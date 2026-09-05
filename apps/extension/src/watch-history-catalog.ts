import {
  WatchCatalogBeginAckSchema, WatchCatalogBeginRequestSchema,
  WatchCatalogCommitAckSchema, WatchCatalogCommitRequestSchema,
  type WatchCatalogBeginAck, type WatchCatalogBeginRequest,
  type WatchCatalogCommitAck, type WatchCatalogCommitRequest,
} from "@anidachi/protocol";
import { runCrunchyrollMainCommand } from "./source-adapters/crunchyroll/bridge-client";
import type { CrunchyrollHistoryMetadata } from "./source-adapters/crunchyroll/bridge-contract";
import type { WatchHistoryMessage, WatchHistoryMessageResponse } from "./watch-history-client";
import type { WatchHistoryLocalEvent } from "./watch-history-outbox";

export type WatchHistoryCatalogAcknowledgement = {
  revision: number; acceptedHash: string | null; acceptedAt: string | null;
  context: WatchCatalogBeginRequest["context"];
};

type Dependencies = {
  request(path: string, body: unknown, signal: AbortSignal, owner: string): Promise<unknown>;
  isCurrent(owner: string, generation: number): Promise<boolean>;
  invalidate(owner: string, generation: number, downgrade?: Pick<WatchCatalogBeginAck, "titleKey" | "effectiveCatalogState">, guard?: () => boolean): Promise<void>;
  save(owner: string, generation: number, titleKey: string, ack: WatchHistoryCatalogAcknowledgement, guard: () => boolean): Promise<void>;
  supersede?(pageId: string): void;
};

function contextKey(context: WatchCatalogBeginRequest["context"]): string {
  return JSON.stringify([context.region, context.requestedLocale, context.audioLocale, [...context.subtitleLocales].sort()]);
}

/** Service-worker memory only. Server revisions remain authoritative after restart. */
export function createWatchHistoryCatalogCoordinator(dependencies: Dependencies) {
  type Job = { pageId: string; input: WatchCatalogBeginRequest; abort: AbortController;
    promise: Promise<WatchCatalogBeginAck | null>; ack: WatchCatalogBeginAck | null; settled: boolean; committed: boolean };
  const jobs = new Map<string, Job>();
  const key = (owner: string, title: string) => `${owner}\u0000${title}`;
  const owns = (owner: string, job: Job) => !job.abort.signal.aborted && jobs.get(key(owner, job.input.titleKey)) === job;
  const current = async (owner: string, job: Job) => owns(owner, job) &&
    await dependencies.isCurrent(owner, job.input.accountGeneration) && owns(owner, job);

  function cancel(owner: string, titleKey?: string): void {
    for (const [id, job] of jobs) {
      if (!id.startsWith(`${owner}\u0000`) || titleKey && job.input.titleKey !== titleKey) continue;
      job.abort.abort(); dependencies.supersede?.(job.pageId); jobs.delete(id);
    }
  }

  function cancelPage(pageId: string): void {
    for (const [id, job] of jobs) if (job.pageId === pageId) { job.abort.abort(); jobs.delete(id); }
  }

  async function release(owner: string, pageId: string, input: { accountGeneration: number; titleKey: string; revision: number }): Promise<boolean> {
    const job = jobs.get(key(owner, input.titleKey));
    if (!job || job.pageId !== pageId || job.input.accountGeneration !== input.accountGeneration ||
      job.ack?.revision !== input.revision || !await current(owner, job) || !owns(owner, job)) return false;
    // Delete immediately after the synchronous ownership check, before abort
    // listeners can run user code and install another job at this key.
    jobs.delete(key(owner, input.titleKey)); job.abort.abort();
    return true;
  }

  function begin(owner: string, pageId: string, raw: unknown): Promise<WatchCatalogBeginAck | null> {
    const parsed = WatchCatalogBeginRequestSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.context.region) return Promise.resolve(null);
    const input = structuredClone(parsed.data);
    const id = key(owner, input.titleKey);
    const old = jobs.get(id);
    if (old && old.input.accountGeneration === input.accountGeneration && contextKey(old.input.context) === contextKey(input.context)) {
      if (old.pageId === pageId) return old.committed ? Promise.resolve(null) : old.promise;
      const samePageNewSource = old.pageId.split(":")[0] === pageId.split(":")[0];
      if (!samePageNewSource && (!old.settled || old.ack?.refreshRequired && !old.committed)) return old.promise.then(() => null);
    }
    if (old) { old.abort.abort(); dependencies.supersede?.(old.pageId); }
    const job: Job = { pageId, input, abort: new AbortController(), promise: Promise.resolve(null), ack: null, settled: false, committed: false };
    jobs.set(id, job);
    job.promise = (async () => {
      try {
        if (!await current(owner, job)) return null;
        const response = await dependencies.request("/api/watch-history/v3/catalog/attempt", input, job.abort.signal, owner);
        const parsedAck = WatchCatalogBeginAckSchema.safeParse(response);
        if (!parsedAck.success || !matches(owner, input, parsedAck.data) || !await current(owner, job)) return null;
        const ack = parsedAck.data;
        job.ack = ack;
        if (ack.availabilityChanged) await dependencies.invalidate(owner, input.accountGeneration, ack, () => owns(owner, job));
        if (!await current(owner, job)) return null;
        if (!ack.refreshRequired) await dependencies.save(owner, input.accountGeneration, input.titleKey,
          { revision: ack.revision, acceptedHash: ack.acceptedHash, acceptedAt: ack.acceptedAt, context: input.context }, () => owns(owner, job));
        return await current(owner, job) ? ack : null;
      } catch { return null; }
      finally { job.settled = true; }
    })();
    return job.promise;
  }

  async function commit(owner: string, raw: unknown): Promise<WatchCatalogCommitAck | null> {
    const parsed = WatchCatalogCommitRequestSchema.safeParse(raw);
    if (!parsed.success) return null;
    const input = parsed.data;
    const job = jobs.get(key(owner, input.titleKey));
    if (!job || job.committed || !job.ack?.refreshRequired || job.ack.revision !== input.revision ||
      JSON.stringify(job.input.context) !== JSON.stringify(input.context) || !await current(owner, job)) return null;
    job.committed = true;
    try {
      const response = await dependencies.request("/api/watch-history/v3/catalog", input, job.abort.signal, owner);
      const parsedAck = WatchCatalogCommitAckSchema.safeParse(response);
      if (!parsedAck.success || !matches(owner, input, parsedAck.data) || parsedAck.data.revision !== input.revision || !await current(owner, job)) return null;
      const ack = parsedAck.data;
      if (ack.outcome === "applied") {
        await dependencies.save(owner, input.accountGeneration, input.titleKey,
          { revision: ack.revision, acceptedHash: ack.acceptedHash, acceptedAt: ack.acceptedAt, context: input.context }, () => owns(owner, job));
        if (!await current(owner, job)) return null;
        await dependencies.invalidate(owner, input.accountGeneration, undefined, () => owns(owner, job));
      }
      return await current(owner, job) ? ack : null;
    } catch { return null; }
  }
  return { begin, commit, cancel, release, cancelPage };
}

function matches(owner: string, input: WatchCatalogBeginRequest | WatchCatalogCommitRequest,
  ack: WatchCatalogBeginAck | WatchCatalogCommitAck): boolean {
  return ack.meta.ownerUserId === owner && ack.accountGeneration === input.accountGeneration &&
    ack.provider === input.provider && ack.titleKey === input.titleKey;
}

/** Page-owned provider I/O, called only after the background accepted durability. */
export function createWatchHistoryPageResolver(dependencies: {
  send(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse>;
  command?: typeof runCrunchyrollMainCommand;
  pageId?: string;
  now?: () => number;
}) {
  const pageId = dependencies.pageId ?? crypto.randomUUID();
  const command = dependencies.command ?? runCrunchyrollMainCommand;
  const now = dependencies.now ?? Date.now;
  const mappings = new Map<string, { promise: Promise<CrunchyrollHistoryMetadata | null>; attemptedAt: number; abort: AbortController; settled: boolean }>();
  const activeCatalogs = new Map<string, { abort: AbortController; signature: string; visitId: string; promise: Promise<void> }>();
  const attemptedCatalogs = new Set<string>();
  const visits = new Map<string, string>();
  let disposed = false;
  let currentSource: string | null = null;

  async function resolve(event: WatchHistoryLocalEvent, owner: string, options: { refreshCatalog: boolean }): Promise<void> {
    const pending = event.identityPending;
    if (disposed || !pending || event.provider !== "crunchyroll") return;
    const sourceKey = `${owner}:${event.accountGeneration}:${event.clientSessionKey}:${pending.watchId}`;
    if (options.refreshCatalog && sourceKey !== currentSource) {
      currentSource = sourceKey;
      abortCatalogs();
    }
    const mappingKey = `${owner}:${event.accountGeneration}:${pending.watchId}:${pending.requestedLocale}`;
    const prior = mappings.get(mappingKey);
    if (!prior || prior.settled && options.refreshCatalog && now() - prior.attemptedAt >= 10_000) {
      const abort = new AbortController();
      const mapping = { attemptedAt: now(), abort, settled: false, promise: command("historyIdentity", { contentId: pending.watchId, locale: pending.requestedLocale }, 30_000, abort.signal)
        .then((response) => response.ok && response.metadata?.identity.providerContentId === pending.watchId ? response.metadata : null)
        .catch(() => null).finally(() => { mapping.settled = true; }) };
      mappings.set(mappingKey, mapping);
    }
    const metadata = await mappings.get(mappingKey)!.promise;
    if (disposed || !metadata) return;
    const resolution = dependencies.send({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "resolve-identity", expectedOwnerUserId: owner,
      accountGeneration: event.accountGeneration, clientEventId: event.clientEventId, identity: metadata.identity, episodeNumber: metadata.episodeNumber });
    if (!options.refreshCatalog || sourceKey !== currentSource || !metadata.context.region) { await resolution; return; }
    const titleKey = `crunchyroll:series:${metadata.identity.providerSeriesId}`;
    const jobKey = `${owner}:${event.accountGeneration}:${titleKey}`;
    if (!visits.has(sourceKey)) visits.set(sourceKey, `${pageId}:${visits.size + 1}`);
    const visitId = visits.get(sourceKey)!;
    const signature = contextKey(metadata.context);
    const active = activeCatalogs.get(jobKey);
    if (active?.signature === signature && active.visitId === visitId) { await Promise.all([resolution, active.promise]); return; }
    active?.abort.abort();
    const attemptKey = `${jobKey}:${visitId}:${signature}`;
    if (attemptedCatalogs.has(attemptKey)) { await resolution; return; }
    attemptedCatalogs.add(attemptKey);
    const abort = new AbortController();
    const input: WatchCatalogBeginRequest = { schemaVersion: 3, provider: "crunchyroll", accountGeneration: event.accountGeneration,
      titleKey, providerSeriesId: metadata.identity.providerSeriesId, context: structuredClone(metadata.context) };
    const collecting = (async () => {
      let revision: number | null = null;
      try {
        const response = await dependencies.send({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "catalog-begin", expectedOwnerUserId: owner, pageId: visitId, input });
        if (!response.ok) return;
        const parsed = WatchCatalogBeginAckSchema.safeParse(response.data);
        if (!parsed.success || !matches(owner, input, parsed.data)) return;
        revision = parsed.data.revision;
        if (disposed || abort.signal.aborted || !parsed.data.refreshRequired) return;
        const result = await command("historyCatalog", { seriesId: input.providerSeriesId, context: input.context }, 120_000, abort.signal);
        if (!result.ok || !result.catalog || disposed || abort.signal.aborted) return;
        await dependencies.send({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "catalog-commit", expectedOwnerUserId: owner, pageId: visitId,
          input: { ...input, revision: parsed.data.revision, snapshot: result.catalog } });
      } catch { /* One bounded attempt per context/visit; a new visit can retry. */ }
      finally {
        if (revision !== null) await dependencies.send({ type: "ANIDACHI_WATCH_HISTORY_V3", command: "catalog-release", expectedOwnerUserId: owner,
          pageId: visitId, accountGeneration: input.accountGeneration, titleKey, revision }).catch(() => undefined);
        if (activeCatalogs.get(jobKey)?.abort === abort) activeCatalogs.delete(jobKey);
      }
    })();
    activeCatalogs.set(jobKey, { abort, signature, visitId, promise: collecting });
    await Promise.all([resolution, collecting]);
  }
  function abortCatalogs(visitId?: string): void {
    for (const [key, active] of activeCatalogs) if (!visitId || active.visitId === visitId) {
      active.abort.abort(); activeCatalogs.delete(key);
    }
  }
  return { resolve, pageId, abortCatalogs, suspendCatalogs: () => { currentSource = null; abortCatalogs(); }, dispose: () => {
    disposed = true; abortCatalogs();
    for (const { abort } of mappings.values()) abort.abort();
    mappings.clear();
  } };
}
