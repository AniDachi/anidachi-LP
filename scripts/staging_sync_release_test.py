import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location("sync_main", Path(__file__).with_name("sync-released-main.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

OPEN_PRS = "pulls?state=open&base=staging&head=AniDachi:main"
GREEN = {"workflow_runs": [{"conclusion": "success"}]}


def sync_pr(author="github-actions[bot]"):
    repo = {"full_name": sync.REPO}
    return {"number": 7, "state": "open", "title": sync.TITLE, "user": {"login": author},
            "base": {"ref": "staging", "repo": repo}, "head": {"ref": "main", "repo": repo}}


class StagingSync(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.addCleanup(os.chdir, os.getcwd())
        os.chdir(tmp.name)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.name", "Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("remote", "add", "origin", tmp.name)
        self.commit_file("shared", "baseline")
        self.git("branch", "staging")

    def git(self, *args):
        return subprocess.check_output(["git", *args], text=True).strip()

    def commit_file(self, name, value):
        Path(name).write_text(value + "\n", encoding="utf-8")
        self.git("add", "--", name)
        self.git("commit", "-qm", value)

    def test_normal_release_with_unpublished_staging_work_needs_no_pr(self):
        self.git("switch", "-qc", "feature")
        self.commit_file("website", "ready")
        self.git("switch", "-q", "staging")
        self.commit_file("extension", "unfinished")
        self.git("merge", "--no-ff", "-qm", "stage feature", "feature")
        self.git("switch", "-q", "main")
        self.git("merge", "--no-ff", "-qm", "release feature", "feature")
        main, staging = sync.fetch_heads()
        self.assertEqual((main, staging), (self.git("rev-parse", "main"), self.git("rev-parse", "staging")))
        self.assertNotEqual(self.git("merge-base", main, staging), main)
        self.assertEqual(self.git("diff", "--name-only", main, staging), "extension")
        with mock.patch.object(sync, "api", return_value=[]) as api:
            sync.reconcile()
            api.assert_called_once_with(OPEN_PRS)

    def test_real_change_and_conflict_each_open_only_one_review_pr(self):
        for case in ("main-only change", "conflict"):
            with self.subTest(case=case):
                if case == "main-only change":
                    self.commit_file("shared", "released")
                else:
                    self.git("switch", "-q", "staging")
                    self.commit_file("shared", "in progress")
                main, staging = sync.fetch_heads()
                with mock.patch.object(sync, "api", side_effect=[[], GREEN, {"number": 7}, [sync_pr()]]) as api:
                    sync.reconcile()
                    sync.reconcile()
                ci = f"actions/workflows/ci.yml/runs?branch=main&event=push&head_sha={main}&per_page=1"
                self.assertEqual([c.args[0] for c in api.call_args_list], [OPEN_PRS, ci, "pulls", OPEN_PRS])
                post = api.call_args_list[2].args
                self.assertEqual(post[1:7], ("--method", "POST", "-f", "base=staging", "-f", "head=main"))
                self.assertEqual(sync.fetch_heads(), (main, staging))

    def test_real_change_waits_for_ci_on_the_exact_released_main(self):
        self.commit_file("website", "released")
        ci = f"actions/workflows/ci.yml/runs?branch=main&event=push&head_sha={self.git('rev-parse', 'main')}&per_page=1"
        for runs in ([], [{"conclusion": None}], [{"conclusion": "failure"}]):
            with self.subTest(runs=runs), mock.patch.object(sync, "api", side_effect=[[], {"workflow_runs": runs}]) as api:
                sync.reconcile()
                self.assertEqual(api.call_args_list, [mock.call(OPEN_PRS), mock.call(ci)])

    def test_redundant_bot_pr_is_closed_and_never_merged(self):
        pr = sync_pr()
        with mock.patch.object(sync, "api", side_effect=[[pr], GREEN, pr, {}, []]) as api:
            sync.reconcile()
            sync.reconcile()
            mutations = [c for c in api.call_args_list if "--method" in c.args]
            self.assertEqual(mutations, [mock.call("pulls/7", "--method", "PATCH", "-f", "state=closed")])

    def test_other_peoples_prs_forks_and_reverse_direction_stay_untouched(self):
        pr = sync_pr()
        for other in (sync_pr("developer"), dict(pr, title="Manual investigation"),
                      dict(pr, head={"ref": "main", "repo": {"full_name": "fork/project"}}),
                      dict(pr, head={"ref": "main", "repo": None}),
                      dict(pr, head=pr["base"], base=pr["head"])):
            with self.subTest(pr=other), mock.patch.object(sync, "api", return_value=[other]) as api:
                sync.reconcile()
                api.assert_called_once_with(OPEN_PRS)

    def test_retargeted_pr_is_preserved(self):
        pr = sync_pr()
        retargeted = dict(pr, base={"ref": "other", "repo": pr["base"]["repo"]})
        with mock.patch.object(sync, "api", side_effect=[[pr], GREEN, retargeted]) as api:
            sync.reconcile()
            self.assertFalse(any("--method" in c.args for c in api.call_args_list))

    def test_stage_moving_before_create_or_close_recomputes_the_merge(self):
        pr = sync_pr()
        for needed, responses in ((True, [[], GREEN, []]), (False, [[pr], GREEN, pr, [pr]])):
            with self.subTest(needed=needed), \
                 mock.patch.object(sync, "fetch_heads", side_effect=[("main", "old"), ("main", "new"), ("main", "new")]), \
                 mock.patch.object(sync, "needs_sync", side_effect=[needed, not needed]) as compare, \
                 mock.patch.object(sync, "api", side_effect=responses) as api:
                sync.reconcile()
                self.assertEqual(compare.call_args_list, [mock.call("main", "old"), mock.call("main", "new")])
                self.assertFalse(any("--method" in c.args for c in api.call_args_list))

    def test_concurrent_pr_creation_is_idempotent(self):
        self.commit_file("website", "released")
        error = subprocess.CalledProcessError(1, "gh api pulls")
        with mock.patch.object(sync, "api", side_effect=[[], GREEN, error, [sync_pr("developer")]]) as api:
            sync.reconcile()
            self.assertEqual(api.call_args_list[-1], mock.call(OPEN_PRS))
        with mock.patch.object(sync, "api", side_effect=[[], GREEN, error, []]):
            with self.assertRaises(subprocess.CalledProcessError):
                sync.reconcile()

    def test_git_failure_is_not_treated_as_a_merge_conflict(self):
        failed = subprocess.CompletedProcess(["git", "merge-tree"], returncode=128, stdout="")
        with mock.patch.object(sync.subprocess, "run", return_value=failed), self.assertRaises(subprocess.CalledProcessError):
            sync.needs_sync("main", "staging")
