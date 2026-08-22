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
  let body: unknown;
  try {
    ({ response, body } = await fetchAndReadJsonWithBoundedTimeout(
      fetchImplementation,
      new URL(`/api/internal/rooms/${encodeURIComponent(roomId)}/ended`, config.baseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      },
      timeoutMs,
    ));
  } catch {
    throw new Error("Room lifecycle Web callback request failed");
  }
  if (!response.ok) {
    throw new Error(`Room lifecycle Web callback failed (${response.status})`);
  }

  const acknowledgement = body as Record<string, unknown> | null;
  if (
    acknowledgement?.ok !== true ||
    acknowledgement.usageFinalized !== true ||
    (command.eventId !== undefined && acknowledgement.eventId !== command.eventId)
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
  let body: unknown;
  try {
    ({ response, body } = await fetchAndReadJsonWithBoundedTimeout(
      fetchImplementation,
      new URL(`/api/internal/rooms/${encodeURIComponent(roomId)}/source`, config.baseUrl),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedCallback.data),
      },
      timeoutMs,
    ));
  } catch {
    throw new Error("Room source Web callback request failed");
  }
  if (!response.ok) {
    throw new Error(`Room source Web callback failed (${response.status})`);
  }

  const acknowledgement = RoomSourcePersistenceAcknowledgementSchema.safeParse(
    body,
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

async function fetchAndReadJsonWithBoundedTimeout(
  fetchImplementation: typeof fetch,
  input: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ body: unknown; response: Response }> {
  const controller = new AbortController();
  let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      void bodyReader?.cancel().catch(() => undefined);
      reject(new Error("Internal Web callback deadline exceeded"));
    }, boundedInternalWebCallbackTimeout(timeoutMs));
  });
  const operation = (async () => {
    const response = await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { body: null, response };
    }
    const body = await readJsonResponseBody(response, (reader) => {
      bodyReader = reader;
    });
    return { body, response };
  })();
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function readJsonResponseBody(
  response: Response,
  captureReader: (reader: ReadableStreamDefaultReader<Uint8Array>) => void,
): Promise<unknown> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  captureReader(reader);
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
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
