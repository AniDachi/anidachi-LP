import { describe, expect, it, vi } from "vitest";
import { collectCrunchyrollHistoryCatalog, resolveCrunchyrollHistoryMetadata } from "../src/source-adapters/crunchyroll/bridge-client";
import variants from "./fixtures/crunchyroll/catalog-variants.json";
import catalog from "./fixtures/crunchyroll/catalog-complete-multiseason.json";
import { createWatchHistoryCatalogCoordinator, createWatchHistoryPageResolver } from "../src/watch-history-catalog";
import { createWatchHistoryClient } from "../src/watch-history-client";
import { createWatchHistoryStorage, watchHistoryPartitionKey, type WatchHistoryStorageRoot } from "../src/watch-history-storage";

const context = { region: "VN", requestedLocale: "fr-FR", audioLocale: "ja-JP", subtitleLocales: ["en-US"], observedAt: "2026-09-05T00:00:00.000Z" };
const owner = "00000000-0000-4000-8000-000000000001";
const beginInput = { schemaVersion: 3 as const, accountGeneration: 1, provider: "crunchyroll" as const, titleKey: "crunchyroll:series:SERIES", providerSeriesId: "SERIES", context };
function ack(revision: number) {
  return { meta: { schemaVersion: 3, ownerUserId: owner, accountGeneration: 1, serverTime: context.observedAt },
    schemaVersion: 3, accountGeneration: 1, provider: "crunchyroll", titleKey: beginInput.titleKey,
    revision, refreshRequired: true, availabilityChanged: true, effectiveCatalogState: "partial", projectionRevision: null, acceptedHash: null, acceptedAt: null };
}

describe("catalog background begin/commit ownership", () => {
  it("cannot delete a replacement installed between the successful async ownership check and release cleanup", async () => {
    let paused = false;
    let resolveGuard!: (value: boolean) => void;
    let revision = 0;
    const coordinator = createWatchHistoryCatalogCoordinator({
      isCurrent: () => paused ? new Promise((resolve) => { resolveGuard = resolve; }) : Promise.resolve(true),
      request: async () => ack(++revision), save: async () => undefined, invalidate: async () => undefined,
    });
    await coordinator.begin(owner, "first", beginInput);
    paused = true;
    const release = coordinator.release(owner, "first", { accountGeneration: 1, titleKey: beginInput.titleKey, revision: 1 });
    let replacement!: ReturnType<typeof coordinator.begin>;
    resolveGuard(true);
    // The current() continuation first sees the old job. This next microtask
    // installs the replacement before release() resumes from awaiting current().
    queueMicrotask(() => { paused = false; replacement = coordinator.begin(owner, "replacement", { ...beginInput, context: { ...context, region: "US" } }); });
    expect(await release).toBe(false);
    expect(await replacement).toMatchObject({ revision: 2 });
    expect(await coordinator.release(owner, "replacement", { accountGeneration: 1, titleKey: beginInput.titleKey, revision: 2 })).toBe(true);
  });
  it("fences release by owner, generation, page and revision without releasing a replacement or concurrent tab", async () => {
    let requests = 0;
    const coordinator = createWatchHistoryCatalogCoordinator({ request: async () => ack(++requests), isCurrent: async () => true,
      save: async () => undefined, invalidate: async () => undefined });
    await coordinator.begin(owner, "first", beginInput);
    expect(await coordinator.begin(owner, "concurrent", beginInput)).toBeNull();
    expect(requests).toBe(1);
    const input = { accountGeneration: 1, titleKey: beginInput.titleKey, revision: 1 };
    expect(await coordinator.release("different-owner", "first", input)).toBe(false);
    expect(await coordinator.release(owner, "first", { ...input, accountGeneration: 2 })).toBe(false);
    expect(await coordinator.release(owner, "concurrent", input)).toBe(false);
    expect(await coordinator.release(owner, "first", { ...input, revision: 2 })).toBe(false);
    expect(await coordinator.release(owner, "first", input)).toBe(true);
    await coordinator.begin(owner, "second", beginInput);
    expect(requests).toBe(2);
    expect(await coordinator.release(owner, "first", input)).toBe(false);
    coordinator.cancelPage("first");
    expect(await coordinator.begin(owner, "concurrent", beginInput)).toBeNull();
    expect(requests).toBe(2);
    coordinator.cancelPage("second");
    await coordinator.begin(owner, "third", beginInput);
    expect(requests).toBe(3);
  });
  it.each(["failure", "close"])("releases a %s collection so another page can begin the same context", async (mode) => {
    let stored: WatchHistoryStorageRoot = { schemaVersion: 3, activeGenerations: { [owner]: 1 }, partitions: {
      [watchHistoryPartitionKey(owner, 1)]: { ownerUserId: owner, accountGeneration: 1, cache: null, preferences: null, currentObservation: null,
        outbox: { ownerUserId: owner, accountGeneration: 1, entries: [] } },
    } };
    let begins = 0;
    let collections = 0;
    const background = createWatchHistoryClient({ getCurrentSession: async () => ({ accessToken: "test", refreshToken: "test", user: { id: owner } } as never),
      storage: createWatchHistoryStorage({ item: { getValue: async () => stored, setValue: async (value) => { stored = value; } }, getBytesInUse: async () => 0, quotaBytes: 1_000_000 }),
      fetch: async () => Response.json(ack(++begins)),
    });
    const command = async (action: string, _payload?: unknown, _timeout?: number, signal?: AbortSignal) => {
      if (action === "historyIdentity") return { ok: true, metadata: { identity: { providerContentId: "RAW", providerSeriesId: "SERIES", providerSeasonIdentifier: "SERIES|S1", providerEpisodeIdentifier: "SERIES|S1|E1", audioLocale: "en-US" }, context, episodeNumber: 1 } } as never;
      collections++;
      if (mode === "close" && collections === 1) return new Promise<never>((resolve) => signal!.addEventListener("abort", () => resolve({ ok: false } as never), { once: true }));
      return { ok: false } as never;
    };
    const event = { provider: "crunchyroll", accountGeneration: 1, clientEventId: "one", identityPending: { watchId: "RAW", requestedLocale: "fr-FR" } } as never;
    const first = createWatchHistoryPageResolver({ pageId: "first", send: background.handle, command });
    const collecting = first.resolve(event, owner, { refreshCatalog: true });
    await vi.waitFor(() => expect(collections).toBe(1));
    if (mode === "close") first.dispose();
    await collecting;
    const second = createWatchHistoryPageResolver({ pageId: "second", send: background.handle, command });
    await second.resolve(event, owner, { refreshCatalog: true });
    expect(begins).toBe(2);
    expect(collections).toBe(2);
  });
  it("commits only the issued context once, cancels an older SPA source, and asks the server again after restart", async () => {
    const requests: Array<{ path: string; signal: AbortSignal }> = [];
    const save = vi.fn(async () => undefined);
    const invalidate = vi.fn(async () => undefined);
    let revision = 0;
    const dependencies = { isCurrent: async () => true, save, invalidate,
      request: async (path: string, _body: unknown, signal: AbortSignal) => {
        requests.push({ path, signal });
        if (path.endsWith("attempt")) return ack(++revision);
        const { refreshRequired: _refresh, availabilityChanged: _changed, ...base } = ack(revision);
        return { ...base, outcome: "applied", acceptedHash: "accepted-hash", acceptedAt: context.observedAt };
      },
    };
    const coordinator = createWatchHistoryCatalogCoordinator(dependencies);
    await coordinator.begin(owner, "page:1", beginInput);
    await coordinator.begin(owner, "page:2", { ...beginInput, context: { ...context, observedAt: "2026-09-05T00:01:00.000Z" } });
    expect(requests[0]!.signal.aborted).toBe(true);
    const issued = { ...beginInput, context: { ...context, observedAt: "2026-09-05T00:01:00.000Z" } };
    const commit = { ...issued, revision: 2, snapshot: { schemaVersion: 3, provider: "crunchyroll", titleKey: issued.titleKey,
      providerSeriesId: "SERIES", title: "Series", completeness: "partial", context: issued.context, seasons: [] } };
    expect(await coordinator.commit(owner, { ...commit, revision: 1 })).toBeNull();
    expect(await coordinator.commit(owner, commit)).toMatchObject({ outcome: "applied", revision: 2 });
    expect(await coordinator.commit(owner, commit)).toBeNull();
    expect(await coordinator.begin(owner, "page:2", { ...issued, context: { ...context, observedAt: "2026-09-05T00:02:00.000Z" } })).toBeNull();
    expect(requests).toHaveLength(3);
    expect(save).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledTimes(3);
    await createWatchHistoryCatalogCoordinator(dependencies).begin(owner, "page:2", issued);
    expect(requests).toHaveLength(4);
  });
  it("begins once again for a new SPA source in the same title even in the same locale context", async () => {
    const messages: Array<{ command: string; pageId?: string }> = [];
    const resolver = createWatchHistoryPageResolver({ pageId: "page-a",
      command: async (_action, payload) => ({ ok: true, metadata: { identity: { providerContentId: payload?.contentId, providerSeriesId: "SERIES", providerSeasonIdentifier: "SERIES|S1", providerEpisodeIdentifier: "SERIES|S1|E1", audioLocale: "en-US" }, context, episodeNumber: 1 } } as never),
      send: async (message) => { messages.push(message); return { ok: true, data: { ...ack(1), refreshRequired: false } }; },
    });
    for (const watchId of ["RAW", "RAW", "NEXT"]) await resolver.resolve({ provider: "crunchyroll", accountGeneration: 1,
      clientSessionKey: watchId, clientEventId: watchId, identityPending: { watchId, requestedLocale: "fr-FR" } } as never, owner, { refreshCatalog: true });
    const begins = messages.filter((message) => message.command === "catalog-begin");
    expect(begins).toHaveLength(2);
    expect(begins[0]!.pageId).not.toBe(begins[1]!.pageId);
  });
  it.each([false, true])("keeps one collection per visit across in-flight duplicates and new timestamps (applied=%s)", async (applied) => {
    let clock = 0;
    let release!: (value: never) => void;
    const messages: string[] = [];
    const signals: AbortSignal[] = [];
    const metadata = { identity: { providerContentId: "RAW", providerSeriesId: "SERIES", providerSeasonIdentifier: "SERIES|S1", providerEpisodeIdentifier: "SERIES|S1|E1", audioLocale: "en-US" }, context, episodeNumber: 1 };
    const resolver = createWatchHistoryPageResolver({ pageId: "page-a", now: () => clock,
      command: async (action, _payload, _timeout, signal) => {
        if (action === "historyIdentity") return { ok: true, metadata: { ...metadata, context: { ...context, observedAt: new Date(clock).toISOString() } } } as never;
        signals.push(signal!);
        return new Promise((resolve) => { release = resolve; });
      },
      send: async (message) => { messages.push(message.command); return { ok: true, data: ack(1) }; },
    });
    const event = { provider: "crunchyroll", accountGeneration: 1, clientEventId: "one", identityPending: { watchId: "RAW", requestedLocale: "fr-FR" } } as never;
    const first = resolver.resolve(event, owner, { refreshCatalog: true });
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    const second = resolver.resolve(event, owner, { refreshCatalog: true });
    await Promise.resolve(); await Promise.resolve();
    expect(signals[0].aborted).toBe(false);
    expect(signals).toHaveLength(1);
    release({ ok: applied, ...(applied ? { catalog: {} } : {}) } as never);
    await Promise.all([first, second]);
    clock = 20_000;
    await resolver.resolve(event, owner, { refreshCatalog: true });
    expect(signals).toHaveLength(1);
    expect(messages.filter((value) => value === "catalog-begin")).toHaveLength(1);
    expect(messages.filter((value) => value === "catalog-commit")).toHaveLength(applied ? 1 : 0);
  });
  it("resolves cached exact GUID on heartbeat without starting a catalog attempt", async () => {
    const commands: string[] = [];
    const messages: string[] = [];
    const metadata = { identity: { providerContentId: "RAW", providerSeriesId: "SERIES", providerSeasonIdentifier: "SERIES|S1", providerEpisodeIdentifier: "SERIES|S1|E1", audioLocale: "en-US" }, context, episodeNumber: 13.5 };
    const resolver = createWatchHistoryPageResolver({
      pageId: "page-a",
      command: async (action) => { commands.push(action); return { ok: true, metadata } as never; },
      send: async (message) => { messages.push(message.command); return { ok: true }; },
    });
    const event = { provider: "crunchyroll", accountGeneration: 1, clientEventId: "one", identityPending: { watchId: "RAW", requestedLocale: "fr-FR" } } as never;
    await resolver.resolve(event, owner, { refreshCatalog: false });
    await resolver.resolve(event, owner, { refreshCatalog: false });
    expect(commands).toEqual(["historyIdentity"]);
    expect(messages).toEqual(["resolve-identity", "resolve-identity"]);
  });
  it("joins duplicate in-flight context, supersedes newer context and invalidates region-changing begin", async () => {
    const requests: Array<{ signal: AbortSignal; resolve: (body: unknown) => void }> = [];
    const invalidations: number[] = [];
    const coordinator = createWatchHistoryCatalogCoordinator({
      request: async (_path, _body, signal) => new Promise((resolve) => requests.push({ signal, resolve })),
      isCurrent: async () => true, invalidate: async () => { invalidations.push(1); }, save: async () => undefined,
    });
    const first = coordinator.begin(owner, "page-a", beginInput);
    await Promise.resolve();
    const duplicate = coordinator.begin(owner, "page-a", beginInput);
    await Promise.resolve();
    expect(requests).toHaveLength(1);
    const newer = coordinator.begin(owner, "page-b", { ...beginInput, context: { ...context, region: "US" } });
    await Promise.resolve();
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].signal.aborted).toBe(true);
    requests[0].resolve(ack(1));
    requests[1].resolve(ack(2));
    expect(await first).toBeNull();
    expect(await duplicate).toBeNull();
    expect(await newer).toMatchObject({ revision: 2 });
    expect(invalidations).toHaveLength(1);
  });

  it("requires a new server begin on a new page even after a fresh acknowledgement", async () => {
    let requests = 0;
    const coordinator = createWatchHistoryCatalogCoordinator({
      request: async () => { requests += 1; return { ...ack(requests), refreshRequired: false, availabilityChanged: false }; },
      isCurrent: async () => true, invalidate: async () => undefined, save: async () => undefined,
    });
    await coordinator.begin(owner, "page-a", beginInput);
    await coordinator.begin(owner, "page-a", beginInput);
    expect(requests).toBe(1);
    await coordinator.begin(owner, "page-b", beginInput);
    expect(requests).toBe(2);
  });
});

describe("Crunchyroll bounded history traversal", () => {
  it("resolves the recorded raw GUID using only its own object and matching season", async () => {
    const paths: string[] = [];
    const metadata = await resolveCrunchyrollHistoryMetadata("G8WUNEWJE", context, async (path) => {
      paths.push(path);
      if (path.includes("objects")) return variants.objectResponses.G8WUNEWJE;
      if (path.includes("/series/")) return variants.seasonsResponse;
      return variants.episodesResponse;
    }, new AbortController().signal);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain("/objects/G8WUNEWJE");
    expect(metadata?.identity).toMatchObject({ providerContentId: "G8WUNEWJE", audioLocale: "en-US" });
    expect(metadata?.context).toEqual(context);
    expect(metadata?.context.audioLocale).toBe("ja-JP");
  });

  it("collects a bounded full bundle in the original immutable locale", async () => {
    const paths: string[] = [];
    const result = await collectCrunchyrollHistoryCatalog(catalog.seriesId, context, async (path) => {
      paths.push(path);
      if (path.includes("objects")) return { data: [{ id: catalog.seriesId, title: "HAIKYU!!" }] };
      if (path.includes("/series/")) return catalog.seasonsResponse;
      const id = path.match(/seasons\/([^/]+)/)?.[1] as keyof typeof catalog.episodeResponses;
      return catalog.episodeResponses[id];
    }, new AbortController().signal);
    expect(result.context).toEqual(context);
    expect(result.completeness).toBe("complete");
    expect(paths.every((path) => path.includes("locale=fr-FR"))).toBe(true);
    expect(paths).toHaveLength(4);
  });

  it("stops traversal immediately on abort and rejects excessive declared raw seasons", async () => {
    const abort = new AbortController();
    let calls = 0;
    await expect(collectCrunchyrollHistoryCatalog("SERIES", context, async () => {
      calls += 1;
      abort.abort();
      return { data: [{ id: "SERIES", title: "Title" }] };
    }, abort.signal)).rejects.toThrow("HISTORY_ABORTED");
    expect(calls).toBe(1);
    calls = 0;
    await expect(collectCrunchyrollHistoryCatalog("SERIES", context, async (path) => {
      calls += 1;
      return path.includes("objects") ? { data: [{ id: "SERIES", title: "Title" }] } : { total: 101, data: [] };
    }, new AbortController().signal)).rejects.toThrow("HISTORY_LIMIT");
    expect(calls).toBe(2);
  });
});
