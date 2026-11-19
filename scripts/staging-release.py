"""Promote one verified topic. Only the publish job receives write permissions."""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

REPO = "AniDachi/anidachi-LP"
STAGE = "https://staging.anidachi.app"
RUN = f"https://github.com/{REPO}/actions/runs/{os.getenv('GITHUB_RUN_ID', '')}"


def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()


def api(path, *args):
    return json.loads(run("gh", "api", f"repos/{REPO}/{path}", *args) or "null")


def paths_between(left, right):
    raw = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", left, right])
    return {os.fsdecode(name) for name in raw.split(b"\0") if name}


def ancestor(old, new):
    result = subprocess.run(["git", "merge-base", "--is-ancestor", old, new])
    if result.returncode > 1:
        raise RuntimeError("Could not verify Git ancestry")
    return result.returncode == 0


def profile(paths):
    shared = any(p.startswith("packages/") or p in {"pnpm-lock.yaml", "package.json", "pnpm-workspace.yaml"} for p in paths)
    worker = shared or any(p.startswith(("apps/api/", "scripts/worker-deploy-gate", ".github/workflows/deploy-api")) for p in paths)
    extension = shared or any(p.startswith(("apps/extension/", "scripts/validate-extension", "scripts/build-extension", ".github/workflows/build-extension")) for p in paths)
    return {"worker": worker, "extension": extension,
            "media": worker or any(p.startswith(("tests/e2e/", "apps/extension/src/p2p", "apps/extension/src/room-client")) for p in paths),
            "db": any(p.startswith(("apps/web/supabase/", ".github/workflows/db-")) for p in paths)}


def feature_at(staged):
    if os.environ.get("GITHUB_REPOSITORY") != REPO or os.environ.get("GITHUB_REF") != "refs/heads/staging":
        raise ValueError("Only the protected staging branch can accept a topic")
    parents = run("git", "show", "-s", "--format=%P", staged).split()
    prs = api(f"commits/{staged}/pulls?per_page=100")
    matched = [p for p in prs if p["merged_at"] and p["merge_commit_sha"] == staged
               and p["base"]["ref"] == "staging" and p["base"]["repo"]["full_name"] == REPO]
    if len(matched) != 1 or len(parents) != 2:
        raise ValueError("Expected one merged staging PR with its original second parent")
    pr = matched[0]
    branch, topic = pr["head"]["ref"], parents[1]
    if not pr["head"]["repo"] or pr["head"]["repo"]["full_name"] != REPO or pr["head"]["sha"] != topic:
        raise ValueError("Staged PR head does not match this repository and merge")
    if branch == "main":
        return None
    if branch == "staging" or branch.startswith("backup/"):
        raise ValueError("Shared branches cannot be released as a feature")
    main = api("git/ref/heads/main")["object"]["sha"]
    if not ancestor(main, topic):
        raise ValueError("Update the feature with current main, then stage that revision")
    staging_history = run("git", "rev-list", "--first-parent", parents[0], "^" + main).split()
    feature_history = set(run("git", "rev-list", topic, "^" + main).split())
    if not feature_history or feature_history.intersection(staging_history):
        raise ValueError("The feature must be independent of unreleased staging merges")
    paths = paths_between(main, topic)
    if not paths:
        raise ValueError("The feature has no independent changes")
    return pr["number"], branch, topic, paths


def branch_tip(branch):
    return api("branches/" + quote(branch, safe=""))["commit"]["sha"]


def output(**values):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        for key, value in values.items():
            print(f"{key}={str(value).lower() if isinstance(value, bool) else value}", file=stream)


def select():
    item = feature_at(os.environ["GITHUB_SHA"])
    if item is None:
        output(release=False)
        return
    number, _, sha, paths = item
    output(release=True, topic=sha, number=number, **profile(paths))


def stage_header():
    # Never send the staging password to a redirect or deployment-provided URL.
    raw = run("curl", "--silent", "--show-error", "--fail", "--max-time", "15",
              "--dump-header", "-", "--output", "/dev/null", f"{STAGE}/robots.txt?release={time.time_ns()}")
    matches = re.findall(r"^x-anidachi-staging-commit:\s*([a-f0-9]{40})\s*$", raw, re.M | re.I)
    return matches[-1] if matches else None


def successful_run(workflow, sha, dispatch, requested):
    runs = api(f"actions/workflows/{workflow}/runs?head_sha={sha}&per_page=100")["workflow_runs"]
    allowed = [r for r in runs if r["head_branch"] == "staging" and r["event"] in {"push", "workflow_dispatch"}]
    if allowed:
        latest = max(allowed, key=lambda r: (r["run_number"], r["run_attempt"]))
        if latest["status"] != "completed":
            return False
        if latest["conclusion"] != "success":
            raise ValueError(f"{workflow} {latest['html_url']}: {latest['conclusion']}")
        if workflow == "build-extension.yml":
            artifacts = api(f"actions/runs/{latest['id']}/artifacts")["artifacts"]
            if not any(a["name"] == "anidachi-extension-staging" and not a["expired"] for a in artifacts):
                raise ValueError("The checked staging extension ZIP is missing")
        return True
    key = workflow, sha
    if dispatch and key not in requested and branch_tip("staging") == sha:
        api(f"actions/workflows/{workflow}/dispatches", "--method", "POST", "-f", "ref=staging")
        requested.add(key)
    return False


def serve_same_content(verified, current):
    if verified == current:
        return True
    if not verified or not re.fullmatch("[a-f0-9]{40}", verified):
        return False
    # A tree-identical integration merge can reuse the actual deployment.
    if subprocess.run(["git", "cat-file", "-e", verified + "^{commit}"], stderr=subprocess.DEVNULL).returncode:
        return False
    return ancestor(verified, current) and run("git", "rev-parse", verified + "^{tree}") == run("git", "rev-parse", current + "^{tree}")


def verify_live():
    staged = os.environ["GITHUB_SHA"]
    _, branch, topic, paths = feature_at(staged)
    required = profile(paths)
    if not os.environ.get("STAGING_ACCESS_CODE"):
        raise ValueError("The staging smoke needs its environment credential")
    requested = set()
    for _ in range(100):
        if branch_tip(branch) != topic:
            raise ValueError("A newer topic revision needs staging acceptance")
        current = branch_tip("staging")
        run("git", "fetch", "--quiet", "origin", current)
        if not ancestor(staged, current) or paths.intersection(paths_between(staged, current)):
            raise ValueError("Another staging change modified the same files; stage the current topic again")
        workflows = [("ci.yml", False)]
        if required["db"]:
            workflows.append(("db-staging.yml", False))
        if required["worker"]:
            workflows.append(("deploy-api.yml", True))
        if required["extension"]:
            workflows.append(("build-extension.yml", True))
        checks = [successful_run(w, current, dispatch, requested) for w, dispatch in workflows]
        served = stage_header()
        if all(checks) and serve_same_content(served, current):
            # Only trusted staged code runs here, and subprocesses do not receive a GitHub write token.
            smoke_env = dict(os.environ, STAGING_WEB_HTTP_BASE=STAGE)
            smoke_env.pop("GH_TOKEN", None)
            run("node", "scripts/smoke-staging-web.mjs", env=smoke_env)
            if required["worker"]:
                run("node", "scripts/smoke-worker.mjs", env={"PATH": os.environ["PATH"]})
            if stage_header() == served and branch_tip("staging") == current:
                print(f"Topic {topic}, merged at {staged}, tested on staging {current}, served by {served}.")
                output(accepted=current)
                return
        time.sleep(15)
    raise TimeoutError("No successful live staging acceptance for this revision")


def publish():
    staged = os.environ["GITHUB_SHA"]
    number, branch, topic, _ = feature_at(staged)
    accepted = os.environ["ACCEPTED_SHA"]
    if not re.fullmatch("[a-f0-9]{40}", accepted) or branch_tip(branch) != topic:
        raise ValueError("The tested revision is no longer the topic head")
    body = (f"Staging PR #{number} tested this branch at `{topic}`. "
            f"The accepted shared staging build was `{accepted}`.\n\n[Checks and live smoke]({RUN}). "
            "The author decides when to merge.")
    open_prs = api("pulls?state=open&base=main&head=" + quote(REPO.split("/")[0] + ":" + branch, safe=""))
    if not open_prs:
        pr = api("pulls", "--method", "POST", "-f", "base=main", "-f", "head=" + branch,
                 "-f", f"title=Release {branch}", "-f", "body=" + body)
    else:
        pr = open_prs[0]
    if pr["head"]["sha"] != topic or pr["base"]["ref"] != "main":
        raise ValueError("Release PR moved during acceptance")
    # Record the tested topic on GitHub's deployment timeline. Other topics can
    # keep their own successful deployment in this same staging environment.
    receipt = {"ref": topic, "task": "deploy", "environment": "staging-acceptance",
               "description": f"Accepted staging PR #{number} at {accepted[:12]}",
               "auto_merge": False, "required_contexts": [], "production_environment": False,
               "payload": {"staging_merge": staged, "accepted_staging": accepted, "run": RUN}}
    prior = api(f"deployments?sha={topic}&environment=staging-acceptance&per_page=100")
    deployment = next((d for d in prior if d.get("task") == "deploy" and d.get("payload") == receipt["payload"]), None)
    if not deployment:
        deployment = json.loads(run("gh", "api", f"repos/{REPO}/deployments", "--method", "POST",
                                    "--input", "-", input=json.dumps(receipt)))
    if deployment["sha"] != topic:
        raise ValueError("Deployment does not identify the tested topic")
    api(f"deployments/{deployment['id']}/statuses", "--method", "POST", "-f", "state=success",
        "-f", "environment_url=" + STAGE, "-f", "log_url=" + RUN, "-F", "auto_inactive=false")
    for context in ("isolated-release-ci", "tested-on-staging"):
        api("statuses/" + topic, "--method", "POST", "-f", "state=success", "-f", "context=" + context,
            "-f", "description=" + f"PR #{number}, staging {accepted[:12]}, topic {topic[:12]}", "-f", "target_url=" + RUN)
    print(pr["html_url"], RUN)


if __name__ == "__main__":
    {"select": select, "live": verify_live, "publish": publish}[sys.argv[1]]()
