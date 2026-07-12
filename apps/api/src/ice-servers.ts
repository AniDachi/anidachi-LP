import { createPrivacySafeHmacId } from "./privacy-id";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServerEnv {
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_KEY_API_TOKEN?: string;
  CLOUDFLARE_TURN_TTL_SECONDS?: string;
}

export interface IceServersPayload {
  cache?: "fresh" | "stale-if-error";
  configured: boolean;
  iceServers: IceServer[];
  provider: "cloudflare" | "fallback";
  relay: IceServersRelaySummary;
  ttlSeconds: number;
}

export interface IceServersScope {
  now: number;
  roomId: string;
  userId: string;
}

export interface IceServersRelaySummary {
  hasStun: boolean;
  hasTurn: boolean;
  hasTurns443: boolean;
  stunUrlCount: number;
  turnUrlCount: number;
  turnsUrlCount: number;
}

const CLOUDFLARE_TURN_ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn/keys";
const DEFAULT_TURN_TTL_SECONDS = 15 * 60;
const MIN_TURN_TTL_SECONDS = 10 * 60;
const MAX_TURN_TTL_SECONDS = 30 * 60;
const TURN_CACHE_SAFETY_MS = 5 * 60 * 1000;

const TURN_CACHE_MAX_SCOPES = 64;
const TURN_CUSTOM_IDENTIFIER_DOMAIN = "anidachi:turn-credential:v1";

const FALLBACK_ICE_SERVERS: IceServer[] = [
  {
    urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"],
  },
];

interface CachedCloudflareIceServers {
  expiresAtMs: number;
  freshUntilMs: number;
  payload: IceServersPayload;
}

interface CloudflareIceServersResponse {
  iceServers?: unknown;
}

const cachedCloudflareIceServers = new Map<string, CachedCloudflareIceServers>();

export async function createIceServersPayload(
  env: IceServerEnv,
  scope: IceServersScope,
  fetcher: typeof fetch = fetch,
): Promise<IceServersPayload> {
  const ttlSeconds = parseTurnTtlSeconds(env.CLOUDFLARE_TURN_TTL_SECONDS);

  if (!scope.roomId || !scope.userId || !Number.isFinite(scope.now)) {
    throw new Error("Valid room/user TURN scope is required");
  }

  if (!env.CLOUDFLARE_TURN_KEY_ID || !env.CLOUDFLARE_TURN_KEY_API_TOKEN) {
    return {
      configured: false,
      iceServers: FALLBACK_ICE_SERVERS,
      provider: "fallback",
      relay: summarizeIceServersRelay(FALLBACK_ICE_SERVERS),
      ttlSeconds,
    };
  }

  const customIdentifier = `ani_${(
    await createPrivacySafeHmacId(
      env.CLOUDFLARE_TURN_KEY_API_TOKEN,
      TURN_CUSTOM_IDENTIFIER_DOMAIN,
      [scope.roomId, scope.userId],
    )
  ).slice(0, 40)}`;
  const cacheKey = `${env.CLOUDFLARE_TURN_KEY_ID}:${customIdentifier}`;
  const now = scope.now;
  const freshCachedPayload = readCachedCloudflarePayload(cacheKey, now, "fresh");
  if (freshCachedPayload) {
    return { ...freshCachedPayload, cache: "fresh" };
  }

  try {
    const response = await fetcher(
      `${CLOUDFLARE_TURN_ENDPOINT}/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_TURN_KEY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: ttlSeconds, customIdentifier }),
      },
    );

    if (!response.ok) {
      throw new Error(`Cloudflare TURN credentials failed: ${response.status}`);
    }

    const payload = (await response.json()) as CloudflareIceServersResponse;
    const iceServers = dropEmptyIceServers(
      filterBrowserBlockedTurnUrls(normalizeIceServers(payload.iceServers)),
    );
    if (!iceServers.length) {
      throw new Error("Cloudflare TURN response did not include usable iceServers.");
    }
    const relay = summarizeIceServersRelay(iceServers);
    if (!relay.hasTurn) {
      throw new Error("Cloudflare TURN response did not include usable TURN URLs after filtering.");
    }

    const iceServersPayload = {
      configured: true,
      iceServers,
      provider: "cloudflare" as const,
      relay,
      ttlSeconds,
    };
    writeCachedCloudflarePayload(cacheKey, iceServersPayload, now);
    return iceServersPayload;
  } catch (error) {
    const validCachedPayload = readCachedCloudflarePayload(cacheKey, now, "valid");
    if (validCachedPayload) {
      return { ...validCachedPayload, cache: "stale-if-error" };
    }

    throw error;
  }
}

export function parseTurnTtlSeconds(value: string | undefined): number {
  if (!value) {
    return DEFAULT_TURN_TTL_SECONDS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TURN_TTL_SECONDS;
  }

  return Math.max(MIN_TURN_TTL_SECONDS, Math.min(MAX_TURN_TTL_SECONDS, parsed));
}

function normalizeIceServers(value: unknown): IceServer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isIceServer).map((server) => {
    const normalized: IceServer = { urls: normalizeUrls(server.urls) };
    if (typeof server.username === "string") {
      normalized.username = server.username;
    }
    if (typeof server.credential === "string") {
      normalized.credential = server.credential;
    }
    return normalized;
  });
}

function isIceServer(value: unknown): value is IceServer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const urls = (value as IceServer).urls;
  return (
    typeof urls === "string" ||
    (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === "string"))
  );
}

function normalizeUrls(urls: string | string[]): string | string[] {
  return Array.isArray(urls) ? urls.filter(Boolean) : urls;
}

function filterBrowserBlockedTurnUrls(servers: IceServer[]): IceServer[] {
  return servers.map((server) => {
    const urls = Array.isArray(server.urls)
      ? server.urls.filter((url) => !isBrowserBlockedTurnUrl(url))
      : server.urls;
    return { ...server, urls };
  });
}

function dropEmptyIceServers(servers: IceServer[]): IceServer[] {
  return servers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some(Boolean);
  });
}

function isBrowserBlockedTurnUrl(url: string): boolean {
  return /^turns?:[^?]+:53(?:\?|$)/i.test(url);
}

export function summarizeIceServersRelay(servers: IceServer[]): IceServersRelaySummary {
  let stunUrlCount = 0;
  let turnUrlCount = 0;
  let turnsUrlCount = 0;
  let hasTurns443 = false;

  for (const server of servers) {
    for (const url of getIceServerUrls(server)) {
      if (/^stuns?:/i.test(url)) {
        stunUrlCount += 1;
      } else if (/^turn:/i.test(url)) {
        turnUrlCount += 1;
      } else if (/^turns:/i.test(url)) {
        turnsUrlCount += 1;
        hasTurns443 ||= /^turns:[^?]+:443(?:\?|$)/i.test(url);
      }
    }
  }

  return {
    hasStun: stunUrlCount > 0,
    hasTurn: turnUrlCount + turnsUrlCount > 0,
    hasTurns443,
    stunUrlCount,
    turnUrlCount,
    turnsUrlCount,
  };
}

function getIceServerUrls(server: IceServer): string[] {
  return Array.isArray(server.urls) ? server.urls : [server.urls];
}

function readCachedCloudflarePayload(
  cacheKey: string,
  nowMs: number,
  mode: "fresh" | "valid",
): IceServersPayload | null {
  pruneCloudflareIceServerCache(nowMs);
  const cached = cachedCloudflareIceServers.get(cacheKey);
  if (!cached) {
    return null;
  }

  const validUntilMs = mode === "fresh" ? cached.freshUntilMs : cached.expiresAtMs;
  if (validUntilMs <= nowMs) {
    return null;
  }

  cachedCloudflareIceServers.delete(cacheKey);
  cachedCloudflareIceServers.set(cacheKey, cached);
  return {
    ...cloneIceServersPayload(cached.payload),
    ttlSeconds: Math.max(1, Math.ceil((cached.expiresAtMs - nowMs) / 1000)),
  };
}

function writeCachedCloudflarePayload(
  cacheKey: string,
  payload: IceServersPayload,
  nowMs: number,
): void {
  const expiresAtMs = nowMs + payload.ttlSeconds * 1000;
  cachedCloudflareIceServers.delete(cacheKey);
  cachedCloudflareIceServers.set(cacheKey, {
    expiresAtMs,
    freshUntilMs: Math.max(nowMs, expiresAtMs - TURN_CACHE_SAFETY_MS),
    payload: cloneIceServersPayload(payload),
  });
  pruneCloudflareIceServerCache(nowMs);
  while (cachedCloudflareIceServers.size > TURN_CACHE_MAX_SCOPES) {
    const oldestKey = cachedCloudflareIceServers.keys().next().value;
    if (oldestKey === undefined) break;
    cachedCloudflareIceServers.delete(oldestKey);
  }
}

function pruneCloudflareIceServerCache(nowMs: number): void {
  for (const [key, cached] of cachedCloudflareIceServers) {
    if (cached.expiresAtMs <= nowMs) {
      cachedCloudflareIceServers.delete(key);
    }
  }
}

function cloneIceServersPayload(payload: IceServersPayload): IceServersPayload {
  return {
    ...payload,
    iceServers: payload.iceServers.map((server) => ({
      ...server,
      urls: Array.isArray(server.urls) ? [...server.urls] : server.urls,
    })),
    relay: { ...payload.relay },
  };
}

export function clearIceServersCacheForTest(): void {
  cachedCloudflareIceServers.clear();
}

export function getIceServersCacheSizeForTest(): number {
  return cachedCloudflareIceServers.size;
}
