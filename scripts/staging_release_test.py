import importlib.util
from pathlib import Path
from unittest import TestCase, main, mock

spec = importlib.util.spec_from_file_location("staging_release", Path(__file__).with_name("staging-release.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class StagingAcceptance(TestCase):
    def test_seo_is_independent_from_prime_checks(self):
        self.assertFalse(any(gate.profile({"apps/web/app/robots.ts"}).values()))
        prime = gate.profile({"apps/extension/entrypoints/primevideo.content.ts", "packages/protocol/src/prime.ts",
                              "apps/web/supabase/migrations/20261116_prime.sql"})
        self.assertTrue(all(prime.values()))

    def test_a_feature_workflow_cannot_enter_the_publisher(self):
        with mock.patch.dict(gate.os.environ, {"GITHUB_REF": "refs/heads/topic", "GITHUB_REPOSITORY": gate.REPO}):
            with self.assertRaisesRegex(ValueError, "protected staging"):
                gate.feature_at("a" * 40)

    def test_unmerged_or_different_topic_cannot_receive_a_receipt(self):
        staged, topic = "a" * 40, "b" * 40
        pr = {"merged_at": None, "merge_commit_sha": staged, "base": {"ref": "staging", "repo": {"full_name": gate.REPO}},
              "head": {"ref": "codex/seo", "sha": "c" * 40, "repo": {"full_name": gate.REPO}}}
        with mock.patch.dict(gate.os.environ, {"GITHUB_REF": "refs/heads/staging", "GITHUB_REPOSITORY": gate.REPO}), \
             mock.patch.object(gate, "run", return_value="first " + topic), mock.patch.object(gate, "api", return_value=[pr]):
            with self.assertRaisesRegex(ValueError, "merged staging PR"):
                gate.feature_at(staged)
            pr["merged_at"] = "2026-11-01"
            with self.assertRaisesRegex(ValueError, "does not match"):
                gate.feature_at(staged)

    def test_wrong_branch_skipped_build_and_missing_zip_are_never_green(self):
        for branch, state, conclusion in [("main", "completed", "success"), ("staging", "completed", "skipped"),
                                          ("staging", "in_progress", None), ("staging", "completed", "success")]:
            with self.subTest(branch=branch, conclusion=conclusion):
                build = {"head_branch": branch, "event": "push", "run_number": 1, "run_attempt": 1, "id": 1,
                         "status": state, "conclusion": conclusion, "html_url": "run"}
                with mock.patch.object(gate, "api", side_effect=[{"workflow_runs": [build]}, {"artifacts": []}]):
                    if branch == "staging" and state == "completed":
                        with self.assertRaises(ValueError):
                            gate.successful_run("build-extension.yml", "abc", False, set())
                    else:
                        self.assertFalse(gate.successful_run("build-extension.yml", "abc", False, set()))

    def test_missing_deployment_revision_cannot_pass(self):
        self.assertFalse(gate.serve_same_content(None, "a" * 40))


if __name__ == "__main__":
    main()
