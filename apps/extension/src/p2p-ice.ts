import { API_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { getDefaultP2PIceServers, getDirectP2PStunServers } from "./p2p-media";

interface IceServersPayload {
  configured?: boolean;
  iceServers?: unknown;
  provider?: string;
  relay?: {
    hasStun?: boolean;
    hasTurn?: boolean;
    hasTurns443?: boolean;
    stunUrlCount?: number;
    turnUrlCount?: number;
    turnsUrlCount?: number;
  };
  ttlSeconds?: number;
}

const ICE_SERVER_CACHE_SAFETY_MS = 5 * 60 * 1000;
const ICE_SERVER_CACHE_MAX_SCOPES = 8;

interface CachedIceServers {
  expiresAtMs: number;
  freshUntilMs: number;
  iceServers: RTCIceServer[];
}

const cachedIceServersByScope = new Map<string, CachedIceServers>();

/** Room credentials required to fetch authenticated TURN/STUN servers (Block 7.1). */
export interface IceServersAuth {
  roomId: string;
  roomToken: string;
}

export async function loadP2PIceServers(auth?: IceServersAuth): Promise<RTCIceServer[]> {
  return loadP2PIceServersWithCache(false, auth);
}

export async function refreshP2PIceServers(auth?: IceServersAuth): Promise<RTCIceServer[]> {
  return loadP2PIceServersWithCache(true, auth);
}

function buildIceServersRequest(auth?: IceServersAuth): {
  headers: Record<string, string>;
  url: string;
} {
  if (!auth) {
    return {
      headers: { Accept: "application/json" },
      url: new URL(`${API_HTTP_BASE}/ice-servers`).toString(),
    };
  }

  return {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${auth.roomToken}`,
    },
    url: new URL(`/rooms/${encodeURIComponent(auth.roomId)}/ice-servers`, API_HTTP_BASE).toString(),
  };
}

async function loadP2PIceServersWithCache(
  forceRefresh: boolean,
  auth?: IceServersAuth,
): Promise<RTCIceServer[]> {
  const now = Date.now();
  const scopeKey = await iceServerCacheScopeKey(auth);
  const freshCache = readCachedIceServers(scopeKey, now, "fresh");
  if (!forceRefresh && freshCache?.length && (!auth || hasTurnServer(freshCache))) {
    return freshCache;
  }

  try {
    const request = buildIceServersRequest(auth);
    const response = await fetch(request.url, {
      headers: request.headers,
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`ICE server endpoint failed: ${response.status}`);
    }

    const payload = (await response.json()) as IceServersPayload;
    const iceServers = prioritizeDirectIceServers(
      normalizeIceServers(payload.iceServers),
      getDirectP2PStunServers(),
    );
    if (!iceServers.length) {
      throw new Error("ICE server endpoint returned no usable iceServers.");
    }

    const ttlSeconds =
      typeof payload.ttlSeconds === "number" && Number.isFinite(payload.ttlSeconds)
        ? payload.ttlSeconds
        : 900;
    writeCachedIceServers(scopeKey, iceServers, ttlSeconds, now);
    logDebug("p2p.ice-config", "loaded", {
      configured: payload.configured,
      forceRefresh,
      provider: payload.provider,
      relay: payload.relay,
      ttlSeconds,
      iceServers: summarizeIceServers(iceServers),
    });
    return iceServers;
  } catch (error) {
    const validCache = readCachedIceServers(scopeKey, now, "valid");
    if (validCache?.length && hasTurnServer(validCache)) {
      logDebug("p2p.ice-config", "cached relay fallback", {
        error: error instanceof Error ? error.message : String(error),
        forceRefresh,
        iceServers: summarizeIceServers(validCache),
      });
      return validCache;
    }

    const fallback = getDefaultP2PIceServers();
    if (auth && !hasTurnServer(fallback)) {
      logDebug("p2p.ice-config", "relay unavailable", {
        error: error instanceof Error ? error.message : String(error),
        forceRefresh,
        iceServers: summarizeIceServers(fallback),
      });
      throw error;
    }

    writeCachedIceServers(scopeKey, fallback, 60, now);
    logDebug("p2p.ice-config", "fallback", {
      error: error instanceof Error ? error.message : String(error),
      forceRefresh,
      iceServers: summarizeIceServers(fallback),
    });
    return fallback;
  }
}

function normalizeIceServers(value: unknown): RTCIceServer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isIceServer).map((server) => ({
    urls: server.urls,
    username: typeof server.username === "string" ? server.username : undefined,
    credential: typeof server.credential === "string" ? server.credential : undefined,
  }));
}

export function prioritizeDirectIceServers(
  primaryServers: RTCIceServer[],
  extraStunServers: RTCIceServer[],
): RTCIceServer[] {
  const merged = [...primaryServers, ...extraStunServers]
    .flatMap(splitIceServerByUrlKind)
    .filter((server) => getIceServerUrls(server).length > 0);
  const deduped = dedupeIceServers(merged);
  return [
    ...deduped.filter((server) => isStunOnlyIceServer(server)),
    ...deduped.filter((server) => !isStunOnlyIceServer(server)),
  ];
}

function splitIceServerByUrlKind(server: RTCIceServer): RTCIceServer[] {
  const urls = getIceServerUrls(server);
  const stunUrls = urls.filter((url) => /^stuns?:/i.test(url));
  const turnUrls = urls.filter((url) => /^turns?:/i.test(url));
  const otherUrls = urls.filter((url) => !/^stuns?:|^turns?:/i.test(url));
  const split: RTCIceServer[] = [];
  if (stunUrls.length) {
    split.push({ urls: stunUrls });
  }
  if (turnUrls.length) {
    split.push({
      urls: turnUrls,
      username: server.username,
      credential: server.credential,
    });
  }
  if (otherUrls.length) {
    split.push({ urls: otherUrls });
  }
  return split;
}

function dedupeIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  const seenUrls = new Set<string>();
  const deduped: RTCIceServer[] = [];
  for (const server of servers) {
    const urls = getIceServerUrls(server).filter((url) => {
      const key = url.toLowerCase();
      if (seenUrls.has(key)) {
        return false;
      }

      seenUrls.add(key);
      return true;
    });
    if (!urls.length) {
      continue;
    }

    deduped.push({
      urls,
      username: server.username,
      credential: server.credential,
    });
  }
  return deduped;
}

function isStunOnlyIceServer(server: RTCIceServer): boolean {
  const urls = getIceServerUrls(server);
  return urls.length > 0 && urls.every((url) => /^stuns?:/i.test(url));
}

function getIceServerUrls(server: RTCIceServer): string[] {
  return Array.isArray(server.urls) ? server.urls : [server.urls];
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const urls = (value as RTCIceServer).urls;
  return (
    typeof urls === "string" ||
    (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string"))
  );
}

function hasTurnServer(servers: RTCIceServer[]): boolean {
  return servers.some((server) => getIceServerUrls(server).some((url) => /^turns?:/i.test(url)));
}

function summarizeIceServers(servers: RTCIceServer[]): Array<Record<string, unknown>> {
  return servers.map((server) => ({
    urls: server.urls,
    hasUsername: Boolean(server.username),
    hasCredential: Boolean(server.credential),
  }));
}

export function clearP2PIceServersCacheForTest(): void {
  cachedIceServersByScope.clear();
}

async function iceServerCacheScopeKey(auth: IceServersAuth | undefined): Promise<string> {
  if (!auth) {
    return "anonymous";
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`anidachi:ice-cache-scope:v1\0${auth.roomId}\0${auth.roomToken}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCachedIceServers(
  scopeKey: string,
  nowMs: number,
  mode: "fresh" | "valid",
): RTCIceServer[] | null {
  pruneIceServerCache(nowMs);
  const cached = cachedIceServersByScope.get(scopeKey);
  if (!cached) return null;
  const validUntilMs = mode === "fresh" ? cached.freshUntilMs : cached.expiresAtMs;
  if (validUntilMs <= nowMs) return null;

  cachedIceServersByScope.delete(scopeKey);
  cachedIceServersByScope.set(scopeKey, cached);
  return cloneIceServers(cached.iceServers);
}

function writeCachedIceServers(
  scopeKey: string,
  iceServers: RTCIceServer[],
  ttlSeconds: number,
  nowMs: number,
): void {
  const ttlMs = Math.max(1, ttlSeconds) * 1000;
  const expiresAtMs = nowMs + ttlMs;
  const safetyMs = Math.min(ICE_SERVER_CACHE_SAFETY_MS, Math.floor(ttlMs / 3));
  cachedIceServersByScope.delete(scopeKey);
  cachedIceServersByScope.set(scopeKey, {
    expiresAtMs,
    freshUntilMs: Math.max(nowMs, expiresAtMs - safetyMs),
    iceServers: cloneIceServers(iceServers),
  });
  pruneIceServerCache(nowMs);
  while (cachedIceServersByScope.size > ICE_SERVER_CACHE_MAX_SCOPES) {
    const oldestKey = cachedIceServersByScope.keys().next().value;
    if (oldestKey === undefined) break;
    cachedIceServersByScope.delete(oldestKey);
  }
}

function pruneIceServerCache(nowMs: number): void {
  for (const [scopeKey, cached] of cachedIceServersByScope) {
    if (cached.expiresAtMs <= nowMs) {
      cachedIceServersByScope.delete(scopeKey);
    }
  }
}

function cloneIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  return servers.map((server) => ({
    ...server,
    urls: Array.isArray(server.urls) ? [...server.urls] : server.urls,
  }));
}
