import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const container = process.env.EXTENSION_AUTH_DB_CONTAINER;
assert.ok(container, "EXTENSION_AUTH_DB_CONTAINER is required");

const userId = "88888888-8888-4888-8888-888888888882";
const codeHash = "5".repeat(64);
const stateHash = "6".repeat(64);
const clientId = "ndkfphbchhfephdodcpehdcoclojagje";
const redirectUri = `https://${clientId}.chromiumapp.org/auth`;
const challenge = "c".repeat(43);
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

function start(sql) {
  const child = spawn("docker", [...psqlArgs, "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  return { completion };
}

async function waitForActivity(applicationName, predicateSql) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const count = query(`
      select pg_catalog.count(*)
      from pg_catalog.pg_stat_activity
      where application_name = '${applicationName}' and (${predicateSql})
    `);
    if (count === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${applicationName} did not reach the expected database state`);
}

const consumeSql = `public.consume_extension_auth_code_v1(
  '${codeHash}', '${stateHash}', '${clientId}', '${redirectUri}', '${challenge}'
)`;

query(`
  delete from public.users where id = '${userId}'::uuid;
  insert into public.users (id, email, display_name)
  values ('${userId}', 'extension-concurrency-contract@example.test', 'Extension concurrency');
  set role service_role;
  select public.create_extension_auth_code_v1(
    '${userId}', '${codeHash}', '${stateHash}', '${clientId}',
    '${redirectUri}', '${challenge}', 'S256'
  );
`);

try {
  const first = start(`
    begin;
    set application_name = 'extension_auth_consumer_one';
    set role service_role;
    select 'result=' || coalesce((${consumeSql})::text, 'NULL');
    select pg_catalog.pg_sleep(2);
    commit;
  `);
  await waitForActivity(
    "extension_auth_consumer_one",
    "wait_event_type = 'Timeout' and wait_event = 'PgSleep'",
  );

  const second = start(`
    begin;
    set application_name = 'extension_auth_consumer_two';
    set role service_role;
    select 'result=' || coalesce((${consumeSql})::text, 'NULL');
    commit;
  `);
  await waitForActivity("extension_auth_consumer_two", "wait_event_type = 'Lock'");

  const [firstResult, secondResult] = await Promise.all([
    first.completion,
    second.completion,
  ]);
  assert.equal(firstResult.code, 0, firstResult.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.match(firstResult.stdout, new RegExp(`result=${userId}`));
  assert.match(secondResult.stdout, /result=NULL/);
  assert.equal(
    query(`
      select pg_catalog.count(*)
      from public.extension_auth_codes
      where code_hash = '${codeHash}'
    `),
    "0",
    "the exactly-once successful consumption must delete the code row",
  );
  console.log("Extension auth concurrent single-consumption contract passed");
} finally {
  query(`delete from public.users where id = '${userId}'::uuid`);
}
