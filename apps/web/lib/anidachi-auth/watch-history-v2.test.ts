import assert from "node:assert/strict";
import test from "node:test";
import type {
  WatchHistoryDeletionAck,
  WatchProgressAck,
} from "@anidachi/protocol";
import {
  applyWatchProgressV2,
  buildWatchHistoryV2Response,
  decodeWatchHistoryCursor,
  deleteWatchHistoryV2,
  encodeWatchHistoryCursor,
  isMeaningfulWatchHistoryV2SessionIdentity,
  parseWatchProgressEventV2,
  WatchHistoryV2ApiError,
  type WatchHistoryV2Store,
} from "./watch-history-v2";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-14T12:00:00.000Z";

function progressEvent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    clientEventId: EVENT_ID,
    clientSessionKey: "solo-session-one",
    accountGeneration: 1,
    provider: "crunchyroll",
    titleKey: "series-one",
    itemKind: "series",
    title: "Series One",
    artworkUrl: null,
    episodeKey: "episode-one",
    episodeTitle: "Episode One",
    seasonKey: "season-one",
    seasonTitle: "Season One",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/episode-one/demo",
    currentTime: 600,
    duration: 1_200,
    progress: 0.5,
    observedAt: NOW,
    kind: "pause",
    ...overrides,
  };
}

function session() {
  return {
    id: SESSION_ID,
    roomId: null,
    roomGeneration: null,
    hostUserId: USER_ID,
    kind: "solo" as const,
    sourceGeneration: null,
    currentTime: 600,
    duration: 1_200,
    progress: 0.5,
    startedAt: "2026-08-14T11:00:00.000Z",
    endedAt: null,
    lastWatchedAt: NOW,
    participants: [],
  };
}

function ack(overrides: Partial<WatchProgressAck> = {}): WatchProgressAck {
  return {
    meta: {
      serverTime: NOW,
      schemaVersion: 2,
      ownerUserId: USER_ID,
      accountGeneration: 1,
    },
    schemaVersion: 2,
    acceptedEventId: EVENT_ID,
    acceptedAt: NOW,
    accountGeneration: 1,
    duplicate: false,
    episode: {
      episodeKey: "episode-one",
      episodeTitle: "Episode One",
      seasonKey: "season-one",
      seasonTitle: "Season One",
      seasonNumber: 1,
      episodeNumber: 1,
      sourceUrl: "https://www.crunchyroll.com/watch/episode-one/demo",
      currentTime: 600,
      duration: 1_200,
      progress: 0.5,
      completedAt: null,
      lastWatchedAt: NOW,
      sessions: [session()],
    },
    ...overrides,
  };
}

test("progress input is strict and accepts only MVP providers on canonical origins", () => {
  assert.equal(parseWatchProgressEventV2(progressEvent()).provider, "crunchyroll");
  assert.equal(
    parseWatchProgressEventV2(
      progressEvent({
        provider: "youtube",
        titleKey: "abcdefghijk",
        episodeKey: "abcdefghijk",
        sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      }),
    ).provider,
    "youtube",
  );

  assert.throws(() => parseWatchProgressEventV2(progressEvent({ userId: USER_ID })), hasCode("INVALID_REQUEST"));
  assert.throws(() => parseWatchProgressEventV2(progressEvent({ provider: "netflix" })), hasCode("UNSUPPORTED_PROVIDER"));
  assert.throws(
    () => parseWatchProgressEventV2(progressEvent({ sourceUrl: "https://crunchyroll.com/watch/demo" })),
    hasCode("PROVIDER_DOMAIN_MISMATCH"),
  );
  assert.throws(
    () => parseWatchProgressEventV2(progressEvent({ sourceUrl: "https://www.youtube.com/watch?v=demo" })),
    hasCode("PROVIDER_DOMAIN_MISMATCH"),
  );
});

test("progress calls the transactional RPC once and never passes the raw authority", async () => {
  const calls: unknown[][] = [];
  const store = storeStub({
    applyProgress: async (...args) => {
      calls.push(args);
      return ack();
    },
  });
  const sharedRoom = {
    roomId: "room-one",
    participantSessionId: "participant-session-one",
    roomGeneration: 2,
    sourceGeneration: 3,
    attestation: "opaque-secret-authority",
  };

  assert.deepEqual(
    await applyWatchProgressV2({
      userId: USER_ID,
      input: progressEvent({ sharedRoom }),
      store,
      verifyAuthority: async () => ({
        sub: USER_ID,
        roomId: "room-one",
        participantSessionId: "participant-session-one",
        roomGeneration: 2,
        sourceGeneration: 3,
        iat: 1_786_680_000,
      }),
    }),
    ack(),
  );
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls).includes("opaque-secret-authority"), false);
  assert.deepEqual(calls[0]?.[2], {
    sub: USER_ID,
    roomId: "room-one",
    participantSessionId: "participant-session-one",
    roomGeneration: 2,
    sourceGeneration: 3,
    iat: 1_786_680_000,
  });
});

test("progress accepts an exact duplicate acknowledgement and rejects malformed RPC data", async () => {
  const duplicate = ack({ duplicate: true });
  assert.equal(
    (
      await applyWatchProgressV2({
        userId: USER_ID,
        input: progressEvent(),
        store: storeStub({ applyProgress: async () => duplicate }),
      })
    ).duplicate,
    true,
  );
  await assert.rejects(
    () =>
      applyWatchProgressV2({
        userId: USER_ID,
        input: progressEvent(),
        store: storeStub({ applyProgress: async () => ({ sql: "private" }) }),
      }),
    hasCode("INVALID_DATABASE_RESPONSE"),
  );
});

test("domain failures map to bounded stable public errors", async () => {
  const failures = [
    ["watch_history_room_unknown", "UNKNOWN_ROOM"],
    ["watch_history_room_member_required", "ROOM_MEMBERSHIP_REQUIRED"],
    ["watch_history_authority_after_end", "AUTHORITY_AFTER_ROOM_END"],
    ["watch_history_authority_before_join", "AUTHORITY_BEFORE_JOIN"],
    ["watch_history_client_id_conflict", "CLIENT_ID_CONFLICT"],
    ["watch_history_generation_mismatch", "GENERATION_MISMATCH"],
    ["watch_history_observation_stale", "STALE_OBSERVATION"],
    ["watch_history_deleted", "DELETED_HISTORY"],
  ] as const;

  for (const [databaseMessage, publicCode] of failures) {
    await assert.rejects(
      () =>
        applyWatchProgressV2({
          userId: USER_ID,
          input: progressEvent(),
          store: storeStub({
            applyProgress: async () => {
              throw { message: databaseMessage, details: "private SQL", hint: "secret" };
            },
          }),
        }),
      (error) =>
        error instanceof WatchHistoryV2ApiError &&
        error.code === publicCode &&
        !error.message.includes("SQL") &&
        !error.message.includes("secret"),
    );
  }
});

test("cursor is opaque base64url data and rejects malformed values", () => {
  const encoded = encodeWatchHistoryCursor({
    lastWatchedAt: NOW,
    stableId: "crunchyroll:series-one",
  });
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes("series-one"), false);
  assert.deepEqual(decodeWatchHistoryCursor(encoded), {
    lastWatchedAt: NOW,
    stableId: "crunchyroll:series-one",
  });
  assert.throws(() => decodeWatchHistoryCursor("not-valid-cursor"), hasCode("INVALID_CURSOR"));
  assert.throws(() => decodeWatchHistoryCursor("a".repeat(513)), hasCode("INVALID_CURSOR"));
});

test("v2 session identity excludes roomless shared tombstones", () => {
  assert.equal(
    isMeaningfulWatchHistoryV2SessionIdentity({
      roomId: null,
      clientSessionKey: null,
    }),
    false,
  );
  assert.equal(
    isMeaningfulWatchHistoryV2SessionIdentity({
      roomId: "room-one",
      clientSessionKey: null,
    }),
    true,
  );
  assert.equal(
    isMeaningfulWatchHistoryV2SessionIdentity({
      roomId: null,
      clientSessionKey: "solo-session-one",
    }),
    true,
  );
});

test("canonical read derives observed-only titles, seasons, episodes, and sessions from v2 rows", () => {
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: [
      {
        user_id: USER_ID,
        provider: "crunchyroll",
        title_key: "series-one",
        episode_key: "episode-one",
        item_kind: "series",
        title: "Series One",
        artwork_url: null,
        episode_title: "Episode One",
        season_key: "season-one",
        season_title: "Season One",
        season_number: 1,
        episode_number: 1,
        source_url: "https://www.crunchyroll.com/watch/episode-one/demo",
        current_time: 600,
        duration: 1_200,
        progress: 0.5,
        completed_at: null,
        latest_session_id: SESSION_ID,
        observed_at: NOW,
        server_order: 1,
        history_generation: 1,
      },
    ],
    sessions: [session()],
  });

  assert.equal(response.totalTitleCount, 1);
  assert.equal(response.meta.ownerUserId, USER_ID);
  assert.equal(response.meta.accountGeneration, 1);
  assert.equal(response.items[0]?.catalogState, "unavailable");
  assert.deepEqual(response.items[0]?.aggregate, {
    completedEpisodes: 0,
    availableEpisodes: null,
    progress: null,
  });
  assert.equal(response.items[0]?.seasons[0]?.episodes[0]?.episodeKey, "episode-one");
  assert.equal(response.items[0]?.seasons[0]?.nextEpisode, null);
  assert.equal(response.items[0]?.sessions[0]?.id, SESSION_ID);
});

test("canonical read includes every meaningful v2 session associated with the visible episode", () => {
  const earlierSession = {
    ...session(),
    id: "44444444-4444-4444-8444-444444444444",
    startedAt: "2026-08-14T09:00:00.000Z",
    lastWatchedAt: "2026-08-14T10:00:00.000Z",
  };
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: [
      {
        user_id: USER_ID,
        provider: "crunchyroll",
        title_key: "series-one",
        episode_key: "episode-one",
        item_kind: "series",
        title: "Series One",
        artwork_url: null,
        episode_title: "Episode One",
        season_key: "season-one",
        season_title: "Season One",
        season_number: 1,
        episode_number: 1,
        source_url: "https://www.crunchyroll.com/watch/episode-one/demo",
        current_time: 600,
        duration: 1_200,
        progress: 0.5,
        completed_at: null,
        latest_session_id: SESSION_ID,
        observed_at: NOW,
        server_order: 1,
        history_generation: 1,
      },
    ],
    sessions: [
      { session: session(), provider: "crunchyroll", titleKey: "series-one", episodeKey: "episode-one" },
      { session: earlierSession, provider: "crunchyroll", titleKey: "series-one", episodeKey: "episode-one" },
    ],
  });
  assert.deepEqual(
    response.items[0]?.sessions.map((value) => value.id),
    [SESSION_ID, earlierSession.id],
  );
  assert.deepEqual(
    response.items[0]?.seasons[0]?.episodes[0]?.sessions.map((value) => value.id),
    [SESSION_ID, earlierSession.id],
  );
});

test("canonical latest activity uses server order when normalized observation times tie", () => {
  const common = {
    user_id: USER_ID,
    provider: "crunchyroll" as const,
    title_key: "series-one",
    item_kind: "series" as const,
    title: "Series One",
    artwork_url: null,
    episode_title: "Episode One",
    season_key: "season-one",
    season_title: "Season One",
    season_number: 1,
    episode_number: 1,
    source_url: "https://www.crunchyroll.com/watch/episode-one/demo",
    duration: 1_200,
    progress: 0.5,
    completed_at: null,
    latest_session_id: null,
    observed_at: NOW,
    history_generation: 1,
  };
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: [
      {
        ...common,
        episode_key: "episode-one",
        current_time: 300,
        server_order: 10,
      },
      {
        ...common,
        episode_key: "episode-two",
        episode_title: "Episode Two",
        episode_number: 2,
        current_time: 900,
        server_order: 11,
      },
    ],
    sessions: [],
  });

  assert.equal(response.items[0]?.latestActivity.episodeKey, "episode-two");
  assert.equal(response.items[0]?.latestActivity.currentTime, 900);
});

test("delete parses exact duplicate acknowledgement and never reports optimistic success", async () => {
  const deletionAck: WatchHistoryDeletionAck = {
    meta: {
      serverTime: NOW,
      schemaVersion: 2,
      ownerUserId: USER_ID,
      accountGeneration: 2,
    },
    schemaVersion: 2,
    clientMutationId: EVENT_ID,
    accountGeneration: 2,
    target: { scope: "all" },
    deletedAt: NOW,
  };
  const value = await deleteWatchHistoryV2({
    userId: USER_ID,
    input: {
      schemaVersion: 2,
      clientMutationId: EVENT_ID,
      accountGeneration: 1,
      target: { scope: "all" },
      requestedAt: NOW,
    },
    store: storeStub({ deleteHistory: async () => deletionAck }),
  });
  assert.deepEqual(value, deletionAck);
  await assert.rejects(
    () =>
      deleteWatchHistoryV2({
        userId: USER_ID,
        input: {
          schemaVersion: 2,
          clientMutationId: EVENT_ID,
          accountGeneration: 1,
          target: { scope: "all" },
          requestedAt: NOW,
        },
        store: storeStub({
          deleteHistory: async () => {
            throw { message: "watch_history_deleted" };
          },
        }),
      }),
    hasCode("DELETED_HISTORY"),
  );
});

function storeStub(overrides: Partial<WatchHistoryV2Store>): WatchHistoryV2Store {
  return {
    applyProgress: async () => ack(),
    loadHistory: async () => ({ accountGeneration: 1, progressRows: [], sessions: [] }),
    getPreferences: async () => ({ accountGeneration: 1, youtubeHistoryEnabled: false }),
    setPreferences: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2, ownerUserId: USER_ID, accountGeneration: 1 },
      preferences: { youtubeHistoryEnabled: false },
    }),
    deleteHistory: async () => {
      throw new Error("not implemented in test");
    },
    getRoomSource: async () => null,
    ...overrides,
  };
}

function hasCode(code: string) {
  return (error: unknown) => error instanceof WatchHistoryV2ApiError && error.code === code;
}
