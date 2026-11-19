import os
import subprocess
from io import BytesIO
from unittest import TestCase, mock

import deploy_db_migrations as migrations


class MigrationRelease(TestCase):
    def environment(self, ref):
        return mock.patch.dict(os.environ, {
            "GITHUB_REPOSITORY": "AniDachi/anidachi-LP",
            "GITHUB_REF": ref,
            "SUPABASE_MIGRATIONS_TOKEN": "example-project-token",
        }, clear=True)

    def test_temporary_access_and_cli_stay_with_the_selected_project(self):
        targets = {
            "staging": ("cyppqpprkygjloyfvvvj", "aws-1-ap-southeast-1.pooler.supabase.com"),
            "main": ("bynsjjxzatxndzjkogim", "aws-1-us-west-1.pooler.supabase.com"),
        }
        for branch, (project, host) in targets.items():
            with self.subTest(branch=branch), self.environment(f"refs/heads/{branch}"), \
                    mock.patch.object(migrations, "HTTPSConnection") as connection, \
                    mock.patch.object(migrations.subprocess, "run") as cli:
                response = BytesIO(b'{"role":"cli_login_postgres","password":"example-session-password"}')
                response.status = 201
                connection.return_value.getresponse.return_value = response
                migrations.deploy()
                connection.assert_called_once_with("api.supabase.com", timeout=30)
                connection.return_value.request.assert_called_once_with(
                    "POST", f"/v1/projects/{project}/cli/login-role", body=b'{"read_only":false}',
                    headers={"Authorization": "Bearer example-project-token", "Content-Type": "application/json"})
                preview, apply = cli.call_args_list
                self.assertEqual(preview.args[0], [*apply.args[0], "--dry-run"])
                self.assertEqual(apply.args[0][-1],
                                 f"postgresql://cli_login_postgres.{project}@{host}:5432/postgres?sslmode=verify-full")
                for call in (preview, apply):
                    env = call.kwargs["env"]
                    self.assertTrue(call.kwargs["check"])
                    self.assertNotIn("SUPABASE_MIGRATIONS_TOKEN", env)
                    self.assertEqual(env["PGSSLROOTCERT"], str(migrations.CA_CERT))
                    self.assertEqual(env["PGPASSWORD"], "example-session-password")
                    self.assertNotIn(env["PGPASSWORD"], " ".join(call.args[0]))

    def test_topic_and_tag_cannot_request_database_access(self):
        for ref in ("refs/heads/topic", "refs/tags/main", "refs/pull/1/merge"):
            with self.subTest(ref=ref), self.environment(ref), \
                    mock.patch.object(migrations, "temporary_login") as login:
                with self.assertRaises(SystemExit):
                    migrations.deploy()
                login.assert_not_called()

    def test_old_repository_secrets_cannot_replace_a_missing_environment_token(self):
        with self.environment("refs/heads/main"), mock.patch.object(migrations, "temporary_login") as login:
            del os.environ["SUPABASE_MIGRATIONS_TOKEN"]
            os.environ.update(SUPABASE_ACCESS_TOKEN="unused", PRODUCTION_DB_PASSWORD="unused")
            with self.assertRaisesRegex(SystemExit, "SUPABASE_MIGRATIONS_TOKEN"):
                migrations.deploy()
            login.assert_not_called()

    def test_denied_login_and_failed_preview_stop_before_apply(self):
        with self.environment("refs/heads/staging"), mock.patch.object(migrations, "HTTPSConnection") as conn, \
                mock.patch.object(migrations.subprocess, "run") as cli:
            conn.return_value.getresponse.return_value.status = 403
            with self.assertRaisesRegex(SystemExit, "HTTP 403"):
                migrations.deploy()
            cli.assert_not_called()
            with mock.patch.object(migrations, "temporary_login", return_value=("role", "placeholder")):
                cli.side_effect = subprocess.CalledProcessError(1, "preview")
                with self.assertRaises(subprocess.CalledProcessError):
                    migrations.deploy()
                self.assertEqual(cli.call_count, 1)
                self.assertEqual(cli.call_args.args[0][-1], "--dry-run")
