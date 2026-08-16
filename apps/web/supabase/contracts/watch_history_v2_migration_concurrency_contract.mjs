import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

const container = process.env.WATCH_HISTORY_DB_CONTAINER;
assert.ok(container, "WATCH_HISTORY_DB_CONTAINER is required");

const userId = "99999999-9999-4999-8999-999999999991";
const sessionId = "99999999-9999-4999-8999-999999999992";
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
  return { child, completion };
}

async function waitForLock(
  applicationName,
  mode,
  granted,
  relation = "public.user_watch_settings",
) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const count = query(`
      select pg_catalog.count(*)
      from pg_catalog.pg_locks as lock
      inner join pg_catalog.pg_stat_activity as activity
        on activity.pid = lock.pid
      where activity.application_name = '${applicationName}'
        and lock.relation = '${relation}'::regclass
        and lock.mode = '${mode}'
        and lock.granted is ${granted ? "true" : "false"}
    `);
    if (count === "1") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(
    `${applicationName} did not reach ${granted ? "granted" : "waiting"} ${mode}`,
  );
}

query(`
  delete from public.users where id = '${userId}'::uuid;
  insert into public.users (id, email, display_name)
  values ('${userId}', 'watch-v2-lock-contract@example.test', 'Watch V2 Lock Contract');
  insert into public.user_watch_settings (user_id)
  values ('${userId}')
  on conflict (user_id) do nothing;
  insert into public.watch_sessions (
    id, host_user_id, provider, item_key, item_kind, item_title,
    episode_key, episode_title, source_url, schema_version,
    history_generation, client_session_key
  ) values (
    '${sessionId}'::uuid,
    '${userId}'::uuid,
    'crunchyroll',
    'lock-contract-title',
    'series',
    'Lock contract title',
    'lock-contract-episode',
    'Lock contract episode',
    'https://www.crunchyroll.com/watch/lock-contract/demo',
    2,
    1,
    'lock-contract-session'
  )
`);

try {
  let forcedFailure;
  try {
    query(`
      begin;
      create table public.watch_history_v2_atomicity_probe (id integer primary key);
      insert into public.watch_history_v2_atomicity_probe values (1);
      do $$ begin raise exception 'watch_history_v2_forced_migration_failure'; end $$;
      commit
    `);
  } catch (error) {
    forcedFailure = error;
  }
  assert.ok(forcedFailure, "forced mid-migration failure must abort the transaction");
  assert.equal(
    query("select pg_catalog.to_regclass('public.watch_history_v2_atomicity_probe') is null"),
    "t",
    "forced mid-migration failure must roll back earlier DDL and DML",
  );

  const inflight = start(`
    begin;
    set application_name = 'watch_v2_inflight_writer';
    update public.user_watch_settings
    set updated_at = pg_catalog.clock_timestamp()
    where user_id = '${userId}'::uuid;
    select pg_catalog.pg_sleep(3);
    commit
  `);
  await waitForLock("watch_v2_inflight_writer", "RowExclusiveLock", true);

  const inflightSession = start(`
    begin;
    set application_name = 'watch_v2_inflight_session_writer';
    update public.watch_sessions
    set updated_at = pg_catalog.clock_timestamp()
    where id = '${sessionId}'::uuid;
    select pg_catalog.pg_sleep(5);
    commit
  `);
  await waitForLock(
    "watch_v2_inflight_session_writer",
    "RowExclusiveLock",
    true,
    "public.watch_sessions",
  );

  const migration = start(`
    begin;
    set application_name = 'watch_v2_migration_lock';
    set local lock_timeout = '10s';
    lock table public.user_watch_settings,
      public.watch_sessions,
      public.watch_session_participants,
      public.watch_episode_progress
      in share row exclusive mode;
    select pg_catalog.pg_sleep(2);
    commit
  `);
  await waitForLock("watch_v2_migration_lock", "ShareRowExclusiveLock", false);

  const inflightResult = await inflight.completion;
  assert.equal(inflightResult.code, 0, inflightResult.stderr);
  await waitForLock("watch_v2_migration_lock", "ShareRowExclusiveLock", true);
  await waitForLock(
    "watch_v2_migration_lock",
    "ShareRowExclusiveLock",
    false,
    "public.watch_sessions",
  );

  const inflightSessionResult = await inflightSession.completion;
  assert.equal(inflightSessionResult.code, 0, inflightSessionResult.stderr);
  await waitForLock(
    "watch_v2_migration_lock",
    "ShareRowExclusiveLock",
    true,
    "public.watch_sessions",
  );

  const later = start(`
    begin;
    set application_name = 'watch_v2_later_writer';
    update public.user_watch_settings
    set youtube_history_enabled = true,
      updated_at = pg_catalog.clock_timestamp()
    where user_id = '${userId}'::uuid;
    commit
  `);
  await waitForLock("watch_v2_later_writer", "RowExclusiveLock", false);

  const laterSession = start(`
    begin;
    set application_name = 'watch_v2_later_session_writer';
    update public.watch_sessions
    set last_checkpoint_at = '2105-01-01 00:00:00+00'
    where id = '${sessionId}'::uuid;
    commit
  `);
  await waitForLock(
    "watch_v2_later_session_writer",
    "RowExclusiveLock",
    false,
    "public.watch_sessions",
  );

  const migrationResult = await migration.completion;
  assert.equal(migrationResult.code, 0, migrationResult.stderr);
  const laterResult = await later.completion;
  assert.equal(laterResult.code, 0, laterResult.stderr);
  const laterSessionResult = await laterSession.completion;
  assert.equal(laterSessionResult.code, 0, laterSessionResult.stderr);
  assert.equal(
    query(`
      select settings.youtube_history_enabled
      from public.user_watch_settings as settings
      where settings.user_id = '${userId}'::uuid
    `),
    "t",
    "a writer blocked behind the migration lock must resume after commit",
  );
  assert.equal(
    query(`
      select session.last_checkpoint_at
      from public.watch_sessions as session
      where session.id = '${sessionId}'::uuid
    `),
    "2105-01-01 00:00:00+00",
    "a canonical session writer blocked behind the migration lock must resume after commit",
  );
} finally {
  query(`delete from public.users where id = '${userId}'::uuid`);
}
