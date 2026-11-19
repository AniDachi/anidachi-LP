"""Apply pending migrations to the Supabase project assigned to this GitHub branch."""
import json
import os
import subprocess
from contextlib import closing
from http.client import HTTPSConnection
from pathlib import Path
from urllib.parse import quote


TARGETS = {
    "refs/heads/staging": ("cyppqpprkygjloyfvvvj", "aws-1-ap-southeast-1.pooler.supabase.com"),
    "refs/heads/main": ("bynsjjxzatxndzjkogim", "aws-1-us-west-1.pooler.supabase.com"),
}
CA_CERT = Path(__file__).resolve().parents[1] / ".github" / "supabase-db-ca.crt"


def temporary_login(project, token):
    with closing(HTTPSConnection("api.supabase.com", timeout=30)) as api:
        api.request("POST", f"/v1/projects/{project}/cli/login-role",
                    body=b'{"read_only":false}',
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        response = api.getresponse()
        if response.status != 201:
            raise SystemExit(f"Supabase refused temporary migration access (HTTP {response.status})")
        credentials = json.load(response)
    if not credentials.get("role") or not credentials.get("password"):
        raise SystemExit("Supabase returned incomplete temporary credentials")
    return credentials["role"], credentials["password"]


def deploy():
    ref = os.environ.get("GITHUB_REF")
    if os.environ.get("GITHUB_REPOSITORY") != "AniDachi/anidachi-LP" or ref not in TARGETS:
        raise SystemExit("Database migrations require the AniDachi staging or main branch")
    project, host = TARGETS[ref]
    cli_env = os.environ.copy()
    token = cli_env.pop("SUPABASE_MIGRATIONS_TOKEN", "")
    if not token:
        raise SystemExit("Set SUPABASE_MIGRATIONS_TOKEN in the selected GitHub environment")
    role, password = temporary_login(project, token)
    if os.environ.get("GITHUB_ACTIONS") == "true":
        masked = password.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print(f"::add-mask::{masked}", flush=True)
    cli_env.update(PGPASSWORD=password, PGSSLROOTCERT=str(CA_CERT), PGSSLMODE="verify-full")
    database = f"postgresql://{quote(role, safe='')}.{project}@{host}:5432/postgres?sslmode=verify-full"
    command = ["supabase", "--workdir", "apps/web", "db", "push", "--db-url", database]
    subprocess.run([*command, "--dry-run"], env=cli_env, check=True)
    subprocess.run(command, env=cli_env, check=True)


if __name__ == "__main__":
    deploy()
