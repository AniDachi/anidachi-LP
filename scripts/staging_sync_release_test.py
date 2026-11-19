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

    def test_staging_push_defers_to_the_matching_main_ci_completion(self):
        comparison = {"behind_by": 1, "base_commit": {"sha": "released"}}
        expected = "actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=released&per_page=1"
        for runs in ([], [{"conclusion": None}], [{"conclusion": "failure"}]):
            with self.subTest(runs=runs), \
                 mock.patch.object(sync, "api", side_effect=[comparison, {"workflow_runs": runs}]) as api, \
                 mock.patch.object(sync, "outputs") as out:
                sync.plan()
                self.assertEqual(api.call_args_list, [mock.call("compare/main...staging"), mock.call(expected)])
                out.assert_called_once_with(needed="false")

        pr = {"number": 7, "merged": False, "state": "open", "head": {"sha": "released"}, "mergeable": True}
        for current, needed in ((pr, True), (dict(pr, head={"sha": "newer"}), False)):
            with self.subTest(head=current["head"]), \
                 mock.patch.object(sync, "api", side_effect=[comparison, {"workflow_runs": [{"conclusion": "success"}]}, [pr], current]), \
                 mock.patch.object(sync, "validate", return_value="tested-merge") as validate, \
                 mock.patch.object(sync, "outputs") as out:
                sync.plan()
                if needed:
                    validate.assert_called_once_with(current)
                    out.assert_called_once_with(needed="true", number=7, merge="tested-merge")
                else:
                    validate.assert_not_called()
                    out.assert_called_once_with(needed="false")

    def test_closed_or_changed_sync_cannot_merge(self):
        with mock.patch.dict(os.environ, {"SYNC_PR":"7", "TESTED_MERGE":"old"}), \
             mock.patch.object(sync, "api", return_value={"merged": False, "state": "closed"}) as api:
            with self.assertRaisesRegex(ValueError, "moved"):
                sync.finish()
            api.assert_called_once_with("pulls/7")
