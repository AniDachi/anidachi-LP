"""Reconcile published main back into staging through a protected pull request."""
import json
import os
import subprocess
import sys
import time

REPO = "AniDachi/anidachi-LP"


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def api(path, *options):
    return json.loads(run("gh", "api", f"repos/{REPO}/{path}", *options))


def outputs(**values):
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        for name, value in values.items():
            print(f"{name}={value}", file=stream)


def validate(pr):
    if (pr["base"]["ref"] != "staging" or pr["head"]["ref"] != "main"
            or pr["base"]["repo"]["full_name"] != REPO or pr["head"]["repo"]["full_name"] != REPO):
        raise ValueError("Refusing any target except main into staging in this repository")
    stage, main = pr["base"]["sha"], pr["head"]["sha"]
    if not pr["mergeable"] or not pr.get("merge_commit_sha"):
        raise ValueError("The sync has conflicts or its merge commit is unavailable")
    merge = pr["merge_commit_sha"]
    run("git", "fetch", "--quiet", "origin", f"refs/pull/{pr['number']}/merge")
    if run("git", "show", "-s", "--format=%P", merge).split() != [stage, main]:
        raise ValueError("The sync PR changed while GitHub prepared the merge result")
    if run("git", "rev-parse", merge + "^{tree}") != run("git", "rev-parse", stage + "^{tree}"):
        raise ValueError("Sync would change staging content; resolve the open sync PR")
    return merge


def plan():
    comparison = api("compare/main...staging")
    if not comparison["behind_by"]:
        outputs(needed="false")
        return
    # A concurrent push to staging can arrive before CI on the released main.
    # Its successful workflow_run will trigger another sync without a manual retry.
    main = comparison["base_commit"]["sha"]
    runs = api(f"actions/workflows/ci.yml/runs?branch=main&event=push&head_sha={main}&per_page=1")["workflow_runs"]
    if not runs or runs[0]["conclusion"] != "success":
        print(f"Waiting for push CI on main {main} before syncing staging.")
        outputs(needed="false")
        return
    prs = api("pulls?state=open&base=staging&head=AniDachi:main")
    pr = prs[0] if prs else api("pulls", "--method", "POST", "-f", "base=staging", "-f", "head=main",
                                "-f", "title=Sync released main into staging",
                                "-f", "body=This PR brings published commits back into the shared test branch after CI.")
    for _ in range(25):
        pr = api(f"pulls/{pr['number']}")
        if pr["merged"] or pr["state"] != "open" or pr["head"]["sha"] != main:
            outputs(needed="false")
            return
        if pr["mergeable"] is not None:
            merge = validate(pr)
            outputs(needed="true", number=pr["number"], merge=merge)
            return
        time.sleep(3)
    raise TimeoutError("GitHub has not computed the staging sync merge")


def finish():
    number, tested = os.environ["SYNC_PR"], os.environ["TESTED_MERGE"]
    if not number.isdecimal():
        raise ValueError("Missing sync PR number")
    pr = api(f"pulls/{number}")
    if pr["merged"]:
        return
    if pr["state"] != "open" or validate(pr) != tested:
        raise ValueError("The sync moved after CI; the latest push must be checked again")
    # CI ran with a read-only token on GitHub's actual test merge. Bot-created
    # PR events can require approval; no permission to approve those is needed.
    api(f"statuses/{tested}", "--method", "POST", "-f", "state=success", "-f", "context=check-and-test",
        "-f", "description=Full CI passed on the exact tree-neutral staging sync",
        "-f", f"target_url=https://github.com/{REPO}/actions/runs/{os.environ['GITHUB_RUN_ID']}")
    for _ in range(40):
        current = api(f"pulls/{number}")
        if current["merged"]:
            return
        if current["state"] != "open" or current["head"]["sha"] != pr["head"]["sha"] or current["base"]["sha"] != pr["base"]["sha"]:
            raise ValueError("The tested sync is stale")
        if current["mergeable_state"] in {"clean", "unstable"}:
            if validate(current) != tested:
                raise ValueError("GitHub changed the tested merge")
            result = api(f"pulls/{number}/merge", "--method", "PUT", "-f", "merge_method=merge", "-f", "sha=" + pr["head"]["sha"])
            if not result.get("merged"):
                raise RuntimeError("GitHub did not merge the staging sync")
            return
        time.sleep(5)
    raise TimeoutError("GitHub still blocks the staging sync PR")


if __name__ == "__main__":
    if os.environ["GITHUB_REPOSITORY"] != REPO or os.environ["GITHUB_REF_NAME"] not in {"main", "staging"}:
        raise ValueError("Unexpected sync source")
    {"plan": plan, "finish": finish}[sys.argv[1]]()
