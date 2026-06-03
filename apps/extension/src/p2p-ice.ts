import { API_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { getDefaultP2PIceServers, getDirectP2PStunServers } from "./p2p-media";

interface IceServersPayload {
  configured?: boolean;
  iceServers?: unknown;
  provider?: string;
  ttlSeconds?: number;
}

let cachedIceServers: RTCIceServer[] | null = null;
let cachedUntilMs = 0;

const ICE_SERVER_CACHE_SAFETY_MS = 5 * 60 * 1000;

export async function loadP2PIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cachedIceServers?.length && cachedUntilMs > now) {
    return cachedIceServers;
  }

  try {
    const response = await fetch(`${API_HTTP_BASE}/ice-servers`, {
      headers: { Accept: "application/json" },
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
        : 3600;
    cachedIceServers = iceServers;
    cachedUntilMs = now + Math.max(60_000, ttlSeconds * 1000 - ICE_SERVER_CACHE_SAFETY_MS);
    logDebug("p2p.ice-config", "loaded", {
      configured: payload.configured,
      provider: payload.provider,
      ttlSeconds,
      iceServers: summarizeIceServers(iceServers),
    });
    return iceServers;
  } catch (error) {
    const fallback = getDefaultP2PIceServers();
    cachedIceServers = fallback;
    cachedUntilMs = now + 60_000;
    logDebug("p2p.ice-config", "fallback", {
      error: error instanceof Error ? error.message : String(error),
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

function summarizeIceServers(servers: RTCIceServer[]): Array<Record<string, unknown>> {
  return servers.map((server) => ({
    urls: server.urls,
    hasUsername: Boolean(server.username),
    hasCredential: Boolean(server.credential),
  }));
}
