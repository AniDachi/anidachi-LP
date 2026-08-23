import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  createWatchHistoryV2RouteHandlers,
  type WatchHistoryV2RouteDependencies,
} from "./watch-history-v2-routes";
import {
  applyWatchProgressV2,
  encodeWatchHistoryCursor,
  type WatchHistoryV2Store,
} from "./watch-history-v2";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-14T12:00:00.000Z";

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://www.anidachi.app${path}`, init);
}

function progressBody() {
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
  };
}

function dependencies(overrides: Partial<WatchHistoryV2RouteDependencies> = {}) {
  return {
    getSession: async () => ({
      userId: USER_ID,
      email: "private@example.com",
      plan: "free" as const,
      source: "extension" as const,
    }),
    listHistory: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 1 },
      generatedAt: NOW,
      totalTitleCount: 0,
      items: [],
      nextCursor: null,
    }),
    listTitleEpisodes: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 1 },
      generatedAt: NOW,
      provider: "crunchyroll" as const,
      titleKey: "series-one",
      observedEpisodeCount: 0,
      completedEpisodeCount: 0,
      episodes: [],
      complete: true,
      nextCursor: null,
    }),
    applyProgress: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 1 },
      schemaVersion: 2 as const,
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
        sessions: [],
      },
    }),
    getPreferences: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 1 },
      preferences: { youtubeHistoryEnabled: false },
    }),
    updatePreferences: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 1 },
      preferences: { youtubeHistoryEnabled: true },
    }),
    deleteHistory: async () => ({
      meta: { serverTime: NOW, schemaVersion: 2 as const, ownerUserId: USER_ID, accountGeneration: 2 },
      schemaVersion: 2 as const,
      clientMutationId: EVENT_ID,
      accountGeneration: 2,
      target: { scope: "all" as const },
      deletedAt: NOW,
    }),
    createRoomFromSession: async () => ({
      roomId: "room-one",
      roomToken: "opaque-room-token",
      shareableLink: "https://www.anidachi.app/room/room-one",
      reused: false,
      capabilities: {
        hostPlanCode: "free" as const,
        maxParticipants: 4,
        maxMediaSeats: 2,
        canNameRoom: false,
        canSendPushInvites: false,
      },
      quota: { remainingSeconds: 1_800, resetAt: "2026-08-15T00:00:00.000Z" },
    }),
    ...overrides,
  } satisfies WatchHistoryV2RouteDependencies;
}

test("every v2 route fails closed when cookie and bearer authentication are invalid", async () => {
  const routes = createWatchHistoryV2RouteHandlers(
    dependencies({ getSession: async () => null }),
  );
  const responses = await Promise.all([
    routes.getHistory(request("/api/watch-history/v2")),
    routes.getTitleEpisodes(request("/api/watch-history/v2/title-episodes?provider=crunchyroll&titleKey=series-one")),
    routes.postProgress(request("/api/watch-history/v2/progress", { method: "POST", body: "{}" })),
    routes.getPreferences(request("/api/watch-history/v2/preferences")),
    routes.patchPreferences(request("/api/watch-history/v2/preferences", { method: "PATCH", body: "{}" })),
    routes.postDelete(request("/api/watch-history/v2/delete", { method: "POST", body: "{}" })),
    routes.postRoom(request("/api/watch-history/v2/rooms", { method: "POST", body: "{}" })),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required", code: "UNAUTHORIZED" });
  }
});

test("progress rejects malformed, extra-field, and oversized JSON before service work", async () => {
  let calls = 0;
  const routes = createWatchHistoryV2RouteHandlers(
    dependencies({ applyProgress: async () => { calls += 1; throw new Error("must not run"); } }),
  );
  const malformed = await routes.postProgress(
    request("/api/watch-history/v2/progress", { method: "POST", body: "{" }),
  );
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "INVALID_JSON");

  const extra = await routes.postProgress(
    request("/api/watch-history/v2/progress", {
      method: "POST",
      body: JSON.stringify({ ...progressBody(), userId: USER_ID }),
    }),
  );
  assert.equal(extra.status, 400);
  assert.equal((await extra.json()).code, "INVALID_REQUEST");

  const oversized = await routes.postProgress(
    request("/api/watch-history/v2/progress", {
      method: "POST",
      headers: { "content-length": "70000" },
      body: JSON.stringify(progressBody()),
    }),
  );
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, "PAYLOAD_TOO_LARGE");
  assert.equal(calls, 0);
});

test("progress stops reading a chunked body immediately after the actual byte limit", async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls <= 100) {
        controller.enqueue(new Uint8Array(1_024));
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  const routes = createWatchHistoryV2RouteHandlers(dependencies());
  const response = await routes.postProgress(
    request("/api/watch-history/v2/progress", {
      method: "POST",
      headers: { "content-length": "1" },
      body: stream,
      duplex: "half",
    }),
  );

  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
  assert.equal(cancelled, true);
  assert.ok(pulls < 100);
});

test("progress derives ownership from the authenticated session", async () => {
  let receivedUserId = "";
  const deps = dependencies();
  const routes = createWatchHistoryV2RouteHandlers({
    ...deps,
    applyProgress: async (params) => {
      receivedUserId = params.userId;
      return deps.applyProgress(params);
    },
  });
  const response = await routes.postProgress(
    request("/api/watch-history/v2/progress", {
      method: "POST",
      body: JSON.stringify(progressBody()),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(receivedUserId, USER_ID);
});

test("progress route returns a shared canonical receipt before expired-authority verification", async () => {
  const deps = dependencies();
  const canonicalReceipt = await deps.applyProgress({ userId: USER_ID, input: progressBody() });
  let verifyCalls = 0;
  let writerCalls = 0;
  const store: WatchHistoryV2Store = {
    getProgressReceipt: async () => canonicalReceipt,
    applyProgress: async () => {
      writerCalls += 1;
      throw new Error("must not write an already-receipted event");
    },
    loadHistory: async () => ({ accountGeneration: 1, progressRows: [], sessions: [] }),
    getPreferences: async () => ({ accountGeneration: 1, youtubeHistoryEnabled: false }),
    setPreferences: async () => { throw new Error("not used"); },
    deleteHistory: async () => { throw new Error("not used"); },
    getRoomSource: async () => null,
  };
  const routes = createWatchHistoryV2RouteHandlers(dependencies({
    applyProgress: ({ userId, input }) => applyWatchProgressV2({
      userId,
      input,
      store,
      verifyAuthority: async () => {
        verifyCalls += 1;
        throw new Error("expired");
      },
    }),
  }));
  const response = await routes.postProgress(request("/api/watch-history/v2/progress", {
    method: "POST",
    body: JSON.stringify({
      ...progressBody(),
      sharedRoom: {
        roomId: "room-one",
        participantSessionId: "participant-session-one",
        roomGeneration: 1,
        sourceGeneration: 1,
        attestation: "expired-but-already-receipted",
      },
    }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), canonicalReceipt);
  assert.equal(verifyCalls, 0);
  assert.equal(writerCalls, 0);
});

test("progress route fails closed for every noncanonical receipt-first outcome", async (t) => {
  const deps = dependencies();
  const canonicalReceipt = await deps.applyProgress({ userId: USER_ID, input: progressBody() });
  const cases = [
    {
      name: "malformed acknowledgement",
      receipt: { duplicate: true },
      status: 502,
      code: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong owner",
      receipt: {
        ...canonicalReceipt,
        meta: {
          ...canonicalReceipt.meta,
          ownerUserId: "55555555-5555-4555-8555-555555555555",
        },
      },
      status: 502,
      code: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong event id",
      receipt: {
        ...canonicalReceipt,
        acceptedEventId: "66666666-6666-4666-8666-666666666666",
      },
      status: 502,
      code: "INVALID_DATABASE_RESPONSE",
      expectedVerifyCalls: 0,
    },
    {
      name: "wrong kind",
      receiptError: new Error("watch_history_client_id_conflict"),
      status: 409,
      code: "CLIENT_ID_CONFLICT",
      expectedVerifyCalls: 0,
    },
    {
      name: "expired receipt miss",
      receipt: null,
      status: 403,
      code: "INVALID_ROOM_AUTHORITY",
      expectedVerifyCalls: 1,
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let verifyCalls = 0;
      let writerCalls = 0;
      const store: WatchHistoryV2Store = {
        getProgressReceipt: async () => {
          if ("receiptError" in scenario) throw scenario.receiptError;
          return scenario.receipt;
        },
        applyProgress: async () => {
          writerCalls += 1;
          return canonicalReceipt;
        },
        loadHistory: async () => ({ accountGeneration: 1, progressRows: [], sessions: [] }),
        getPreferences: async () => ({ accountGeneration: 1, youtubeHistoryEnabled: false }),
        setPreferences: async () => { throw new Error("not used"); },
        deleteHistory: async () => { throw new Error("not used"); },
        getRoomSource: async () => null,
      };
      const routes = createWatchHistoryV2RouteHandlers(dependencies({
        applyProgress: ({ userId, input }) => applyWatchProgressV2({
          userId,
          input,
          store,
          verifyAuthority: async () => {
            verifyCalls += 1;
            throw new Error("invalid or expired authority");
          },
        }),
      }));
      const response = await routes.postProgress(request("/api/watch-history/v2/progress", {
        method: "POST",
        body: JSON.stringify({
          ...progressBody(),
          sharedRoom: {
            roomId: "room-one",
            participantSessionId: "participant-session-one",
            roomGeneration: 1,
            sourceGeneration: 1,
            attestation: "untrusted-unless-exactly-receipted",
          },
        }),
      }));

      assert.equal(response.status, scenario.status);
      assert.equal((await response.json()).code, scenario.code);
      assert.equal(verifyCalls, scenario.expectedVerifyCalls);
      assert.equal(writerCalls, 0);
    });
  }
});

test("history validates limit and opaque cursor boundaries", async () => {
  const routes = createWatchHistoryV2RouteHandlers(dependencies());
  for (const query of ["limit=0", "limit=101", "limit=1.5", "cursor=not-a-cursor"]) {
    const response = await routes.getHistory(request(`/api/watch-history/v2?${query}`));
    assert.equal(response.status, 400);
  }
});

test("history returns an opaque cursor that round-trips unchanged over HTTP", async () => {
  const opaqueCursor = encodeWatchHistoryCursor({
    lastWatchedAt: NOW,
    stableId: "crunchyroll:series-one",
  });
  const receivedCursors: unknown[] = [];
  const deps = dependencies();
  const routes = createWatchHistoryV2RouteHandlers({
    ...deps,
    listHistory: async (params) => {
      receivedCursors.push(params.cursor);
      return {
        ...(await deps.listHistory(params)),
        nextCursor: receivedCursors.length === 1 ? opaqueCursor : null,
      };
    },
  });

  const first = await routes.getHistory(request("/api/watch-history/v2?limit=1"));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.nextCursor, opaqueCursor);

  const second = await routes.getHistory(
    request(`/api/watch-history/v2?limit=1&cursor=${firstBody.nextCursor}`),
  );
  assert.equal(second.status, 200);
  assert.deepEqual(receivedCursors, [
    null,
    { lastWatchedAt: NOW, stableId: "crunchyroll:series-one" },
  ]);
});

test("history rejects unknown and duplicate query parameters", async () => {
  const routes = createWatchHistoryV2RouteHandlers(dependencies());
  for (const query of [
    "unknown=value",
    "limit=1&limit=2",
    "cursor=value&cursor=value",
  ]) {
    const response = await routes.getHistory(
      request(`/api/watch-history/v2?${query}`),
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_QUERY");
  }
});

test("title episode detail route authenticates ownership and parses an exact bounded query", async () => {
  const received: unknown[] = [];
  const routes = createWatchHistoryV2RouteHandlers(dependencies({
    listTitleEpisodes: async (params) => {
      received.push(params);
      return {
        meta: {
          serverTime: NOW,
          schemaVersion: 2,
          ownerUserId: USER_ID,
          accountGeneration: 1,
        },
        generatedAt: NOW,
        provider: "crunchyroll",
        titleKey: "series-one",
        observedEpisodeCount: 1,
        completedEpisodeCount: 0,
        episodes: [],
        complete: true,
        nextCursor: null,
      };
    },
  }));
  const response = await routes.getTitleEpisodes(request(
    "/api/watch-history/v2/title-episodes?provider=crunchyroll&titleKey=series-one&limit=50&cursor=episode_cursor",
  ));
  assert.equal(response.status, 200);
  assert.deepEqual(received, [{
    userId: USER_ID,
    provider: "crunchyroll",
    titleKey: "series-one",
    limit: 50,
    cursor: "episode_cursor",
  }]);

  for (const query of [
    "provider=crunchyroll&titleKey=series-one&limit=51",
    "provider=crunchyroll&titleKey=series-one&unknown=1",
    "provider=crunchyroll&provider=youtube&titleKey=series-one",
    "provider=netflix&titleKey=series-one",
    "provider=crunchyroll&titleKey=",
  ]) {
    const invalidResponse: Response = await routes.getTitleEpisodes(request(
      `/api/watch-history/v2/title-episodes?${query}`,
    ));
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).code, "INVALID_QUERY");
  }
  assert.equal(received.length, 1);
});

test("title episode detail route fails closed before service work when unauthenticated", async () => {
  let calls = 0;
  const routes = createWatchHistoryV2RouteHandlers(dependencies({
    getSession: async () => null,
    listTitleEpisodes: async () => {
      calls += 1;
      throw new Error("must not run");
    },
  }));
  const response = await routes.getTitleEpisodes(request(
    "/api/watch-history/v2/title-episodes?provider=crunchyroll&titleKey=series-one",
  ));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("preferences expose only the YouTube flag and reject unknown fields", async () => {
  const routes = createWatchHistoryV2RouteHandlers(dependencies());
  const getResponse = await routes.getPreferences(request("/api/watch-history/v2/preferences"));
  assert.deepEqual(await getResponse.json(), {
    meta: { serverTime: NOW, schemaVersion: 2, ownerUserId: USER_ID, accountGeneration: 1 },
    preferences: { youtubeHistoryEnabled: false },
  });
  const patchResponse = await routes.patchPreferences(
    request("/api/watch-history/v2/preferences", {
      method: "PATCH",
      body: JSON.stringify({ youtubeHistoryEnabled: true, userId: USER_ID }),
    }),
  );
  assert.equal(patchResponse.status, 400);
  assert.equal((await patchResponse.json()).code, "INVALID_REQUEST");

  for (const query of ["unused=1", "youtubeHistoryEnabled=true"]) {
    const getWithQuery = await routes.getPreferences(
      request(`/api/watch-history/v2/preferences?${query}`),
    );
    assert.equal(getWithQuery.status, 400);
    assert.equal((await getWithQuery.json()).code, "INVALID_QUERY");
  }
});

test("delete and room recreation require strict bodies and return only service results", async () => {
  const routes = createWatchHistoryV2RouteHandlers(dependencies());
  const deleteResponse = await routes.postDelete(
    request("/api/watch-history/v2/delete", {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: 2,
        clientMutationId: EVENT_ID,
        accountGeneration: 1,
        target: { scope: "all" },
        requestedAt: NOW,
      }),
    }),
  );
  assert.equal(deleteResponse.status, 200);
  assert.equal((await deleteResponse.json()).accountGeneration, 2);

  const badRoom = await routes.postRoom(
    request("/api/watch-history/v2/rooms", {
      method: "POST",
      body: JSON.stringify({ sessionId: EVENT_ID, userId: USER_ID }),
    }),
  );
  assert.equal(badRoom.status, 400);
  assert.equal((await badRoom.json()).code, "INVALID_REQUEST");

  const missingSessionBinding = await routes.postRoom(
    request("/api/watch-history/v2/rooms", {
      method: "POST",
      body: JSON.stringify({ sessionId: EVENT_ID }),
    }),
  );
  assert.equal(missingSessionBinding.status, 400);
  assert.equal((await missingSessionBinding.json()).code, "INVALID_REQUEST");
});

test("room recreation forwards the exact tab session and returns the shared conflict", async () => {
  let participantSessionId = "";
  const success = createWatchHistoryV2RouteHandlers(
    dependencies({
      createRoomFromSession: async (params) => {
        participantSessionId = params.participantSessionId;
        return dependencies().createRoomFromSession(params);
      },
    }),
  );
  const response = await success.postRoom(
    request("/api/watch-history/v2/rooms", {
      method: "POST",
      body: JSON.stringify({
        sessionId: EVENT_ID,
        participantSessionId: "participant-session-one",
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(participantSessionId, "participant-session-one");

  const conflict = createWatchHistoryV2RouteHandlers(
    dependencies({
      createRoomFromSession: async () => ({
        outcome: "conflict",
        activeRoom: {
          roomId: "active-youtube-room",
          role: "member",
          provider: "youtube",
          title: "Another video",
        },
      }),
    }),
  );
  const conflictResponse = await conflict.postRoom(
    request("/api/watch-history/v2/rooms", {
      method: "POST",
      body: JSON.stringify({
        sessionId: EVENT_ID,
        participantSessionId: "participant-session-two",
      }),
    }),
  );
  assert.equal(conflictResponse.status, 409);
  assert.deepEqual(await conflictResponse.json(), {
    code: "ACTIVE_ROOM_CONFLICT",
    message: "You already have an active watch room.",
    activeRoom: {
      roomId: "active-youtube-room",
      role: "member",
      provider: "youtube",
      title: "Another video",
    },
  });
});
