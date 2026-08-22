import {
  RoomSourcePersistenceAcknowledgementSchema,
  RoomSourcePersistenceCallbackSchema,
  type RoomSourcePersistenceCallback,
  type RoomUsageSummary,
} from "@anidachi/protocol";
import type { EndRoomCommand } from "./room-lifecycle";

export interface InternalWebLifecycleEnv {
  ANIDACHI_INTERNAL_API_SECRET?: string;
  ANIDACHI_WEB_INTERNAL_BASE_URL?: string;
}

export const INTERNAL_WEB_CALLBACK_TIMEOUT_MS = 8_000;
const INTERNAL_WEB_CALLBACK_MAX_TIMEOUT_MS = 15_000;

type RoomEndCallback = EndRoomCommand & {
  eventId?: string;
  usage?: RoomUsageSummary;
};

export async function notifyWebRoomEnded(
  env: InternalWebLifecycleEnv,
  roomId: string,
  command: RoomEndCallback,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = INTERNAL_WEB_CALLBACK_TIMEOUT_MS,
): Promise<void> {
  const config = internalWebCallbackConfig(env);
  let response: Response;
  try {
    response = await fetchImplementation(
      new URL(`/api/internal/rooms/${encodeURIComponent(roomId)}/ended`, config.baseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(boundedInternalWebCallbackTimeout(timeoutMs)),
      },
    );
  } catch {
    throw new Error("Room lifecycle Web callback request failed");
  }
  if (!response.ok) {
    throw new Error(`Room lifecycle Web callback failed (${response.status})`);
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    body?.ok !== true ||
    body.usageFinalized !== true ||
    (command.eventId !== undefined && body.eventId !== command.eventId)
  ) {
    throw new Error("Room lifecycle Web callback returned an invalid acknowledgement");
  }
}

export async function notifyWebRoomSource(
  env: InternalWebLifecycleEnv,
  roomId: string,
  callback: RoomSourcePersistenceCallback,
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = INTERNAL_WEB_CALLBACK_TIMEOUT_MS,
): Promise<void> {
  const config = internalWebCallbackConfig(env);
  const parsedCallback = RoomSourcePersistenceCallbackSchema.safeParse(callback);
  if (!parsedCallback.success || parsedCallback.data.roomId !== roomId) {
    throw new Error("Room source Web callback received an invalid callback");
  }

  let response: Response;
  try {
    response = await fetchImplementation(
      new URL(`/api/internal/rooms/${encodeURIComponent(roomId)}/source`, config.baseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedCallback.data),
        signal: AbortSignal.timeout(boundedInternalWebCallbackTimeout(timeoutMs)),
      },
    );
  } catch {
    throw new Error("Room source Web callback request failed");
  }
  if (!response.ok) {
    throw new Error(`Room source Web callback failed (${response.status})`);
  }

  const acknowledgement = RoomSourcePersistenceAcknowledgementSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (
    !acknowledgement.success ||
    acknowledgement.data.sourceGeneration !== parsedCallback.data.sourceGeneration
  ) {
    throw new Error("Room source Web callback returned an invalid acknowledgement");
  }
}

function boundedInternalWebCallbackTimeout(timeoutMs: number): number {
  return Number.isFinite(timeoutMs)
    ? Math.max(1, Math.min(INTERNAL_WEB_CALLBACK_MAX_TIMEOUT_MS, Math.floor(timeoutMs)))
    : INTERNAL_WEB_CALLBACK_TIMEOUT_MS;
}

function internalWebCallbackConfig(env: InternalWebLifecycleEnv): {
  baseUrl: URL;
  secret: string;
} {
  const secret = env.ANIDACHI_INTERNAL_API_SECRET;
  const rawBaseUrl = env.ANIDACHI_WEB_INTERNAL_BASE_URL;
  if (!secret || !rawBaseUrl) {
    throw new Error("Room lifecycle Web callback is not configured");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("Room lifecycle Web callback is not configured");
  }
  const secureTransport = baseUrl.protocol === "https:" || (
    baseUrl.protocol === "http:" && isLoopbackHostname(baseUrl.hostname)
  );
  if (
    !secureTransport ||
    baseUrl.username !== "" ||
    baseUrl.password !== "" ||
    baseUrl.hash !== "" ||
    baseUrl.search !== "" ||
    baseUrl.pathname !== "/"
  ) {
    throw new Error("Room lifecycle Web callback is not configured");
  }
  return { baseUrl, secret };
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
}
