import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE_URL = new URL("./watch-library.ts", import.meta.url);
const source = readFileSync(SOURCE_URL, "utf8");

function definition(name: string): string {
  const marker = new RegExp(`(?:export\\s+)?async\\s+function\\s+${name}\\b`);
  const match = marker.exec(source);
  assert.ok(match, `missing ${name}`);
  const next = source.slice(match.index + match[0].length).search(
    /\n(?:export\s+)?async\s+function\s+|\nexport\s+function\s+/,
  );
  const end = next < 0 ? source.length : match.index + match[0].length + next;
  return source.slice(match.index, end).replace(/\s+/g, " ");
}

test("v1 reconcile never reuses or updates a discriminator-two session", () => {
  const upsert = definition("upsertWatchSession");
  assert.match(upsert, /schema_version: 1/);
  assert.match(
    upsert,
    /\.from\("watch_sessions"\) \.update\(payload\) \.eq\("id", existing\.id\) \.eq\("schema_version", 1\)/,
  );
  assert.match(definition("getLatestRoomWatchSession"), /\.eq\("schema_version", 1\)/);
  assert.match(definition("getReusableSoloWatchSession"), /\.eq\("schema_version", 1\)/);

  const participant = definition("upsertWatchSessionParticipant");
  assert.match(participant, /schema_version: 1/);
});

test("v1 list and room recreation cannot select v2 sessions or participants", () => {
  assert.match(definition("listWatchLibrary"), /\.eq\("schema_version", 1\)/);
  assert.match(definition("listViewerSessionParticipants"), /\.eq\("schema_version", 1\)/);
  assert.match(definition("listWatchSessionsByIds"), /\.eq\("schema_version", 1\)/);
  assert.match(definition("listParticipantsForSessions"), /\.eq\("schema_version", 1\)/);

  const recreation = definition("getWatchSessionRoomSourceForViewer");
  assert.equal(recreation.match(/\.eq\("schema_version", 1\)/g)?.length, 2);
});

test("v1 clear deletes only discriminator-one participant and title rows", () => {
  const clear = definition("clearWatchLibrary");
  assert.match(
    clear,
    /\.from\("watch_session_participants"\) \.delete\(\) \.eq\("user_id", userId\) \.eq\("schema_version", 1\)/,
  );
  assert.match(
    clear,
    /\.from\("user_tracked_titles"\) \.delete\(\) \.eq\("user_id", userId\) \.eq\("schema_version", 1\)/,
  );
});

test("every active v1 tracked-title path carries discriminator one", () => {
  assert.match(definition("listWatchLibrary"), /user_tracked_titles[\s\S]*?\.eq\("schema_version", 1\)/);
  assert.match(definition("upsertTrackedTitle"), /schema_version: 1/);
  assert.match(definition("getTrackedTitle"), /\.eq\("schema_version", 1\)/);
  const archive = definition("archiveOldestTrackedTitlesOverLimit");
  assert.equal(archive.match(/\.eq\("schema_version", 1\)/g)?.length, 2);
  assert.match(definition("countActiveTrackedTitles"), /\.eq\("schema_version", 1\)/);
});
