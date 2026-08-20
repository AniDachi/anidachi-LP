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
  bestEffortFlushWatchHistoryBeforeSignOut,
  flushWatchHistoryInBackground,
  handleWatchHistoryAuthSessionChange,
  isWatchHistoryMessage,
  parseWatchHistoryBootstrapData,
  reconcileWatchHistoryThenDrain,
  usesStoredWatchHistorySession,
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
    provider: "crunchyroll" as const,
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
    sourceUrl: "https://www.crunchyroll.com/watch/episode-a",
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
      seasonNumber: null, episodeNumber: null, sourceUrl: "https://www.crunchyroll.com/watch/episode-a",
      currentTime: 12, duration: 120, progress: 0.1, completedAt: null,
      lastWatchedAt: "2026-08-15T10:00:01.000Z", sessions: [],
    },
  };
}

function readyPartition(ownerUserId: string, youtubeHistoryEnabled: boolean) {
  return {
    ownerUserId,
    accountGeneration: 1,
    cache: null,
    preferences: { youtubeHistoryEnabled },
    preferencesConfirmed: true,
    currentObservation: null,
    capturePaused: false,
    captureMarkersReady: true,
    outbox: { ownerUserId, accountGeneration: 1, entries: [] },
  };
}

describe("watch history v2 client", () => {
  it("returns confirmed current-owner cached authority without a network request", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false),
      },
    };
    const fetchImpl = vi.fn();
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap-cache",
      expectedOwnerUserId: owner,
    } as never)).resolves.toEqual({
      ok: true,
      data: {
        ownerUserId: owner,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
        capturePaused: false,
        source: "cache",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("applies the YouTube switch locally while offline and immediately authorizes local capture", async () => {
    const owner = session.user.id;
    const key = watchHistoryPartitionKey(owner, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [key]: readyPartition(owner, false) },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    })).resolves.toEqual({ ok: true });
    expect(stored.partitions[key]).toMatchObject({
      preferences: { youtubeHistoryEnabled: true },
      preferencesConfirmed: true,
      preferencesSyncPending: true,
    });

    const youtubeEvent = {
      ...progressEvent(),
      provider: "youtube" as const,
      titleKey: "youtube:video-a",
      episodeKey: "youtube:video-a",
      sourceUrl: "https://www.youtube.com/watch?v=video-a",
      sharedRoom: null,
    };
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event: youtubeEvent,
      meaningfulSolo: true,
      displayMode: "mine",
    })).resolves.toEqual({ ok: true });
    expect(stored.partitions[key]?.currentObservation?.clientEventId)
      .toBe(youtubeEvent.clientEventId);
  });

  it("moves the last meaningful YouTube sample to the outbox when local tracking is turned off", async () => {
    const owner = session.user.id;
    const key = watchHistoryPartitionKey(owner, 1);
    const youtubeEvent = {
      ...progressEvent(),
      provider: "youtube" as const,
      titleKey: "youtube:video-a",
      episodeKey: "youtube:video-a",
      sourceUrl: "https://www.youtube.com/watch?v=video-a",
      sharedRoom: null,
    };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [key]: {
          ...readyPartition(owner, true),
          currentObservation: youtubeEvent,
          currentObservationMeaningfulSolo: true,
          currentObservationDisplayMode: "mine",
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: false },
    })).resolves.toEqual({ ok: true });

    expect(stored.partitions[key]).toMatchObject({
      preferences: { youtubeHistoryEnabled: false },
      currentObservation: null,
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: null,
    });
    expect(stored.partitions[key]?.outbox.entries).toHaveLength(1);
    expect(stored.partitions[key]?.outbox.entries[0]?.event).toEqual(youtubeEvent);
  });

  it("retries a locally pending YouTube preference on bootstrap and clears it after server acknowledgement", async () => {
    const owner = session.user.id;
    const key = watchHistoryPartitionKey(owner, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [key]: { ...readyPartition(owner, true), preferencesSyncPending: true },
      },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      meta: {
        serverTime: "2026-08-15T10:00:01.000Z",
        schemaVersion: 2,
        ownerUserId: owner,
        accountGeneration: 1,
      },
      preferences: { youtubeHistoryEnabled: true },
    })));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toMatchObject({
      ok: true,
      data: {
        ownerUserId: owner,
        preferences: { youtubeHistoryEnabled: true },
        source: "cache",
      },
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3003/api/watch-history/v2/preferences",
      expect.objectContaining({ method: "PATCH" }),
    ));
    await vi.waitFor(() => expect(stored.partitions[key]?.preferencesSyncPending).toBe(false));
  });

  it("does not let an older preference read from another popup session overwrite a newer local switch", async () => {
    const owner = session.user.id;
    const key = watchHistoryPartitionKey(owner, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [key]: readyPartition(owner, false) },
    };
    let resolveOldRead: ((response: Response) => void) | undefined;
    const preferenceResponse = (youtubeHistoryEnabled: boolean) => new Response(JSON.stringify({
      meta: {
        serverTime: "2026-08-15T10:00:01.000Z",
        schemaVersion: 2,
        ownerUserId: owner,
        accountGeneration: 1,
      },
      preferences: { youtubeHistoryEnabled },
    }));
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return preferenceResponse(true);
      return new Promise<Response>((resolve) => {
        resolveOldRead = resolve;
      });
    });
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const createClient = () => createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage,
    });
    const openingPopup = createClient();

    const oldRead = openingPopup.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "get-preferences",
    });
    await vi.waitFor(() => expect(resolveOldRead).toBeTypeOf("function"));
    const togglingPopup = createClient();
    await expect(togglingPopup.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    })).resolves.toEqual({ ok: true });
    await vi.waitFor(() => expect(stored.partitions[key]?.preferencesSyncPending).toBe(false));
    expect(stored.partitions[key]?.preferences).toEqual({ youtubeHistoryEnabled: true });
    expect(stored.partitions[key]?.preferencesLocalRevision).toBe(1);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method ?? "GET"))
      .toEqual(["GET", "PATCH"]);

    if (!resolveOldRead) throw new Error("Expected the old preference read to be pending");
    resolveOldRead(preferenceResponse(false));
    await expect(oldRead).resolves.toMatchObject({
      ok: true,
      data: { preferences: { youtubeHistoryEnabled: true } },
    });
    expect(stored.partitions[key]?.preferences).toEqual({ youtubeHistoryEnabled: true });

    const reopenedPopup = createClient();
    await expect(reopenedPopup.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap-cache",
      expectedOwnerUserId: owner,
    } as never)).resolves.toMatchObject({
      ok: true,
      data: { preferences: { youtubeHistoryEnabled: true } },
    });
  });

  it("serializes preference writes from separate popup sessions so the last local choice wins", async () => {
    const owner = session.user.id;
    const key = watchHistoryPartitionKey(owner, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [key]: {
          ...readyPartition(owner, true),
          preferencesSyncPending: true,
          preferencesLocalRevision: 1,
        },
      },
    };
    let serverPreference = true;
    let releaseOlderWrite: (() => void) | undefined;
    const writes: boolean[] = [];
    const preferenceResponse = (youtubeHistoryEnabled: boolean) => new Response(JSON.stringify({
      meta: {
        serverTime: "2026-08-15T10:00:01.000Z",
        schemaVersion: 2,
        ownerUserId: owner,
        accountGeneration: 1,
      },
      preferences: { youtubeHistoryEnabled },
    }));
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PATCH") return preferenceResponse(serverPreference);
      const input = JSON.parse(String(init.body)) as { youtubeHistoryEnabled: boolean };
      writes.push(input.youtubeHistoryEnabled);
      if (writes.length === 1) {
        await new Promise<void>((resolve) => {
          releaseOlderWrite = resolve;
        });
      }
      serverPreference = input.youtubeHistoryEnabled;
      return preferenceResponse(serverPreference);
    });
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const createClient = () => createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage,
    });

    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "flush",
    })).resolves.toEqual({ ok: true, flushed: 0 });
    await vi.waitFor(() => expect(releaseOlderWrite).toBeTypeOf("function"));

    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: false },
    })).resolves.toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (!releaseOlderWrite) throw new Error("Expected the older preference write to be pending");
    releaseOlderWrite();
    await vi.waitFor(() => expect(writes).toEqual([true, false]));
    await vi.waitFor(() => expect(stored.partitions[key]?.preferencesSyncPending).toBe(false));

    expect(serverPreference).toBe(false);
    expect(stored.partitions[key]?.preferences).toEqual({ youtubeHistoryEnabled: false });
    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "get-preferences",
    })).resolves.toMatchObject({
      ok: true,
      data: { preferences: { youtubeHistoryEnabled: false } },
    });
  });

  it.each([
    { localChoice: true, laggingServerChoice: false },
    { localChoice: false, laggingServerChoice: true },
  ])(
    "keeps an explicit local $localChoice choice across popup reopen when the server still says $laggingServerChoice",
    async ({ localChoice, laggingServerChoice }) => {
      const owner = session.user.id;
      const key = watchHistoryPartitionKey(owner, 1);
      let stored: WatchHistoryStorageRoot = {
        schemaVersion: 2,
        activeGenerations: { [owner]: 1 },
        partitions: {
          [key]: {
            ...readyPartition(owner, localChoice),
            preferencesSyncPending: false,
            preferencesLocalRevision: 1,
          },
        },
      };
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
        meta: {
          serverTime: "2026-08-15T10:00:01.000Z",
          schemaVersion: 2,
          ownerUserId: owner,
          accountGeneration: 1,
        },
        preferences: { youtubeHistoryEnabled: laggingServerChoice },
      })));
      const storage = createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      });
      const createClient = () => createWatchHistoryClient({
        getCurrentSession: async () => session,
        fetch: fetchImpl,
        storage,
      });

      await expect(createClient().handle({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "get-preferences",
      })).resolves.toMatchObject({
        ok: true,
        data: { preferences: { youtubeHistoryEnabled: localChoice } },
      });
      await expect(createClient().handle({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "bootstrap",
        expectedOwnerUserId: owner,
      })).resolves.toMatchObject({
        ok: true,
        data: {
          preferences: { youtubeHistoryEnabled: localChoice },
          source: "cache",
        },
      });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(stored.partitions[key]?.preferences).toEqual({ youtubeHistoryEnabled: localChoice });
    },
  );

  it("bootstraps from canonical preferences online and same-owner cached preferences only on retryable transport failure", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: false,
          currentObservation: null,
          capturePaused: false,
          captureMarkersReady: true,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
        },
      },
    };
    let online = true;
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => {
        if (!online) throw new TypeError("offline");
        return new Response(JSON.stringify({
          meta: {
            serverTime: "2026-08-15T10:00:00.000Z",
            schemaVersion: 2,
            ownerUserId: owner,
            accountGeneration: 1,
          },
          preferences: { youtubeHistoryEnabled: true },
        }));
      }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toEqual({
      ok: true,
      data: {
        ownerUserId: owner,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
        capturePaused: false,
        source: "network",
      },
    });

    online = false;
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toEqual({
      ok: true,
      data: {
        ownerUserId: owner,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
        capturePaused: false,
        source: "cache",
      },
    });
  });

  it("rejects a deferred A bootstrap after B becomes current", async () => {
    const ownerA = session.user.id;
    const ownerB = "00000000-0000-4000-8000-000000000109";
    const sessionB = {
      ...session,
      accessToken: "access-token-b",
      refreshToken: "refresh-token-b",
      user: { ...session.user, id: ownerB },
    };
    let currentSession: typeof session | typeof sessionB = session;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [ownerA]: 1, [ownerB]: 1 },
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: readyPartition(ownerA, false),
        [watchHistoryPartitionKey(ownerB, 1)]: readyPartition(ownerB, false),
      },
    };
    let resolveNetwork: ((response: Response) => void) | null = null;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => { resolveNetwork = resolve; }));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    const bootstrapping = client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: ownerA,
    } as never);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    currentSession = sessionB;
    (resolveNetwork as unknown as (response: Response) => void)(new Response(JSON.stringify({
      meta: {
        serverTime: "2026-08-15T10:00:00.000Z",
        schemaVersion: 2,
        ownerUserId: ownerA,
        accountGeneration: 1,
      },
      preferences: { youtubeHistoryEnabled: true },
    })));

    await expect(bootstrapping).resolves.toEqual({ ok: false, status: "rejected" });
    expect(stored.partitions[watchHistoryPartitionKey(ownerB, 1)]?.preferences)
      .toEqual({ youtubeHistoryEnabled: false });
  });

  it("rejects bootstrap when the same owner refresh token changes during canonical storage", async () => {
    const owner = session.user.id;
    const refreshedSession = { ...session, refreshToken: "rotated-refresh-token" };
    let currentSession = session;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        meta: {
          serverTime: "2026-08-15T10:00:00.000Z",
          schemaVersion: 2,
          ownerUserId: owner,
          accountGeneration: 1,
        },
        preferences: { youtubeHistoryEnabled: true },
      }))) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
            currentSession = refreshedSession;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toEqual({ ok: false, status: "rejected" });
  });

  it("rechecks the session immediately before returning cached bootstrap data", async () => {
    const owner = session.user.id;
    const sessionB = {
      ...session,
      accessToken: "access-token-b",
      refreshToken: "refresh-token-b",
      user: { ...session.user, id: "00000000-0000-4000-8000-000000000110" },
    };
    let reads = 0;
    const client = createWatchHistoryClient({
      getCurrentSession: async () => {
        reads += 1;
        return reads <= 2 ? session : sessionB;
      },
      fetch: vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => ({
            schemaVersion: 2,
            activeGenerations: { [owner]: 1 },
            partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, true) },
          }),
          setValue: async () => undefined,
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toEqual({ ok: false, status: "rejected" });
  });

  it("does not clear a persisted storage pause merely because canonical preferences were written", async () => {
    const owner = "00000000-0000-4000-8000-000000000096";
    const isolatedSession = { ...session, user: { ...session.user, id: owner } };
    const partitionKey = watchHistoryPartitionKey(owner, 1);
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: null,
          capturePaused: true,
          captureMarkersReady: true,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => isolatedSession,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        meta: {
          serverTime: "2026-08-15T10:00:00.000Z",
          schemaVersion: 2,
          ownerUserId: owner,
          accountGeneration: 1,
        },
        preferences: { youtubeHistoryEnabled: true },
      }))) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never)).resolves.toMatchObject({
      ok: true,
      data: { capturePaused: true, preferences: { youtubeHistoryEnabled: true } },
    });
    expect(stored.partitions[partitionKey]?.capturePaused).toBe(true);
  });

  it("fails closed instead of bootstrapping across owners, stale generations, missing preferences, or invalid canonical responses", async () => {
    const owner = session.user.id;
    const otherSession = {
      ...session,
      refreshToken: "other-refresh",
      user: { ...session.user, id: "00000000-0000-4000-8000-000000000099" },
    };
    const partition = {
      ownerUserId: owner,
      accountGeneration: 1,
      cache: null,
      preferences: { youtubeHistoryEnabled: false },
      currentObservation: null,
      capturePaused: false,
      outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
    };
    const bootstrap = {
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    } as never;
    const makeClient = (
      currentSession: typeof session,
      stored: WatchHistoryStorageRoot,
      fetchImpl: typeof fetch,
    ) => createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      fetch: fetchImpl,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async () => undefined },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(makeClient(otherSession, {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: partition },
    }, vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch).handle(bootstrap))
      .resolves.toEqual({ ok: false, status: "rejected" });

    await expect(makeClient(session, {
      schemaVersion: 2,
      activeGenerations: { [owner]: 2 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: partition },
    }, vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch).handle(bootstrap))
      .resolves.toEqual({ ok: false, status: "retryable" });

    await expect(makeClient(session, {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: { ...partition, preferences: null } },
    }, vi.fn(async () => { throw new TypeError("offline"); }) as typeof fetch).handle(bootstrap))
      .resolves.toEqual({ ok: false, status: "retryable" });

    await expect(makeClient(session, {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: partition },
    }, vi.fn(async () => new Response(JSON.stringify({ preferences: { youtubeHistoryEnabled: true } }))) as typeof fetch)
      .handle(bootstrap)).resolves.toEqual({ ok: false, status: "invalid-response" });

    await expect(makeClient(session, {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: partition },
    }, vi.fn(async () => new Response(JSON.stringify({ code: "UPGRADE_REQUIRED" }), { status: 426 })) as typeof fetch)
      .handle(bootstrap)).resolves.toEqual({ ok: false, status: "upgrade-required" });
  });

  it("strictly validates bootstrap commands and background results", () => {
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "bootstrap" })).toBe(false);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: session.user.id,
    })).toBe(true);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap-cache",
      expectedOwnerUserId: session.user.id,
    })).toBe(true);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap-cache",
      expectedOwnerUserId: session.user.id,
      extra: true,
    })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "bootstrap", ownerUserId: session.user.id })).toBe(false);
    expect(parseWatchHistoryBootstrapData({
      ownerUserId: session.user.id,
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: true,
      source: "cache",
    })).toEqual({
      ownerUserId: session.user.id,
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: true,
      source: "cache",
    });
    expect(parseWatchHistoryBootstrapData({
      ownerUserId: session.user.id,
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: true,
      source: "cache",
      accessToken: "caller-token",
    })).toBeNull();
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: session.user.id,
      event: progressEvent(),
      meaningfulSolo: true,
      queueForSync: true,
      flushNow: false,
    })).toBe(true);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: session.user.id,
      event: progressEvent(),
      meaningfulSolo: "yes",
    })).toBe(false);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: session.user.id,
      event: progressEvent(),
      queueForSync: "yes",
    })).toBe(false);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      event: progressEvent(),
    })).toBe(false);
  });

  it("rejects an A-owned capture after sign-out and a same-generation B sign-in", async () => {
    const ownerA = session.user.id;
    const ownerB = "00000000-0000-4000-8000-000000000097";
    const sessionB = {
      ...session,
      accessToken: "access-token-b",
      refreshToken: "refresh-token-b",
      user: { ...session.user, id: ownerB },
    };
    let currentSession: typeof session | null = session;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [ownerA]: 1, [ownerB]: 1 },
      partitions: {
        [watchHistoryPartitionKey(ownerA, 1)]: readyPartition(ownerA, true),
        [watchHistoryPartitionKey(ownerB, 1)]: readyPartition(ownerB, true),
      },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(
      progressAck("00000000-0000-4000-8000-000000000098", ownerB),
    )));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    const staleAEvent = {
      ...progressEvent("00000000-0000-4000-8000-000000000098"),
      sharedRoom: null,
    };

    currentSession = null;
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: ownerA,
      event: staleAEvent,
    } as never)).resolves.toEqual({ ok: false, status: "unauthenticated" });
    currentSession = sessionB;
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: ownerA,
      event: staleAEvent,
    } as never)).resolves.toEqual({ ok: false, status: "rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stored.partitions[watchHistoryPartitionKey(ownerB, 1)]).toMatchObject({
      currentObservation: null,
      outbox: { entries: [] },
    });
  });

  it("enforces confirmed YouTube opt-out in background for local observation and enqueue", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const fetchImpl = vi.fn();
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    const youtubeEvent = {
      ...progressEvent(),
      provider: "youtube" as const,
      sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      sharedRoom: null,
    };

    for (const command of ["observe-progress", "enqueue-progress"] as const) {
      await expect(client.handle({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command,
        expectedOwnerUserId: owner,
        event: youtubeEvent,
      } as never)).resolves.toEqual({ ok: false, status: "rejected" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservation: null,
      outbox: { entries: [] },
    });
  });

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

  it("persists a solo crash-recovery observation without creating outbox work or making an HTTP request", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const fetchImpl = vi.fn();
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    const event = { ...progressEvent(), sharedRoom: null };

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event,
      meaningfulSolo: true,
      displayMode: "mine",
    }))
      .resolves.toEqual({ ok: true });

    const partition = stored.partitions[watchHistoryPartitionKey(owner, 1)];
    expect(partition).toMatchObject({
      preferencesConfirmed: true,
      capturePaused: false,
      captureMarkersReady: true,
    });
    expect(partition.currentObservation?.clientEventId).toBe(event.clientEventId);
    expect(partition.currentObservationMeaningfulSolo).toBe(true);
    expect(partition.currentObservationDisplayMode).toBe("mine");
    expect(partition.outbox.entries).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("atomically stores the visible meaningful observation and coalesced outbox without an HTTP request", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const writes: WatchHistoryStorageRoot[] = [];
    const fetchImpl = vi.fn();
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
            writes.push(value);
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    const event = { ...progressEvent(), sharedRoom: null };

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event,
      meaningfulSolo: true,
      displayMode: "mine",
      queueForSync: true,
      flushNow: false,
    })).resolves.toEqual({ ok: true });

    const partition = stored.partitions[watchHistoryPartitionKey(owner, 1)];
    expect(writes).toHaveLength(1);
    expect(partition.currentObservation?.clientEventId).toBe(event.clientEventId);
    expect(partition.outbox.entries).toEqual([
      expect.objectContaining({
        event: expect.objectContaining({ clientEventId: event.clientEventId }),
        slot: "latest",
      }),
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stores a shared crash-recovery observation without retaining room authority or exposing it as solo", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const fetchImpl = vi.fn();
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event: progressEvent(),
      meaningfulSolo: true,
      displayMode: "together",
    })).resolves.toEqual({ ok: true });

    const partition = stored.partitions[watchHistoryPartitionKey(owner, 1)];
    expect(partition.currentObservation).not.toHaveProperty("sharedRoom");
    expect(partition.currentObservationMeaningfulSolo).toBe(false);
    expect(partition.currentObservationDisplayMode).toBe("together");
    expect(partition.outbox.entries).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("replaces the local meaningful marker with the exact latest observation", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn() as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    for (const meaningfulSolo of [true, false]) {
      await expect(client.handle({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "observe-progress",
        expectedOwnerUserId: owner,
        event: { ...progressEvent(crypto.randomUUID()), sharedRoom: null },
        meaningfulSolo,
      })).resolves.toEqual({ ok: true });
    }

    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservationMeaningfulSolo: false,
      outbox: { entries: [] },
    });
  });

  it("strictly validates internal reconnect commands and list bounds", () => {
    expect(isWatchHistoryMessage(createWatchHistoryContentReconnectMessage())).toBe(true);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "list", limit: 0 })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "list", limit: 101 })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush", extra: true })).toBe(false);
    expect(isWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: session.user.id,
      event: progressEvent(),
      displayMode: "somewhere",
    })).toBe(false);
    expect(isWatchHistoryMessage({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "create-room", sessionId: "x".repeat(129) })).toBe(false);
  });

  it("keeps preference reads and writes on the background-owned local session path", () => {
    expect(usesStoredWatchHistorySession("get-preferences")).toBe(true);
    expect(usesStoredWatchHistorySession("update-preferences")).toBe(true);
    expect(usesStoredWatchHistorySession("bootstrap")).toBe(true);
    expect(usesStoredWatchHistorySession("list")).toBe(false);
    expect(usesStoredWatchHistorySession("delete")).toBe(false);
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
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.currentObservationMeaningfulSolo)
      .toBe(false);
  });

  it("retains an acknowledged active observation until canonical cache catches up", async () => {
    const owner = session.user.id;
    const event = { ...progressEvent(), sharedRoom: null };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(JSON.stringify(progressAck(event.clientEventId)))) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event,
      meaningfulSolo: true,
      displayMode: "mine",
    })).resolves.toEqual({ ok: true });
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event,
    })).resolves.toEqual({ ok: true, flushed: 1 });

    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservation: { clientEventId: event.clientEventId },
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: "mine",
      outbox: { entries: [] },
    });
  });

  it("retains an acknowledged final observation until canonical cache catches up", async () => {
    const owner = session.user.id;
    const event = { ...progressEvent(), kind: "pagehide" as const, sharedRoom: null };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(JSON.stringify(progressAck(event.clientEventId)))) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event,
      meaningfulSolo: true,
      displayMode: null,
    })).resolves.toEqual({ ok: true });
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event,
    })).resolves.toEqual({ ok: true, flushed: 1 });

    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservation: {
        clientEventId: event.clientEventId,
        currentTime: event.currentTime,
        kind: "pagehide",
      },
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: "mine",
      outbox: { entries: [] },
    });
  });

  it("drains pending progress before returning a refreshed canonical snapshot", async () => {
    const owner = session.user.id;
    const event = {
      ...progressEvent("00000000-0000-4000-8000-000000000098"),
      kind: "pagehide" as const,
      sharedRoom: null,
    };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, false),
          currentObservation: event,
          currentObservationMeaningfulSolo: true,
          currentObservationDisplayMode: null,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event, key: "final", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    let accepted = false;
    const requestOrder: string[] = [];
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async (input, init) => {
        if (String(input).endsWith("/progress")) {
          requestOrder.push("progress");
          accepted = true;
          return new Response(JSON.stringify(progressAck(event.clientEventId)));
        }
        requestOrder.push("list");
        return new Response(JSON.stringify({
          meta: {
            serverTime: "2026-08-15T10:01:00.000Z",
            schemaVersion: 2,
            ownerUserId: owner,
            accountGeneration: 1,
          },
          generatedAt: accepted
            ? "2026-08-15T10:01:00.000Z"
            : "2026-08-15T10:00:00.000Z",
          totalTitleCount: 0,
          items: [],
          nextCursor: null,
        }), { status: init?.method === "POST" ? 500 : 200 });
      }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    const response = await client.handle(createListWatchHistoryMessage());

    expect(response).toMatchObject({
      ok: true,
      flushed: 1,
      data: { generatedAt: "2026-08-15T10:01:00.000Z" },
    });
    expect(requestOrder).toEqual(["progress", "list"]);
  });

  it("negative-acknowledges a stale older latest after accepting the terminal and continues the drain", async () => {
    const owner = session.user.id;
    const terminal = {
      ...progressEvent("00000000-0000-4000-8000-000000000101"),
      kind: "ended" as const,
      observedAt: "2026-08-15T10:02:00.000Z",
    };
    const staleLatest = {
      ...progressEvent("00000000-0000-4000-8000-000000000102"),
      sharedRoom: null,
      observedAt: "2026-08-15T10:01:00.000Z",
    };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, true),
          currentObservation: staleLatest,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [
              { event: terminal, key: "session:terminal", slot: "terminal", persistedAt: 2 },
              { event: staleLatest, key: "session:latest", slot: "latest", persistedAt: 1 },
            ],
          },
        },
      },
    };
    let requestCount = 0;
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => {
        requestCount += 1;
        return requestCount === 1
          ? new Response(JSON.stringify(progressAck(terminal.clientEventId)))
          : new Response(JSON.stringify({ code: "STALE_OBSERVATION" }), { status: 409 });
      }) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: true, flushed: 2 });
    expect(requestCount).toBe(2);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservation: null,
      outbox: { entries: [] },
    });
  });

  it("negative-acknowledges exactly one event rejected by a cross-device deletion fence", async () => {
    const owner = session.user.id;
    const deleted = {
      ...progressEvent("00000000-0000-4000-8000-000000000103"),
      sharedRoom: null,
    };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, true),
          currentObservation: deleted,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: deleted, key: "deleted", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(
        JSON.stringify({ code: "DELETED_HISTORY" }),
        { status: 409 },
      )) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: true, flushed: 1 });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservation: null,
      outbox: { entries: [] },
    });
  });

  it.each([
    [401, { code: "UNAUTHORIZED" }, "retryable"],
    [503, { code: "HISTORY_UNAVAILABLE" }, "retryable"],
    [200, { acceptedEventId: "malformed" }, "invalid-response"],
  ] as const)("retains pending work after non-consumable HTTP %s", async (status, body, expectedStatus) => {
    const owner = session.user.id;
    const pending = { ...progressEvent(), sharedRoom: null };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, true),
          currentObservation: pending,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: pending, key: "pending", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(JSON.stringify(body), { status })) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: false, status: expectedStatus });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries)
      .toHaveLength(1);
  });

  it("retains rejected shared work with a stable invalid-room-authority status", async () => {
    const owner = session.user.id;
    const pending = progressEvent("00000000-0000-4000-8000-000000000104");
    const { sharedRoom: _sharedRoom, ...localObservation } = pending;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, false),
          currentObservation: localObservation,
          currentObservationMeaningfulSolo: false,
          currentObservationDisplayMode: "together",
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: pending, key: "shared", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(
        JSON.stringify({ code: "INVALID_AUTHORITY" }),
        { status: 403 },
      )) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: false, status: "invalid-room-authority" });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: "together",
      outbox: { entries: [{ event: { sharedRoom: { attestation: "room-attestation-proof" } } }] },
    });
  });

  it("refreshes a stale access token once and acknowledges the same idempotent event", async () => {
    const owner = session.user.id;
    const pending = { ...progressEvent(), sharedRoom: null };
    const refreshedSession = {
      ...session,
      accessToken: "fresh-access-token",
      refreshToken: "rotated-refresh-token",
    };
    let currentSession = session;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, false),
          currentObservation: pending,
          currentObservationMeaningfulSolo: true,
          currentObservationDisplayMode: "mine",
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: pending, key: "pending", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const authorizations: string[] = [];
    const fetchImpl = vi.fn(async (_input, init) => {
      const authorization = new Headers(init?.headers).get("Authorization") ?? "";
      authorizations.push(authorization);
      return authorization === "Bearer access-token"
        ? new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 })
        : new Response(JSON.stringify(progressAck(pending.clientEventId)));
    });
    const client = createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      getRequestSession: async () => {
        currentSession = refreshedSession;
        return refreshedSession;
      },
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: true, flushed: 1 });
    expect(authorizations).toEqual(["Bearer access-token", "Bearer fresh-access-token"]);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("consumes a permanent rejection after refreshing a rotated session", async () => {
    const owner = session.user.id;
    const pending = { ...progressEvent(), sharedRoom: null };
    const refreshedSession = {
      ...session,
      accessToken: "fresh-access-token",
      refreshToken: "rotated-refresh-token",
    };
    let currentSession = session;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ...readyPartition(owner, false),
          currentObservation: pending,
          currentObservationMeaningfulSolo: true,
          currentObservationDisplayMode: "mine",
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: pending, key: "pending", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const fetchImpl = vi.fn(async (_input, init) => {
      const authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return authorization === "Bearer access-token"
        ? new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 })
        : new Response(JSON.stringify({ code: "STALE_OBSERVATION" }), { status: 409 });
    });
    const client = createWatchHistoryClient({
      getCurrentSession: async () => currentSession,
      getRequestSession: async () => {
        currentSession = refreshedSession;
        return refreshedSession;
      },
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: true, flushed: 1 });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("keeps shared-room authority only in pending work and binds acknowledgements to its snapshot", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: { [watchHistoryPartitionKey(owner, 1)]: readyPartition(owner, false) },
    };
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

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event,
    })).resolves.toEqual({ ok: false, status: "invalid-response" });
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

  it("validates and handles aggregate old-owner discard without exposing owner identifiers", async () => {
    const oldOwner = "00000000-0000-4000-8000-000000000099";
    const currentKey = watchHistoryPartitionKey(session.user.id, 1);
    const oldKey = watchHistoryPartitionKey(oldOwner, 1);
    let stored = {
      schemaVersion: 2 as const,
      activeGenerations: { [session.user.id]: 1, [oldOwner]: 1 },
      partitions: {
        [currentKey]: readyPartition(session.user.id, false),
        [oldKey]: {
          ...readyPartition(oldOwner, false),
          outbox: {
            ownerUserId: oldOwner,
            accountGeneration: 1,
            entries: [{ event: progressEvent(), key: "old", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    } as WatchHistoryStorageRoot;
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    const command = {
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "discard-old-owner-work",
      confirmed: true,
    } as const;

    expect(isWatchHistoryMessage(command)).toBe(true);
    expect(isWatchHistoryMessage({ ...command, ownerUserId: oldOwner })).toBe(false);
    await expect(client.handle(command)).resolves.toEqual({ ok: true });
    expect(stored.partitions[currentKey]?.outbox.entries).toEqual([]);
    expect(stored.partitions[oldKey]?.outbox.entries).toEqual([]);
  });

  it("reclaims acknowledged pending work once before rejecting a quota-limited capture", async () => {
    const owner = session.user.id;
    const oldEvent = { ...progressEvent("00000000-0000-4000-8000-000000000020"), kind: "ended" as const };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: { youtubeHistoryEnabled: false }, currentObservation: null,
          preferencesConfirmed: false, capturePaused: false, captureMarkersReady: true,
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
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "enqueue-progress", expectedOwnerUserId: owner,
      event: progressEvent("00000000-0000-4000-8000-000000000021"),
    })).resolves.toMatchObject({ ok: true, flushed: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("keeps an existing terminal when the one quota recovery retry still cannot persist a new capture", async () => {
    const owner = session.user.id;
    const terminal = { ...progressEvent("00000000-0000-4000-8000-000000000022"), kind: "ended" as const };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2, activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: { youtubeHistoryEnabled: false }, currentObservation: null,
          preferencesConfirmed: true, capturePaused: false, captureMarkersReady: true,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event: terminal, key: "terminal", slot: "terminal", persistedAt: 1 }] },
        },
      },
    };
    let writes = 0;
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            writes += 1;
            const active = value.partitions[watchHistoryPartitionKey(owner, 1)];
            if (Object.values(value.partitions).flatMap((partition) => partition.outbox.entries).length > 1) {
              throw new Error("quota");
            }
            if (!active?.capturePaused && active?.currentObservation?.clientEventId === "00000000-0000-4000-8000-000000000023") {
              throw new Error("quota");
            }
            stored = value;
          },
        },
        getBytesInUse: async () => 0, quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "enqueue-progress", expectedOwnerUserId: owner,
      event: progressEvent("00000000-0000-4000-8000-000000000023"),
    })).resolves.toEqual({ ok: false, status: "storage-full", capturePausedPersisted: true });
    expect(writes).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toHaveLength(1);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries[0]?.event.clientEventId).toBe(terminal.clientEventId);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.capturePaused).toBe(true);

    const writesAfterPause = writes;
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "observe-progress",
      expectedOwnerUserId: owner,
      event: { ...progressEvent("00000000-0000-4000-8000-000000000024"), sharedRoom: null },
    })).resolves.toEqual({ ok: false, status: "storage-full", capturePausedPersisted: true });
    expect(writes).toBe(writesAfterPause);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const recreated = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { writes += 1; stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });
    await expect(recreated.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2", command: "observe-progress",
      expectedOwnerUserId: owner,
      event: { ...progressEvent("00000000-0000-4000-8000-000000000025"), sharedRoom: null },
    })).resolves.toEqual({ ok: false, status: "storage-full", capturePausedPersisted: true });
    expect(writes).toBe(writesAfterPause);
    await expect(recreated.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "bootstrap",
      expectedOwnerUserId: owner,
    })).resolves.toEqual({
      ok: true,
      data: {
        ownerUserId: owner,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
        capturePaused: true,
        source: "cache",
      },
    });
  });

  it("does not claim a durable pause when a new-root marker write fails and keeps recreated clients fail-closed without repeat work", async () => {
    const owner = "00000000-0000-4000-8000-000000000090";
    const isolatedSession = { ...session, user: { ...session.user, id: owner } };
    const terminal = {
      ...progressEvent("00000000-0000-4000-8000-000000000091"),
      kind: "ended" as const,
    };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: null,
          capturePaused: false,
          captureMarkersReady: true,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event: terminal, key: "terminal", slot: "terminal", persistedAt: 1 }],
          },
        },
      },
    };
    let writes = 0;
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const storage = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async () => {
          writes += 1;
          throw new Error("total storage I/O failure");
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const createClient = () => createWatchHistoryClient({
      getCurrentSession: async () => isolatedSession,
      fetch: fetchImpl as typeof fetch,
      storage,
    });

    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event: { ...progressEvent("00000000-0000-4000-8000-000000000092"), accountGeneration: 1 },
    })).resolves.toEqual({
      ok: false,
      status: "storage-full",
      capturePausedPersisted: false,
    });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.capturePaused).toBe(false);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries[0]?.event.clientEventId)
      .toBe(terminal.clientEventId);
    const writesAfterFailure = writes;
    const requestsAfterFailure = fetchImpl.mock.calls.length;

    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event: {
        ...progressEvent("00000000-0000-4000-8000-000000000093"),
        accountGeneration: 1,
        sharedRoom: null,
      },
    })).resolves.toEqual({
      ok: false,
      status: "storage-full",
      capturePausedPersisted: false,
    });
    expect(writes).toBe(writesAfterFailure);
    expect(fetchImpl).toHaveBeenCalledTimes(requestsAfterFailure);
  });

  it("keeps a legacy root fail-closed across failed migration and recreation until explicit recovery writes normalized markers", async () => {
    const owner = "00000000-0000-4000-8000-000000000094";
    const isolatedSession = { ...session, user: { ...session.user, id: owner } };
    const partitionKey = watchHistoryPartitionKey(owner, 1);
    let stored = {
      schemaVersion: 2 as const,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          currentObservation: null,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
        },
      },
    } as WatchHistoryStorageRoot;
    let failWrites = true;
    let writes = 0;
    const fetchImpl = vi.fn();
    const storage = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          writes += 1;
          if (failWrites) throw new Error("quota");
          stored = value;
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const createClient = () => createWatchHistoryClient({
      getCurrentSession: async () => isolatedSession,
      fetch: fetchImpl as typeof fetch,
      storage,
    });

    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "recover-storage",
    })).resolves.toEqual({
      ok: false,
      status: "storage-full",
      capturePausedPersisted: false,
    });
    const writesAfterMigrationFailure = writes;
    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "observe-progress",
      expectedOwnerUserId: owner,
      event: { ...progressEvent(), accountGeneration: 1, sharedRoom: null },
    })).resolves.toEqual({
      ok: false,
      status: "storage-full",
      capturePausedPersisted: false,
    });
    expect(writes).toBe(writesAfterMigrationFailure);
    expect(fetchImpl).not.toHaveBeenCalled();

    failWrites = false;
    await expect(createClient().handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "recover-storage",
    })).resolves.toEqual({
      ok: true,
      data: { capturePaused: false, capturePausedPersisted: false },
    });
    expect(stored.partitions[partitionKey]).toMatchObject({
      capturePaused: false,
      captureMarkersReady: true,
      preferencesConfirmed: false,
    });
  });

  it("keeps an offline enqueue durable without pausing capture and clears a pause only through explicit recovery", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: false,
          currentObservation: null,
          capturePaused: false,
          captureMarkersReady: true,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] },
        },
      },
    };
    let online = false;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!online) throw new TypeError("offline");
      const sent = JSON.parse(String(init?.body)) as { clientEventId: string };
      return new Response(JSON.stringify(progressAck(sent.clientEventId)));
    });
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage,
    });
    const event = { ...progressEvent("00000000-0000-4000-8000-000000000080"), sharedRoom: null };

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event,
    }))
      .resolves.toEqual({ ok: false, status: "retryable" });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries)
      .toHaveLength(1);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.capturePaused).toBe(false);

    stored.partitions[watchHistoryPartitionKey(owner, 1)]!.capturePaused = true;
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "recover-storage",
    } as never)).resolves.toEqual({
      ok: true,
      data: { capturePaused: false, capturePausedPersisted: false },
    });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.capturePaused).toBe(false);

    online = true;
    const recoveredEvent = {
      ...progressEvent("00000000-0000-4000-8000-000000000081"),
      sharedRoom: null,
    };
    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "enqueue-progress",
      expectedOwnerUserId: owner,
      event: recoveredEvent,
    })).resolves.toEqual({ ok: true, flushed: 1 });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("clears a persisted storage pause when a successful flush removes pending work", async () => {
    const owner = session.user.id;
    const event = { ...progressEvent("00000000-0000-4000-8000-000000000082"), sharedRoom: null };
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          currentObservation: event,
          capturePaused: true,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event, key: "paused", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: vi.fn(async () => new Response(JSON.stringify(progressAck(event.clientEventId)))) as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle({ type: "ANIDACHI_WATCH_HISTORY_V2", command: "flush" }))
      .resolves.toEqual({ ok: true, flushed: 1 });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.capturePaused).toBe(false);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("bounds the pre-sign-out flush and refuses old-owner work after the stored session switches", async () => {
    const owner = session.user.id;
    const event = { ...progressEvent("00000000-0000-4000-8000-000000000083"), sharedRoom: null };
    const stored: WatchHistoryStorageRoot = {
      schemaVersion: 2,
      activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner,
          accountGeneration: 1,
          cache: null,
          preferences: { youtubeHistoryEnabled: false },
          currentObservation: event,
          capturePaused: false,
          outbox: {
            ownerUserId: owner,
            accountGeneration: 1,
            entries: [{ event, key: "sign-out", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };
    const switched = {
      ...session,
      refreshToken: "new-refresh",
      user: { ...session.user, id: "00000000-0000-4000-8000-000000000084" },
    };
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async () => undefined },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });

    await bestEffortFlushWatchHistoryBeforeSignOut(session, {
      getCurrentSession: async () => switched,
      fetch: fetchImpl as typeof fetch,
      storage,
      timeoutMs: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    await bestEffortFlushWatchHistoryBeforeSignOut(session, {
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage,
      timeoutMs: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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

  it("awaits one bounded drain even when background cache reconciliation fails", async () => {
    const owner = session.user.id;
    const event = progressEvent("00000000-0000-4000-8000-000000000040");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2, activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: event,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event, key: "background", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    let resolveDrain: (() => void) | undefined;
    const drain = new Promise<void>((resolve) => { resolveDrain = resolve; });
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("/api/watch-history/v2")) return new Response("offline", { status: 503 });
      await drain;
      return new Response(JSON.stringify(progressAck(event.clientEventId)));
    });
    const trigger = flushWatchHistoryInBackground({
      getCurrentSession: async () => session,
      fetch: fetchImpl as typeof fetch,
      storage: createWatchHistoryStorage({
        item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
        getBytesInUse: async () => 0, quotaBytes: 1_000_000,
      }),
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    let settled = false;
    void trigger.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveDrain?.();
    await expect(trigger).resolves.toBeUndefined();
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toEqual([]);
  });

  it("runs the startup/install drain once when separate session reconciliation fails", async () => {
    let drains = 0;
    await expect(reconcileWatchHistoryThenDrain(
      async () => { throw new Error("website unavailable"); },
      async () => { drains += 1; },
    )).resolves.toBeUndefined();
    expect(drains).toBe(1);
  });

  it("clears only rebuildable switched-owner state and leaves its pending work dormant", async () => {
    const oldOwner = session.user.id;
    const nextSession = { ...session, refreshToken: "next-refresh", user: { ...session.user, id: "00000000-0000-4000-8000-000000000050" } };
    const event = progressEvent("00000000-0000-4000-8000-000000000051");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2, activeGenerations: { [oldOwner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(oldOwner, 1)]: {
          ownerUserId: oldOwner, accountGeneration: 1, cache: {} as never, preferences: { youtubeHistoryEnabled: true }, currentObservation: event,
          outbox: { ownerUserId: oldOwner, accountGeneration: 1, entries: [{ event, key: "old-owner", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0, quotaBytes: 1_000_000,
    });

    await handleWatchHistoryAuthSessionChange(session, nextSession, {
      getCurrentSession: async () => nextSession,
      fetch: fetchImpl as typeof fetch,
      storage,
    });
    const oldPartition = stored.partitions[watchHistoryPartitionKey(oldOwner, 1)];
    expect(oldPartition).toMatchObject({ cache: null, preferences: null, currentObservation: null });
    expect(oldPartition.outbox.entries).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/api/watch-history/v2"), expect.anything());
  });

  it("clears rebuildable state on sign-out and reconciles canonical generation before same-owner draining", async () => {
    const owner = session.user.id;
    const event = progressEvent("00000000-0000-4000-8000-000000000060");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2, activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: {} as never, preferences: { youtubeHistoryEnabled: true }, currentObservation: event,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event, key: "old", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0, quotaBytes: 1_000_000,
    });
    await handleWatchHistoryAuthSessionChange(session, null, { storage, getCurrentSession: async () => null });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toMatchObject({ cache: null, preferences: null, currentObservation: null });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toHaveLength(1);

    const canonical = {
      meta: { serverTime: "2026-08-15T10:01:00.000Z", schemaVersion: 2, ownerUserId: owner, accountGeneration: 2 },
      generatedAt: "2026-08-15T10:01:00.000Z", totalTitleCount: 0, items: [], nextCursor: null,
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(canonical)));
    await handleWatchHistoryAuthSessionChange(session, session, {
      storage, getCurrentSession: async () => session, fetch: fetchImpl as typeof fetch,
    });
    expect(stored.activeGenerations?.[owner]).toBe(2);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not drain dormant same-owner work when auth canonical reconciliation fails", async () => {
    const owner = session.user.id;
    const event = progressEvent("00000000-0000-4000-8000-000000000070");
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2, activeGenerations: { [owner]: 1 },
      partitions: {
        [watchHistoryPartitionKey(owner, 1)]: {
          ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: null,
          outbox: { ownerUserId: owner, accountGeneration: 1, entries: [{ event, key: "dormant", slot: "latest", persistedAt: 1 }] },
        },
      },
    };
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const storage = createWatchHistoryStorage({
      item: { getValue: async () => stored, setValue: async (value) => { stored = value; } },
      getBytesInUse: async () => 0, quotaBytes: 1_000_000,
    });

    await expect(handleWatchHistoryAuthSessionChange(session, session, {
      storage, getCurrentSession: async () => session, fetch: fetchImpl as typeof fetch,
    })).resolves.toEqual({ ok: false, status: "retryable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]?.outbox.entries).toHaveLength(1);
    expect(stored.activeGenerations?.[owner]).toBe(1);
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
