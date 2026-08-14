import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const MIGRATION_URL = new URL(
  "../../supabase/migrations/20260814010000_watch_history_v2_foundation.sql",
  import.meta.url,
);

function migrationSql() {
  try {
    return readFileSync(MIGRATION_URL, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function normalizedSql() {
  return migrationSql()
    .replace(/--.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function functionDefinition(name: string) {
  const match = migrationSql().match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$\\s*;`,
      "i",
    ),
  );
  assert.ok(match, `missing public.${name}`);
  return match[0].replace(/\s+/g, " ").toLowerCase();
}

const NEW_TABLES = [
  "user_watch_settings",
  "watch_episode_progress",
  "watch_history_receipts",
  "watch_history_deletions",
  "recent_people_evidence",
] as const;

const V2_FUNCTIONS = [
  "apply_watch_progress_v2",
  "set_watch_preferences_v2",
  "delete_watch_history_v2",
] as const;

test("watch history v2 creates only the five additive, account-owned relations", () => {
  const sql = normalizedSql();
  for (const table of NEW_TABLES) {
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`));
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.doesNotMatch(sql, /\b(drop table|truncate(?: table)?)\b/);
  assert.doesNotMatch(sql, /\b(delete from|insert into|update) public\.watch_progress_checkpoints\b/);
  assert.doesNotMatch(sql, /create table public\.watch_room/);
});

test("new tables are private to service_role and every foreign-key access path is indexed", () => {
  const sql = normalizedSql();
  for (const table of NEW_TABLES) {
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`),
    );
    assert.match(
      sql,
      new RegExp(
        `grant select, insert, update, delete on table public\\.${table} to service_role`,
      ),
    );
  }

  for (const index of [
    "uniq_watch_episode_progress_user_server_order",
    "idx_watch_episode_progress_episode_lookup",
    "idx_watch_episode_progress_title_page",
    "idx_watch_episode_progress_latest_session",
    "idx_watch_history_receipts_expiry",
    "idx_watch_history_deletions_lookup",
    "idx_recent_people_evidence_order",
    "idx_recent_people_evidence_other_user",
    "idx_recent_people_evidence_room",
  ]) {
    assert.match(sql, new RegExp(`(?:unique )?index ${index} `));
  }
});

test("receipt retention is exactly fourteen days and acknowledgements are bounded objects", () => {
  const sql = normalizedSql();
  const table = sql.match(
    /create table public\.watch_history_receipts \([\s\S]*?\);/,
  )?.[0];
  assert.ok(table);
  assert.match(table, /kind text not null check \(kind in \('progress', 'delete'\)\)/);
  assert.match(table, /check \(expires_at = accepted_at \+ interval '14 days'\)/);
  assert.match(table, /jsonb_typeof\(acknowledgement\) = 'object'/);
  assert.match(table, /pg_column_size\(acknowledgement\) <= 262144/);
  assert.doesNotMatch(sql, /interval '(?!14 days)[^']+'[^;]*receipt/);
});

test("deletion fences encode unambiguous all, title, and episode scopes", () => {
  const sql = normalizedSql();
  assert.match(sql, /scope text not null check \(scope in \('all', 'title', 'episode'\)\)/);
  assert.match(sql, /scope = 'all'.*provider is null.*title_key is null.*episode_key is null/);
  assert.match(sql, /scope = 'title'.*provider is not null.*title_key is not null.*episode_key is null/);
  assert.match(sql, /scope = 'episode'.*provider is not null.*title_key is not null.*episode_key is not null/);
  for (const index of [
    "uniq_watch_history_deletions_all",
    "uniq_watch_history_deletions_title",
    "uniq_watch_history_deletions_episode",
  ]) {
    assert.match(sql, new RegExp(`unique index ${index} `));
  }
});

test("v2 functions are schema-isolated, service-role-only transactional boundaries", () => {
  const sql = normalizedSql();
  for (const name of V2_FUNCTIONS) {
    const definition = functionDefinition(name);
    assert.match(definition, /security invoker/);
    assert.match(definition, /set search_path = ''/);
    assert.doesNotMatch(definition, /\bwatch_progress_checkpoints\b/);
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(`));
    assert.match(
      sql,
      new RegExp(
        `revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated`,
      ),
    );
    assert.match(
      sql,
      new RegExp(`grant execute on function public\\.${name}\\([^;]+ to service_role`),
    );
  }
});

test("progress application locks one account boundary before dedupe and mutation", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  const lockAt = definition.indexOf("pg_catalog.pg_advisory_xact_lock");
  const receiptAt = definition.indexOf("from public.watch_history_receipts");
  const orderAt = definition.indexOf("next_server_order =");
  assert.ok(lockAt >= 0);
  assert.ok(receiptAt > lockAt);
  assert.ok(orderAt > receiptAt);
  assert.match(
    definition,
    /normalized_observed_at := least\( .*?'observedat'.*? server_accepted_at \);/,
  );
  assert.match(definition, /public\.rooms/);
  assert.match(definition, /public\.room_members/);
  assert.match(definition, /room_generation/);
  assert.match(definition, /source_generation/);
  assert.match(definition, /participantsessionid/);
});

test("v2 session identity is additive and excludes discriminator-one rows", () => {
  const sql = normalizedSql();
  assert.match(sql, /add column if not exists schema_version smallint not null default 1/);
  assert.match(sql, /add column if not exists history_generation bigint not null default 1/);
  assert.match(sql, /unique index uniq_watch_sessions_v2_solo/);
  assert.match(sql, /unique index uniq_watch_sessions_v2_shared/);
  assert.match(sql, /where schema_version = 2/);
});

test("v2 transactions leave active v1 tracked-title rows untouched", () => {
  for (const name of ["apply_watch_progress_v2", "delete_watch_history_v2"]) {
    assert.doesNotMatch(functionDefinition(name), /public\.user_tracked_titles/);
  }
  assert.match(
    normalizedSql(),
    /alter table public\.user_tracked_titles add column if not exists schema_version/,
  );
});

test("deleted rooms may preserve only ended shared v2 session identities", () => {
  const sql = normalizedSql();
  assert.match(
    sql,
    /room_id is null and client_session_key is null and room_generation is not null and source_generation is not null and ended_at is not null/,
  );
  assert.doesNotMatch(
    sql,
    /room_id is null and client_session_key is null and room_generation is not null and source_generation is not null\s*\)/,
  );
});

test("recent-person pair locks and winning room metadata are deterministic", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /from \( values \(p_user_id, other_user_id\), \(other_user_id, p_user_id\) \) as directional_pair\(user_id, other_user_id\) order by directional_pair\.user_id, directional_pair\.other_user_id/,
  );
  assert.match(
    definition,
    /last_room_id = case when excluded\.last_watched_at > public\.recent_people_evidence\.last_watched_at then excluded\.last_room_id else public\.recent_people_evidence\.last_room_id end/,
  );
});

test("recent-person pair groups are acquired in one global order", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /for other_user_id in select other_participant\.user_id from public\.watch_session_participants as other_participant where other_participant\.session_id = session_id_value and other_participant\.user_id <> p_user_id order by least\(p_user_id, other_participant\.user_id\), greatest\(p_user_id, other_participant\.user_id\) loop/,
  );
});

test("canonical receipt sessions bound participants deterministically", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /order by participant\.joined_at, participant\.user_id limit 15/,
  );
  assert.match(definition, /jsonb_agg\(\s*bounded_participant\.payload/);
});

test("canonical acknowledgements omit roomless shared tombstones", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /where session\.schema_version = 2 and \( session\.room_id is not null or session\.client_session_key is not null \) and session\.provider = provider_value/,
  );
});

test("receipt cleanup index starts with the locked account boundary", () => {
  assert.match(
    normalizedSql(),
    /index idx_watch_history_receipts_expiry on public\.watch_history_receipts \(user_id, expires_at\)/,
  );
});
