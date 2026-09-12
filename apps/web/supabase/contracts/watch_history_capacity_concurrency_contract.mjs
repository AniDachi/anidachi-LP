import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Explicit disposable marker + Docker project identity, never a remote DB URL.
const workdir = process.env.WATCH_HISTORY_DB_WORKDIR;
const container = process.env.WATCH_HISTORY_DB_CONTAINER;
assert.ok(workdir && container && process.env.DOCKER_HOST?.startsWith("unix://"),
  "Explicit local disposable workdir, container, and Unix DOCKER_HOST required");
const marker = JSON.parse(readFileSync(join(workdir, ".anidachi-watch-history-v3-disposable.json"), "utf8"));
assert.equal(marker.acknowledgement, "I_ACKNOWLEDGE_THIS_IS_A_DEDICATED_DISPOSABLE_LOCAL_DATABASE");
assert.equal(marker.container, container);
const labels = JSON.parse(execFileSync("docker", ["inspect", container, "--format", "{{json .Config.Labels}}"], { encoding: "utf8" }));
const ports = JSON.parse(execFileSync("docker", ["inspect", container, "--format", "{{json .NetworkSettings.Ports}}"], { encoding: "utf8" }));
assert.equal(labels["com.supabase.cli.project"], marker.project);
assert.ok(ports["5432/tcp"].length > 0 && ports["5432/tcp"].every(port => Number(port.HostPort) === marker.hostPort));

const owner = "c4444444-4444-4444-8444-444444444444";
const args = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"];
const bounds = "set statement_timeout='10s';set lock_timeout='8s';";
function query(sql) {
  return execFileSync("docker", args, { input: bounds + sql, encoding: "utf8", timeout: 15_000 }).trim();
}
function literal(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function start(sql, keepOpen = false) {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
  child.stdin.write(bounds + sql + "\n");
  if (!keepOpen) child.stdin.end();
  return { child, done, output: () => stdout };
}
async function until(check, reason) {
  const deadline = Date.now() + 6_000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  assert.fail(reason);
}
function event(provider, number) {
  const video = `v${String(number).padStart(10, "0")}`;
  return {
    schemaVersion: 3, clientEventId: randomUUID(), clientSessionKey: randomUUID(), accountGeneration: 1,
    provider, titleKey: provider === "youtube" ? `youtube:video:${video}` : `crunchyroll:series:series${number}`,
    episodeKey: provider === "youtube" ? `youtube:video:${video}` : `crunchyroll:episode:episode${number}`,
    itemKind: provider === "youtube" ? "movie" : "series", title: "Capacity", artworkUrl: null, episodeTitle: "Episode",
    seasonKey: provider === "youtube" ? null : "crunchyroll:season:season-one", seasonTitle: null, seasonNumber: null, episodeNumber: null,
    sourceUrl: provider === "youtube" ? `https://www.youtube.com/watch?v=${video}` : `https://www.crunchyroll.com/watch/episode${number}`,
    currentTime: 50, duration: 1000, progress: 0.05, observedAt: new Date().toISOString(), kind: "heartbeat",
    ...(provider === "youtube" ? { youtubeVideoId: video } : { crunchyrollIdentity: {
      providerSeriesId: `series${number}`, providerSeasonIdentifier: "season-one", providerEpisodeIdentifier: `episode${number}`,
      providerContentId: `episode${number}`, audioLocale: null,
    } }),
  };
}
function write(provider, number, personal) {
  const e = event(provider, number);
  // DB time avoids host/VM clock skew in this concurrency-only test.
  const value = `${literal(e)} || jsonb_build_object('observedAt',clock_timestamp())`;
  if (!personal) return `select public.apply_watch_progress_v3('${owner}',${value},null);`;
  return `select public.apply_personal_watch_progress_v1('${owner}',jsonb_build_object('captureVersion',1,
    'accessEpoch',a->'accessEpoch','youtubeConsentEpoch',a->'youtubeConsentEpoch','clientSequence',1,'event',${value}))
    from (select public.resolve_watch_history_access_v1('${owner}')->'history' a) lease;`;
}
function seed(provider, total) {
  query(`insert into public.watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,
    source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at)
    select '${owner}','${provider}',
      case when '${provider}'='youtube' then 'youtube:video:v'||lpad(i::text,10,'0') else 'crunchyroll:series:series'||i end,
      case when '${provider}'='youtube' then 'youtube:video:v'||lpad(i::text,10,'0') else 'crunchyroll:episode:episode'||i end,
      case when '${provider}'='youtube' then 'movie' else 'series' end,'Title','Episode',
      case when '${provider}'='youtube' then 'https://www.youtube.com/watch?v=v'||lpad(i::text,10,'0') else 'https://www.crunchyroll.com/watch/episode'||i end,
      10,1000,0.01,gen_random_uuid(),clock_timestamp()-interval '1 day',i,1,clock_timestamp()
    from generate_series(1,${total}) i;`);
}
const live = [];
async function contend(firstSql, secondSql, expectedSuccess) {
  const first = start(`begin;${firstSql}select 'HOLDING';`, true);
  live.push(first);
  await until(() => first.output().includes("HOLDING"), "first writer must hold the user lock");
  const appName = `history-capacity-${randomUUID()}`;
  const second = start(`set application_name='${appName}';${secondSql}`);
  live.push(second);
  await until(() => query(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid
    where a.application_name='${appName}' and l.locktype='advisory' and not l.granted;`) === "1",
    "contender must wait on the same per-user advisory lock");
  first.child.stdin.end("commit;\n");
  const [a, b] = await Promise.all([first.done, second.done]);
  assert.equal(a.code, 0, a.stderr);
  if (expectedSuccess) assert.equal(b.code, 0, b.stderr);
  else { assert.notEqual(b.code, 0); assert.match(b.stderr, /HISTORY_LIMIT_REACHED/); }
}
assert.equal(query(`select count(*) from public.users where id='${owner}';`), "0", "fixture owner must be unused");
assert.equal(query("select active from public.personal_history_policy where singleton;"), "f", "legacy contention requires inactive rollout fixture");
const results = [];
try {
  for (const [provider, limit] of [["youtube", 100], ["crunchyroll", 200]]) {
    query(`insert into public.users(id,email,display_name) values('${owner}','capacity-concurrency@example.test','Capacity concurrency');
      insert into public.account_manual_plan_grants(user_id,plan_code,reason) values('${owner}','plus','local contract');
      select public.set_watch_preferences_v3('${owner}','{"youtubeHistoryEnabled":true}');
      select public.resolve_watch_history_access_v1('${owner}');
      update public.user_watch_settings set next_server_order=10000 where user_id='${owner}';`);
    seed(provider, limit - 1);
    await contend(write(provider, limit, provider === "youtube"), write(provider, limit + 1, provider !== "youtube"), false);
    let capacity = JSON.parse(query(`select public.get_watch_history_capacity_v1('${owner}');`));
    assert.equal(capacity.providers[provider].used, limit);
    assert.equal(query(`select count(*) from public.watch_sessions where host_user_id='${owner}';`), "1");
    const deletion = { schemaVersion: 3, clientMutationId: randomUUID(), accountGeneration: 1,
      requestedAt: new Date().toISOString(), target: { scope: "title", provider, titleKey: event(provider, 1).titleKey } };
    await contend(`select public.delete_watch_history_v3('${owner}',${literal(deletion)});`, write(provider, limit + 1, true), true);
    capacity = JSON.parse(query(`select public.get_watch_history_capacity_v1('${owner}');`));
    assert.equal(capacity.providers[provider].used, limit);
    results.push({ provider, limit, lastSlotSerialized: true, competingNewTitleRejected: true, deletionThenWriteSerialized: true });
    query(`delete from public.users where id='${owner}';`);
  }
  console.log(JSON.stringify({ pass: true, results }));
} finally {
  for (const operation of live) if (operation.child.exitCode === null) operation.child.kill();
  await Promise.allSettled(live.map(operation => operation.done));
  query(`delete from public.users where id='${owner}';`);
}
