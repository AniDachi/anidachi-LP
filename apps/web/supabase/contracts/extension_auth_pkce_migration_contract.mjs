import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const container = process.env.EXTENSION_AUTH_DB_CONTAINER;
assert.ok(container, "EXTENSION_AUTH_DB_CONTAINER is required");

const userId = "88888888-8888-4888-8888-888888888881";
const legacyCodeHash = "1".repeat(64);
const secondLegacyCodeHash = "3".repeat(64);
const psqlArgs = [
  "exec",
  container,
  "psql",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-qAt",
];

function query(sql) {
  return execFileSync("docker", [...psqlArgs, "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

query(`
  delete from public.users where id = '${userId}'::uuid;
  insert into public.users (id, email, display_name)
  values ('${userId}', 'extension-migration-contract@example.test', 'Extension migration');
  drop function if exists public.create_extension_auth_code_v1(uuid,text,text,text,text,text,text);
  drop function if exists public.consume_extension_auth_code_v1(text,text,text,text,text);
  alter table public.extension_auth_codes
    drop constraint if exists extension_auth_codes_binding_completeness_check,
    drop constraint if exists extension_auth_codes_code_hash_check,
    drop constraint if exists extension_auth_codes_state_hash_check,
    drop constraint if exists extension_auth_codes_extension_id_check,
    drop constraint if exists extension_auth_codes_redirect_uri_check,
    drop constraint if exists extension_auth_codes_code_challenge_check,
    drop constraint if exists extension_auth_codes_code_challenge_method_check,
    drop constraint if exists extension_auth_codes_expiry_check,
    drop constraint if exists extension_auth_codes_consumed_check,
    drop column if exists extension_id,
    drop column if exists code_challenge,
    drop column if exists code_challenge_method;
  insert into public.extension_auth_codes (
    user_id, code_hash, state_hash, redirect_uri, expires_at
  ) values (
    '${userId}', '${legacyCodeHash}', repeat('2', 64),
    'https://legacy.chromiumapp.org/auth',
    pg_catalog.clock_timestamp() + interval '5 minutes'
  );
`);

try {
  const migration = readFileSync(
    new URL("../migrations/20260818192007_extension_auth_pkce.sql", import.meta.url),
    "utf8",
  );
  const applied = spawnSync("docker", ["exec", "-i", ...psqlArgs.slice(1)], {
    input: migration,
    encoding: "utf8",
  });
  assert.equal(applied.status, 0, `${applied.stdout}\n${applied.stderr}`);

  assert.equal(
    query(`
      select pg_catalog.count(*)
      from public.extension_auth_codes
      where code_hash = '${legacyCodeHash}'
        and extension_id is null
        and code_challenge is null
        and code_challenge_method is null
    `),
    "1",
    "the migration must preserve a pre-existing legacy authorization row",
  );

  query(`
    insert into public.extension_auth_codes (
      user_id, code_hash, state_hash, redirect_uri, expires_at
    ) values (
      '${userId}', '${secondLegacyCodeHash}', repeat('4', 64),
      'https://legacy.chromiumapp.org/auth',
      pg_catalog.clock_timestamp() + interval '5 minutes'
    )
  `);
  assert.equal(
    query(`
      select pg_catalog.count(*)
      from public.extension_auth_codes
      where user_id = '${userId}'::uuid and extension_id is null
    `),
    "2",
    "the old runtime direct-insert shape must remain structurally available",
  );
  console.log("Extension auth migration compatibility contract passed");
} finally {
  query(`delete from public.users where id = '${userId}'::uuid`);
}
