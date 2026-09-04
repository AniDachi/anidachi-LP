import {
  WatchHistoryResponseSchema,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchProgressEvent,
} from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PopupWatchHistoryPanel,
  selectConfirmedPopupWatchHistorySnapshot,
  subscribeToPopupWatchHistorySnapshot,
  type PopupWatchHistoryClient,
  type PopupWatchHistorySnapshot,
} from "../src/popup-watch-history";
import {
  createWatchHistoryStorage,
  watchHistoryPartitionKey,
  type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";
import {
  createWatchHistoryClient,
  createListWatchHistoryMessage,
  type WatchHistoryMessageResponse,
} from "../src/watch-history-client";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const NOW = "2026-08-15T03:00:00.000Z";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Popup Watch History v2", () => {
  it("suppresses foreign-region exact totals immediately, including an already open Popup, while GET fails", async () => {
    const complete = historyFixture();
    complete.items[0]!.catalogState = "complete";
    complete.items[0]!.aggregate = { completedEpisodes: 0, availableEpisodes: 12, progress: 0 };
    complete.items[0]!.seasons[0]!.aggregate = { completedEpisodes: 0, availableEpisodes: 12, progress: 0 };
    const key = watchHistoryPartitionKey(OWNER_ID, 1);
    let stored: WatchHistoryStorageRoot = { schemaVersion: 3, activeGenerations: { [OWNER_ID]: 1 }, partitions: {
      [key]: { ownerUserId: OWNER_ID, accountGeneration: 1, preferences: { youtubeHistoryEnabled: false }, preferencesConfirmed: true,
        cache: complete, captureMarkersReady: true, capturePaused: false, currentObservation: null, outbox: { ownerUserId: OWNER_ID, accountGeneration: 1, entries: [] } },
    } };
    let getSucceeds = false;
    const background = createWatchHistoryClient({
      getCurrentSession: async () => ({ accessToken: "test", refreshToken: "test", user: { id: OWNER_ID } } as never),
      storage: createWatchHistoryStorage({ item: { getValue: async () => stored, setValue: async (value) => { stored = value; } }, getBytesInUse: async () => 0, quotaBytes: 1_000_000 }),
      fetch: async (_url, init) => init?.method === "POST" ? new Response(JSON.stringify({ meta: complete.meta,
        schemaVersion: 3, accountGeneration: 1, provider: "crunchyroll", titleKey: "crunchyroll:series:FRIEREN", revision: 2,
        refreshRequired: true, availabilityChanged: true, effectiveCatalogState: "partial", projectionRevision: null, acceptedHash: null, acceptedAt: null,
      })) : getSucceeds ? new Response(JSON.stringify(complete)) : new Response("offline", { status: 503 }),
    });
    let publish!: (snapshot: PopupWatchHistorySnapshot | null) => void;
    const client = { ...clientFixture({ cached: snapshotFixture(complete), request: async () => ({ ok: false, status: "retryable" }) }),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => undefined; },
    };
    const view = await renderPanel(client);
    await waitFor(() => expect(view.container.textContent).toContain("0/12 episodes"));
    await background.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "catalog-begin", expectedOwnerUserId: OWNER_ID, pageId: "visit",
      input: { schemaVersion: 3, accountGeneration: 1, provider: "crunchyroll", titleKey: "crunchyroll:series:FRIEREN", providerSeriesId: "FRIEREN",
        context: { region: "US", requestedLocale: "en-US", audioLocale: null, subtitleLocales: [], observedAt: NOW } } });
    const partial = selectConfirmedPopupWatchHistorySnapshot(stored, OWNER_ID)!;
    expect(partial.history.items[0]).toMatchObject({ catalogState: "partial", aggregate: { availableEpisodes: null, progress: null } });
    expect(partial.history.items[0]!.seasons[0]!.episodes).toEqual(complete.items[0]!.seasons[0]!.episodes);
    await act(async () => { publish(partial); });
    expect(view.container.textContent).not.toContain("0/12 episodes");
    expect(view.container.textContent).toContain("The Journey");
    await background.handle(createListWatchHistoryMessage());
    expect(stored.partitions[key]!.cache!.items[0]!.catalogState).toBe("partial");
    getSucceeds = true;
    await background.handle(createListWatchHistoryMessage());
    await act(async () => { publish(selectConfirmedPopupWatchHistorySnapshot(stored, OWNER_ID)); });
    expect(view.container.textContent).toContain("0/12 episodes");
    await unmount(view.root);
  });
  it("coalesces mutation invalidations for an open subscriber and stops refresh after close", async () => {
    let listener!: (changes: Record<string, chrome.storage.StorageChange>, area: chrome.storage.AreaName) => void;
    const refresh = vi.fn(async () => ({ ok: true } as const));
    const selected: unknown[] = [];
    const close = subscribeToPopupWatchHistorySnapshot(OWNER_ID, (value) => selected.push(value), {
      onChanged: { addListener: (next) => { listener = next; }, removeListener: () => undefined },
      load: async () => snapshotFixture(historyFixture(), []), refresh,
    });
    const root = (revision: number) => ({ schemaVersion: 3, activeGenerations: { [OWNER_ID]: 1 }, partitions: {
      [watchHistoryPartitionKey(OWNER_ID, 1)]: { ownerUserId: OWNER_ID, accountGeneration: 1, invalidationRevision: revision, cacheRevision: 0 },
    } });
    listener({ "anidachi.watchHistory.v3": { newValue: root(1) } }, "local");
    listener({ "anidachi.watchHistory.v3": { newValue: root(2) } }, "local");
    await Promise.resolve(); await Promise.resolve();
    expect(refresh).toHaveBeenCalledOnce();
    expect(selected).toHaveLength(1);
    close();
    listener({ "anidachi.watchHistory.v3": { newValue: root(3) } }, "local");
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledOnce();
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("paints the confirmed current-owner cache, overlays matching pending progress, then accepts canonical refresh", async () => {
    let resolveList: ((value: WatchHistoryMessageResponse) => void) | undefined;
    const cached = historyFixture({ title: "Cached Frieren", currentTime: 420, progress: 0.2 });
    const refreshed = historyFixture({ title: "Canonical Frieren", currentTime: 1_260, progress: 0.6 });
    const client = clientFixture({
      cached: snapshotFixture(cached, [pendingEvent({ currentTime: 840, progress: 0.4 })]),
      request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "list") {
          return new Promise<WatchHistoryMessageResponse>((resolve) => {
            resolveList = resolve;
          });
        }
        if (message.command === "get-preferences") {
          return { ok: true, data: preferencesFixture(false) };
        }
        if (message.command === "other-owner-pending") {
          return { ok: true, hasPendingWork: false, byteUse: 0 };
        }
        return { ok: true };
      }),
    });
    let cacheReads = 0;
    client.loadCached = vi.fn(async () => {
      cacheReads += 1;
      return cacheReads === 1
        ? snapshotFixture(cached, [pendingEvent({ currentTime: 840, progress: 0.4 })])
        : snapshotFixture(refreshed);
    });

    const view = await renderPanel(client);
    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("14:00");

    await act(async () => {
      resolveList?.({ ok: true, data: refreshed });
      await Promise.resolve();
    });

    await waitFor(() => expect(view.container.textContent).toContain("Canonical Frieren"));
    expect(view.container.textContent).toContain("21:00");
    expect(view.container.textContent).not.toContain("Cached Frieren");
    expect(client.request).toHaveBeenCalledWith(createListWatchHistoryMessage({ limit: 100 }));

    await unmount(view.root);
  });

  it("keeps a newer meaningful local observation over a canonical refresh without another network write", async () => {
    const canonical = historyFixture({ currentTime: 600, progress: 0.25 });
    const local = {
      ...pendingEvent({ currentTime: 840, progress: 0.4 }),
      observedAt: "2026-08-15T03:00:05.000Z",
    };
    const snapshot = snapshotFixture(canonical, [local]);
    const baseRequest = requestForHistory(canonical);
    let listRequests = 0;
    const request = vi.fn(async (message) => {
      if (message.command === "list") listRequests += 1;
      return baseRequest(message);
    });
    const client = clientFixture({ cached: snapshot, request });

    const view = await renderPanel(client);

    await waitFor(() => expect(view.container.textContent).toContain("14:00"));
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(client.loadCached).toHaveBeenCalledTimes(2);
    expect(listRequests).toBe(1);
    await unmount(view.root);
  });

  it("renders a meaningful pending title before the canonical list contains it", async () => {
    const emptyHistory: WatchHistoryResponse = {
      ...historyFixture(),
      totalTitleCount: 0,
      items: [],
    };
    const local = pendingEvent({ currentTime: 12, progress: 12 / 2_100 });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(emptyHistory, [local]),
      request: requestForHistory(emptyHistory),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("0:12");
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).not.toContain("Progress will appear after meaningful playback.");
    await unmount(view.root);
  });

  it("renders the current local observation immediately before it is eligible for sync", async () => {
    const emptyHistory: WatchHistoryResponse = {
      ...historyFixture(),
      totalTitleCount: 0,
      items: [],
    };
    const local = pendingEvent({ currentTime: 3, progress: 3 / 2_100 });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(
        emptyHistory,
        [],
        false,
        { event: local, mode: "mine" },
      ),
      request: requestForHistory(emptyHistory),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).toContain("0:03");
    expect(view.container.textContent).not.toContain("Watching now");
    expect(view.container.textContent).not.toContain("Pending sync");
    await unmount(view.root);
  });

  it("keeps an already-open Popup live from local observation through sync and canonical acknowledgement", async () => {
    const emptyHistory: WatchHistoryResponse = {
      ...historyFixture(),
      totalTitleCount: 0,
      items: [],
    };
    const local = pendingEvent({ currentTime: 12, progress: 12 / 2_100 });
    const canonical = historyFixture({
      title: "Canonical Frieren",
      currentTime: 12,
      progress: 12 / 2_100,
    });
    let publishSnapshot: ((snapshot: PopupWatchHistorySnapshot | null) => void) | null = null;
    const client = {
      ...clientFixture({
        cached: snapshotFixture(emptyHistory),
        request: requestForHistory(emptyHistory),
      }),
      subscribe: (
        _ownerUserId: string,
        listener: (snapshot: PopupWatchHistorySnapshot | null) => void,
      ) => {
        publishSnapshot = listener;
        return () => {
          publishSnapshot = null;
        };
      },
    };
    const view = await renderPanel(client);

    await waitFor(() => {
      expect(view.container.textContent).toContain(
        "Episodes you watch on supported sites will appear here.",
      );
    });

    await act(async () => {
      publishSnapshot?.(snapshotFixture(
        emptyHistory,
        [],
        false,
        { event: local, mode: "mine" },
      ));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).not.toContain("Watching now");
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("0:12");

    await act(async () => {
      publishSnapshot?.(snapshotFixture(emptyHistory));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.container.textContent).not.toContain("Cached Frieren"));

    await act(async () => {
      publishSnapshot?.(snapshotFixture(
        emptyHistory,
        [local],
        false,
        { event: local, mode: "mine" },
      ));
      await Promise.resolve();
    });
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).not.toContain("Watching now");
    expect(view.container.textContent).toContain("0:12");

    await act(async () => {
      publishSnapshot?.(snapshotFixture(emptyHistory));
      await Promise.resolve();
    });
    expect(view.container.textContent).toContain("Cached Frieren");
    expect(view.container.textContent).not.toContain("Pending sync");

    await act(async () => {
      publishSnapshot?.(snapshotFixture(canonical));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.container.textContent).toContain("Canonical Frieren"));
    expect(view.container.textContent).not.toContain("Cached Frieren");
    expect(view.container.textContent).not.toContain("Pending sync");
    await unmount(view.root);
  });

  it("does not let an older opening refresh erase newer live progress", async () => {
    const emptyHistory: WatchHistoryResponse = {
      ...historyFixture(),
      totalTitleCount: 0,
      items: [],
    };
    const local = pendingEvent({ currentTime: 12, progress: 12 / 2_100 });
    let publishSnapshot: ((snapshot: PopupWatchHistorySnapshot | null) => void) | null = null;
    let resolveList: ((response: WatchHistoryMessageResponse) => void) | null = null;
    const client = {
      ...clientFixture({
        cached: snapshotFixture(emptyHistory),
        request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
          if (message.command === "list") {
            return new Promise<WatchHistoryMessageResponse>((resolve) => {
              resolveList = resolve;
            });
          }
          if (message.command === "get-preferences") {
            return { ok: true, data: preferencesFixture(false) };
          }
          if (message.command === "other-owner-pending") {
            return { ok: true, hasPendingWork: false, byteUse: 0 };
          }
          return { ok: true };
        }),
      }),
      subscribe: (
        _ownerUserId: string,
        listener: (snapshot: PopupWatchHistorySnapshot | null) => void,
      ) => {
        publishSnapshot = listener;
        return () => {
          publishSnapshot = null;
        };
      },
    };
    const view = await renderPanel(client);

    await waitFor(() => {
      expect(view.container.textContent).toContain(
        "Episodes you watch on supported sites will appear here.",
      );
    });
    await act(async () => {
      publishSnapshot?.(snapshotFixture(emptyHistory, [local]));
      await Promise.resolve();
    });
    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));

    await act(async () => {
      resolveList?.({ ok: true, data: emptyHistory });
      await Promise.resolve();
    });
    await waitFor(() => expect(view.container.textContent).toContain("Cached Frieren"));
    expect(view.container.textContent).not.toContain("Pending sync");
    await unmount(view.root);
  });

  it("renders a meaningful pending episode before its canonical title refresh catches up", async () => {
    const canonical = historyFixture();
    const local: WatchProgressEvent = {
      ...pendingEvent({ currentTime: 12, progress: 12 / 2_100 }),
      clientEventId: "00000000-0000-4000-8000-000000000006",
      episodeKey: "crunchyroll:episode:FRIEREN|S1|E2",
      episodeTitle: "Episode 2 - The Promise",
    };
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(canonical, [local]),
      request: requestForHistory(canonical),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("Episode 2 - The Promise"));
    expect(view.container.textContent).toContain("0:12");
    expect(view.container.textContent).not.toContain("Pending sync");
    await unmount(view.root);
  });

  it("separates an active local observation from durable pending sync work", () => {
    const history = historyFixture();
    const observation = {
      ...pendingEvent({ currentTime: 840, progress: 0.4 }),
      observedAt: "2026-08-15T03:00:05.000Z",
    };
    const partitionKey = watchHistoryPartitionKey(OWNER_ID, 1);
    const root: WatchHistoryStorageRoot = {
      schemaVersion: 3,
      activeGenerations: { [OWNER_ID]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: OWNER_ID,
          accountGeneration: 1,
          cache: history,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: observation,
          currentObservationMeaningfulSolo: false,
          currentObservationDisplayMode: "mine",
          capturePaused: false,
          captureMarkersReady: true,
          outbox: { ownerUserId: OWNER_ID, accountGeneration: 1, entries: [] },
        },
      },
    };

    const snapshot = selectConfirmedPopupWatchHistorySnapshot(root, OWNER_ID);
    expect(snapshot?.localObservation).toEqual({ event: observation, mode: "mine" });
    expect(snapshot?.pendingEvents).toEqual([]);
  });

  it("does not let a stale local observation override newer canonical progress from another device", () => {
    const history = historyFixture({ currentTime: 1_200, progress: 0.6 });
    const staleLocal = {
      ...pendingEvent({ currentTime: 840, progress: 0.4 }),
      observedAt: "2026-08-15T02:59:59.000Z",
    };
    const partitionKey = watchHistoryPartitionKey(OWNER_ID, 1);
    const root: WatchHistoryStorageRoot = {
      schemaVersion: 3,
      activeGenerations: { [OWNER_ID]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: OWNER_ID,
          accountGeneration: 1,
          cache: history,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: staleLocal,
          currentObservationMeaningfulSolo: true,
          capturePaused: false,
          captureMarkersReady: true,
          outbox: { ownerUserId: OWNER_ID, accountGeneration: 1, entries: [] },
        },
      },
    };

    const snapshot = selectConfirmedPopupWatchHistorySnapshot(root, OWNER_ID);
    expect(snapshot?.pendingEvents).toEqual([]);
    expect(snapshot?.localObservation).toBeNull();
  });

  it("stops overlaying a local observation once canonical history reaches the same timestamp", () => {
    const history = historyFixture({ currentTime: 840, progress: 0.4 });
    const observation = pendingEvent({ currentTime: 840, progress: 0.4 });
    const partitionKey = watchHistoryPartitionKey(OWNER_ID, 1);
    const root: WatchHistoryStorageRoot = {
      schemaVersion: 3,
      activeGenerations: { [OWNER_ID]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: OWNER_ID,
          accountGeneration: 1,
          cache: history,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: observation,
          currentObservationMeaningfulSolo: false,
          currentObservationDisplayMode: "mine",
          capturePaused: false,
          captureMarkersReady: true,
          outbox: { ownerUserId: OWNER_ID, accountGeneration: 1, entries: [] },
        },
      },
    };

    expect(selectConfirmedPopupWatchHistorySnapshot(root, OWNER_ID)?.localObservation).toBeNull();
  });

  it("rejects obsolete cache shapes without manufacturing schema3 counts while offline", async () => {
    const legacyCache = legacyHistoryFixture(10);
    expect(WatchHistoryResponseSchema.safeParse(legacyCache).success).toBe(false);
    const local = pendingEvent({
      currentTime: 660,
      progress: 660 / 2_100,
      clientEventId: "00000000-0000-4000-8000-000000000011",
      episodeKey: "crunchyroll:episode:FRIEREN|S1|E11",
      episodeTitle: "Episode 11 - Local",
      episodeNumber: 11,
      observedAt: "2026-08-15T03:00:11.000Z",
    });
    const queued = pendingEvent({
      currentTime: 720,
      progress: 720 / 2_100,
      clientEventId: "00000000-0000-4000-8000-000000000012",
      episodeKey: "crunchyroll:episode:FRIEREN|S1|E12",
      episodeTitle: "Episode 12 - Queued",
      episodeNumber: 12,
      observedAt: "2026-08-15T03:00:12.000Z",
    });
    const partitionKey = watchHistoryPartitionKey(OWNER_ID, 1);
    const root: WatchHistoryStorageRoot = {
      schemaVersion: 3,
      activeGenerations: { [OWNER_ID]: 1 },
      partitions: {
        [partitionKey]: {
          ownerUserId: OWNER_ID,
          accountGeneration: 1,
          cache: legacyCache,
          preferences: { youtubeHistoryEnabled: false },
          preferencesConfirmed: true,
          currentObservation: local,
          currentObservationMeaningfulSolo: false,
          currentObservationDisplayMode: "mine",
          capturePaused: false,
          captureMarkersReady: true,
          outbox: {
            ownerUserId: OWNER_ID,
            accountGeneration: 1,
            entries: [{ event: queued, key: "queued", slot: "latest", persistedAt: 1 }],
          },
        },
      },
    };

    const snapshot = selectConfirmedPopupWatchHistorySnapshot(root, OWNER_ID);
    expect(snapshot).toBeNull();
    expect(root.partitions[partitionKey]?.outbox.entries).toHaveLength(1);

    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: false, status: "retryable" };
      if (message.command === "get-preferences") return { ok: false, status: "retryable" };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: snapshot, request }));
    expect(view.container.textContent).not.toContain("Frieren");
    expect(view.container.querySelectorAll(".popup-episode-row")).toHaveLength(0);
    await unmount(view.root);
  });

  it("bounds pending projection newest-first without mutating work and always pins local progress", async () => {
    const canonical = historyWithEpisodesFixture(8);
    const pending = [
      ...[9, 10, 11].map((number) => pendingEvent({
        currentTime: number * 60,
        progress: number / 20,
        clientEventId: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
        episodeKey: `crunchyroll:episode:FRIEREN|S1|E${number}`,
        episodeTitle: `Episode ${number} - Queued`,
        episodeNumber: number,
        observedAt: `2026-08-15T03:00:${String(number).padStart(2, "0")}.000Z`,
      })),
      pendingEvent({
        currentTime: 1_200,
        progress: 1_200 / 2_100,
        clientEventId: "00000000-0000-4000-8000-000000000013",
        episodeKey: "crunchyroll:episode:FRIEREN|S1|E12",
        episodeTitle: "Episode 12 - Queued later",
        episodeNumber: 12,
        observedAt: "2026-08-15T03:00:12.000Z",
      }),
    ];
    const local = pendingEvent({
      currentTime: 12,
      progress: 12 / 2_100,
      clientEventId: "00000000-0000-4000-8000-000000000012",
      episodeKey: "crunchyroll:episode:FRIEREN|S1|E12",
      episodeTitle: "Episode 12 - Immediate local",
      episodeNumber: 12,
      observedAt: "2026-08-15T03:00:01.000Z",
    });
    const originalPending = structuredClone(pending);
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(canonical, pending, false, { event: local, mode: "mine" }),
      request: requestForHistory(canonical),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("Episode 12 - Immediate local"));
    const rows = [...view.container.querySelectorAll(".popup-episode-row")];
    expect(rows).toHaveLength(8);
    expect(view.container.textContent).toContain("Episode 11 - Queued");
    expect(view.container.textContent).toContain("0:12");
    expect(view.container.textContent).not.toContain("Episode 12 - Queued later");
    expect(view.container.textContent).not.toContain("Episode 1 - Cached");
    expect(pending).toEqual(originalPending);
    await unmount(view.root);
  });

  it("uses binary episode-key order for equal timestamps while pinning older local progress", async () => {
    const canonical = historyWithEpisodesFixture(8);
    const tied = [
      ["crunchyroll:episode:FRIEREN|S1|Ea", "Episode tie lowercase", 21],
      ["crunchyroll:episode:FRIEREN|S1|E_", "Episode tie underscore", 22],
      ["crunchyroll:episode:FRIEREN|S1|EA", "Episode tie uppercase", 23],
    ] as const;
    const pending = tied.map(([episodeKey, episodeTitle, id]) => pendingEvent({
      currentTime: id,
      progress: id / 2_100,
      clientEventId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      episodeKey,
      episodeTitle,
      episodeNumber: id,
      observedAt: "2026-08-15T03:00:20.000Z",
    }));
    const local = pendingEvent({
      currentTime: 7,
      progress: 7 / 2_100,
      clientEventId: "00000000-0000-4000-8000-000000000024",
      episodeKey: "crunchyroll:episode:FRIEREN|S1|Elocal",
      episodeTitle: "Episode local pinned",
      episodeNumber: 24,
      observedAt: "2026-08-15T01:00:00.000Z",
    });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(canonical, pending, false, { event: local, mode: "mine" }),
      request: requestForHistory(canonical),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("Episode local pinned"));
    const tiedTitles = [...view.container.querySelectorAll(".popup-episode-title")]
      .map((node) => node.textContent)
      .filter((title) => title?.startsWith("Episode tie"));
    expect(tiedTitles).toEqual([
      "Episode tie uppercase",
      "Episode tie underscore",
      "Episode tie lowercase",
    ]);
    expect(view.container.querySelectorAll(".popup-episode-row")).toHaveLength(8);
    await unmount(view.root);
  });

  it("shows the cached YouTube switch immediately while live confirmation is pending", async () => {
    let resolvePreferences: ((value: WatchHistoryMessageResponse) => void) | undefined;
    const client = clientFixture({
      cached: snapshotFixture(historyFixture(), [], true),
      request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "list") return { ok: true, data: historyFixture() };
        if (message.command === "get-preferences") {
          return new Promise<WatchHistoryMessageResponse>((resolve) => {
            resolvePreferences = resolve;
          });
        }
        if (message.command === "other-owner-pending") {
          return { ok: true, hasPendingWork: false, byteUse: 0 };
        }
        return { ok: true };
      }),
    });

    const view = await renderPanel(client);
    const toggle = await findButton(view.container, "Track YouTube history");
    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute("role")).toBe("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.querySelector(".popup-watch-youtube-switch-track")).not.toBeNull();
    expect(toggle.textContent).toContain("On");
    expect(toggle.textContent).not.toContain("Loading");
    expect(toggle.textContent).not.toContain("Retry");

    await act(async () => {
      resolvePreferences?.({ ok: true, data: preferencesFixture(true) });
      await Promise.resolve();
    });

    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await unmount(view.root);
  });

  it("keeps a simple switch and lets the user update after preference loading fails", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") {
        return { ok: false, status: "retryable" };
      }
      if (message.command === "update-preferences") {
        return { ok: true, data: preferencesFixture(true) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(historyFixture()),
      request,
    }));
    const toggle = await findButton(view.container, "Track YouTube history");

    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.textContent).toContain("Off");
    expect(toggle.textContent).not.toContain("Loading");
    expect(toggle.textContent).not.toContain("Retry");
    await click(toggle);

    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    }));
    await unmount(view.root);
  });

  it("does not wait for a hanging history list before applying YouTube preferences", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        return new Promise<WatchHistoryMessageResponse>(() => undefined);
      }
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(true) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(historyFixture()),
      request,
    }));
    const toggle = await findButton(view.container, "Track YouTube history");

    await waitFor(() => expect(toggle.disabled).toBe(false));
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.textContent).toContain("On");
    await unmount(view.root);
  });

  it("patches the account YouTube preference and applies only the confirmed acknowledgement", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "update-preferences") {
        return { ok: true, data: preferencesFixture(true) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const toggle = await findButton(view.container, "Track YouTube history");
    await waitFor(() => expect(toggle.disabled).toBe(false));

    await click(toggle);

    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    }));
    await unmount(view.root);
  });

  it("keeps current content visible during a same-owner background refresh", async () => {
    let listRequests = 0;
    const history = historyFixture({ title: "Stable Frieren" });
    const client = clientFixture({
      cached: snapshotFixture(history, [], true),
      request: vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
        if (message.command === "list") {
          listRequests += 1;
          if (listRequests === 1) return { ok: true, data: history };
          return new Promise<WatchHistoryMessageResponse>(() => undefined);
        }
        if (message.command === "get-preferences") {
          return { ok: true, data: preferencesFixture(true) };
        }
        if (message.command === "other-owner-pending") {
          return { ok: true, hasPendingWork: false, byteUse: 0 };
        }
        return { ok: true };
      }),
    });
    let cacheReads = 0;
    client.loadCached = vi.fn(async () => {
      cacheReads += 1;
      return snapshotFixture(
        cacheReads <= 2 ? history : historyFixture({ title: "Older cached Frieren" }),
        [],
        true,
      );
    });
    const view = await renderPanel(client);
    await waitFor(() => expect(view.container.textContent).toContain("Stable Frieren"));

    await act(async () => {
      view.root.render(
        <PopupWatchHistoryPanel
          client={client}
          ownerUserId={OWNER_ID}
          refreshSignal={1}
        />,
      );
    });

    await waitFor(() => expect(listRequests).toBe(2));
    expect(view.container.textContent).toContain("Stable Frieren");
    expect(view.container.textContent).not.toContain("Older cached Frieren");
    expect(view.container.textContent).not.toContain("Loading watch history");
    const toggle = await findButton(view.container, "Track YouTube history");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await unmount(view.root);
  });

  it("deletes one episode with the current generation and keeps unrelated canonical history", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: twoEpisodeHistoryFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      if (message.command === "delete") {
        const input = message.input as {
          clientMutationId: string;
          accountGeneration: number;
          target: { scope: "episode"; provider: "crunchyroll"; titleKey: string; episodeKey: string };
        };
        return {
          ok: true,
          data: {
            meta: {
              schemaVersion: 3,
              ownerUserId: OWNER_ID,
              accountGeneration: 1,
              serverTime: NOW,
            },
            schemaVersion: 3,
            clientMutationId: input.clientMutationId,
            accountGeneration: input.accountGeneration,
            target: input.target,
            deletedAt: NOW,
          },
        };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const deleteFirst = await findButton(view.container, "Delete Episode 1 - The Journey");

    await click(deleteFirst);

    await waitFor(() => expect(view.container.textContent).not.toContain("Episode 1 - The Journey"));
    expect(view.container.textContent).toContain("Episode 2 - The Promise");
    const deletion = request.mock.calls.find(([message]) => message.command === "delete")?.[0];
    expect(deletion).toEqual(expect.objectContaining({
      command: "delete",
      input: expect.objectContaining({
        schemaVersion: 3,
        accountGeneration: 1,
        clientMutationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        target: {
          scope: "episode",
          provider: "crunchyroll",
          titleKey: "crunchyroll:series:FRIEREN",
          episodeKey: "crunchyroll:episode:FRIEREN|S1|E1",
        },
      }),
    }));
    await unmount(view.root);
  });

  it("shows only an aggregate old-account warning and discards it only after confirmation", async () => {
    const confirmDiscard = vi.fn(() => true);
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") {
        return { ok: true, data: preferencesFixture(false) };
      }
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: true, byteUse: 1_024 };
      }
      return { ok: true };
    });
    const client: PopupWatchHistoryClient = {
      ...clientFixture({ cached: null, request }),
      confirmDiscard,
    };
    const view = await renderPanel(client);
    const discard = await findButton(view.container, "Discard pending history from another account");
    expect(view.container.textContent).toContain("Pending history from another account");
    expect(view.container.textContent).not.toContain("00000000-");

    await click(discard);

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "discard-old-owner-work",
      confirmed: true,
    }));
    await unmount(view.root);
  });

  it("accepts an all-history acknowledgement that advances the account generation", async () => {
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: historyFixture() };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      if (message.command === "delete") {
        const input = message.input as { clientMutationId: string; target: { scope: "all" } };
        return {
          ok: true,
          data: {
            meta: { schemaVersion: 3, ownerUserId: OWNER_ID, accountGeneration: 2, serverTime: NOW },
            schemaVersion: 3,
            clientMutationId: input.clientMutationId,
            accountGeneration: 2,
            target: input.target,
            deletedAt: NOW,
          },
        };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const clear = await findButton(view.container, "Clear all watch history");

    await click(clear);

    await waitFor(() => expect(view.container.textContent).toContain(
      "Episodes you watch on supported sites will appear here.",
    ));
    expect(view.container.textContent).not.toContain("Frieren");
    await unmount(view.root);
  });

  it("recreates a room from a canonical session and opens the source with its room id", async () => {
    const openUrl = vi.fn(async () => undefined);
    const history = sameEpisodeMixedSessionHistoryFixture();
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: history };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      if (message.command === "create-room") {
        return {
          ok: true,
          data: {
            roomId: "room-popup-1",
            roomToken: "signed-room-token",
            shareableLink: "https://staging.anidachi.app/room/room-popup-1",
            reused: false,
            capabilities: {
              hostPlanCode: "free",
              maxParticipants: 4,
              maxMediaSeats: 2,
              canNameRoom: false,
              canSendPushInvites: false,
            },
            quota: null,
          },
        };
      }
      return { ok: true };
    });
    const client = { ...clientFixture({ cached: null, request }), openUrl };
    const view = await renderPanel(client);
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");
    await click(mode);
    const createRoom = await findButton(view.container, "Create room from Shared session");

    await click(createRoom);

    await waitFor(() => expect(openUrl).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      command: "create-room",
      sessionId: "00000000-0000-4000-8000-000000000004",
    }));
    expect(openUrl).toHaveBeenCalledWith("https://www.crunchyroll.com/watch/EPISODE1#anidachiRoom=room-popup-1");
    await unmount(view.root);
  });

  it("renders a YouTube movie-like item without inventing a catalog denominator", async () => {
    const history = youtubeMovieHistoryFixture();
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: history };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(true) };
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: false, byteUse: 0 };
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));

    await waitFor(() => expect(view.container.textContent).toContain("YouTube Movie"));
    expect(view.container.textContent).toContain("1 observed episode");
    expect(view.container.textContent).toContain("5:00");
    expect(view.container.textContent).not.toContain("0/");
    await unmount(view.root);
  });

  it("renders exact canonical counts from the compact snapshot and never requests old detail pages", async () => {
    const base = historyFixture();
    const item = base.items[0]!;
    const first = item.seasons[0]!.episodes[0]!;
    const episodes = Array.from({ length: 8 }, (_, index) => ({
      ...first,
      episodeKey: `crunchyroll:episode:FRIEREN|S1|E${index + 1}`,
      episodeTitle: `Episode ${index + 1}`,
      episodeNumber: index + 1,
    }));
    const compact = {
      ...base,
      items: [{
        ...item,
        observedEpisodeCount: 2_000,
        completedEpisodeCount: 100,
        episodePage: { complete: false, nextCursor: "episode_cursor" },
        aggregate: { ...item.aggregate, completedEpisodes: 100 },
        seasons: [{ ...item.seasons[0]!, episodes }],
      }],
    } as WatchHistoryResponse;
    const request = vi.fn(requestForHistory(compact));
    const view = await renderPanel(clientFixture({ cached: null, request }));

    await waitFor(() => expect(view.container.textContent).toContain("2000 observed episodes"));
    expect(view.container.textContent).toContain("Episode 1");
    expect(view.container.textContent).toContain("Episode 8");
    expect(request.mock.calls.filter(([message]) => message.command === "list")).toHaveLength(1);
    expect(request.mock.calls.some(([message]) => "titleKey" in message)).toBe(false);
    await unmount(view.root);
  });

  it("searches canonical v2 history by title and episode without mutating the response", async () => {
    const history = twoEpisodeHistoryFixture();
    const request = requestForHistory(history);
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const search = await findInput(view.container, "Search watch history");

    await setInputValue(search, "Promise");
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Episode 2 - The Promise");

    await setInputValue(search, "missing");
    expect(view.container.textContent).toContain("No titles match your search.");
    expect(history.items[0]?.seasons[0]?.episodes).toHaveLength(2);
    await unmount(view.root);
  });

  it("collapses titles and seasons independently without fetching or losing disclosure state", async () => {
    const history = multiSeasonHistoryFixture();
    const request = vi.fn(requestForHistory(history));
    const view = await renderPanel(clientFixture({ cached: null, request }));
    const title = await findButton(view.container, "Toggle Frieren history");
    const secondTitle = await findButton(view.container, "Toggle Another title history");
    const firstSeason = await findButton(view.container, "Toggle Frieren Season 1");
    const latestSeason = await findButton(view.container, "Toggle Frieren Season 2");

    expect(title.getAttribute("aria-expanded")).toBe("true");
    expect(secondTitle.getAttribute("aria-expanded")).toBe("false");
    expect(firstSeason.getAttribute("aria-expanded")).toBe("false");
    expect(latestSeason.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("A New Beginning");
    await click(firstSeason);
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(title);
    expect(view.container.textContent).not.toContain("A New Beginning");
    expect(view.container.textContent).toContain("Frieren");
    await click(title);
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(secondTitle);
    expect(secondTitle.getAttribute("aria-expanded")).toBe("true");
    expect(title.getAttribute("aria-expanded")).toBe("true");
    expect(request.mock.calls.filter(([message]) => message.command === "list")).toHaveLength(1);
    expect(request.mock.calls.some(([message]) => "titleKey" in message)).toBe(false);
    await unmount(view.root);
  });

  it("reveals matching episodes inside collapsed branches and restores the previous view after search", async () => {
    const history = multiSeasonHistoryFixture();
    const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(history) }));
    await click(await findButton(view.container, "Toggle Frieren history"));
    await click(await findButton(view.container, "Toggle Crunchyroll history"));
    const search = await findInput(view.container, "Search watch history");
    await setInputValue(search, "Journey");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(view.container.textContent).not.toContain("A New Beginning");
    await click(await findButton(view.container, "Toggle Frieren Season 1"));
    const frieren = (await findButton(view.container, "Toggle Frieren history")).closest("article");
    expect(frieren?.textContent).not.toContain("Episode 1 - The Journey");
    await setInputValue(search, "Beginning");
    expect(view.container.textContent).toContain("A New Beginning");
    await click(await findButton(view.container, "Clear watch history search"));
    const provider = await findButton(view.container, "Toggle Crunchyroll history");
    expect(provider.getAttribute("aria-expanded")).toBe("false");
    await click(provider);
    expect((await findButton(view.container, "Toggle Frieren history")).getAttribute("aria-expanded"))
      .toBe("false");
    expect(history.items[0]?.seasons).toHaveLength(2);
    await unmount(view.root);
  });

  it("keeps deletion separate from disclosure and cancel never mutates history", async () => {
    const request = vi.fn(requestForHistory(historyFixture()));
    const client = clientFixture({ cached: null, request });
    client.confirmDiscard = vi.fn(() => false);
    const view = await renderPanel(client);
    const title = await findButton(view.container, "Toggle Frieren history");
    await click(await findButton(view.container, "Delete Frieren"));
    await click(await findButton(view.container, "Delete Episode 1 - The Journey"));
    expect(title.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(request.mock.calls.some(([message]) => message.command === "delete")).toBe(false);
    expect(view.container.querySelector("button button")).toBeNull();
    await unmount(view.root);
  });

  it("reveals the same search again after clearing a collapsed search result", async () => {
    const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(historyFixture()) }));
    const search = await findInput(view.container, "Search watch history");
    await setInputValue(search, "Journey");
    await click(await findButton(view.container, "Toggle Frieren history"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    await click(await findButton(view.container, "Clear watch history search"));
    await setInputValue(search, "Journey");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await unmount(view.root);
  });

  it("switches between Mine and Together while keeping provider identity visible", async () => {
    const history = mixedSessionHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(mode.dataset.mode).toBe("mine");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(view.container.textContent).not.toContain("Episode 2 - The Promise");
    expect(view.container.querySelector(".resource-provider-logo.crunchyroll svg")).not.toBeNull();

    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Episode 2 - The Promise");
    await unmount(view.root);
  });

  it("keeps observed progress without a session in Mine and excludes it from Together", async () => {
    const history = observedOnlyHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Shared sessions will appear after watching together.");
    await unmount(view.root);
  });

  it("projects mixed episode sessions to the selected mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).not.toContain("Solo session");
    expect(view.container.textContent).not.toContain("Shared session");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Solo session");
    expect(view.container.textContent).toContain("Shared session");
    expect(view.container.textContent).toContain("15:00");
    await unmount(view.root);
  });

  it("applies pending progress only to its Mine or Together mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const sharedPending = pendingEvent({ currentTime: 840, progress: 0.4, shared: true });
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: false, status: "retryable" };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(history, [sharedPending]),
      request,
    }));
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");

    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.dataset.mode).toBe("together"));
    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("14:00");
    await unmount(view.root);
  });

  it("retries a transient list failure from the Watch controls", async () => {
    let listAttempts = 0;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return listAttempts === 1
          ? { ok: false, status: "retryable" }
          : { ok: true, data: historyFixture() };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached: null, request }));

    await waitFor(() => expect(view.container.textContent).toContain("Could not refresh watch history."));
    const retry = await findButton(view.container, "Retry watch history");
    await click(retry);

    await waitFor(() => expect(view.container.textContent).toContain("Frieren"));
    expect(listAttempts).toBe(2);
    expect(view.container.textContent).not.toContain("Could not refresh watch history.");
    await unmount(view.root);
  });

  it("keeps cached rows visible and marks a failed canonical refresh as retryable", async () => {
    const cached = snapshotFixture(historyFixture({ title: "Cached Frieren" }));
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: false, status: "retryable" };
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const view = await renderPanel(clientFixture({ cached, request }));

    await waitFor(() => expect(view.container.textContent).toContain("Could not refresh watch history."));
    expect(view.container.textContent).toContain("Cached Frieren");
    await findButton(view.container, "Retry watch history");
    await unmount(view.root);
  });

  it("recovers full storage before refreshing Watch History", async () => {
    let listAttempts = 0;
    let recovered = false;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return { ok: true, data: historyFixture() };
      }
      if (message.command === "recover-storage") {
        recovered = true;
        return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const cached = snapshotFixture(historyFixture());
    cached.capturePaused = true;
    const client = clientFixture({ cached, request });
    client.loadCached = vi.fn(async () => ({ ...cached, capturePaused: !recovered }));
    const view = await renderPanel(client);

    await waitFor(() => expect(view.container.textContent).toContain("browser storage is full"));
    const retry = await findButton(view.container, "Retry watch history");
    await click(retry);

    await waitFor(() => expect(view.container.textContent).not.toContain("browser storage is full"));
    const recoveryCall = request.mock.calls.findIndex(([message]) => message.command === "recover-storage");
    const secondListCall = request.mock.calls.findIndex(
      ([message], index) => message.command === "list" && index > recoveryCall,
    );
    expect(recoveryCall).toBeGreaterThan(-1);
    expect(secondListCall).toBeGreaterThan(recoveryCall);
    expect(listAttempts).toBe(2);
    await unmount(view.root);
  });

  it("keeps recovered cached rows but returns to retry when the next drain is still storage-full", async () => {
    let listAttempts = 0;
    let recovered = false;
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") {
        listAttempts += 1;
        return listAttempts === 1
          ? { ok: true, data: historyFixture({ title: "Cached Frieren" }) }
          : { ok: false, status: "storage-full" };
      }
      if (message.command === "recover-storage") {
        recovered = true;
        return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
      }
      if (message.command === "get-preferences") return { ok: true, data: preferencesFixture(false) };
      if (message.command === "other-owner-pending") {
        return { ok: true, hasPendingWork: false, byteUse: 0 };
      }
      return { ok: true };
    });
    const cached = snapshotFixture(historyFixture({ title: "Cached Frieren" }));
    cached.capturePaused = true;
    const client = clientFixture({ cached, request });
    client.loadCached = vi.fn(async () => ({ ...cached, capturePaused: !recovered }));
    const view = await renderPanel(client);
    const retry = await findButton(view.container, "Retry watch history");

    await click(retry);

    await waitFor(() => expect(view.container.textContent).toContain("Browser storage is full."));
    expect(view.container.textContent).toContain("Cached Frieren");
    await findButton(view.container, "Retry watch history");
    expect(listAttempts).toBe(2);
    await unmount(view.root);
  });

  it("preserves the selected mode and search query across a manual refresh", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const view = await renderPanel(clientFixture({
      cached: null,
      request: requestForHistory(history),
    }));
    const mode = await findButton(view.container, "Watch history mode: Mine. Switch to Together");
    const search = await findInput(view.container, "Search watch history");
    await click(mode);
    await setInputValue(search, "Journey");
    const refresh = await findButton(view.container, "Refresh watch history");

    await click(refresh);

    await waitFor(() => expect(view.container.textContent).toContain("Shared session"));
    expect(mode.dataset.mode).toBe("together");
    expect(search.value).toBe("Journey");
    await unmount(view.root);
  });

  it("keeps each redesigned provider section independently collapsible", async () => {
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(historyFixture()) }),
    );
    const provider = await findButton(view.container, "Toggle Crunchyroll history");

    expect(provider.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(provider);
    expect(provider.getAttribute("aria-expanded")).toBe("false");
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    await unmount(view.root);
  });
});

function clientFixture(overrides: {
  cached: PopupWatchHistorySnapshot | null;
  request: PopupWatchHistoryClient["request"];
}): PopupWatchHistoryClient {
  return {
    loadCached: vi.fn(async () => overrides.cached),
    request: overrides.request,
    confirmDiscard: vi.fn(() => true),
    openUrl: vi.fn(async () => undefined),
  };
}

function snapshotFixture(
  history: WatchHistoryResponse,
  pendingEvents: WatchProgressEvent[] = [],
  youtubeHistoryEnabled = false,
  localObservation: PopupWatchHistorySnapshot["localObservation"] = null,
): PopupWatchHistorySnapshot {
  return {
    history,
    accountGeneration: 1,
    preferences: { youtubeHistoryEnabled },
    pendingEvents,
    localObservation,
    capturePaused: false,
  };
}

function historyFixture(overrides: {
  title?: string;
  currentTime?: number;
  progress?: number;
} = {}): WatchHistoryResponse {
  const currentTime = overrides.currentTime ?? 600;
  const progress = overrides.progress ?? 0.5;
  const episode = {
    episodeKey: "crunchyroll:episode:FRIEREN|S1|E1",
    episodeTitle: "Episode 1 - The Journey",
    seasonKey: "crunchyroll:season:FRIEREN|S1",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE1",
    currentTime,
    duration: 2_100,
    progress,
    completedAt: null,
    lastWatchedAt: NOW,
    sessions: [sessionFixture(currentTime, progress)],
  };
  return {
    meta: {
      schemaVersion: 3,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
      serverTime: NOW,
    },
    generatedAt: NOW,
    totalTitleCount: 1,
    nextCursor: null,
    items: [
      {
        provider: "crunchyroll",
        titleKey: "crunchyroll:series:FRIEREN",
        observedEpisodeCount: 1,
        completedEpisodeCount: 0,
        episodePage: { complete: true, nextCursor: null },
        itemKind: "series",
        title: overrides.title ?? "Frieren",
        sourceUrl: episode.sourceUrl,
        artworkUrl: null,
        catalogState: "unavailable",
        aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
        seasons: [
          {
            seasonKey: "crunchyroll:season:FRIEREN|S1",
            seasonTitle: "Season 1",
            seasonNumber: 1,
            order: 0,
            aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
            episodes: [episode],
            nextEpisode: null,
          },
        ],
        sessions: [sessionFixture(currentTime, progress)],
        latestActivity: {
          episodeKey: episode.episodeKey,
          currentTime,
          duration: episode.duration,
          progress,
          completedAt: null,
          lastWatchedAt: NOW,
        },
        lastWatchedAt: NOW,
      },
    ],
  };
}

function twoEpisodeHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  const first = history.items[0]?.seasons[0]?.episodes[0];
  if (!first) throw new Error("fixture episode missing");
  const second = {
    ...first,
    episodeKey: "crunchyroll:episode:FRIEREN|S1|E2",
    episodeTitle: "Episode 2 - The Promise",
    episodeNumber: 2,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE2",
  };
  return {
    ...history,
    items: history.items.map((item) => ({
      ...item,
      observedEpisodeCount: 2,
      episodePage: { complete: true, nextCursor: null },
      seasons: item.seasons.map((season) => ({ ...season, episodes: [first, second] })),
    })),
  };
}

function multiSeasonHistoryFixture(): WatchHistoryResponse {
  const history = twoEpisodeHistoryFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const firstEpisode = season?.episodes[0];
  if (!item || !season || !firstEpisode) throw new Error("multi-season fixture missing");
  const latest = {
    ...firstEpisode,
    episodeKey: "crunchyroll:season-2-episode-1",
    episodeTitle: "A New Beginning",
    seasonKey: "crunchyroll:season-2",
    seasonTitle: "Season 2",
    seasonNumber: 2,
  };
  return {
    ...history,
    totalTitleCount: 2,
    items: [{
      ...item,
      observedEpisodeCount: 3,
      latestActivity: { ...item.latestActivity, episodeKey: latest.episodeKey },
      seasons: [season, {
        ...season,
        seasonKey: latest.seasonKey,
        seasonTitle: latest.seasonTitle,
        seasonNumber: 2,
        order: 1,
        episodes: [latest],
      }],
    }, { ...item, titleKey: "crunchyroll:another", title: "Another title" }],
  };
}

function historyWithEpisodesFixture(count: number): WatchHistoryResponse {
  const history = historyFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const first = season?.episodes[0];
  if (!item || !season || !first) throw new Error("history fixture missing");
  const episodes = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const lastWatchedAt = new Date(Date.parse(NOW) - (count - number + 1) * 60_000).toISOString();
    return {
      ...first,
      episodeKey: `crunchyroll:episode:FRIEREN|S1|E${number}`,
      episodeTitle: `Episode ${number} - Cached`,
      episodeNumber: number,
      sourceUrl: `https://www.crunchyroll.com/watch/EPISODE${number}`,
      currentTime: number * 60,
      progress: number / 20,
      completedAt: number % 2 === 0 ? lastWatchedAt : null,
      lastWatchedAt,
      sessions: [],
    };
  }).reverse();
  const completedEpisodeCount = episodes.filter((episode) => episode.completedAt).length;
  const latest = episodes[0]!;
  return {
    ...history,
    items: [{
      ...item,
      observedEpisodeCount: count,
      completedEpisodeCount,
      episodePage: { complete: true, nextCursor: null },
      aggregate: { ...item.aggregate, completedEpisodes: completedEpisodeCount },
      seasons: [{
        ...season,
        aggregate: { ...season.aggregate, completedEpisodes: completedEpisodeCount },
        episodes,
      }],
      latestActivity: {
        episodeKey: latest.episodeKey,
        currentTime: latest.currentTime,
        duration: latest.duration,
        progress: latest.progress,
        completedAt: latest.completedAt,
        lastWatchedAt: latest.lastWatchedAt,
      },
      lastWatchedAt: latest.lastWatchedAt,
    }],
  };
}

function legacyHistoryFixture(count: number): WatchHistoryResponse {
  const legacy = structuredClone(historyWithEpisodesFixture(count)) as unknown as {
    items: Array<Record<string, unknown>>;
  };
  for (const item of legacy.items) {
    delete item.observedEpisodeCount;
    delete item.completedEpisodeCount;
    delete item.episodePage;
  }
  return legacy as unknown as WatchHistoryResponse;
}

function mixedSessionHistoryFixture(): WatchHistoryResponse {
  const history = twoEpisodeHistoryFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const first = season?.episodes[0];
  const second = season?.episodes[1];
  if (!item || !season || !first || !second) throw new Error("mixed history fixture missing");
  const shared = sharedSessionFixture(second.currentTime, second.progress);
  return {
    ...history,
    items: [{
      ...item,
      seasons: [{
        ...season,
        episodes: [first, { ...second, sessions: [shared] }],
      }],
      sessions: [...item.sessions, shared],
    }],
  };
}

function observedOnlyHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  return {
    ...history,
    items: history.items.map((item) => ({
      ...item,
      sessions: [],
      seasons: item.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((episode) => ({ ...episode, sessions: [] })),
      })),
    })),
  };
}

function sameEpisodeMixedSessionHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  const item = history.items[0];
  const season = item?.seasons[0];
  const episode = season?.episodes[0];
  if (!item || !season || !episode) throw new Error("mixed episode fixture missing");
  const shared = sharedSessionFixture(900, 0.75);
  return {
    ...history,
    items: [{
      ...item,
      sessions: [...item.sessions, shared],
      seasons: [{
        ...season,
        episodes: [{ ...episode, sessions: [...episode.sessions, shared] }],
      }],
    }],
  };
}

function youtubeMovieHistoryFixture(): WatchHistoryResponse {
  const history = historyFixture();
  return {
    ...history,
    items: [{
      ...history.items[0]!,
      provider: "youtube",
      titleKey: "youtube:movie-one",
      itemKind: "movie",
      title: "YouTube Movie",
      sourceUrl: "https://www.youtube.com/watch?v=movie-one",
      seasons: [],
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
      latestActivity: {
        episodeKey: "youtube:movie-one",
        currentTime: 300,
        duration: 600,
        progress: 0.5,
        completedAt: null,
        lastWatchedAt: NOW,
      },
      sessions: [sessionFixture(300, 0.5)],
    }],
  };
}

function sessionFixture(currentTime: number, progress: number) {
  return {
    id: SESSION_ID,
    roomId: null,
    roomGeneration: null,
    hostUserId: OWNER_ID,
    kind: "solo" as const,
    sourceGeneration: null,
    currentTime,
    duration: 2_100,
    progress,
    startedAt: NOW,
    endedAt: null,
    lastWatchedAt: NOW,
    participants: [],
  };
}

function sharedSessionFixture(currentTime: number, progress: number) {
  return {
    ...sessionFixture(currentTime, progress),
    id: "00000000-0000-4000-8000-000000000004",
    roomId: "room-popup-shared",
    roomGeneration: 1,
    kind: "shared" as const,
    sourceGeneration: 1,
  };
}

function requestForHistory(history: WatchHistoryResponse): PopupWatchHistoryClient["request"] {
  return vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
    if (message.command === "list") return { ok: true, data: history };
    if (message.command === "get-preferences") {
      return { ok: true, data: preferencesFixture(false) };
    }
    if (message.command === "other-owner-pending") {
      return { ok: true, hasPendingWork: false, byteUse: 0 };
    }
    return { ok: true };
  });
}

function pendingEvent(overrides: {
  currentTime: number;
  progress: number;
  shared?: boolean;
  clientEventId?: string;
  episodeKey?: string;
  episodeTitle?: string;
  episodeNumber?: number;
  observedAt?: string;
}): WatchProgressEvent {
  return {
    schemaVersion: 3,
    clientEventId: overrides.clientEventId ?? "00000000-0000-4000-8000-000000000003",
    clientSessionKey: "popup-test-session",
    crunchyrollIdentity: {
      providerSeriesId: "FRIEREN", providerSeasonIdentifier: "FRIEREN|S1",
      providerEpisodeIdentifier: (overrides.episodeKey ?? "crunchyroll:episode:FRIEREN|S1|E1").replace("crunchyroll:episode:", ""),
      providerContentId: "EPISODE1", audioLocale: "ja-JP",
    },
    accountGeneration: 1,
    provider: "crunchyroll",
    titleKey: "crunchyroll:series:FRIEREN",
    itemKind: "series",
    title: "Cached Frieren",
    artworkUrl: null,
    episodeKey: overrides.episodeKey ?? "crunchyroll:episode:FRIEREN|S1|E1",
    episodeTitle: overrides.episodeTitle ?? "Episode 1 - The Journey",
    seasonKey: "crunchyroll:season:FRIEREN|S1",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: overrides.episodeNumber ?? 1,
    sourceUrl: "https://www.crunchyroll.com/watch/EPISODE1",
    currentTime: overrides.currentTime,
    duration: 2_100,
    progress: overrides.progress,
    observedAt: overrides.observedAt ?? NOW,
    kind: "pause",
    sharedRoom: overrides.shared ? {
      roomId: "room-popup-shared",
      participantSessionId: "participant-popup-shared",
      roomGeneration: 1,
      sourceGeneration: 1,
      attestation: "room-attestation-proof",
    } : null,
  };
}

function preferencesFixture(youtubeHistoryEnabled: boolean): WatchHistoryPreferencesResponse {
  return {
    meta: {
      schemaVersion: 3,
      ownerUserId: OWNER_ID,
      accountGeneration: 1,
      serverTime: NOW,
    },
    preferences: { youtubeHistoryEnabled },
  };
}

async function renderPanel(client: PopupWatchHistoryClient) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PopupWatchHistoryPanel client={client} ownerUserId={OWNER_ID} />);
  });
  return { container, root };
}

async function findButton(container: HTMLElement, name: string): Promise<HTMLButtonElement> {
  let button: HTMLButtonElement | null = null;
  await waitFor(() => {
    button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.getAttribute("aria-label") === name,
    ) ?? null;
    expect(button).not.toBeNull();
  });
  if (!button) throw new Error(`Button not found: ${name}`);
  return button;
}

async function findInput(container: HTMLElement, name: string): Promise<HTMLInputElement> {
  let input: HTMLInputElement | null = null;
  await waitFor(() => {
    input = container.querySelector(`input[aria-label="${name}"]`);
    expect(input).not.toBeNull();
  });
  if (!input) throw new Error(`Input not found: ${name}`);
  return input;
}

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => button.click());
}

async function waitFor(assertion: () => void, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}
