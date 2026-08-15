import { describe, expect, it, vi } from "vitest";
import {
  createWatchHistoryStorage,
  watchHistoryPartitionKey,
  type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";
import {
  createWatchHistoryContentReconnectMessage,
  createListWatchHistoryMessage,
  createWatchHistoryClient,
  isWatchHistoryMessage,
} from "../src/watch-history-client";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "alina@example.com",
    displayName: "Alina",
    avatarUrl: null,
    plan: "plus" as const,
  },
};

function progressEvent(id = "00000000-0000-4000-8000-000000000010") {
  return {
    schemaVersion: 2 as const,
    clientEventId: id,
    clientSessionKey: "content-session-a",
    accountGeneration: 1,
    provider: "youtube" as const,
    titleKey: "title-a",
    itemKind: "series" as const,
    title: "Title A",
    artworkUrl: null,
    episodeKey: "episode-a",
    episodeTitle: "Episode A",
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    currentTime: 12,
    duration: 120,
    progress: 0.1,
    observedAt: "2026-08-15T10:00:00.000Z",
    kind: "heartbeat" as const,
    sharedRoom: {
      roomId: "room-1",
      participantSessionId: "00000000-0000-4000-8000-000000000011",
      roomGeneration: 1,
      sourceGeneration: 1,
      attestation: "room-attestation-proof",
    },
  };
}

function progressAck(eventId: string, ownerUserId = session.user.id) {
  return {
    meta: { serverTime: "2026-08-15T10:00:01.000Z", schemaVersion: 2, ownerUserId, accountGeneration: 1 },
    schemaVersion: 2,
    acceptedEventId: eventId,
    acceptedAt: "2026-08-15T10:00:01.000Z",
    accountGeneration: 1,
    duplicate: false,
    episode: {
      episodeKey: "episode-a", episodeTitle: "Episode A", seasonKey: null, seasonTitle: null,
      seasonNumber: null, episodeNumber: null, sourceUrl: "https://www.youtube.com/watch?v=abc",
      currentTime: 12, duration: 120, progress: 0.1, completedAt: null,
      lastWatchedAt: "2026-08-15T10:00:01.000Z", sessions: [],
    },
  };
}

describe("watch history v2 client", () => {
  it("keeps credentials and account ownership in the background and maps retryable transport failure", async () => {
    let stored = { schemaVersion: 2 as const, partitions: {} };
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    const message = createListWatchHistoryMessage({ limit: 20 });
    expect(message).not.toHaveProperty("accessToken");
    expect(message).not.toHaveProperty("ownerUserId");
    await expect(client.handle(message)).resolves.toEqual({ ok: false, status: "retryable" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3003/api/watch-history/v2?limit=20",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("rejects caller-supplied access tokens before the background bridge runs", () => {
    expect(
      isWatchHistoryMessage({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "list",
        accessToken: "attacker-token",
      }),
    ).toBe(false);
  });

  it("strictly validates internal reconnect commands and list bounds", () => {
    expect(isWatchHistoryMessage(createWatchHistoryContentReconnectMessage())).toBe(true);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "list", limit: 0 })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "list", limit: 101 })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush", extra: true })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "create-room", sessionId: "x".repeat(129) })).toBe(false);
  });

  it("drains one bounded active outbox through the dedicated content reconnect command", async () => {
    const owner = session.user.id;
    const event = progressEvent("00000000-0000-4000-8000-000000000005");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: event,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event, key: "reconnect", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(progressAck(event.clientEventId))));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0, quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle(createWatchHistoryContentReconnectMessage())).resolves.toEqual({ ok: true, flushed: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("keeps shared-room authority only in pending work and binds acknowledgements to its snapshot", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = { schemaVersion: 2, partitions: {}, activeGenerations: {} };
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const event = progressEvent();
    let ackBody = progressAck(event.clientEventId, "00000000-0000-4000-8000-000000000002");
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: async () => new Response(JSON.stringify(ackBody)),
      storage,
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "enqueue-progress", event })).resolves.toEqual({ ok: false, status: "invalid-response" });
    const partition = stored.partitions[watchHistoryPartitionKey(owner, 1)];
    expect(partition.currentObservation).not.toHaveProperty("sharedRoom");
    expect(partition.outbox.entries[0]?.event.sharedRoom?.attestation).toBe("room-attestation-proof");
    expect(partition.outbox.entries).toHaveLength(1);
    ackBody = progressAck("00000000-0000-4000-8000-000000000099");
    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" })).resolves.toEqual({ ok: false, status: "invalid-response" });
    expect(partition.outbox.entries).toHaveLength(1);
  });

  it("returns a stable local error for unconfirmed old-owner discard", async () => {
    let stored: WatchHistoryStorageRoot = { schemaVersion: 2, partitions: {}, activeGenerations: {} };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "discard-old-owner", ownerUserId: "other-owner", confirmed: false,
    })).resolves.toEqual({ ok: false, status: "invalid-request" });
  });

  it("reclaims acknowledged pending work once before rejecting a quota-limited capture", async () => {
    const owner = session.user.id;
    const oldEvent = { ...progressEvent("00000000-0000-4000-8000-000000000020"), kind: "ended" as const };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: null,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event: oldEvent, key: "old", slot: "terminal", persistedAt: 1 }] },
        },
      },
    };
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { clientEventId: string };
      return new Response(JSON.stringify(progressAck(sent.clientEventId)));
    });
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            const entries = Object.values(value.partitions).flatMap((partition) => partition.outbox.entries);
            if (entries.length > 1) throw new Error("quota");
            stored = value;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "enqueue-progress", event: progressEvent("00000000-0000-4000-8000-000000000021"),
    })).resolves.toMatchObject({ ok: true, flushed: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("advances deletion generation without leaving old-generation work to flush", async () => {
    const owner = session.user.id;
    const event = progressEvent("00000000-0000-4000-8000-000000000030");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: event,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event, key: "old", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    const deletionAck = {
      meta: { serverTime: "2026-08-15T10:00:02.000Z", schemaVersion: 2, ownerUserId: owner, accountGeneration: 2 },
      schemaVersion: 2, clientMutationId: "00000000-0000-4000-8000-000000000031", accountGeneration: 2,
      target: { scope: "all" }, deletedAt: "2026-08-15T10:00:02.000Z",
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: async () => new Response(JSON.stringify(deletionAck)),
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0, quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "delete", input: {
        schemaVersion: 2, clientMutationId: deletionAck.clientMutationId, accountGeneration: 1,
        target: { scope: "all" }, requestedAt: "2026-08-15T10:00:00.000Z",
      },
    })).resolves.toMatchObject({ ok: true });
    expect(stored.activeGenerations?.[owner]).toBe(2);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toBeUndefined();
    expect(stored.partitions[watchHistoryPartitionKey(owner, 2)]?.outbox.entries).toEqual([]);
  });

  it("rejects a stale canonical response without replacing the newer local partition", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2 as const,
      partitions: {
        [watchHistoryPartitionKey(owner, 2)]: {
          ownerUserId: owner,
          accountGeneration: 2,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: owner, accountGeneration: 2, entries: [] },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: async () =>
        new Response(
          JSON.stringify({
            meta: {
              serverTime: "2026-08-15T10:00:00.000Z",
              schemaVersion: 2,
              ownerUserId: owner,
              accountGeneration: 1,
            },
            generatedAt: "2026-08-15T10:00:00.000Z",
            totalTitleCount: 0,
            items: [],
            nextCursor: null,
          }),
        ),
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle(createListWatchHistoryMessage())).resolves.toEqual({
      ok: false,
      status: "generation-mismatch",
    });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toBeUndefined();
  });
});
