import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import {
  createWebsiteRoomHeaders,
  RoomApiError,
  type CreatedRoom,
} from "./room-client";
import type {
  ResourceProvider,
  StoredWatchItem,
  WatchProgressEntry,
  WatchProgressStore,
} from "./watch-progress";

const WATCH_LIBRARY_HTTP_MESSAGE_TYPE = "ANIDACHI_WATCH_LIBRARY_HTTP";

export type WatchCheckpointKind =
  | "local"
  | "room"
  | "pause"
  | "seeked"
  | "ended"
  | "pagehide"
  | "reconcile"
  | "manual";

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

export type WatchLibraryHttpMessage =
  | {
      type: typeof WATCH_LIBRARY_HTTP_MESSAGE_TYPE;
      command: "list-library";
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
  if (
    message.type !== WATCH_LIBRARY_HTTP_MESSAGE_TYPE ||
    typeof message.accessToken !== "string"
  ) {
    return false;
  }
  if (message.command === "list-library") return true;
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
): WatchProgressReconcileEntry[] {
  const entries: WatchProgressReconcileEntry[] = [];
  for (const provider of Object.keys(store.providers) as ResourceProvider[]) {
    for (const item of Object.values(store.providers[provider]?.items ?? {})) {
      entries.push(...watchProgressEntriesFromItem(item, checkpointKind));
    }
  }
  return entries.sort((a, b) => Number(b.observedAt ?? 0) - Number(a.observedAt ?? 0)).slice(0, 100);
}

export async function listWatchLibraryFromApi(
  accessToken: string,
): Promise<WatchLibraryResponse> {
  logDebug("watch-library.http", "list watch library request", { webHttpBase: WEB_HTTP_BASE });
  const response = await fetch(new URL("/api/watch-library", WEB_HTTP_BASE), {
    headers: createWebsiteRoomHeaders(accessToken),
  });
  if (!response.ok) {
    throw await watchLibraryHttpError(response, "Failed to load watch library");
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
      return { ok: true, library: await listWatchLibraryFromApi(message.accessToken) };
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
      return { ok: false, error: error.message, code: error.code, resetAt: error.resetAt };
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

function watchProgressEntriesFromItem(
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

function assertWatchLibraryHttpResponse(
  response: WatchLibraryHttpMessageResponse | null | undefined,
): WatchLibraryHttpMessageResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Watch library bridge did not return a response");
  }
  return response;
}

function watchLibraryBridgeError(
  response: Extract<WatchLibraryHttpMessageResponse, { ok: false }>,
): RoomApiError {
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
