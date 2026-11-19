"""Open a protected main-to-staging PR only when the released files need reconciliation."""
import json
import os
import subprocess

REPO = "AniDachi/anidachi-LP"
TITLE = "Sync released main into staging"


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def api(path, *options):
    return json.loads(run("gh", "api", f"repos/{REPO}/{path}", *options))


def fetch_heads():
    # Take both tips from the same fetch, including on reruns of an older event.
    run("git", "-c", "credential.helper=", "-c", "credential.https://github.com.helper=!gh auth git-credential",
        "fetch", "--atomic", "--quiet", "--no-tags", "origin",
        "+refs/heads/main:refs/remotes/origin/main", "+refs/heads/staging:refs/remotes/origin/staging")
    main, staging = run("git", "rev-parse", "refs/remotes/origin/main", "refs/remotes/origin/staging").splitlines()
    return main, staging


def needs_sync(main, staging):
    # A direct diff would include unfinished staging work. Compare the result of
    # bringing main into staging against the current staging tree instead.
    merge = subprocess.run(["git", "merge-tree", "--write-tree", "--no-messages", staging, main],
                           stdout=subprocess.PIPE, text=True)
    if merge.returncode == 1:
        return True  # Conflicts need a protected PR even if Git produced a tree.
    merge.check_returncode()
    return merge.stdout.strip() != run("git", "rev-parse", f"{staging}^{{tree}}")


def is_main_to_staging(pr):
    base, head = pr["base"], pr["head"]
    return (base["ref"] == "staging" and head["ref"] == "main"
            and (base.get("repo") or {}).get("full_name") == REPO
            and (head.get("repo") or {}).get("full_name") == REPO)


def open_sync_pr():
    prs = api("pulls?state=open&base=staging&head=AniDachi:main")
    return next((pr for pr in prs if is_main_to_staging(pr)), None)


def is_bot_sync(pr):
    return pr["user"]["login"] == "github-actions[bot]" and pr["title"] == TITLE


def reconcile():
    for _ in range(3):
        main, staging = fetch_heads()
        needed = needs_sync(main, staging)
        pr = open_sync_pr()
        if not needed and (not pr or not is_bot_sync(pr)):
            print("Staging already contains the released file changes. No sync PR needed.")
            return
        if needed and pr:
            print(f"Released changes or conflicts are tracked in staging PR #{pr['number']}.")
            return

        runs = api(f"actions/workflows/ci.yml/runs?branch=main&event=push&head_sha={main}&per_page=1")["workflow_runs"]
        if not runs or runs[0]["conclusion"] != "success":
            print(f"Waiting for successful push CI on main {main}.")
            return
        if not needed:
            current = api(f"pulls/{pr['number']}")
            if current["state"] != "open" or not is_main_to_staging(current) or not is_bot_sync(current):
                return
        if fetch_heads() != (main, staging):
            continue

        if needed:
            try:
                created = api("pulls", "--method", "POST", "-f", "base=staging", "-f", "head=main",
                              "-f", f"title={TITLE}", "-f",
                              "body=Bringing published main into staging would change files or requires conflict resolution. "
                              "Review the changes through the usual staging checks.")
            except subprocess.CalledProcessError:
                # Another actor may have opened the same PR or advanced a branch.
                if open_sync_pr():
                    return
                if fetch_heads() != (main, staging):
                    continue
                raise
            print(f"Opened staging reconciliation PR #{created['number']}.")
        else:
            api(f"pulls/{pr['number']}", "--method", "PATCH", "-f", "state=closed")
            print(f"Closed redundant bot sync PR #{pr['number']} without merging.")
        return
    raise RuntimeError("Release branches kept moving during reconciliation. Retry with the latest tips.")


if __name__ == "__main__":
    if os.environ["GITHUB_REPOSITORY"] != REPO or os.environ["GITHUB_REF_NAME"] not in {"main", "staging"}:
        raise ValueError("Unexpected sync source")
    reconcile()
