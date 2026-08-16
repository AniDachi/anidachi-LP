import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../migrations/20260816090000_watch_history_v2_bounded_read.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");
const transactionPosition = sql.indexOf("begin;");
const lockTimeoutPosition = sql.indexOf("set local lock_timeout = '10s';");
const sourceLockPosition = sql.indexOf(
  "lock table public.user_watch_settings, public.watch_sessions, public.watch_session_participants, public.watch_episode_progress",
);
const triggerPosition = sql.indexOf("create trigger sync_watch_history_title_summary_v2");
const userSessionTriggerPosition = sql.indexOf(
  "create trigger sync_watch_history_user_session_summary_v2",
);
const sessionTriggerPosition = sql.indexOf(
  "create trigger sync_watch_history_session_summaries_v2",
);
const initializationPosition = sql.indexOf(
  "-- Initialize the projection after write maintenance is active.",
);
const userSessionInitializationPosition = sql.indexOf(
  "-- Initialize the user-session projection after write maintenance is active.",
);
const rpcPosition = sql.indexOf("-- The generation hint preserves");

assert.equal(transactionPosition, 0, "migration must open an explicit transaction");
assert.notEqual(lockTimeoutPosition, -1, "migration lock acquisition must fail safely");
assert.notEqual(sourceLockPosition, -1, "projection source tables must be write-locked");
assert.notEqual(triggerPosition, -1, "insert/update maintenance trigger must exist");
assert.notEqual(
  userSessionTriggerPosition,
  -1,
  "user-session maintenance trigger must exist",
);
assert.notEqual(
  sessionTriggerPosition,
  -1,
  "session checkpoint and identity maintenance trigger must exist",
);
assert.notEqual(initializationPosition, -1, "initialization marker must exist");
assert.notEqual(
  userSessionInitializationPosition,
  -1,
  "user-session initialization marker must exist",
);
assert.ok(
  transactionPosition < lockTimeoutPosition &&
    lockTimeoutPosition < sourceLockPosition &&
    sourceLockPosition < triggerPosition,
  "the migration must lock settings first, then session, participant, and progress sources before trigger installation",
);
assert.ok(
  triggerPosition < initializationPosition,
  "insert/update maintenance must be installed before projection initialization",
);
assert.ok(
  userSessionTriggerPosition < userSessionInitializationPosition,
  "user-session maintenance must be installed before its projection initialization",
);
assert.ok(
  sessionTriggerPosition < userSessionInitializationPosition,
  "session-side maintenance must be installed before user-session initialization",
);
assert.ok(initializationPosition < rpcPosition, "initialization must precede the read RPC");
assert.ok(
  userSessionInitializationPosition < rpcPosition,
  "user-session initialization must precede the read RPC",
);
assert.match(sql, /commit;\s*$/i, "migration must hold every source lock through commit");

const initializationSql = sql.slice(initializationPosition, rpcPosition);
assert.match(
  initializationSql,
  /on conflict \(user_id, history_generation, provider, title_key\)\s+do update set last_watched_at = case/i,
  "projection initialization must merge idempotently with concurrent trigger writes",
);

const userSessionInitializationSql = sql.slice(
  userSessionInitializationPosition,
  rpcPosition,
);
assert.match(
  userSessionInitializationSql,
  /session\.last_checkpoint_at/i,
  "user-session initialization must use canonical session checkpoint time",
);
assert.match(
  userSessionInitializationSql,
  /session\.room_id is not null\s+or session\.client_session_key is not null/i,
  "user-session initialization must exclude roomless shared tombstones",
);
assert.match(
  userSessionInitializationSql,
  /on conflict \(user_id, session_id\)\s+do update set[\s\S]*last_watched_at = excluded\.last_watched_at/i,
  "locked user-session initialization must converge exactly to canonical session state",
);
