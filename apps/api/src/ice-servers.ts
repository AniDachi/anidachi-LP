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
  configured: boolean;
  iceServers: IceServer[];
  provider: "cloudflare" | "fallback";
  ttlSeconds: number;
}

const CLOUDFLARE_TURN_ENDPOINT = "https://rtc.live.cloudflare.com/v1/turn/keys";
const DEFAULT_TURN_TTL_SECONDS = 12 * 60 * 60;
const MIN_TURN_TTL_SECONDS = 10 * 60;
const MAX_TURN_TTL_SECONDS = 24 * 60 * 60;

const FALLBACK_ICE_SERVERS: IceServer[] = [
  {
    urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"],
  },
];

interface CloudflareIceServersResponse {
  iceServers?: unknown;
}

export async function createIceServersPayload(
  env: IceServerEnv,
  fetcher: typeof fetch = fetch,
): Promise<IceServersPayload> {
  const ttlSeconds = parseTurnTtlSeconds(env.CLOUDFLARE_TURN_TTL_SECONDS);

  if (!env.CLOUDFLARE_TURN_KEY_ID || !env.CLOUDFLARE_TURN_KEY_API_TOKEN) {
    return {
      configured: false,
      iceServers: FALLBACK_ICE_SERVERS,
      provider: "fallback",
      ttlSeconds,
    };
  }

  const response = await fetcher(
    `${CLOUDFLARE_TURN_ENDPOINT}/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: ttlSeconds }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudflare TURN credentials failed: ${response.status}`);
  }

  const payload = (await response.json()) as CloudflareIceServersResponse;
  const iceServers = normalizeIceServers(payload.iceServers);
  if (!iceServers.length) {
    throw new Error("Cloudflare TURN response did not include usable iceServers.");
  }

  return {
    configured: true,
    iceServers: filterBrowserBlockedTurnUrls(iceServers),
    provider: "cloudflare",
    ttlSeconds,
  };
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

function isBrowserBlockedTurnUrl(url: string): boolean {
  return /^turns?:[^?]+:53(?:\?|$)/i.test(url);
}
