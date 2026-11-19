import os
import subprocess
import tempfile
import unittest
import importlib.util
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("sync_main", Path(__file__).with_name("sync-released-main.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class StagingSync(unittest.TestCase):
    def test_only_an_exact_tree_neutral_merge_can_target_staging(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args, data=None):
                return subprocess.check_output(["git", *args], cwd=root, input=data, text=True).strip()

            git("init", "--quiet", "-b", "main")
            git("config", "user.name", "Fixture")
            git("config", "user.email", "fixture@example.invalid")
            git("remote", "add", "origin", str(root))
            tree = git("mktree", data="")
            base = git("commit-tree", tree, "-m", "base")
            main = git("commit-tree", tree, "-p", base, "-m", "released")
            stage = git("commit-tree", tree, "-p", base, "-m", "tested")
            merge = git("commit-tree", tree, "-p", stage, "-p", main, "-m", "reconcile")
            git("update-ref", "refs/pull/7/merge", merge)
            repo = {"full_name": sync.REPO}
            pr = {"number": 7, "base": {"ref": "staging", "sha": stage, "repo": repo},
                  "head": {"ref": "main", "sha": main, "repo": repo}, "mergeable": True, "merge_commit_sha": merge}
            with mock.patch.object(sync, "run", side_effect=lambda cmd,*args: git(*args)):
                self.assertEqual(sync.validate(pr), merge)
                with self.assertRaisesRegex(ValueError, "target"):
                    sync.validate(dict(pr, base=dict(pr["base"], ref="main")))
                blob = git("hash-object", "-w", "--stdin", data="changed")
                other = git("mktree", data=f"100644 blob {blob}\tfile\n")
                changed = git("commit-tree", other, "-p", stage, "-p", main, "-m", "changed code")
                git("update-ref", "refs/pull/7/merge", changed)
                with self.assertRaisesRegex(ValueError, "change staging content"):
                    sync.validate(dict(pr, merge_commit_sha=changed))

    def test_no_sync_pr_when_staging_already_contains_main(self):
        with mock.patch.object(sync, "api", return_value={"behind_by": 0}) as api, mock.patch.object(sync, "outputs") as out:
            sync.plan()
            api.assert_called_once_with("compare/main...staging")
            out.assert_called_once_with(needed="false")

    def test_closed_or_changed_sync_cannot_merge(self):
        with mock.patch.dict(os.environ, {"SYNC_PR":"7", "TESTED_MERGE":"old"}), \
             mock.patch.object(sync, "api", return_value={"merged": False, "state": "closed"}) as api:
            with self.assertRaisesRegex(ValueError, "moved"):
                sync.finish()
            api.assert_called_once_with("pulls/7")
