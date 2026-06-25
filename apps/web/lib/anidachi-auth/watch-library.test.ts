import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanWatchProgressEntries,
  cleanWatchProgressEntry,
  historyRetentionCutoff,
  roomWatchParticipantTargets,
} from "./watch-library";

test("watch progress entries normalize episode checkpoints into series items", () => {
  const entry = cleanWatchProgressEntry({
    provider: "crunchyroll",
    kind: "episode",
    itemId: "crunchyroll-series:kill-blue",
    itemTitle: "Kill Blue",
    contentId: "G31UXV53P",
    seriesId: "GKILLBLUE",
    seasonId: "season-1",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeId: "G31UXV53P",
    episodeTitle: "E3 - Clean Up After Yourself",
    sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/clean-up-after-yourself",
    artworkUrl: "https://imgsrv.crunchyroll.com/poster.png",
    currentTime: 9999,
    duration: 1440.9,
    roomId: "room-1",
    watchedWithCount: 4,
    checkpointKind: "pause",
    observedAt: 1_800_000_000_000,
  });

  assert.equal(entry?.provider, "crunchyroll");
  assert.equal(entry?.itemKind, "series");
  assert.equal(entry?.episodeKey, "G31UXV53P");
  assert.equal(entry?.seasonKey, "season-1");
  assert.equal(entry?.seasonTitle, "Season 1");
  assert.equal(entry?.seasonNumber, 1);
  assert.equal(entry?.currentTimeSeconds, 1440);
  assert.equal(entry?.durationSeconds, 1440);
  assert.equal(entry?.progress, 1);
  assert.equal(entry?.checkpointKind, "pause");
  assert.equal(entry?.observedAt, "2027-01-15T08:00:00.000Z");
});

test("watch progress entries infer known Crunchyroll seasons from source URLs", () => {
  const entry = cleanWatchProgressEntry({
    provider: "crunchyroll",
    kind: "episode",
    itemId: "crunchyroll-series:haikyu",
    itemTitle: "Haikyu!!",
    contentId: "GRP8P9XGR",
    episodeId: "GRP8P9XGR",
    episodeTitle: "E1 - Let's Go To Tokyo!!",
    sourceUrl: "https://www.crunchyroll.com/watch/GRP8P9XGR/lets-go-to-tokyo",
    currentTime: 456,
    duration: 1440,
  });

  assert.equal(entry?.seasonKey, "season-2");
  assert.equal(entry?.seasonTitle, "Season 2");
  assert.equal(entry?.seasonNumber, 2);
});

test("watch progress entries reject unsupported providers and unsafe URLs", () => {
  assert.equal(
    cleanWatchProgressEntry({
      provider: "unsupported",
      kind: "movie",
      itemId: "movie-1",
      itemTitle: "Movie",
      sourceUrl: "https://example.com/watch/movie-1",
      currentTime: 10,
      duration: 100,
    }),
    null
  );
  assert.equal(
    cleanWatchProgressEntry({
      provider: "youtube",
      kind: "movie",
      itemId: "movie-1",
      itemTitle: "Movie",
      sourceUrl: "javascript:alert(1)",
      currentTime: 10,
      duration: 100,
    }),
    null
  );
});

test("watch progress batch reconciliation caps oversized payloads", () => {
  const entries = cleanWatchProgressEntries({
    entries: Array.from({ length: 140 }, (_, index) => ({
      provider: "youtube",
      kind: "movie",
      itemId: `movie-${index}`,
      itemTitle: `Movie ${index}`,
      sourceUrl: `https://youtube.com/watch?v=${index}`,
      currentTime: 10,
      duration: 100,
    })),
  });

  assert.equal(entries.length, 100);
});

test("watch library retention follows account plan limits", () => {
  const now = new Date("2026-06-21T00:00:00.000Z");

  assert.equal(
    historyRetentionCutoff(now, "free").toISOString(),
    "2026-06-14T00:00:00.000Z"
  );
  assert.equal(
    historyRetentionCutoff(now, "plus").toISOString(),
    "2026-03-21T00:00:00.000Z"
  );
  assert.equal(
    historyRetentionCutoff(now, "pro").toISOString(),
    "2025-06-20T00:00:00.000Z"
  );
});

test("room watch participant targets include host and accepted room members once", () => {
  const targets = roomWatchParticipantTargets(
    {
      host_user_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-06-21T01:00:00.000Z",
      host_connected_at: "2026-06-21T01:01:00.000Z",
    },
    [
      {
        user_id: "22222222-2222-4222-8222-222222222222",
        joined_at: "2026-06-21T01:02:00.000Z",
      },
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        joined_at: "2026-06-21T01:03:00.000Z",
      },
    ]
  );

  assert.deepEqual(targets, [
    {
      userId: "11111111-1111-4111-8111-111111111111",
      role: "host",
      joinedAt: "2026-06-21T01:01:00.000Z",
    },
    {
      userId: "22222222-2222-4222-8222-222222222222",
      role: "viewer",
      joinedAt: "2026-06-21T01:02:00.000Z",
    },
  ]);
});
