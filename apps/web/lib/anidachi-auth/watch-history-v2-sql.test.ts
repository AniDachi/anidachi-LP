import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PublicProfileSchema } from "@anidachi/protocol";

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
  assert.match(table, /octet_length\(acknowledgement::text\) <= 2097152/);
  assert.doesNotMatch(sql, /interval '(?!14 days)[^']+'[^;]*receipt/);
});

test("season constraints consistently allow zero and reject values above 1000", () => {
  const sql = normalizedSql();
  assert.match(
    sql,
    /watch_episode_progress[\s\S]*season_number integer check \(season_number is null or season_number between 0 and 1000\)/,
  );
  assert.match(
    sql,
    /drop constraint if exists watch_sessions_season_number_check; alter table public\.watch_sessions add constraint watch_sessions_season_number_check check \(season_number is null or season_number between 0 and 1000\) not valid; alter table public\.watch_sessions validate constraint watch_sessions_season_number_check/,
  );
  assert.match(
    sql,
    /drop constraint if exists watch_progress_checkpoints_season_number_check; alter table public\.watch_progress_checkpoints add constraint watch_progress_checkpoints_season_number_check check \(season_number is null or season_number between 0 and 1000\) not valid; alter table public\.watch_progress_checkpoints validate constraint watch_progress_checkpoints_season_number_check/,
  );
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

test("participant evidence is discriminator-two on every v2 write, read, and delete path", () => {
  const sql = normalizedSql();
  const applyDefinition = functionDefinition("apply_watch_progress_v2");
  const deleteDefinition = functionDefinition("delete_watch_history_v2");
  assert.match(
    sql,
    /alter table public\.watch_session_participants add column if not exists schema_version smallint not null default 1/,
  );
  assert.match(sql, /watch_session_participants_schema_version_check/);
  assert.match(
    applyDefinition,
    /insert into public\.watch_session_participants \( session_id, user_id, role, joined_at, left_at, current_time_seconds, progress, updated_at, schema_version \)[\s\S]*?server_accepted_at, 2 \) on conflict/,
  );
  assert.match(
    applyDefinition,
    /current_participant\.session_id = session_id_value and current_participant\.user_id = p_user_id and current_participant\.schema_version = 2/,
  );
  assert.match(
    applyDefinition,
    /other_participant\.session_id = session_id_value and other_participant\.user_id <> p_user_id and other_participant\.schema_version = 2/,
  );
  assert.match(
    applyDefinition,
    /where participant\.session_id = session\.id and participant\.schema_version = 2/,
  );
  assert.match(
    applyDefinition,
    /owner_participant\.user_id = p_user_id and owner_participant\.schema_version = 2/,
  );
  assert.equal(
    deleteDefinition.match(/participant\.schema_version = 2/g)?.length,
    3,
  );
});

test("both shared roles lock and validate immutable source identity before mutation", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  const lookupAt = definition.indexOf("select session.* into shared_session_row");
  const viewerBranchAt = definition.indexOf("participant_role = 'viewer'");
  const pendingAt = definition.indexOf("watch_history_shared_session_pending");
  const mismatchAt = definition.indexOf("watch_history_shared_source_mismatch");
  const orderAt = definition.indexOf("next_server_order =");
  const participantAt = definition.indexOf(
    "insert into public.watch_session_participants",
  );
  const progressAt = definition.indexOf("insert into public.watch_episode_progress");
  const receiptAt = definition.indexOf("insert into public.watch_history_receipts");
  assert.ok(lookupAt >= 0);
  assert.ok(lookupAt < viewerBranchAt);
  for (const rejectionAt of [pendingAt, mismatchAt]) {
    assert.ok(rejectionAt >= 0);
    assert.ok(rejectionAt < orderAt);
    assert.ok(rejectionAt < participantAt);
    assert.ok(rejectionAt < progressAt);
    assert.ok(rejectionAt < receiptAt);
  }
  assert.match(
    definition,
    /where session\.schema_version = 2 and session\.room_id = room_row\.room_id and session\.room_generation = .*?'roomgeneration'.*? and session\.source_generation = .*?'sourcegeneration'.*? for update/,
  );
  assert.match(
    definition,
    /shared_session_row\.provider <> provider_value or shared_session_row\.item_key <> title_key_value or shared_session_row\.episode_key <> episode_key_value or shared_session_row\.source_url <> source_url_value/,
  );
});

test("shared insert races never rewrite immutable source identity", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /insert into public\.watch_sessions[\s\S]*?on conflict \(room_id, room_generation, source_generation\) where schema_version = 2 and room_id is not null do nothing returning id into session_id_value/,
  );
  assert.equal(
    definition.match(/watch_history_shared_source_mismatch/g)?.length,
    2,
  );
});

test("host updates only shared playback and lifecycle fields", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  const update = definition.match(
    /if participant_role = 'host' then update public\.watch_sessions as session set ([\s\S]*?) where session\.id = session_id_value; end if;/,
  )?.[1];
  assert.ok(update);
  for (const field of [
    "duration_seconds",
    "current_time_seconds",
    "progress",
    "ended_at",
    "last_checkpoint_at",
    "updated_at",
  ]) {
    assert.match(update, new RegExp(`${field} =`));
  }
  for (const immutableField of [
    "provider",
    "item_key",
    "item_kind",
    "item_title",
    "episode_key",
    "episode_title",
    "season_key",
    "season_title",
    "season_number",
    "source_url",
    "artwork_url",
    "started_at",
    "history_generation",
  ]) {
    assert.doesNotMatch(update, new RegExp(`${immutableField} =`));
  }
});

test("acknowledgement profiles guarantee JavaScript contract-safe fields", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /case when profile\.handle is not null and pg_catalog\.btrim\(profile\.handle\) ~ '\^\[a-z0-9_\]\{3,24\}\$' then pg_catalog\.btrim\(profile\.handle\) else null end/,
  );
  assert.match(
    definition,
    /octet_length\(\s*pg_catalog\.btrim\(profile\.display_name\)\s*\) <= 80[\s\S]*?octet_length\(\s*pg_catalog\.btrim\(participant_user\.display_name\)\s*\) <= 80[\s\S]*?else 'anidachi user' end\s*,\s*'avatarurl'/,
  );
  assert.match(
    definition,
    /char_length\(profile\.avatar_url\) <= 2048[\s\S]*?octet_length\(profile\.avatar_url\) = char_length\(profile\.avatar_url\)[\s\S]*?profile\.avatar_url ~\* '\^https\?:\/\//,
  );
  assert.doesNotMatch(definition, /left\([^)]*avatar_url|substring\([^)]*avatar_url/);

  const avatarPattern = definition.match(
    /profile\.avatar_url ~\* '([^']+)'/,
  )?.[1];
  assert.ok(avatarPattern);
  const sqlSafeAvatar = (value: string) =>
    value.length <= 2_048 &&
    Buffer.byteLength(value, "utf8") === Array.from(value).length &&
    new RegExp(avatarPattern, "i").test(value);
  assert.equal(sqlSafeAvatar("https://"), false);
  assert.equal(sqlSafeAvatar("https://["), false);
  assert.equal(sqlSafeAvatar(`https://cdn.example.com/${"😀".repeat(1_024)}`), false);
  assert.equal(sqlSafeAvatar("https://cdn.example.com/avatar/user_1.png"), true);
  assert.ok(Buffer.byteLength("😀".repeat(41), "utf8") > 80);
  assert.ok(Buffer.byteLength("AniDachi User", "utf8") <= 80);
});

test("acknowledgement avatar predicate is a conservative public-profile subset", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  const avatarPattern = definition.match(
    /profile\.avatar_url ~\* '([^']+)'/,
  )?.[1];
  const participantAvatarPattern = definition.match(
    /participant_user\.avatar_url ~\* '([^']+)'/,
  )?.[1];
  const excludedAvatarPatterns = Array.from(
    definition.matchAll(/profile\.avatar_url !~\* '([^']+)'/g),
    (match) => match[1],
  );
  const participantExcludedAvatarPatterns = Array.from(
    definition.matchAll(/participant_user\.avatar_url !~\* '([^']+)'/g),
    (match) => match[1],
  );
  assert.ok(avatarPattern);
  assert.ok(excludedAvatarPatterns.length > 0);
  assert.equal(participantAvatarPattern, avatarPattern);
  assert.deepEqual(participantExcludedAvatarPatterns, excludedAvatarPatterns);

  const sqlSafeAvatar = (value: string) =>
    value.length <= 2_048 &&
    Buffer.byteLength(value, "utf8") === Array.from(value).length &&
    new RegExp(avatarPattern, "i").test(value) &&
    excludedAvatarPatterns.every(
      (pattern) => !new RegExp(pattern, "i").test(value),
    );
  const profileWithAvatar = (avatarUrl: string) =>
    PublicProfileSchema.safeParse({
      userId: "00000000-0000-4000-8000-000000000001",
      handle: null,
      displayName: "AniDachi user",
      avatarUrl,
    }).success;

  for (const avatarUrl of [
    "https://999.999",
    "https://999.999/",
    "https://999.999/avatar.png",
    "https://1.2.3.999",
    "https://1.2.3.999/",
    "https://1.2.3.999/avatar.png",
  ]) {
    assert.equal(profileWithAvatar(avatarUrl), false, avatarUrl);
    assert.equal(sqlSafeAvatar(avatarUrl), false, avatarUrl);
  }

  const invalidHostnameFixtures = [
    "https://example.123/",
    "https://foo.09/",
    "https://1a.2/",
    "https://foo.0x10/",
    "https://xn--.com/",
  ];
  assert.deepEqual(
    invalidHostnameFixtures.filter(profileWithAvatar),
    [],
    "fixtures must remain invalid under PublicProfileSchema",
  );
  assert.deepEqual(
    invalidHostnameFixtures.filter(sqlSafeAvatar),
    [],
    "the SQL predicate must not emit a URL rejected by PublicProfileSchema",
  );

  const validPunycodeFallbackFixtures = [
    "https://xn--bcher-kva.example.com/avatar",
    "https://assets.xn--bcher-kva.example.com/avatar",
  ];
  for (const avatarUrl of validPunycodeFallbackFixtures) {
    assert.equal(profileWithAvatar(avatarUrl), true, avatarUrl);
    assert.equal(sqlSafeAvatar(avatarUrl), false, avatarUrl);
  }

  const allowedAvatarFixtures = [
    "https://cdn.example.com/avatar/user_1.png",
    "https://1a.example.co/avatar",
    `https://cdn.example.${"a".repeat(63)}/avatar`,
  ];
  for (const avatarUrl of allowedAvatarFixtures) {
    assert.equal(profileWithAvatar(avatarUrl), true, avatarUrl);
    assert.equal(sqlSafeAvatar(avatarUrl), true, avatarUrl);
  }
});

test("acknowledgement display-name predicate follows JavaScript trim semantics", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  const postgresUnicodePattern = definition.match(
    /pg_catalog\.btrim\(profile\.display_name\) ~ u&'([^']+)'/,
  )?.[1];
  const participantPostgresUnicodePattern = definition.match(
    /pg_catalog\.btrim\(participant_user\.display_name\) ~ u&'([^']+)'/,
  )?.[1];
  assert.ok(postgresUnicodePattern);
  assert.equal(participantPostgresUnicodePattern, postgresUnicodePattern);
  const javascriptPattern = postgresUnicodePattern.replace(
    /\\([0-9a-f]{4})/gi,
    (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)),
  );
  const containsNonTrimCharacter = new RegExp(javascriptPattern, "u");
  const sqlSafeDisplayName = (value: string) => {
    const postgresTrimmed = value.replace(/^ +| +$/g, "");
    const characterLength = Array.from(postgresTrimmed).length;
    return (
      characterLength >= 1 &&
      characterLength <= 80 &&
      Buffer.byteLength(postgresTrimmed, "utf8") <= 80 &&
      containsNonTrimCharacter.test(postgresTrimmed)
    );
  };
  const profileWithDisplayName = (displayName: string) =>
    PublicProfileSchema.safeParse({
      userId: "00000000-0000-4000-8000-000000000001",
      handle: null,
      displayName,
      avatarUrl: null,
    }).success;

  const javascriptTrimWhitespace = [
    "\u0009",
    "\u000a",
    "\u000b",
    "\u000c",
    "\u000d",
    "\u0020",
    "\u00a0",
    "\u1680",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200a",
    "\u2028",
    "\u2029",
    "\u202f",
    "\u205f",
    "\u3000",
    "\ufeff",
  ];
  for (const whitespace of javascriptTrimWhitespace) {
    const displayName = whitespace.repeat(2);
    assert.equal(profileWithDisplayName(displayName), false);
    assert.equal(sqlSafeDisplayName(displayName), false);
  }

  for (const displayName of ["猫", "😀", "猫と😀"]) {
    assert.equal(Buffer.byteLength(displayName, "utf8") <= 80, true);
    assert.equal(profileWithDisplayName(displayName), true);
    assert.equal(sqlSafeDisplayName(displayName), true);
  }
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

test("deleted rooms preserve an internal shared v2 tombstone", () => {
  const sql = normalizedSql();
  assert.match(
    sql,
    /room_id is null and client_session_key is null and room_generation is not null and source_generation is not null\s*\)/,
  );
});

test("recent-person pair locks and winning room metadata are deterministic", () => {
  const definition = functionDefinition("apply_watch_progress_v2");
  assert.match(
    definition,
    /from \( values \(p_user_id, other_user_id_value\), \(other_user_id_value, p_user_id\) \) as directional_pair\(user_id, other_user_id\) order by directional_pair\.user_id, directional_pair\.other_user_id/,
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
    /for other_user_id_value in select other_participant\.user_id from public\.watch_session_participants as other_participant where other_participant\.session_id = session_id_value and other_participant\.user_id <> p_user_id and other_participant\.schema_version = 2 order by least\(p_user_id, other_participant\.user_id\), greatest\(p_user_id, other_participant\.user_id\) loop/,
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
    /where session\.schema_version = 2 and \( session\.room_id is not null or session\.client_session_key is not null \) and session\.provider = provider_value and session\.item_key = title_key_value and session\.episode_key = episode_key_value/,
  );
});

test("receipt cleanup index starts with the locked account boundary", () => {
  assert.match(
    normalizedSql(),
    /index idx_watch_history_receipts_expiry on public\.watch_history_receipts \(user_id, expires_at\)/,
  );
});
