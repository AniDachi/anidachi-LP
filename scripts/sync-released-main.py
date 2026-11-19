"""Only integrate main back into staging through a protected, tree-neutral PR."""
import json
import os
import subprocess
import time


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def gh(path, *options):
    return json.loads(run("gh", "api", "repos/AniDachi/anidachi-LP/" + path, *options))


def sync():
    if os.environ["GITHUB_REPOSITORY"] != "AniDachi/anidachi-LP" or os.environ["GITHUB_REF_NAME"] not in {"main", "staging"}:
        raise ValueError("Unexpected sync source")
    comparison = gh("compare/main...staging")
    if not comparison["behind_by"]:
        return
    prs = gh("pulls?state=open&base=staging&head=AniDachi:main")
    pr = prs[0] if prs else gh("pulls", "--method", "POST", "-f", "base=staging", "-f", "head=main",
                               "-f", "title=Sync released main into staging", "-f", "body=Bring the published commits into the shared test branch after CI.")
    for _ in range(65):
        pr = gh(f"pulls/{pr['number']}")
        if pr["merged"] or pr["state"] != "open":
            return
        if pr["base"]["ref"] != "staging" or pr["head"]["ref"] != "main" or pr["head"]["repo"]["full_name"] != "AniDachi/anidachi-LP":
            raise ValueError("Sync target changed")
        stage, main = pr["base"]["sha"], pr["head"]["sha"]
        run("git", "fetch", "--quiet", "origin", stage, main)
        merged_tree = run("git", "merge-tree", "--write-tree", stage, main)
        if merged_tree != run("git", "rev-parse", stage + "^{tree}"):
            raise ValueError("Sync changes staging content; resolve the open sync PR")
        if pr["mergeable_state"] in {"clean", "unstable"}:
            result = gh(f"pulls/{pr['number']}/merge", "--method", "PUT", "-f", "merge_method=merge", "-f", "sha=" + main)
            if not result.get("merged"):
                raise RuntimeError("GitHub did not merge the staging sync")
            return
        if pr["mergeable"] is False:
            raise ValueError("Resolve the conflict on the staging sync PR")
        time.sleep(15)
    raise TimeoutError("Staging sync is still waiting for GitHub checks")


if __name__ == "__main__":
    sync()
