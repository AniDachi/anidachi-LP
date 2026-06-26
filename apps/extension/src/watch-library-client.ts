import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { createWebsiteRoomHeaders, RoomApiError, type CreatedRoom } from "./room-client";
import { storage } from "wxt/utils/storage";
import {
  recordWatchProgressInStore,
  type ResourceProvider,
  type StoredWatchItem,
  type WatchProgressEntry,
  type WatchProgressStore,
} from "./watch-progress";

const WATCH_LIBRARY_HTTP_MESSAGE_TYPE = "ANIDACHI_WATCH_LIBRARY_HTTP";
export const WATCH_LIBRARY_CACHE_STORAGE_KEY = "anidachi.watchLibraryCache.v1";
export const WATCH_LIBRARY_CACHE_KEY = `local:${WATCH_LIBRARY_CACHE_STORAGE_KEY}` as const;
export const WATCH_LIBRARY_CACHE_MAX_AGE_MS = 60_000;

export type WatchCheckpointKind = "local" | "room" | "pause" | "seeked" | "ended" | "pagehide" | "reconcile" | "manual";

export type WatchProgressReconcileEntry = WatchProgressEntry & {
  checkpointKind?: WatchCheckpointKind;
  observedAt?: string | number;
};

export interface WatchLibraryParticipant {
  user: {
    userId: string;
    handle: string | null;
    displayName: string;
    avatarUrl: string | null;
  };
  role: "host" | "viewer";
  currentTime: number;
  progress: number;
  joinedAt: string;
  leftAt: string | null;
  updatedAt: string;
}

export interface WatchLibrarySession {
  id: string;
  roomId: string | null;
  hostUserId: string;
  kind: "solo" | "shared";
  currentTime: number;
  duration: number;
  progress: number;
  startedAt: string;
  endedAt: string | null;
  lastWatchedAt: string;
  participants: WatchLibraryParticipant[];
}

export interface WatchLibraryEpisode {
  episodeKey: string;
  episodeTitle: string;
  seasonId: string | null;
  seasonTitle: string | null;
  seasonNumber: number | null;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastWatchedAt: string;
  sessions: WatchLibrarySession[];
}

export interface WatchLibraryItem {
  provider: ResourceProvider;
  itemKey: string;
  itemKind: "series" | "movie";
  itemTitle: string;
  sourceUrl: string;
  artworkUrl: string | null;
  active: boolean;
  lastWatchedAt: string;
  episodes: WatchLibraryEpisode[];
}

export interface WatchLibraryResponse {
  generatedAt: string;
  limits: {
    planCode: string;
    maxActiveTrackedTitles: number;
    activeTrackedTitleCount: number;
    historyRetentionDays: number;
    retainedSince: string;
  };
  items: WatchLibraryItem[];
}

export interface CachedWatchLibrary {
  userId: string;
  cachedAt: string;
  library: WatchLibraryResponse;
}

export type WatchLibrarySyncLedger = Record<string, number>;

export type WatchLibraryHttpMessage =
  | {
      type: typeof WATCH_LIBRARY_HTTP_MESSAGE_TYPE;
      command: "list-library";
      accessToken: string;
    }
  | {
      type: typeof WATCH_LIBRARY_HTTP_MESSAGE_TYPE;
      command: "clear-library";
      accessToken: string;
    }
  | {
      type: typeof WATCH_LIBRARY_HTTP_MESSAGE_TYPE;
      command: "reconcile-progress";
      accessToken: string;
      entries: WatchProgressReconcileEntry[];
    }
  | {
      type: typeof WATCH_LIBRARY_HTTP_MESSAGE_TYPE;
      command: "create-room-from-session";
      accessToken: string;
      sessionId: string;
      clientRequestId?: string;
    };

export type WatchLibraryHttpMessageResponse =
  | { ok: true; library: WatchLibraryResponse }
  | { ok: true; room: CreatedRoom }
  | { ok: false; error: string; code?: string; resetAt?: string };

export function listWatchLibraryHttpMessage(accessToken: string): WatchLibraryHttpMessage {
  return {
    type: WATCH_LIBRARY_HTTP_MESSAGE_TYPE,
    command: "list-library",
    accessToken,
  };
}

export function clearWatchLibraryHttpMessage(accessToken: string): WatchLibraryHttpMessage {
  return {
    type: WATCH_LIBRARY_HTTP_MESSAGE_TYPE,
    command: "clear-library",
    accessToken,
  };
}

export function reconcileWatchProgressHttpMessage(
  accessToken: string,
  entries: WatchProgressReconcileEntry[],
): WatchLibraryHttpMessage {
  return {
    type: WATCH_LIBRARY_HTTP_MESSAGE_TYPE,
    command: "reconcile-progress",
    accessToken,
    entries,
  };
}

export function createRoomFromWatchSessionHttpMessage(params: {
  accessToken: string;
  sessionId: string;
  clientRequestId?: string;
}): WatchLibraryHttpMessage {
  return {
    type: WATCH_LIBRARY_HTTP_MESSAGE_TYPE,
    command: "create-room-from-session",
    accessToken: params.accessToken,
    sessionId: params.sessionId,
    ...(params.clientRequestId ? { clientRequestId: params.clientRequestId } : {}),
  };
}

export function isWatchLibraryHttpMessage(value: unknown): value is WatchLibraryHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<WatchLibraryHttpMessage>;
  if (message.type !== WATCH_LIBRARY_HTTP_MESSAGE_TYPE || typeof message.accessToken !== "string") {
    return false;
  }
  if (message.command === "list-library" || message.command === "clear-library") return true;
  if (message.command === "create-room-from-session") {
    return (
      typeof message.sessionId === "string" &&
      Boolean(message.sessionId.trim()) &&
      (message.clientRequestId === undefined || typeof message.clientRequestId === "string")
    );
  }
  if (message.command === "reconcile-progress") {
    return Array.isArray(message.entries) && message.entries.every(isWatchProgressEntryLike);
  }
  return false;
}

export function watchProgressEntriesFromStore(
  store: WatchProgressStore,
  checkpointKind: WatchCheckpointKind = "reconcile",
  sinceMs = 0,
): WatchProgressReconcileEntry[] {
  return collectWatchProgressEntriesFromStore(store, checkpointKind)
    .filter((entry) => Number(entry.observedAt ?? 0) > sinceMs)
    .sort((a, b) => Number(b.observedAt ?? 0) - Number(a.observedAt ?? 0))
    .slice(0, 100);
}

function collectWatchProgressEntriesFromStore(
  store: WatchProgressStore,
  checkpointKind: WatchCheckpointKind,
): WatchProgressReconcileEntry[] {
  const entries: WatchProgressReconcileEntry[] = [];
  for (const provider of Object.keys(store.providers) as ResourceProvider[]) {
    for (const item of Object.values(store.providers[provider]?.items ?? {})) {
      entries.push(...watchProgressEntriesFromItem(item, checkpointKind));
    }
  }
  return entries;
}

export function watchProgressEntriesFromStoreForSync(
  store: WatchProgressStore,
  checkpointKind: WatchCheckpointKind,
  ledger: WatchLibrarySyncLedger,
): WatchProgressReconcileEntry[] {
  return collectWatchProgressEntriesFromStore(store, checkpointKind)
    .filter(
      (entry) =>
        Number(entry.observedAt ?? 0) > (ledger[watchProgressSyncEntryKey(entry)] ?? 0),
    )
    .sort((a, b) => Number(b.observedAt ?? 0) - Number(a.observedAt ?? 0))
    .slice(0, 100);
}

export function watchProgressSyncEntryKey(
  entry: Pick<
    WatchProgressReconcileEntry,
    "provider" | "itemId" | "episodeId" | "contentId" | "kind"
  >,
): string {
  const leafId =
    entry.kind === "movie" ? entry.itemId : entry.episodeId ?? entry.contentId ?? entry.itemId;
  return `${entry.provider}:${entry.itemId}:${leafId}`;
}

export function watchProgressEntriesFromWatchLibrary(
  library: WatchLibraryResponse | null,
  checkpointKind: WatchCheckpointKind = "reconcile",
): WatchProgressReconcileEntry[] {
  const entries: WatchProgressReconcileEntry[] = [];
  for (const item of library?.items ?? []) {
    for (const episode of item.episodes) {
      const observedAt = new Date(episode.lastWatchedAt).getTime();
      if (!Number.isFinite(observedAt)) {
        continue;
      }

      const latestSession = episode.sessions[0] ?? null;
      entries.push({
        provider: item.provider,
        kind: item.itemKind === "series" ? "episode" : "movie",
        itemId: item.itemKey,
        itemTitle: item.itemTitle,
        contentId: episode.episodeKey,
        seasonId: episode.seasonId ?? undefined,
        seasonTitle: episode.seasonTitle ?? undefined,
        seasonNumber: episode.seasonNumber ?? undefined,
        episodeId: episode.episodeKey,
        episodeTitle: episode.episodeTitle,
        artworkUrl: item.artworkUrl ?? undefined,
        sourceUrl: episode.sourceUrl,
        currentTime: episode.currentTime,
        duration: episode.duration,
        roomId: latestSession?.roomId ?? undefined,
        watchedWithCount: Math.max(1, latestSession?.participants.length ?? 1),
        checkpointKind,
        observedAt,
      });
    }
  }
  return entries.sort((a, b) => Number(b.observedAt ?? 0) - Number(a.observedAt ?? 0));
}

export function mergeWatchLibraryIntoProgressStore(
  localStore: WatchProgressStore,
  library: WatchLibraryResponse | null,
): WatchProgressStore {
  let nextStore = localStore;
  for (const entry of watchProgressEntriesFromWatchLibrary(library)) {
    const observedAt = Number(entry.observedAt ?? 0);
    const existingItem = nextStore.providers[entry.provider]?.items[entry.itemId];
    const existingEntry =
      entry.kind === "episode" ? existingItem?.episodes?.[entry.episodeId ?? entry.itemId] : existingItem;
    if (existingEntry && existingEntry.lastWatchedAt >= observedAt) {
      continue;
    }

    nextStore = recordWatchProgressInStore(nextStore, entry, observedAt);
  }
  return nextStore;
}

export async function getCachedWatchLibraryForUser(userId: string): Promise<CachedWatchLibrary | null> {
  const cached = normalizeCachedWatchLibrary(
    await storage.getItem<unknown>(watchLibraryCacheKeyForUser(userId)),
  );
  if (cached?.userId === userId) {
    return cached;
  }

  const legacyCached = normalizeCachedWatchLibrary(await storage.getItem<unknown>(WATCH_LIBRARY_CACHE_KEY));
  return legacyCached?.userId === userId ? legacyCached : null;
}

export function isWatchLibraryCacheFresh(
  cached: CachedWatchLibrary,
  nowMs = Date.now(),
): boolean {
  const cachedAtMs = new Date(cached.cachedAt).getTime();
  return Number.isFinite(cachedAtMs) && nowMs - cachedAtMs <= WATCH_LIBRARY_CACHE_MAX_AGE_MS;
}

export async function setCachedWatchLibraryForUser(userId: string, library: WatchLibraryResponse): Promise<void> {
  await storage.setItem(watchLibraryCacheKeyForUser(userId), {
    userId,
    cachedAt: new Date().toISOString(),
    library: normalizeWatchLibraryResponse(library),
  } satisfies CachedWatchLibrary);
}

export async function clearCachedWatchLibrary(): Promise<void> {
  await storage.removeItem(WATCH_LIBRARY_CACHE_KEY);
}

export async function clearCachedWatchLibraryForUser(
  userId: string | null | undefined,
): Promise<void> {
  await Promise.all([
    storage.removeItem(WATCH_LIBRARY_CACHE_KEY),
    userId ? storage.removeItem(watchLibraryCacheKeyForUser(userId)) : Promise.resolve(),
  ]);
}

export function watchLibraryCacheKeyForUser(userId: string): `local:${string}` {
  return `local:${WATCH_LIBRARY_CACHE_STORAGE_KEY}.${encodeURIComponent(userId)}`;
}

const WATCH_LIBRARY_SYNC_WATERMARK_STORAGE_KEY = "anidachi.watchLibrarySync.v1";
export const WATCH_LIBRARY_SYNC_WATERMARK_KEY =
  `local:${WATCH_LIBRARY_SYNC_WATERMARK_STORAGE_KEY}` as const;

interface WatchLibrarySyncWatermark {
  userId: string;
  lastObservedAtMs: number;
}

const WATCH_LIBRARY_SYNC_LEDGER_STORAGE_KEY = "anidachi.watchLibrarySyncLedger.v1";
export const WATCH_LIBRARY_SYNC_LEDGER_KEY =
  `local:${WATCH_LIBRARY_SYNC_LEDGER_STORAGE_KEY}` as const;

interface WatchLibrarySyncLedgerRecord {
  userId: string;
  entries: WatchLibrarySyncLedger;
}

// Legacy global watermark kept for older data/tests. New sync uses the
// per-entry ledger below so server snapshots do not hide unsynced local entries.
export async function getWatchLibrarySyncWatermark(userId: string): Promise<number> {
  const stored = normalizeSyncWatermark(
    await storage.getItem<unknown>(WATCH_LIBRARY_SYNC_WATERMARK_KEY),
  );
  return stored && stored.userId === userId ? stored.lastObservedAtMs : 0;
}

export async function setWatchLibrarySyncWatermark(
  userId: string,
  lastObservedAtMs: number,
): Promise<void> {
  if (!Number.isFinite(lastObservedAtMs) || lastObservedAtMs <= 0) return;
  await storage.setItem(WATCH_LIBRARY_SYNC_WATERMARK_KEY, {
    userId,
    lastObservedAtMs,
  } satisfies WatchLibrarySyncWatermark);
}

export async function clearWatchLibrarySyncWatermark(): Promise<void> {
  await clearWatchLibrarySyncStateForUser(null);
}

export async function clearWatchLibrarySyncStateForUser(
  userId: string | null | undefined,
): Promise<void> {
  await Promise.all([
    storage.removeItem(WATCH_LIBRARY_SYNC_WATERMARK_KEY),
    storage.removeItem(WATCH_LIBRARY_SYNC_LEDGER_KEY),
    userId ? storage.removeItem(watchLibrarySyncLedgerKeyForUser(userId)) : Promise.resolve(),
  ]);
}

export async function getWatchLibrarySyncLedger(userId: string): Promise<WatchLibrarySyncLedger> {
  const stored = normalizeSyncLedger(
    await storage.getItem<unknown>(watchLibrarySyncLedgerKeyForUser(userId)),
  );
  if (stored && stored.userId === userId) {
    return stored.entries;
  }

  const legacyStored = normalizeSyncLedger(
    await storage.getItem<unknown>(WATCH_LIBRARY_SYNC_LEDGER_KEY),
  );
  return legacyStored && legacyStored.userId === userId ? legacyStored.entries : {};
}

export async function markWatchLibraryEntriesSynced(
  userId: string,
  entries: WatchProgressReconcileEntry[],
): Promise<WatchLibrarySyncLedger> {
  const ledger = await getWatchLibrarySyncLedger(userId);
  const nextLedger: WatchLibrarySyncLedger = { ...ledger };
  for (const entry of entries) {
    const observedAt = Number(entry.observedAt ?? 0);
    if (!Number.isFinite(observedAt) || observedAt <= 0) {
      continue;
    }
    const key = watchProgressSyncEntryKey(entry);
    nextLedger[key] = Math.max(nextLedger[key] ?? 0, observedAt);
  }

  await storage.setItem(watchLibrarySyncLedgerKeyForUser(userId), {
    userId,
    entries: nextLedger,
  } satisfies WatchLibrarySyncLedgerRecord);
  return nextLedger;
}

export function watchLibrarySyncLedgerKeyForUser(userId: string): `local:${string}` {
  return `local:${WATCH_LIBRARY_SYNC_LEDGER_STORAGE_KEY}.${encodeURIComponent(userId)}`;
}

export async function listWatchLibraryFromApi(accessToken: string): Promise<WatchLibraryResponse> {
  logDebug("watch-library.http", "list watch library request", {
    webHttpBase: WEB_HTTP_BASE,
  });
  const response = await fetch(new URL("/api/watch-library", WEB_HTTP_BASE), {
    headers: createWebsiteRoomHeaders(accessToken),
  });
  if (!response.ok) {
    throw await watchLibraryHttpError(response, "Failed to load watch library");
  }
  return normalizeWatchLibraryResponse(await response.json());
}

export async function clearWatchLibraryFromApi(accessToken: string): Promise<WatchLibraryResponse> {
  logDebug("watch-library.http", "clear watch library request", {
    webHttpBase: WEB_HTTP_BASE,
  });
  const response = await fetch(new URL("/api/watch-library", WEB_HTTP_BASE), {
    method: "DELETE",
    headers: createWebsiteRoomHeaders(accessToken),
  });
  if (!response.ok) {
    throw await watchLibraryHttpError(response, "Failed to clear watch library");
  }
  return normalizeWatchLibraryResponse(await response.json());
}

export async function reconcileWatchProgressFromApi(
  accessToken: string,
  entries: WatchProgressReconcileEntry[],
): Promise<WatchLibraryResponse> {
  logDebug("watch-library.http", "reconcile watch progress request", {
    webHttpBase: WEB_HTTP_BASE,
    entryCount: entries.length,
  });
  const response = await fetch(new URL("/api/watch-progress/reconcile", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) {
    throw await watchLibraryHttpError(response, "Failed to reconcile watch progress");
  }
  return normalizeWatchLibraryResponse(await response.json());
}

export async function createRoomFromWatchSessionFromApi(params: {
  accessToken: string;
  sessionId: string;
  clientRequestId?: string;
}): Promise<CreatedRoom> {
  logDebug("watch-library.http", "create room from watch session request", {
    webHttpBase: WEB_HTTP_BASE,
    sessionId: params.sessionId,
  });
  const response = await fetch(new URL("/api/watch-library/rooms", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(params.accessToken),
    body: JSON.stringify({
      sessionId: params.sessionId,
      clientRequestId: params.clientRequestId,
    }),
  });
  if (!response.ok) {
    throw await watchLibraryHttpError(response, "Failed to create room");
  }
  const payload = (await response.json()) as Partial<CreatedRoom>;
  if (typeof payload.roomId !== "string" || typeof payload.roomToken !== "string") {
    throw new Error("Watch library room response is missing room credentials");
  }
  return {
    roomId: payload.roomId,
    roomToken: payload.roomToken,
    shareableLink: typeof payload.shareableLink === "string" ? payload.shareableLink : "",
    reused: payload.reused === true,
    capabilities: payload.capabilities,
    quota: payload.quota,
  };
}

export async function handleWatchLibraryHttpMessage(
  message: WatchLibraryHttpMessage,
): Promise<WatchLibraryHttpMessageResponse> {
  try {
    if (message.command === "list-library") {
      return {
        ok: true,
        library: await listWatchLibraryFromApi(message.accessToken),
      };
    }
    if (message.command === "clear-library") {
      return {
        ok: true,
        library: await clearWatchLibraryFromApi(message.accessToken),
      };
    }
    if (message.command === "reconcile-progress") {
      return {
        ok: true,
        library: await reconcileWatchProgressFromApi(message.accessToken, message.entries),
      };
    }
    return {
      ok: true,
      room: await createRoomFromWatchSessionFromApi({
        accessToken: message.accessToken,
        sessionId: message.sessionId,
        clientRequestId: message.clientRequestId,
      }),
    };
  } catch (error) {
    if (error instanceof RoomApiError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
        resetAt: error.resetAt,
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Watch library request failed",
    };
  }
}

export async function listWatchLibrary(accessToken: string): Promise<WatchLibraryResponse> {
  const response = assertWatchLibraryHttpResponse(
    await chrome.runtime.sendMessage(listWatchLibraryHttpMessage(accessToken)),
  );
  if (!response.ok) throw watchLibraryBridgeError(response);
  if (!("library" in response)) {
    throw new Error("Watch library bridge response is missing library");
  }
  return response.library;
}

export async function clearWatchLibrary(accessToken: string): Promise<WatchLibraryResponse> {
  const response = assertWatchLibraryHttpResponse(
    await chrome.runtime.sendMessage(clearWatchLibraryHttpMessage(accessToken)),
  );
  if (!response.ok) throw watchLibraryBridgeError(response);
  if (!("library" in response)) {
    throw new Error("Watch library bridge response is missing library");
  }
  return response.library;
}

export async function reconcileWatchProgress(
  accessToken: string,
  entries: WatchProgressReconcileEntry[],
): Promise<WatchLibraryResponse> {
  const response = assertWatchLibraryHttpResponse(
    await chrome.runtime.sendMessage(reconcileWatchProgressHttpMessage(accessToken, entries)),
  );
  if (!response.ok) throw watchLibraryBridgeError(response);
  if (!("library" in response)) {
    throw new Error("Watch library bridge response is missing library");
  }
  return response.library;
}

export async function createRoomFromWatchSession(params: {
  accessToken: string;
  sessionId: string;
  clientRequestId?: string;
}): Promise<CreatedRoom> {
  const response = assertWatchLibraryHttpResponse(
    await chrome.runtime.sendMessage(createRoomFromWatchSessionHttpMessage(params)),
  );
  if (!response.ok) throw watchLibraryBridgeError(response);
  if (!("room" in response)) {
    throw new Error("Watch library bridge response is missing room");
  }
  return response.room;
}

export function watchProgressEntriesFromItem(
  item: StoredWatchItem,
  checkpointKind: WatchCheckpointKind,
): WatchProgressReconcileEntry[] {
  if (item.kind === "series" && item.episodes) {
    return Object.values(item.episodes).map((episode) => ({
      provider: item.provider,
      kind: "episode",
      itemId: item.id,
      itemTitle: item.title,
      contentId: episode.id,
      seriesId: item.seriesId,
      seasonId: episode.seasonId,
      seasonTitle: episode.seasonTitle,
      seasonNumber: episode.seasonNumber,
      episodeId: episode.id,
      episodeTitle: episode.title,
      artworkUrl: item.artworkUrl,
      sourceUrl: episode.sourceUrl,
      currentTime: episode.currentTime,
      duration: episode.duration,
      roomId: episode.lastRoomId,
      watchedWithCount: episode.watchedWithCount,
      checkpointKind,
      observedAt: episode.lastWatchedAt,
    }));
  }

  return [
    {
      provider: item.provider,
      kind: "movie",
      itemId: item.id,
      itemTitle: item.title,
      contentId: item.contentId,
      seriesId: item.seriesId,
      episodeId: item.id,
      episodeTitle: item.title,
      artworkUrl: item.artworkUrl,
      sourceUrl: item.sourceUrl,
      currentTime: item.currentTime,
      duration: item.duration,
      roomId: item.lastRoomId,
      watchedWithCount: item.watchedWithCount,
      checkpointKind,
      observedAt: item.lastWatchedAt,
    },
  ];
}

async function watchLibraryHttpError(response: Response, fallback: string): Promise<RoomApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    code?: unknown;
    resetAt?: unknown;
  } | null;
  const detail =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.code === "string" && body.code) ||
    fallback;
  return new RoomApiError(
    `${detail} (${response.status})`,
    typeof body?.code === "string" ? body.code : undefined,
    typeof body?.resetAt === "string" ? body.resetAt : undefined,
  );
}

function normalizeWatchLibraryResponse(value: unknown): WatchLibraryResponse {
  const payload = value as Partial<WatchLibraryResponse>;
  return {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString(),
    limits:
      payload.limits && typeof payload.limits === "object"
        ? payload.limits
        : {
            planCode: "free",
            maxActiveTrackedTitles: 0,
            activeTrackedTitleCount: 0,
            historyRetentionDays: 0,
            retainedSince: new Date(0).toISOString(),
          },
    items: Array.isArray(payload.items) ? (payload.items as WatchLibraryItem[]) : [],
  };
}

function normalizeCachedWatchLibrary(value: unknown): CachedWatchLibrary | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<CachedWatchLibrary>;
  if (typeof payload.userId !== "string" || typeof payload.cachedAt !== "string") {
    return null;
  }
  return {
    userId: payload.userId,
    cachedAt: payload.cachedAt,
    library: normalizeWatchLibraryResponse(payload.library),
  };
}

function normalizeSyncWatermark(value: unknown): WatchLibrarySyncWatermark | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<WatchLibrarySyncWatermark>;
  if (typeof payload.userId !== "string") return null;
  const lastObservedAtMs =
    typeof payload.lastObservedAtMs === "number" &&
    Number.isFinite(payload.lastObservedAtMs)
      ? payload.lastObservedAtMs
      : 0;
  return { userId: payload.userId, lastObservedAtMs };
}

function normalizeSyncLedger(value: unknown): WatchLibrarySyncLedgerRecord | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<WatchLibrarySyncLedgerRecord>;
  if (typeof payload.userId !== "string" || !payload.entries || typeof payload.entries !== "object") {
    return null;
  }

  const entries: WatchLibrarySyncLedger = {};
  for (const [key, observedAt] of Object.entries(payload.entries)) {
    if (typeof observedAt === "number" && Number.isFinite(observedAt) && observedAt > 0) {
      entries[key] = observedAt;
    }
  }
  return { userId: payload.userId, entries };
}

function assertWatchLibraryHttpResponse(
  response: WatchLibraryHttpMessageResponse | null | undefined,
): WatchLibraryHttpMessageResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Watch library bridge did not return a response");
  }
  return response;
}

function watchLibraryBridgeError(response: Extract<WatchLibraryHttpMessageResponse, { ok: false }>): RoomApiError {
  return new RoomApiError(response.error, response.code, response.resetAt);
}

function isWatchProgressEntryLike(value: unknown): value is WatchProgressReconcileEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Partial<WatchProgressReconcileEntry>;
  return (
    typeof entry.provider === "string" &&
    (entry.kind === "episode" || entry.kind === "movie") &&
    typeof entry.itemId === "string" &&
    typeof entry.itemTitle === "string" &&
    typeof entry.sourceUrl === "string" &&
    typeof entry.currentTime === "number" &&
    typeof entry.duration === "number"
  );
}
