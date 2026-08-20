import assert from "node:assert/strict";
import test from "node:test";
import type {
  WatchHistoryDeletionAck,
  WatchProgressAck,
} from "@anidachi/protocol";
import * as watchHistoryV2Module from "./watch-history-v2";
import {
  applyWatchProgressV2,
  buildWatchHistoryV2Response,
  decodeWatchHistoryCursor,
  deleteWatchHistoryV2,
  encodeWatchHistoryCursor,
  isMeaningfulWatchHistoryV2SessionIdentity,
  listWatchHistoryV2,
  parseWatchProgressEventV2,
  supabaseWatchHistoryV2Store,
  WatchHistoryV2ApiError,
  type WatchHistoryV2Store,
} from "./watch-history-v2";
import {
  bindWatchHistoryPageRefresh,
  getWatchHistoryAggregateLabel,
  mergeWatchHistoryPages,
  removeWatchHistoryTarget,
} from "../../app/account/watch-library/watch-library-client";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-14T12:00:00.000Z";

function progressRow(overrides: Record<string, unknown> = {}) {
  return {
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
    current_time_seconds: 600,
    duration: 1_200,
    progress: 0.5,
    completed_at: null,
    latest_session_id: SESSION_ID,
    observed_at: NOW,
    server_order: 1,
    history_generation: 1,
    ...overrides,
  };
}

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
  assert.equal(
    parseWatchProgressEventV2(
      progressEvent({
        provider: "youtube",
        titleKey: "abcdefghijk",
        episodeKey: "abcdefghijk",
        sourceUrl: "https://youtube.com/watch?v=abcdefghijk",
      }),
    ).provider,
    "youtube",
  );
  assert.throws(
    () => parseWatchProgressEventV2(progressEvent({
      provider: "youtube",
      sourceUrl: "https://m.youtube.com/watch?v=abcdefghijk",
    })),
    hasCode("PROVIDER_DOMAIN_MISMATCH"),
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
        typ: "room_history",
        iss: "anidachi-worker",
        aud: "anidachi-web-history",
        sub: USER_ID,
        roomId: "room-one",
        participantSessionId: "participant-session-one",
        roomGeneration: 2,
        sourceGeneration: 3,
        iat: 1_786_680_000,
        exp: 1_786_766_400,
        jti: "44444444-4444-4444-8444-444444444444",
      }),
    }),
    ack(),
  );
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls).includes("opaque-secret-authority"), false);
  assert.deepEqual(calls[0]?.[2], {
    typ: "room_history",
    iss: "anidachi-worker",
    aud: "anidachi-web-history",
    sub: USER_ID,
    roomId: "room-one",
    participantSessionId: "participant-session-one",
    roomGeneration: 2,
    sourceGeneration: 3,
    iat: 1_786_680_000,
    exp: 1_786_766_400,
    jti: "44444444-4444-4444-8444-444444444444",
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

test("shared progress returns its canonical receipt before verifying an expired authority", async () => {
  let verifyCalls = 0;
  let applyCalls = 0;
  const duplicate = ack({ duplicate: true });
  const store = storeStub({
    getProgressReceipt: async () => duplicate,
    applyProgress: async () => {
      applyCalls += 1;
      return ack();
    },
  });

  assert.deepEqual(await applyWatchProgressV2({
    userId: USER_ID,
    input: progressEvent({
      sharedRoom: {
        roomId: "room-one",
        participantSessionId: "participant-session-one",
        roomGeneration: 2,
        sourceGeneration: 3,
        attestation: "expired-but-already-receipted",
      },
    }),
    store,
    verifyAuthority: async () => {
      verifyCalls += 1;
      throw new Error("expired");
    },
  }), duplicate);
  assert.equal(verifyCalls, 0);
  assert.equal(applyCalls, 0);
});

test("shared receipt-first failures close every noncanonical bypass before writing", async (t) => {
  const otherUserId = "55555555-5555-4555-8555-555555555555";
  const otherEventId = "66666666-6666-4666-8666-666666666666";
  const cases = [
    {
      name: "malformed acknowledgement",
      receipt: { duplicate: true },
      errorCode: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong receipt owner",
      receipt: ack({ meta: { ...ack().meta, ownerUserId: otherUserId } }),
      errorCode: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong receipt event id",
      receipt: ack({ acceptedEventId: otherEventId }),
      errorCode: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong receipt kind",
      receiptError: new Error("watch_history_client_id_conflict"),
      errorCode: "CLIENT_ID_CONFLICT",
      expectedVerifyCalls: 0,
    },
    {
      name: "expired receipt miss",
      receipt: null,
      errorCode: "INVALID_ROOM_AUTHORITY",
      expectedVerifyCalls: 1,
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let verifyCalls = 0;
      let applyCalls = 0;
      const store = storeStub({
        getProgressReceipt: async () => {
          if ("receiptError" in scenario) throw scenario.receiptError;
          return scenario.receipt;
        },
        applyProgress: async () => {
          applyCalls += 1;
          return ack();
        },
      });

      await assert.rejects(
        () => applyWatchProgressV2({
          userId: USER_ID,
          input: progressEvent({
            sharedRoom: {
              roomId: "room-one",
              participantSessionId: "participant-session-one",
              roomGeneration: 2,
              sourceGeneration: 3,
              attestation: "untrusted-unless-exactly-receipted",
            },
          }),
          store,
          verifyAuthority: async () => {
            verifyCalls += 1;
            throw new Error("invalid or expired authority");
          },
        }),
        hasCode(scenario.errorCode),
      );
      assert.equal(verifyCalls, scenario.expectedVerifyCalls);
      assert.equal(applyCalls, 0);
    });
  }
});

test("production receipt lookup is owner-event-expiry scoped and fails closed on kind or ack", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://watch-history-receipt.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  let databaseRow: unknown = { kind: "progress", acknowledgement: ack({ duplicate: true }) };
  const requestUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requestUrls.push(input instanceof Request ? input.url : input.toString());
    return new Response(JSON.stringify(databaseRow), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const beforeLookup = Date.now();
  assert.deepEqual(
    await supabaseWatchHistoryV2Store.getProgressReceipt(USER_ID, EVENT_ID),
    ack({ duplicate: true }),
  );
  const afterLookup = Date.now();
  const query = new URL(requestUrls[0] ?? "");
  assert.equal(query.pathname, "/rest/v1/watch_history_receipts");
  assert.equal(query.searchParams.get("select"), "kind,acknowledgement");
  assert.equal(query.searchParams.get("user_id"), `eq.${USER_ID}`);
  assert.equal(query.searchParams.get("client_id"), `eq.${EVENT_ID}`);
  const expiresFilter = query.searchParams.get("expires_at");
  assert.match(expiresFilter ?? "", /^gt\./);
  const filterTime = Date.parse((expiresFilter ?? "").slice(3));
  assert.ok(filterTime >= beforeLookup && filterTime <= afterLookup);

  databaseRow = { kind: "delete", acknowledgement: ack({ duplicate: true }) };
  await assert.rejects(
    () => supabaseWatchHistoryV2Store.getProgressReceipt(USER_ID, EVENT_ID),
    /watch_history_client_id_conflict/,
  );

  databaseRow = { kind: "progress", acknowledgement: { duplicate: true } };
  let verifyCalls = 0;
  let applyCalls = 0;
  await assert.rejects(
    () => applyWatchProgressV2({
      userId: USER_ID,
      input: progressEvent({
        sharedRoom: {
          roomId: "room-one",
          participantSessionId: "participant-session-one",
          roomGeneration: 2,
          sourceGeneration: 3,
          attestation: "must-not-bypass-on-malformed-store-ack",
        },
      }),
      store: storeStub({
        getProgressReceipt: (userId, clientEventId) =>
          supabaseWatchHistoryV2Store.getProgressReceipt(userId, clientEventId),
        applyProgress: async () => {
          applyCalls += 1;
          return ack();
        },
      }),
      verifyAuthority: async () => {
        verifyCalls += 1;
        throw new Error("must not verify a malformed receipt");
      },
    }),
    hasCode("INVALID_DATABASE_RESPONSE"),
  );
  assert.equal(verifyCalls, 0);
  assert.equal(applyCalls, 0);
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

test("shared session host-order failures map to retryable bounded conflicts", async () => {
  for (const [databaseMessage, publicCode] of [
    ["watch_history_shared_session_pending", "SHARED_SESSION_PENDING"],
    ["watch_history_shared_source_mismatch", "SHARED_SOURCE_MISMATCH"],
  ] as const) {
    await assert.rejects(
      () =>
        applyWatchProgressV2({
          userId: USER_ID,
          input: progressEvent(),
          store: storeStub({
            applyProgress: async () => {
              throw { message: databaseMessage, detail: "private" };
            },
          }),
        }),
      (error) =>
        error instanceof WatchHistoryV2ApiError &&
        error.status === 409 &&
        error.code === publicCode &&
        !error.message.includes("private"),
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
        current_time_seconds: 600,
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
      {
        session: session(),
        provider: "crunchyroll",
        titleKey: "series-one",
        episodeKey: "episode-one",
      },
    ],
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
        current_time_seconds: 600,
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

test("canonical read uses durable host provenance instead of the latest-session pointer", () => {
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: [progressRow({ latest_session_id: null })],
    sessions: [
      {
        session: session(),
        provider: "crunchyroll",
        titleKey: "series-one",
        episodeKey: "episode-one",
      },
    ],
  });

  assert.equal(response.items[0]?.titleKey, "series-one");
  assert.equal(response.items[0]?.sessions[0]?.id, SESSION_ID);
});

test("canonical read validates and returns an encoded reusable cursor", () => {
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 1,
    progressRows: [
      progressRow(),
      progressRow({
        title_key: "series-two",
        episode_key: "episode-two",
        title: "Series Two",
        episode_title: "Episode Two",
        latest_session_id: null,
        observed_at: "2026-08-14T11:00:00.000Z",
        server_order: 2,
      }),
    ],
    sessions: [],
  });

  assert.equal(typeof response.nextCursor, "string");
  assert.deepEqual(decodeWatchHistoryCursor(response.nextCursor!), {
    lastWatchedAt: NOW,
    stableId: "crunchyroll:series-one",
  });
});

test("canonical read delegates the title page boundary to storage", async () => {
  let requestedPage: unknown;
  const response = await listWatchHistoryV2({
    userId: USER_ID,
    limit: 1,
    now: new Date(NOW),
    store: storeStub({
      loadHistory: async (_userId, page) => {
        requestedPage = page;
        return {
          accountGeneration: 1,
          progressRows: [progressRow()],
          sessions: [],
          totalTitleCount: 2,
          hasMore: true,
        };
      },
    }),
  });

  assert.deepEqual(requestedPage, { limit: 1, cursor: null });
  assert.equal(response.totalTitleCount, 2);
  assert.deepEqual(response.items.map((item) => item.titleKey), ["series-one"]);
  assert.deepEqual(decodeWatchHistoryCursor(response.nextCursor!), {
    lastWatchedAt: NOW,
    stableId: "crunchyroll:series-one",
  });
});

test("server-bounded read preserves database binary title order for its cursor", () => {
  const response = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 3,
    progressRows: [
      progressRow({
        title_key: "A",
        episode_key: "episode-uppercase",
        title: "Uppercase",
        latest_session_id: null,
      }),
      progressRow({
        title_key: "a-",
        episode_key: "episode-hyphen",
        title: "Hyphen",
        latest_session_id: null,
      }),
      progressRow({
        title_key: "a_",
        episode_key: "episode-underscore",
        title: "Underscore",
        latest_session_id: null,
      }),
    ],
    sessions: [],
    totalTitleCount: 4,
    hasMore: true,
  });

  assert.deepEqual(response.items.map((item) => item.titleKey), ["A", "a-", "a_"]);
  assert.deepEqual(decodeWatchHistoryCursor(response.nextCursor!), {
    lastWatchedAt: NOW,
    stableId: "crunchyroll:a_",
  });
});

test("observed history supports 101 seasons and 501 episodes exactly", () => {
  const seasons = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: Array.from({ length: 101 }, (_, index) =>
      progressRow({
        episode_key: `season-${index}-episode`,
        episode_title: `Episode ${index}`,
        season_key: `season-${index}`,
        season_title: `Season ${index}`,
        season_number: index,
        episode_number: 1,
        latest_session_id: null,
        server_order: index + 1,
      }),
    ),
    sessions: [],
  });
  assert.equal(seasons.items[0]?.seasons.length, 101);

  const episodes = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    generatedAt: new Date(NOW),
    limit: 100,
    progressRows: Array.from({ length: 501 }, (_, index) =>
      progressRow({
        episode_key: `episode-${index}`,
        episode_title: `Episode ${index}`,
        episode_number: index,
        latest_session_id: null,
        server_order: index + 1,
      }),
    ),
    sessions: [],
  });
  assert.equal(episodes.items[0]?.seasons[0]?.episodes.length, 501);
});

test("history progress loading advances by capped page length until exact total", async () => {
  const loadAll = (
    watchHistoryV2Module as unknown as {
      loadAllWatchHistoryProgressRows?: (
        loadRange: (
          from: number,
          to: number,
        ) => Promise<{ rows: unknown[]; total: number | null }>,
      ) => Promise<unknown[]>;
    }
  ).loadAllWatchHistoryProgressRows;
  assert.equal(typeof loadAll, "function");
  const ranges: Array<[number, number]> = [];
  const sourceRows = Array.from({ length: 2_005 }, (_, index) => ({ index }));
  const rows = await loadAll!(async (from, to) => {
    ranges.push([from, to]);
    return {
      rows: sourceRows.slice(from, Math.min(from + 137, to + 1)),
      total: sourceRows.length,
    };
  });

  assert.deepEqual(ranges.slice(0, 3), [
    [0, 999],
    [137, 1_136],
    [274, 1_273],
  ]);
  assert.deepEqual(rows, sourceRows);
});

test("history range loading fails closed on incomplete or unstable exact counts", async () => {
  const loadAll = (
    watchHistoryV2Module as unknown as {
      loadAllWatchHistoryProgressRows?: (
        loadRange: (
          from: number,
          to: number,
        ) => Promise<{ rows: unknown[]; total: unknown }>,
      ) => Promise<unknown[]>;
    }
  ).loadAllWatchHistoryProgressRows;
  assert.equal(typeof loadAll, "function");

  await assert.rejects(
    () => loadAll!(async () => ({ rows: [], total: 2 })),
    hasCode("INVALID_DATABASE_RESPONSE"),
  );
  await assert.rejects(
    () => loadAll!(async () => ({ rows: [], total: null })),
    hasCode("INVALID_DATABASE_RESPONSE"),
  );
  let request = 0;
  await assert.rejects(
    () =>
      loadAll!(async () => ({
        rows: [{ request: request++ }],
        total: request === 1 ? 2 : 3,
      })),
    hasCode("INVALID_DATABASE_RESPONSE"),
  );
});

test("session enrichment exhausts more than 2000 owners with bounded IN batches", async () => {
  const loadExact = (
    watchHistoryV2Module as unknown as {
      loadExactWatchHistorySessionEnrichment?: (params: {
        loadOwnerParticipants: (from: number, to: number) => Promise<unknown>;
        loadSessions: (ids: string[], from: number, to: number) => Promise<unknown>;
        loadParticipants: (ids: string[], from: number, to: number) => Promise<unknown>;
        loadUsers: (ids: string[], from: number, to: number) => Promise<unknown>;
        loadProfiles: (ids: string[], from: number, to: number) => Promise<unknown>;
      }) => Promise<{
        sessions: unknown[];
        participants: unknown[];
      }>;
    }
  ).loadExactWatchHistorySessionEnrichment;
  assert.equal(typeof loadExact, "function");

  const uuid = (index: number) =>
    `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
  const sessionIds = Array.from({ length: 2_005 }, (_, index) => uuid(index + 10));
  const participantIds = [
    USER_ID,
    ...Array.from({ length: 10 }, (_, index) => uuid(index + 4_000)),
  ];
  const ownerRanges: Array<[number, number]> = [];
  const batchSizes: number[] = [];
  const participantRanges: Array<[number, number]> = [];
  const page = (values: unknown[], from: number, to: number) => ({
    rows: values.slice(from, Math.min(from + 137, to + 1)),
    total: values.length,
  });

  const enrichment = await loadExact!({
    loadOwnerParticipants: async (from, to) => {
      ownerRanges.push([from, to]);
      return page(sessionIds.map((session_id) => ({ session_id })), from, to);
    },
    loadSessions: async (ids, from, to) => {
      batchSizes.push(ids.length);
      return page(ids.map((id) => ({ id })), from, to);
    },
    loadParticipants: async (ids, from, to) => {
      batchSizes.push(ids.length);
      participantRanges.push([from, to]);
      return page(
        ids.flatMap((session_id) =>
          participantIds.map((user_id) => ({ session_id, user_id })),
        ),
        from,
        to,
      );
    },
    loadUsers: async (ids, from, to) => {
      batchSizes.push(ids.length);
      return page(ids.map((id) => ({ id })), from, to);
    },
    loadProfiles: async (ids, from, to) => {
      batchSizes.push(ids.length);
      return page(ids.map((user_id) => ({ user_id })), from, to);
    },
  });

  assert.deepEqual(ownerRanges.slice(0, 3), [
    [0, 999],
    [137, 1_136],
    [274, 1_273],
  ]);
  assert.equal(Math.max(...batchSizes), 100);
  assert.ok(participantRanges.some(([from]) => from === 137));
  assert.equal(enrichment.sessions.length, 2_005);
  assert.equal(enrichment.participants.length, 2_005 * 11);
});

test("room recreation uses durable host metadata for old and new owned sessions", () => {
  const buildSource = (
    watchHistoryV2Module as unknown as {
      buildHostAuthoritativeWatchHistoryRoomSource?: (params: unknown) => unknown;
    }
  ).buildHostAuthoritativeWatchHistoryRoomSource;
  assert.equal(typeof buildSource, "function");
  for (const sessionId of [SESSION_ID, "44444444-4444-4444-8444-444444444444"]) {
    assert.deepEqual(buildSource!({
      userId: USER_ID,
      sessionId,
      participant: {
        session_id: sessionId,
        user_id: USER_ID,
        schema_version: 2,
      },
      session: {
        id: sessionId,
        schema_version: 2,
        room_id: "room-one",
        client_session_key: null,
        provider: "crunchyroll",
        item_key: "host-series",
        episode_key: "host-episode",
        source_url: "https://www.crunchyroll.com/watch/owner-episode/demo",
        item_title: "Host Series",
        episode_title: "Host Episode",
        item_kind: "series",
      },
    }), {
      sessionId,
      showId: "host-series",
      episodeId: "host-episode",
      sourceUrl: "https://www.crunchyroll.com/watch/owner-episode/demo",
      title: "Host Series - Host Episode",
    });
  }
});

test("session profile enrichment replaces malformed public fields safely", () => {
  const normalize = (
    watchHistoryV2Module as unknown as {
      normalizeWatchHistoryPublicProfile?: (params: unknown) => unknown;
    }
  ).normalizeWatchHistoryPublicProfile;
  assert.equal(typeof normalize, "function");
  assert.deepEqual(
    normalize!({
      userId: USER_ID,
      profile: {
        handle: "Bad Handle",
        display_name: "D".repeat(81),
        avatar_url: `https://example.com/${"a".repeat(2_100)}`,
      },
      user: { display_name: "   ", avatar_url: "javascript:alert(1)" },
    }),
    {
      userId: USER_ID,
      handle: null,
      displayName: "AniDachi user",
      avatarUrl: null,
    },
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
        current_time_seconds: 300,
        server_order: 10,
      },
      {
        ...common,
        episode_key: "episode-two",
        episode_title: "Episode Two",
        episode_number: 2,
        current_time_seconds: 900,
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

test("website v2 model never invents totals for unavailable catalog data", () => {
  const history = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    progressRows: [
      progressRow(),
      progressRow({
        episode_key: "episode-two",
        episode_title: "Episode Two",
        episode_number: 2,
        observed_at: "2026-08-14T12:01:00.000Z",
        server_order: 2,
      }),
    ],
    sessions: [],
    limit: 50,
    generatedAt: new Date(NOW),
  });

  assert.equal(history.items[0]?.catalogState, "unavailable");
  assert.equal(getWatchHistoryAggregateLabel(history.items[0]!), "2 observed episodes");
  assert.equal(history.items[0]?.aggregate.availableEpisodes, null);
  assert.equal(history.items[0]?.seasons[0]?.nextEpisode, null);
});

test("website v2 model applies acknowledged episode, title, and all deletion scopes", () => {
  const history = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    progressRows: [
      progressRow(),
      progressRow({
        episode_key: "episode-two",
        episode_title: "Episode Two",
        episode_number: 2,
        observed_at: "2026-08-14T12:01:00.000Z",
        server_order: 2,
      }),
      progressRow({
        provider: "youtube",
        title_key: "movie-one",
        episode_key: "video-one",
        item_kind: "movie",
        title: "Movie One",
        episode_title: "Movie One",
        season_key: null,
        season_title: null,
        season_number: null,
        episode_number: null,
        source_url: "https://www.youtube.com/watch?v=video-one",
        observed_at: "2026-08-14T12:02:00.000Z",
        server_order: 3,
      }),
    ],
    sessions: [],
    limit: 50,
    generatedAt: new Date(NOW),
  });

  const withoutEpisode = removeWatchHistoryTarget(history, {
    scope: "episode",
    provider: "crunchyroll",
    titleKey: "series-one",
    episodeKey: "episode-one",
  });
  assert.deepEqual(
    withoutEpisode.items.find((item) => item.titleKey === "series-one")?.seasons[0]?.episodes.map((episode) => episode.episodeKey),
    ["episode-two"],
  );
  const withoutTitle = removeWatchHistoryTarget(withoutEpisode, {
    scope: "title",
    provider: "youtube",
    titleKey: "movie-one",
  });
  assert.deepEqual(withoutTitle.items.map((item) => item.titleKey), ["series-one"]);
  assert.deepEqual(removeWatchHistoryTarget(withoutTitle, { scope: "all" }).items, []);
});

test("website v2 model appends opaque cursor pages without duplicating titles", () => {
  const first = buildWatchHistoryV2Response({
    userId: USER_ID,
    accountGeneration: 1,
    progressRows: [progressRow()],
    sessions: [],
    limit: 50,
    generatedAt: new Date(NOW),
  });
  const duplicate = { ...first, nextCursor: "next-page" };
  const merged = mergeWatchHistoryPages(first, duplicate);

  assert.equal(merged.items.length, 1);
  assert.equal(merged.nextCursor, "next-page");
  assert.equal(merged.totalTitleCount, 1);
});

test("website refreshes canonical history when the account page regains focus", async () => {
  assert.equal(typeof bindWatchHistoryPageRefresh, "function");
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  let visibilityState: DocumentVisibilityState = "hidden";
  let refreshes = 0;
  const unbind = bindWatchHistoryPageRefresh({
    refresh: () => { refreshes += 1; },
    windowTarget,
    documentTarget,
    getVisibilityState: () => visibilityState,
    schedule: (callback) => {
      queueMicrotask(callback);
      return () => undefined;
    },
  });

  documentTarget.dispatchEvent(new Event("visibilitychange"));
  windowTarget.dispatchEvent(new Event("focus"));
  await Promise.resolve();
  assert.equal(refreshes, 1);

  visibilityState = "visible";
  documentTarget.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  assert.equal(refreshes, 2);

  unbind();
  windowTarget.dispatchEvent(new Event("focus"));
  await Promise.resolve();
  assert.equal(refreshes, 2);
});

function storeStub(overrides: Partial<WatchHistoryV2Store>): WatchHistoryV2Store {
  return {
    getProgressReceipt: async () => null,
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
