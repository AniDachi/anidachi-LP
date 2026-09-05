import {
  WatchHistoryResponseSchema,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchProgressEvent,
} from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopupHistorySettings } from "../src/popup-history-settings";
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

describe("Popup Watch History v3", () => {
  it("shows a newly resolved poster on a cached title before the progress upload is acknowledged", async () => {
    const history = historyFixture();
    history.items[0]!.artworkUrl = null;
    const event = { ...pendingEvent({ currentTime: 610, progress: 0.51, observedAt: "2026-08-15T03:00:10.000Z" }), artworkUrl: "https://www.crunchyroll.com/poster.jpg" };
    const view = await renderPanel(clientFixture({ cached: snapshotFixture(history, [event]), request: requestForHistory(history) }));
    try {
      expect(view.container.querySelector(".popup-watch-artwork img")?.getAttribute("src")).toBe(event.artworkUrl);
      expect(view.container.querySelectorAll(".popup-watch-item")).toHaveLength(1);
    } finally { await unmount(view.root); }
  });

  it("falls back after a failed cover and retries only when its URL changes", async () => {
    const history = historyFixture();
    history.items[0]!.artworkUrl = "https://www.crunchyroll.com/old-poster.jpg";
    let publish!: (snapshot: PopupWatchHistorySnapshot | null) => void;
    const view = await renderPanel({ ...clientFixture({ cached: snapshotFixture(history), request: requestForHistory(history) }),
      subscribe: (_owner, listener) => { publish = listener; return () => undefined; },
    });
    try {
      const artwork = () => view.container.querySelector(".popup-watch-artwork")!;
      expect(artwork().querySelector("img")?.getAttribute("src")).toBe(history.items[0]!.artworkUrl);
      await act(async () => { artwork().querySelector("img")!.dispatchEvent(new Event("error")); });
      expect(artwork().querySelector("img")).toBeNull();
      expect(artwork().textContent).toBe(history.items[0]!.title.slice(0, 1));
      await act(async () => { publish(snapshotFixture(structuredClone(history))); });
      expect(artwork().querySelector("img")).toBeNull();
      const updated = structuredClone(history);
      updated.items[0]!.artworkUrl = "https://www.crunchyroll.com/new-poster.jpg";
      await act(async () => { publish(snapshotFixture(updated)); });
      expect(artwork().querySelector("img")?.getAttribute("src")).toBe(updated.items[0]!.artworkUrl);
    } finally { await unmount(view.root); }
  });

  it("initializes disclosures from the visible mode, not hidden shared-only titles", async () => {
    const history = multiSeasonHistoryFixture();
    history.items[0] = structuredClone(history.items[0]!);
    const shared = sharedSessionFixture(600, 0.5);
    history.items[0]!.sessions = [shared];
    for (const season of history.items[0]!.seasons) {
      for (const episode of season.episodes) episode.sessions = [shared];
    }
    const view = await renderPanel(clientFixture({cached: snapshotFixture(history), request: requestForHistory(history)}));
    try {
      expect(view.container.querySelector(".popup-watch-title")?.textContent).toBe("Another title");
      expect((await findButton(view.container, "Toggle Another title history")).getAttribute("aria-expanded")).toBe("true");
      expect(view.container.querySelectorAll(".popup-episode-row").length).toBeGreaterThan(0);
    } finally { await unmount(view.root); }
  });

  it("opens the visible solo season when latest global activity belongs to a hidden shared season", async () => {
    const history = multiSeasonHistoryFixture();
    const shared = sharedSessionFixture(600, 0.5);
    history.items[0]!.seasons[1]!.episodes[0]!.sessions = [shared];
    const view = await renderPanel(clientFixture({cached: snapshotFixture(history), request: requestForHistory(history)}));
    try {
      expect((await findButton(view.container, "Toggle Frieren Season 1")).getAttribute("aria-expanded")).toBe("true");
      expect(view.container.querySelectorAll(".popup-episode-row")).toHaveLength(2);
    } finally { await unmount(view.root); }
  });

  it("keeps episode order and row identity through local checkpoint and server refresh cycles", async () => {
    const history = twoEpisodeHistoryFixture();
    history.items[0]!.seasons[0]!.episodes[1]!.lastWatchedAt = "2026-08-15T03:01:00.000Z";
    let publish!: (snapshot: PopupWatchHistorySnapshot) => void;
    const client = {
      ...clientFixture({ cached: snapshotFixture(history), request: requestForHistory(history) }),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => undefined; },
    };
    const view = await renderPanel(client);
    try {
      const rows = [...view.container.querySelectorAll(".popup-episode-row")];
      for (let tick = 0; tick < 3; tick++) {
        const event = pendingEvent({ currentTime: 601 + tick, progress: 0.3, observedAt: "2026-08-15T03:02:00.000Z" });
        await act(async () => publish(snapshotFixture(history, [event], false, { event, mode: "mine" })));
        expect([...view.container.querySelectorAll(".popup-episode-number")].map(node => node.textContent)).toEqual(["E1", "E2"]);
        expect([...view.container.querySelectorAll(".popup-episode-row")]).toEqual(rows);
        await act(async () => publish(snapshotFixture(history)));
        expect([...view.container.querySelectorAll(".popup-episode-row")]).toEqual(rows);
      }
    } finally { await unmount(view.root); }
  });

  it("keeps title positions and default disclosures when latest activity changes", async () => {
    const history = multiSeasonHistoryFixture();
    let publish!: (snapshot: PopupWatchHistorySnapshot) => void;
    const client = {
      ...clientFixture({ cached: snapshotFixture(history), request: requestForHistory(history) }),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => undefined; },
    };
    const view = await renderPanel(client);
    try {
      const titles = [...view.container.querySelectorAll(".popup-watch-item")];
      expect((await findButton(view.container, "Toggle Frieren Season 2")).getAttribute("aria-expanded")).toBe("true");
      const updated = structuredClone(history);
      updated.items[0]!.latestActivity.episodeKey = updated.items[0]!.seasons[0]!.episodes[0]!.episodeKey;
      updated.items.reverse();
      await act(async () => publish(snapshotFixture(updated)));
      expect([...view.container.querySelectorAll(".popup-watch-item")]).toEqual(titles);
      expect((await findButton(view.container, "Toggle Frieren Season 2")).getAttribute("aria-expanded")).toBe("true");
      expect((await findButton(view.container, "Toggle Frieren Season 1")).getAttribute("aria-expanded")).toBe("false");
      expect((await findButton(view.container, "Toggle Another title history")).getAttribute("aria-expanded")).toBe("false");
      await click(await findButton(view.container, "Toggle Crunchyroll history"));
      await click(await findButton(view.container, "Toggle Crunchyroll history"));
      expect((await findButton(view.container, "Toggle Frieren Season 2")).getAttribute("aria-expanded")).toBe("true");
    } finally { await unmount(view.root); }
  });

  it("keeps confirmed completion while new playback observations arrive and settle", async () => {
    const history = historyFixture({ currentTime: 2_000, progress: 2_000 / 2_100 });
    history.items[0]!.seasons[0]!.episodes[0]!.completedAt = NOW;
    let publish!: (snapshot: PopupWatchHistorySnapshot) => void;
    const client = {
      ...clientFixture({ cached: snapshotFixture(history), request: requestForHistory(history) }),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => undefined; },
    };
    const view = await renderPanel(client);
    try {
      const row = view.container.querySelector(".popup-episode-row")!;
      expect(row.getAttribute("data-completed")).toBe("true");
      // Includes a replay/seek: completion is durable, resume position is not.
      for (const currentTime of [2_001, 2_099, 12]) {
        const event = pendingEvent({ currentTime, progress: currentTime / 2_100 });
        await act(async () => publish(snapshotFixture(history, [event], false, { event, mode: "mine" })));
        expect(row.getAttribute("data-completed")).toBe("true");
        expect(row.textContent).toContain("Completed");
        await act(async () => publish(snapshotFixture(history)));
        expect(view.container.querySelector(".popup-episode-row")).toBe(row);
        expect(row.getAttribute("data-completed")).toBe("true");
      }
    } finally { await unmount(view.root); }
  });

  it("delivers refresh completion even if a playback notification supersedes its cache load", async () => {
    let changed!: Parameters<typeof chrome.storage.onChanged.addListener>[0];
    let finishRefresh!: (response: WatchHistoryMessageResponse) => void;
    let finishLoad!: (snapshot: PopupWatchHistorySnapshot | null) => void;
    let holdNextLoad = false;
    const outcomes: WatchHistoryMessageResponse[] = [];
    const snapshot = snapshotFixture(historyFixture());
    const close = subscribeToPopupWatchHistorySnapshot(OWNER_ID, (_snapshot, result) => {
      if (result) outcomes.push(result);
    }, {
      onChanged: { addListener: (listener) => { changed = listener; }, removeListener: () => undefined },
      load: async () => {
        if (holdNextLoad) { holdNextLoad = false; return new Promise((resolve) => { finishLoad = resolve; }); }
        return snapshot;
      },
      refresh: async () => new Promise((resolve) => { finishRefresh = resolve; }),
    });
    const notify = (cacheRevision: number) => changed({ "anidachi.watchHistory.v3": { newValue: {
      schemaVersion: 3, activeGenerations: { [OWNER_ID]: 1 }, partitions: {
        [watchHistoryPartitionKey(OWNER_ID, 1)]: { ownerUserId: OWNER_ID, invalidationRevision: 1, cacheRevision },
      },
    } } }, "local");
    try {
      notify(0);
      await waitFor(() => expect(finishRefresh).toBeTypeOf("function"));
      notify(1);
      await Promise.resolve();
      holdNextLoad = true;
      finishRefresh({ ok: true, data: snapshot.history });
      await waitFor(() => expect(finishLoad).toBeTypeOf("function"));
      notify(1);
      finishLoad(snapshot);
      await waitFor(() => expect(outcomes).toHaveLength(1));
      expect(outcomes[0]).toMatchObject({ ok: true, data: { meta: { ownerUserId: OWNER_ID } } });
    } finally { close(); }
  });

  it("does not let an old owner's discard failure change the newly signed-in drawer", async () => {
    let finishDiscard!: (response: WatchHistoryMessageResponse) => void;
    let owner = OWNER_ID;
    const client = clientFixture({ cached: null, request: async (message) => {
      if (message.command === "discard-old-owner-work") return new Promise((resolve) => { finishDiscard = resolve; });
      if (message.command === "other-owner-pending") return { ok: true, hasPendingWork: owner === OWNER_ID };
      if (message.command === "get-preferences") return { ok: true, data: { ...preferencesFixture(false), meta: { ...preferencesFixture(false).meta, ownerUserId: owner } } };
      const history = historyFixture({ title: owner === OWNER_ID ? "First account" : "Second account" });
      history.meta.ownerUserId = owner;
      return { ok: true, data: history };
    } });
    const view = await renderPanel(client);
    try {
      await click(await findButton(view.container, "Discard pending history from another account"));
      owner = "00000000-0000-4000-8000-000000000099";
      await act(async () => { view.root.render(<PopupWatchHistoryPanel client={client} ownerUserId={owner} />); });
      await act(async () => { finishDiscard({ ok: false, status: "retryable" }); });
      expect(view.container.textContent).toContain("Second account");
      expect(view.container.textContent).not.toContain("First account");
      expect(view.container.textContent).not.toContain("Could not refresh watch history.");
    } finally { await unmount(view.root); }
  });


  it("converges an opening read with a playback acknowledgement without a false refresh error", async () => {
    const cached = historyFixture({ title: "Before playback" });
    const fresh = historyFixture({ title: "After playback", currentTime: 900, progress: 0.43 });
    fresh.generatedAt = fresh.meta.serverTime = "2026-08-15T03:00:02.000Z";
    const reads: Array<(response: Response) => void> = [];
    let recovered = false;
    const live = liveClientFixture(cached, async (url, init) => {
      if (String(url).includes("/preferences")) return Response.json(preferencesFixture(false));
      if (init?.method === "POST") {
        const event = JSON.parse(String(init.body));
        return Response.json({ meta: fresh.meta, schemaVersion: 3, acceptedEventId: event.clientEventId,
          acceptedAt: fresh.generatedAt, accountGeneration: 1, duplicate: false,
          episode: fresh.items[0]!.seasons[0]!.episodes[0] });
      }
      return recovered ? Response.json(fresh) : new Promise<Response>((resolve) => reads.push(resolve));
    });
    const view = await renderPanel(live.client);
    try {
      await waitFor(() => expect(reads).toHaveLength(1));
      await act(async () => {
        const accepted = await live.background.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "observe-progress",
          expectedOwnerUserId: OWNER_ID, event: pendingEvent({ currentTime: 900, progress: 0.43 }),
          meaningfulSolo: true, queueForSync: true, flushNow: true });
        expect(accepted.ok).toBe(true);
        reads[0]!(Response.json(cached));
      });
      await waitFor(() => expect(reads.length).toBeGreaterThanOrEqual(2));
      await act(async () => { recovered = true; for (const resolve of reads.slice(1)) resolve(Response.json(fresh)); });
      await waitFor(() => expect(view.container.textContent).toContain("After playback"));
      expect(view.container.textContent).not.toContain("Could not refresh watch history.");
      expect((await live.client.loadCached(OWNER_ID))?.pendingEvents).toEqual([]);
      expect((await findButton(view.container, "Refresh watch history")).disabled).toBe(false);
    } finally { await unmount(view.root); }
  });

  it("clears a recovered automatic read error but not on local observation updates", async () => {
    let online = false;
    const live = liveClientFixture(historyFixture(), async (url) => {
      if (String(url).includes("/preferences")) return Response.json(preferencesFixture(false));
      return online ? Response.json(historyFixture({ title: "Recovered Frieren" })) : new Response("offline", { status: 503 });
    });
    const view = await renderPanel(live.client);
    try {
      await waitFor(() => expect(view.container.textContent).toContain("Could not refresh watch history."));
      await act(async () => { await live.storage.updateRoot((root) => structuredClone(root)); });
      expect(view.container.textContent).toContain("Could not refresh watch history.");
      online = true;
      await act(async () => { await live.storage.updateRoot((root) => {
        const key = watchHistoryPartitionKey(OWNER_ID, 1);
        return { ...root, partitions: { ...root.partitions, [key]: { ...root.partitions[key]!, invalidationRevision: 1 } } };
      }); });
      await waitFor(() => expect(view.container.textContent).toContain("Recovered Frieren"));
      expect(view.container.textContent).not.toContain("Could not refresh watch history.");
    } finally { await unmount(view.root); }
  });

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
    const client = { ...clientFixture({ cached: snapshotFixture(complete), request: requestForHistory(complete) }),
      subscribe: (_owner: string, listener: typeof publish) => { publish = listener; return () => undefined; },
    };
    const view = await renderPanel(client);
    await waitFor(() => expect(view.container.textContent).toContain("0 / 12 episodes0%"));
    await background.handle({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "catalog-begin", expectedOwnerUserId: OWNER_ID, pageId: "visit",
      input: { schemaVersion: 3, accountGeneration: 1, provider: "crunchyroll", titleKey: "crunchyroll:series:FRIEREN", providerSeriesId: "FRIEREN",
        context: { region: "US", requestedLocale: "en-US", audioLocale: null, subtitleLocales: [], observedAt: NOW } } });
    const partial = selectConfirmedPopupWatchHistorySnapshot(stored, OWNER_ID)!;
    expect(partial.history.items[0]).toMatchObject({ catalogState: "partial", aggregate: { availableEpisodes: null, progress: null } });
    expect(partial.history.items[0]!.seasons[0]!.episodes).toEqual(complete.items[0]!.seasons[0]!.episodes);
    await act(async () => { publish(partial); });
    expect(view.container.textContent).not.toContain("0 / 12 episodes0%");
    expect(view.container.textContent).toContain("The Journey");
    await background.handle(createListWatchHistoryMessage());
    expect(stored.partitions[key]!.cache!.items[0]!.catalogState).toBe("partial");
    getSucceeds = true;
    await background.handle(createListWatchHistoryMessage());
    await act(async () => { publish(selectConfirmedPopupWatchHistorySnapshot(stored, OWNER_ID)); });
    expect(view.container.textContent).toContain("0 / 12 episodes0%");
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
    const refreshedEpisode = refreshed.items[0]?.seasons[0]?.episodes[0];
    if (!refreshedEpisode) throw new Error("Missing refreshed episode fixture");
    refreshedEpisode.lastWatchedAt = "2026-08-15T03:00:10.000Z";
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
    expect(view.container.textContent).toContain("Pending sync");
    expect(view.container.textContent).toContain("14:00");

    await act(async () => {
      resolveList?.({ ok: true, data: refreshed });
      await Promise.resolve();
    });

    await waitFor(() => expect(view.container.textContent).toContain("Canonical Frieren"));
    expect(view.container.textContent).toContain("21:00");
    expect(view.container.textContent).not.toContain("Cached Frieren");

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
    expect(view.container.textContent).toContain("Pending sync");
    expect(client.loadCached).toHaveBeenCalledTimes(1);
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
    expect(view.container.textContent).toContain("Pending sync");
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
    expect(view.container.textContent).toContain("Pending sync");
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
    let servedHistory = emptyHistory;
    const client = {
      ...clientFixture({
        cached: snapshotFixture(emptyHistory),
        request: message => requestForHistory(servedHistory)(message),
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
    expect(view.container.textContent).toContain("Pending sync");
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
    expect(view.container.textContent).toContain("Pending sync");
    expect(view.container.textContent).not.toContain("Watching now");
    expect(view.container.textContent).toContain("0:12");

    await act(async () => {
      publishSnapshot?.(snapshotFixture(emptyHistory));
      await Promise.resolve();
    });
    expect(view.container.textContent).toContain("Cached Frieren");
    expect(view.container.textContent).toContain("Pending sync");

    await act(async () => {
      servedHistory = canonical;
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
        "Loading watch history...",
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
    expect(view.container.textContent).toContain("Pending sync");
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
    expect(view.container.textContent).toContain("Pending sync");
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

  it("keeps bounded browse episodes plus pending additions without mutating work and pins local progress", async () => {
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
    expect(rows).toHaveLength(12);
    expect(view.container.textContent).toContain("Episode 11 - Queued");
    expect(view.container.textContent).toContain("0:12");
    expect(view.container.textContent).not.toContain("Episode 12 - Queued later");
    expect(view.container.textContent).toContain("Episode 1 - Cached");
    expect(pending).toEqual(originalPending);
    await unmount(view.root);
  });

  it("uses stable episode-key order for unnumbered episodes while pinning older local progress", async () => {
    const canonical = historyWithEpisodesFixture(8);
    const tied = [
      ["crunchyroll:episode:FRIEREN|S1|Ea", "Episode tie lowercase", 21],
      ["crunchyroll:episode:FRIEREN|S1|E_", "Episode tie underscore", 22],
      ["crunchyroll:episode:FRIEREN|S1|EA", "Episode tie uppercase", 23],
    ] as const;
    const pending = tied.map(([episodeKey, episodeTitle, id]) => ({ ...pendingEvent({
      currentTime: id,
      progress: id / 2_100,
      clientEventId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      episodeKey,
      episodeTitle,
      episodeNumber: id,
      observedAt: "2026-08-15T03:00:20.000Z",
    }), episodeNumber: null }));
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
    expect(view.container.querySelectorAll(".popup-episode-row")).toHaveLength(12);
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

    const view = await renderSettings(client);
    const toggle = await findButton(view.container, "Track YouTube history");
    expect(toggle.disabled).toBe(false);
    expect(toggle.getAttribute("role")).toBe("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.querySelector(".popup-notification-switch")).not.toBeNull();
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
    const view = await renderSettings(clientFixture({
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
    const view = await renderSettings(clientFixture({
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
    const view = await renderSettings(clientFixture({ cached: null, request }));
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
    const mode = await findButton(view.container, "Together");
    await click(mode);
    await click(await findButton(view.container, "1 shared session"));
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

  it("renders only server-owned overall progress and exposes the exact state on the disclosure", async () => {
    const history = historyFixture({ title: "葬送のフリーレン الموسم الطويل جدا" });
    const item = history.items[0]!;
    item.observedEpisodeCount = 7;
    item.completedEpisodeCount = 6;
    item.episodePage = { complete: false, nextCursor: "episode_cursor" };
    item.catalogState = "complete";
    item.aggregate = { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 };
    item.seasons[0]!.seasonTitle = "الموسم الأول الطويل جدا";
    item.seasons[0]!.aggregate = {
      completedEpisodes: 5,
      availableEpisodes: 13,
      progress: 5 / 13,
    };
    const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(history) }));

    const disclosure = await findButton(
      view.container,
      "Toggle 葬送のフリーレン الموسم الطويل جدا history, 5 of 13 episodes watched, 38 percent",
    );
    expect(disclosure.textContent).toContain("葬送のフリーレン الموسم الطويل جدا");
    expect(disclosure.textContent).toContain("5 / 13 episodes");
    expect(disclosure.textContent).toContain("38%");
    expect(disclosure.querySelector(".popup-watch-title")?.getAttribute("dir")).toBe("auto");
    const track = disclosure.querySelector(".popup-watch-overall-track");
    expect(track?.getAttribute("aria-hidden")).toBe("true");
    expect((track?.firstElementChild as HTMLElement | null)?.style.width).toBe(`${(5 / 13) * 100}%`);
    expect(item.completedEpisodeCount).toBe(6);
    await unmount(view.root);
  });

  for (const catalogState of ["partial", "unavailable"] as const) {
    it(`keeps ${catalogState} title progress observed-only`, async () => {
      const history = historyFixture();
      const item = history.items[0]!;
      item.catalogState = catalogState;
      item.observedEpisodeCount = 7;
      item.completedEpisodeCount = 6;
      item.episodePage = { complete: false, nextCursor: "episode_cursor" };
      item.aggregate = { completedEpisodes: 6, availableEpisodes: null, progress: null };
      const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(history) }));

      await waitFor(() => expect(view.container.textContent).toContain("7 observed episodes"));
      expect(view.container.querySelector(".popup-watch-overall-track")).toBeNull();
      expect(view.container.textContent).not.toContain("0%");
      await unmount(view.root);
    });
  }

  it("shows a complete zero-available catalog as unavailable without a bar or 0 / 0", async () => {
    const history = historyFixture();
    const item = history.items[0]!;
    item.observedEpisodeCount = 7;
    item.completedEpisodeCount = 6;
    item.episodePage = { complete: false, nextCursor: "episode_cursor" };
    item.catalogState = "complete";
    item.aggregate = { completedEpisodes: 0, availableEpisodes: 0, progress: 0 };
    item.seasons[0]!.aggregate = { completedEpisodes: 0, availableEpisodes: 0, progress: 0 };
    const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(history) }));

    await findButton(view.container, "Toggle Frieren history, Not currently available");
    expect(view.container.textContent).toContain("Not currently available");
    expect(view.container.textContent).not.toContain("0 / 0");
    expect(view.container.querySelector(".popup-watch-overall-track")).toBeNull();
    await unmount(view.root);
  });

  it("keeps the canonical overall aggregate while Mine, Together, and search project visible rows", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const item = history.items[0]!;
    item.observedEpisodeCount = 7;
    item.completedEpisodeCount = 6;
    item.episodePage = { complete: false, nextCursor: "episode_cursor" };
    item.catalogState = "complete";
    item.aggregate = { completedEpisodes: 5, availableEpisodes: 13, progress: 5 / 13 };
    item.seasons[0]!.aggregate = {
      completedEpisodes: 5,
      availableEpisodes: 13,
      progress: 5 / 13,
    };
    const view = await renderPanel(clientFixture({ cached: null, request: requestForHistory(history) }));
    const search = await findInput(view.container, "Search watch history");
    const mode = await findButton(view.container, "Together");

    expect(view.container.textContent).toContain("5 / 13 episodes");
    await setInputValue(search, "Journey");
    expect(view.container.textContent).toContain("5 / 13 episodes");
    await click(mode);
    await waitFor(() => expect(mode.getAttribute("aria-pressed")).toBe("true"));
    expect(view.container.textContent).toContain("5 / 13 episodes");
    await unmount(view.root);
  });

  it("preserves canonical season order while projecting pending rows", async () => {
    const history = multiSeasonHistoryFixture();
    const item = history.items[0]!;
    item.seasons[0]!.order = 10;
    item.seasons[1]!.order = 20;
    item.seasons[0]!.episodes[0]!.lastWatchedAt = "2026-08-15T01:00:00.000Z";
    item.seasons[1]!.episodes[0]!.lastWatchedAt = "2026-08-15T04:00:00.000Z";
    const pending = pendingEvent({ currentTime: 720, progress: 0.4 });
    const view = await renderPanel(clientFixture({
      cached: snapshotFixture(history, [pending]),
      request: requestForHistory(history),
    }));

    await waitFor(() => expect(view.container.textContent).toContain("A New Beginning"));
    expect([...view.container.querySelectorAll(".popup-season-title")].map((node) => node.textContent))
      .toEqual(["Season 1", "Season 2"]);
    expect(item.seasons.map((season) => season.order)).toEqual([10, 20]);
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
    expect(view.container.textContent).toContain("No history matches these conditions.");
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
    const mode = await findButton(view.container, "Together");

    expect(mode.getAttribute("aria-pressed")).toBe("false");
    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    expect(view.container.textContent).not.toContain("Episode 2 - The Promise");
    expect(view.container.querySelector(".resource-provider-logo.crunchyroll svg")).not.toBeNull();

    await click(mode);

    await waitFor(() => expect(mode.getAttribute("aria-pressed")).toBe("true"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Episode 2 - The Promise");
    await unmount(view.root);
  });

  it("keeps observed progress without a session in Mine and excludes it from Together", async () => {
    const history = observedOnlyHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Together");

    expect(view.container.textContent).toContain("Episode 1 - The Journey");
    await click(mode);

    await waitFor(() => expect(mode.getAttribute("aria-pressed")).toBe("true"));
    expect(view.container.textContent).not.toContain("Episode 1 - The Journey");
    expect(view.container.textContent).toContain("Shared sessions will appear after watching together.");
    await unmount(view.root);
  });

  it("projects mixed episode sessions to the selected mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const view = await renderPanel(
      clientFixture({ cached: null, request: requestForHistory(history) }),
    );
    const mode = await findButton(view.container, "Together");

    expect(view.container.textContent).not.toContain("Solo session");
    expect(view.container.textContent).not.toContain("Shared session");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.getAttribute("aria-pressed")).toBe("true"));
    expect(view.container.textContent).not.toContain("Solo session");
    expect(view.container.textContent).toContain("shared session");
    expect(view.container.textContent).toContain("10:00");
    await unmount(view.root);
  });

  it("applies pending progress only to its Mine or Together mode", async () => {
    const history = sameEpisodeMixedSessionHistoryFixture();
    const sharedPending = pendingEvent({ currentTime: 840, progress: 0.4, shared: true });
    const request = vi.fn(async (message): Promise<WatchHistoryMessageResponse> => {
      if (message.command === "list") return { ok: true, data: history };
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
    const mode = await findButton(view.container, "Together");

    expect(view.container.textContent).not.toContain("Pending sync");
    expect(view.container.textContent).toContain("10:00");
    await click(mode);

    await waitFor(() => expect(mode.getAttribute("aria-pressed")).toBe("true"));
    expect(view.container.textContent).toContain("Pending sync");
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
    // This legacy transport maps browse to list: failed browse, canonical
    // recovery, then the filtered browse replay are three separate reads.
    expect(listAttempts).toBe(3);
    expect(view.container.textContent).not.toContain("Could not refresh watch history.");
    await unmount(view.root);
  });

  it("keeps unverified cache rows out of a failed browse and offers retry", async () => {
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
    expect(view.container.textContent).not.toContain("Cached Frieren");
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
    const mode = await findButton(view.container, "Together");
    const search = await findInput(view.container, "Search watch history");
    await click(mode);
    await setInputValue(search, "Journey");
    const refresh = await findButton(view.container, "Refresh watch history");

    await click(refresh);

    await waitFor(() => expect(view.container.textContent).toContain("shared session"));
    expect(mode.getAttribute("aria-pressed")).toBe("true");
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


function fixtureFetch(fetch: typeof globalThis.fetch, initial: WatchHistoryResponse): typeof globalThis.fetch {
  let latest = initial;
  return async (url, init) => {
    const parsedUrl = new URL(String(url));
    const input = Object.fromEntries(parsedUrl.searchParams);
    if (parsedUrl.pathname.endsWith("/browse/title-episodes")) {
      const page = fixtureBrowseDetail(latest, input);
      return page.ok ? Response.json(page.data) : new Response("unavailable", { status: 503 });
    }
    const response = await fetch(url, init);
    if (!response.ok) return response;
    let parsed;
    try { parsed = WatchHistoryResponseSchema.safeParse(await response.clone().json()); } catch { return response; }
    if (!parsed.success) return response;
    latest = parsed.data;
    if (parsedUrl.pathname.endsWith("/browse")) { const page = fixtureBrowseTitles(latest, input); return Response.json(page.ok ? page.data : null); }
    return response;
  };
}

function liveClientFixture(history: WatchHistoryResponse, fetch: typeof globalThis.fetch) {
  const key = watchHistoryPartitionKey(OWNER_ID, 1);
  let stored: WatchHistoryStorageRoot = { schemaVersion: 3, activeGenerations: { [OWNER_ID]: 1 }, partitions: {
    [key]: { ownerUserId: OWNER_ID, accountGeneration: 1, cache: history, preferences: { youtubeHistoryEnabled: false },
      preferencesConfirmed: true, capturePaused: false, captureMarkersReady: true, currentObservation: null,
      outbox: { ownerUserId: OWNER_ID, accountGeneration: 1, entries: [] } },
  } };
  const listeners = new Set<Parameters<typeof chrome.storage.onChanged.addListener>[0]>();
  const storage = createWatchHistoryStorage({ item: {
    getValue: async () => structuredClone(stored),
    setValue: async (value) => {
      const oldValue = stored;
      stored = structuredClone(value);
      for (const listener of listeners) listener({ "anidachi.watchHistory.v3": { oldValue, newValue: stored } }, "local");
    },
  }, getBytesInUse: async () => 0, quotaBytes: 1_000_000 });
  const background = createWatchHistoryClient({ storage, fetch: fixtureFetch(fetch, history), getCurrentSession: async () => ({
    accessToken: "test", refreshToken: "test", user: { id: OWNER_ID, email: "test@example.invalid", displayName: "Test", avatarUrl: null, plan: "plus" },
  }) });
  const loadCached = async (owner: string) => selectConfirmedPopupWatchHistorySnapshot(await storage.readRoot(), owner);
  const client: PopupWatchHistoryClient = {
    loadCached, request: background.handle, confirmDiscard: () => true, openUrl: async () => undefined,
    subscribe: (owner, listener) => subscribeToPopupWatchHistorySnapshot(owner, listener, {
      load: loadCached, refresh: background.handle,
      onChanged: { addListener: (listener) => { listeners.add(listener); }, removeListener: (listener) => { listeners.delete(listener); } },
    }),
  };
  return { client, background, storage };
}


function fixtureBrowseEpisodes(history: WatchHistoryResponse, input: Record<string, unknown>) {
  const matches = (title: string, episode: WatchHistoryResponse["items"][number]["seasons"][number]["episodes"][number]) =>
    (input.mode === "shared" ? episode.sessions.some(session => session.kind === "shared") : episode.sessions.length === 0 || episode.sessions.some(session => session.kind === "solo")) &&
    (!input.search || `${title} ${episode.episodeTitle}`.toLowerCase().includes(String(input.search).toLowerCase()));
  return history.items.flatMap(item => {
    const episodes = item.seasons.flatMap(season => season.episodes).filter(episode => matches(item.title, episode)).map(episode => ({ ...episode, sessions: episode.sessions.filter(session => session.kind === (input.mode === "shared" ? "shared" : "solo")) }));
    if (!item.seasons.length && (!input.search || item.title.toLowerCase().includes(String(input.search).toLowerCase())) && (input.mode !== "shared" || item.sessions.some(session => session.kind === "shared"))) episodes.push({ episodeTitle: item.title, seasonKey: null, seasonTitle: null, seasonNumber: null, episodeNumber: null, sourceUrl: item.sourceUrl, ...item.latestActivity, sessions: item.sessions.filter(session => session.kind === (input.mode === "shared" ? "shared" : "solo")) });
    return [{ item, episodes }];
  });
}
function fixtureBrowseTitles(history: WatchHistoryResponse, input: Record<string, unknown>): WatchHistoryMessageResponse {
  const eligible = fixtureBrowseEpisodes(history, input).filter(value => value.episodes.length);
  return { ok: true, data: { history: { ...history, items: eligible.map(value => value.item), totalTitleCount: eligible.length }, matches: eligible.map(({ item, episodes }) => ({ provider: item.provider, titleKey: item.titleKey, lastWatchedAt: item.lastWatchedAt, matchingEpisodeCount: episodes.length, matchingSessionCount: episodes.reduce((count, episode) => count + episode.sessions.length, 0) })) } };
}
function fixtureBrowseDetail(history: WatchHistoryResponse, input: Record<string, unknown>): WatchHistoryMessageResponse {
  const found = fixtureBrowseEpisodes(history, input).find(value => value.item.titleKey === input.titleKey);
  if (!found) return { ok: false, status: "retryable" };
  const { item, episodes } = found;
  const exact = item.catalogState === "complete";
  return { ok: true, data: { detail: { meta: history.meta, generatedAt: history.generatedAt, provider: item.provider, titleKey: item.titleKey, observedEpisodeCount: item.observedEpisodeCount, completedEpisodeCount: item.completedEpisodeCount, episodes: episodes.slice(0, 20), catalog: { state: item.catalogState, title: exact ? item.title : null, aggregate: exact ? item.aggregate : null, seasons: exact ? item.seasons.filter(season => season.aggregate.availableEpisodes !== null).map(({ episodes: _episodes, ...season }) => season) : [] }, complete: item.episodePage.complete, nextCursor: item.episodePage.nextCursor }, matches: episodes.slice(0,20).map(episode => ({ episodeKey: episode.episodeKey, lastWatchedAt: episode.lastWatchedAt, matchingSessionCount: episode.sessions.length, sessionsComplete: true })), groups: [] } };
}
async function renderSettings(client: PopupWatchHistoryClient) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PopupHistorySettings ownerUserId={OWNER_ID} client={client} />));
  return { container, root };
}

function clientFixture(overrides: {
  cached: PopupWatchHistorySnapshot | null;
  request: PopupWatchHistoryClient["request"];
}): PopupWatchHistoryClient {
  let latestHistory = overrides.cached?.history ?? null;
  return {
    loadCached: vi.fn(async () => overrides.cached),
    request: async message => {
      if (message.command === "browse-title-episodes" && latestHistory) return fixtureBrowseDetail(latestHistory, message.input as Record<string, unknown>);
      if (message.command !== "browse") return overrides.request(message);
      // Old fixtures describe canonical server data. Adapt only the simulated
      // transport to the new browse contract; production filtering stays real.
      const response = await overrides.request({ ...message, command: "list" } as Parameters<PopupWatchHistoryClient["request"]>[0]);
      if (!response.ok) return response;
      const parsed = WatchHistoryResponseSchema.safeParse(response.data);
      if (!parsed.success) return response;
      latestHistory = parsed.data;
      return fixtureBrowseTitles(parsed.data, message.input as Record<string, unknown>);
    },
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
      (candidate) => candidate.getAttribute("aria-label") === name || candidate.textContent === name,
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
