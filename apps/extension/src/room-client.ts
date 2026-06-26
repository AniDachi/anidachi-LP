import {
  ClientEventSchema,
  RoomCapabilitiesSchema,
  ServerEventSchema,
  type ClientEvent,
  type Participant,
  type RoomCapabilities,
  type ServerEvent,
} from "@anidachi/protocol";
import { API_WS_BASE, WEB_HTTP_BASE } from "./constants";
import { logDebug, roomEventDebugSnapshot } from "./debug-log";

export type RoomConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface RoomClientOptions {
  roomId: string;
  roomToken: string;
  participant: Participant;
  videoFingerprint: string;
  lastSeenP2PServerSeq?: number;
  participantSessionId?: string;
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: RoomConnectionStatus) => void;
}

/** Free-plan daily quota summary attached to room API responses (PD2). */
export interface RoomQuotaSummary {
  remainingSeconds: number;
  resetAt: string;
}

export interface CreatedRoom {
  roomId: string;
  roomToken: string;
  shareableLink: string;
  /** True when an idempotent retry returned the already-created room. */
  reused?: boolean;
  capabilities?: RoomCapabilities;
  quota?: RoomQuotaSummary | null;
}

export interface CreateRoomInput {
  sourceUrl?: string;
  videoFingerprint?: string;
  title?: string | null;
  showId?: string;
  episodeId?: string;
  /** Per-click idempotency key; retries with the same id reuse the room. */
  clientRequestId?: string;
}

/** Room API error that keeps the machine-readable code across the bridge. */
export class RoomApiError extends Error {
  readonly code?: string;
  readonly resetAt?: string;
  readonly status?: number;

  constructor(message: string, code?: string, resetAt?: string, status?: number) {
    super(message);
    this.name = "RoomApiError";
    this.code = code;
    this.resetAt = resetAt;
    this.status = status;
  }
}

export function isQuotaExhaustedError(error: unknown): error is RoomApiError {
  return error instanceof RoomApiError && error.code === "QUOTA_EXHAUSTED";
}

export function isTerminalRoomJoinError(error: unknown): error is RoomApiError {
  return (
    error instanceof RoomApiError &&
    error.code !== "QUOTA_EXHAUSTED" &&
    (error.status === 403 || error.status === 404)
  );
}

const ROOM_HTTP_MESSAGE_TYPE = "ANIDACHI_ROOM_HTTP";
const ROOM_KEEPALIVE_INTERVAL_MS = 20_000;
const ROOM_KEEPALIVE_TIMEOUT_MS = 45_000;

export type RoomHttpCommand = "create-room" | "connect-room" | "end-room";

export type RoomHttpMessage =
  | {
      type: typeof ROOM_HTTP_MESSAGE_TYPE;
      command: "create-room";
      accessToken: string;
      input?: CreateRoomInput;
    }
  | {
      type: typeof ROOM_HTTP_MESSAGE_TYPE;
      command: "connect-room";
      accessToken: string;
      roomId: string;
    }
  | {
      type: typeof ROOM_HTTP_MESSAGE_TYPE;
      command: "end-room";
      accessToken: string;
      roomId: string;
    };

export type RoomHttpMessageResponse =
  | { ok: true; room: CreatedRoom }
  | {
      ok: true;
      connection: {
        roomToken: string;
        capabilities?: RoomCapabilities;
        quota?: RoomQuotaSummary | null;
      };
    }
  | { ok: true; ended: { endedAt: string | null } }
  | { ok: false; error: string; code?: string; resetAt?: string; status?: number };

export function buildRoomWebSocketUrl(roomId: string, roomToken: string): string {
  const url = new URL(`${API_WS_BASE}/ws/${encodeURIComponent(roomId)}`);
  url.searchParams.set("roomToken", roomToken);
  return url.toString();
}

export function createWebsiteRoomHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function websiteRoomHttpError(response: Response, fallback: string): Promise<RoomApiError> {
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
    response.status,
  );
}

function parseQuotaSummary(value: unknown): RoomQuotaSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const quota = value as Record<string, unknown>;
  if (typeof quota.remainingSeconds !== "number" || typeof quota.resetAt !== "string") {
    return null;
  }
  return { remainingSeconds: quota.remainingSeconds, resetAt: quota.resetAt };
}

function parseRoomCapabilities(value: unknown): RoomCapabilities | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = RoomCapabilitiesSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function isCreateRoomInput(value: unknown): value is CreateRoomInput {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    (input.sourceUrl === undefined || typeof input.sourceUrl === "string") &&
    (input.videoFingerprint === undefined || typeof input.videoFingerprint === "string") &&
    (input.title === undefined || input.title === null || typeof input.title === "string") &&
    (input.showId === undefined || typeof input.showId === "string") &&
    (input.episodeId === undefined || typeof input.episodeId === "string") &&
    (input.clientRequestId === undefined || typeof input.clientRequestId === "string")
  );
}

export function createRoomHttpMessage(
  accessToken: string,
  input?: CreateRoomInput,
): RoomHttpMessage {
  return {
    type: ROOM_HTTP_MESSAGE_TYPE,
    command: "create-room",
    accessToken,
    input,
  };
}

export function connectRoomHttpMessage(roomId: string, accessToken: string): RoomHttpMessage {
  return {
    type: ROOM_HTTP_MESSAGE_TYPE,
    command: "connect-room",
    roomId,
    accessToken,
  };
}

export function endRoomHttpMessage(roomId: string, accessToken: string): RoomHttpMessage {
  return {
    type: ROOM_HTTP_MESSAGE_TYPE,
    command: "end-room",
    roomId,
    accessToken,
  };
}

export function isRoomHttpMessage(value: unknown): value is RoomHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<RoomHttpMessage>;
  if (message.type !== ROOM_HTTP_MESSAGE_TYPE) return false;
  if (message.command === "create-room") {
    return typeof message.accessToken === "string" && isCreateRoomInput(message.input);
  }
  if (message.command === "connect-room" || message.command === "end-room") {
    return typeof message.accessToken === "string" && typeof message.roomId === "string";
  }
  return false;
}

export async function createWebsiteRoomFromApi(
  accessToken: string,
  input?: CreateRoomInput,
): Promise<CreatedRoom> {
  logDebug("room.http", "create website room request", {
    webHttpBase: WEB_HTTP_BASE,
    hasSourceUrl: Boolean(input?.sourceUrl),
    videoFingerprint: input?.videoFingerprint,
  });
  const response = await fetch(new URL("/api/rooms", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify(input ?? {}),
  });

  if (!response.ok) {
    logDebug("room.http", "create website room failed", { status: response.status });
    throw await websiteRoomHttpError(response, "Failed to create website room");
  }

  const payload = (await response.json()) as {
    roomId: string;
    roomToken?: unknown;
    shareableLink?: unknown;
    reused?: unknown;
    capabilities?: unknown;
    quota?: unknown;
  };
  if (typeof payload.roomToken !== "string" || typeof payload.shareableLink !== "string") {
    throw new Error("Website room response is missing roomToken or shareableLink");
  }

  logDebug("room.http", "create website room success", {
    roomId: payload.roomId,
    reused: payload.reused === true,
  });
  return {
    roomId: payload.roomId,
    roomToken: payload.roomToken,
    shareableLink: payload.shareableLink,
    reused: payload.reused === true,
    capabilities: parseRoomCapabilities(payload.capabilities),
    quota: parseQuotaSummary(payload.quota),
  };
}

export async function connectWebsiteRoomFromApi(
  roomId: string,
  accessToken: string,
): Promise<{
  roomToken: string;
  capabilities?: RoomCapabilities;
  quota?: RoomQuotaSummary | null;
}> {
  logDebug("room.http", "connect website room request", { webHttpBase: WEB_HTTP_BASE, roomId });
  const response = await fetch(
    new URL(`/api/rooms/${encodeURIComponent(roomId)}/connect`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    logDebug("room.http", "connect website room failed", { roomId, status: response.status });
    throw await websiteRoomHttpError(response, "Failed to connect website room");
  }

  const payload = (await response.json()) as {
    roomToken?: unknown;
    capabilities?: unknown;
    quota?: unknown;
  };
  if (typeof payload.roomToken !== "string") {
    throw new Error("Website room connect response is missing roomToken");
  }
  return {
    roomToken: payload.roomToken,
    capabilities: parseRoomCapabilities(payload.capabilities),
    quota: parseQuotaSummary(payload.quota),
  };
}

export async function endWebsiteRoomFromApi(
  roomId: string,
  accessToken: string,
): Promise<{ endedAt: string | null }> {
  logDebug("room.http", "end website room request", { webHttpBase: WEB_HTTP_BASE, roomId });
  const response = await fetch(
    new URL(`/api/rooms/${encodeURIComponent(roomId)}/end`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    logDebug("room.http", "end website room failed", { roomId, status: response.status });
    throw await websiteRoomHttpError(response, "Failed to end room");
  }

  const payload = (await response.json()) as { endedAt?: unknown };
  return { endedAt: typeof payload.endedAt === "string" ? payload.endedAt : null };
}

export async function handleRoomHttpMessage(
  message: RoomHttpMessage,
): Promise<RoomHttpMessageResponse> {
  try {
    if (message.command === "create-room") {
      return { ok: true, room: await createWebsiteRoomFromApi(message.accessToken, message.input) };
    }
    if (message.command === "end-room") {
      return {
        ok: true,
        ended: await endWebsiteRoomFromApi(message.roomId, message.accessToken),
      };
    }
    return {
      ok: true,
      connection: await connectWebsiteRoomFromApi(message.roomId, message.accessToken),
    };
  } catch (error) {
    if (error instanceof RoomApiError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
        resetAt: error.resetAt,
        status: error.status,
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Room request failed",
    };
  }
}

async function sendRoomHttpMessage(message: RoomHttpMessage): Promise<RoomHttpMessageResponse> {
  return chrome.runtime.sendMessage(message);
}

function assertRoomHttpResponse(
  response: RoomHttpMessageResponse | null | undefined,
): RoomHttpMessageResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Room bridge did not return a response");
  }
  return response;
}

function bridgeError(response: Extract<RoomHttpMessageResponse, { ok: false }>): RoomApiError {
  return new RoomApiError(response.error, response.code, response.resetAt, response.status);
}

export async function createRoom(accessToken: string, input?: CreateRoomInput): Promise<CreatedRoom> {
  logDebug("room.http", "create room through background bridge", { webHttpBase: WEB_HTTP_BASE });
  const response = assertRoomHttpResponse(
    await sendRoomHttpMessage(createRoomHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw bridgeError(response);
  if (!("room" in response)) throw new Error("Room bridge response is missing room");
  return response.room;
}

export async function connectWebsiteRoom(
  roomId: string,
  accessToken: string,
): Promise<{
  roomToken: string;
  capabilities?: RoomCapabilities;
  quota?: RoomQuotaSummary | null;
}> {
  logDebug("room.http", "connect room through background bridge", {
    webHttpBase: WEB_HTTP_BASE,
    roomId,
  });
  const response = assertRoomHttpResponse(
    await sendRoomHttpMessage(connectRoomHttpMessage(roomId, accessToken)),
  );
  if (!response.ok) throw bridgeError(response);
  if (!("connection" in response)) throw new Error("Room bridge response is missing connection");
  return response.connection;
}

export async function endRoom(
  roomId: string,
  accessToken: string,
): Promise<{ endedAt: string | null }> {
  logDebug("room.http", "end room through background bridge", {
    webHttpBase: WEB_HTTP_BASE,
    roomId,
  });
  const response = assertRoomHttpResponse(
    await sendRoomHttpMessage(endRoomHttpMessage(roomId, accessToken)),
  );
  if (!response.ok) throw bridgeError(response);
  if (!("ended" in response)) throw new Error("Room bridge response is missing ended");
  return response.ended;
}

export class RoomClient {
  private currentSenderConnectionId = createRoomConnectionId();
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private pendingEvents: ClientEvent[] = [];
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private ws: WebSocket | null = null;

  get senderConnectionId(): string {
    return this.currentSenderConnectionId;
  }

  connect(options: RoomClientOptions): void {
    this.close();
    this.currentSenderConnectionId = createRoomConnectionId();
    this.pendingEvents = [];
    options.onStatus("connecting");
    logDebug("room.ws", "connecting", {
      apiWsBase: API_WS_BASE,
      senderConnectionId: this.currentSenderConnectionId,
      roomId: options.roomId,
      participantId: options.participant.id,
      videoFingerprint: options.videoFingerprint,
    });

    const ws = new WebSocket(buildRoomWebSocketUrl(options.roomId, options.roomToken));
    this.ws = ws;

    ws.addEventListener("open", () => {
      if (this.ws !== ws) {
        return;
      }

      logDebug("room.ws", "open", {
        roomId: options.roomId,
        participantId: options.participant.id,
        senderConnectionId: this.currentSenderConnectionId,
      });
      options.onStatus("connected");
      const joinEvent: ClientEvent = {
        type: "JOIN",
        roomId: options.roomId,
        participant: options.participant,
        videoFingerprint: options.videoFingerprint,
      };
      if (options.lastSeenP2PServerSeq !== undefined) {
        joinEvent.lastSeenP2PServerSeq = options.lastSeenP2PServerSeq;
      }
      if (options.participantSessionId !== undefined) {
        joinEvent.participantSessionId = options.participantSessionId;
      }
      this.send(joinEvent);
      this.flushPendingEvents();
      this.startKeepalive(ws, options.roomId);
    });

    ws.addEventListener("message", (message) => {
      if (this.ws !== ws) {
        return;
      }

      try {
        const event = ServerEventSchema.parse(JSON.parse(String(message.data)));
        if (event.type === "PONG") {
          this.clearPongTimeout();
          return;
        }

        logDebug("room.recv", event.type, roomEventDebugSnapshot(event));
        options.onEvent(event);
      } catch (error) {
        logDebug("room.recv", "invalid server event", {
          error: error instanceof Error ? error.message : String(error),
          raw: String(message.data).slice(0, 500),
        });
        console.warn("[Anidachi] Ignoring invalid server event", error);
      }
    });

    ws.addEventListener("close", (event) => {
      if (this.ws !== ws) {
        return;
      }

      logDebug("room.ws", "closed", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      this.stopKeepalive();
      options.onStatus("closed");
    });
    ws.addEventListener("error", () => {
      if (this.ws !== ws) {
        return;
      }

      logDebug("room.ws", "error");
      this.stopKeepalive();
      options.onStatus("error");
    });
  }

  send(event: ClientEvent): void {
    const parsed = ClientEventSchema.parse(event);
    if (this.ws?.readyState === WebSocket.OPEN) {
      logDebug("room.send", parsed.type, roomEventDebugSnapshot(parsed));
      this.ws.send(JSON.stringify(parsed));
      return;
    }

    const shouldQueue = this.ws?.readyState === WebSocket.CONNECTING;
    if (shouldQueue) {
      this.pendingEvents = [...this.pendingEvents, parsed].slice(-40);
    }

    logDebug(
      "room.send",
      shouldQueue ? "queued until socket opens" : "dropped because socket is not open",
      {
        readyState: this.ws?.readyState ?? null,
        event: roomEventDebugSnapshot(parsed),
      },
    );
  }

  close(): void {
    this.stopKeepalive();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.pendingEvents = [];
  }

  private startKeepalive(ws: WebSocket, roomId: string): void {
    this.stopKeepalive();
    logDebug("room.ws", "keepalive started", { roomId });
    this.keepaliveInterval = setInterval(() => {
      this.sendPing(ws, roomId);
    }, ROOM_KEEPALIVE_INTERVAL_MS);
    this.sendPing(ws, roomId);
  }

  private stopKeepalive(): void {
    if (this.keepaliveInterval !== null) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
    this.clearPongTimeout();
  }

  private clearPongTimeout(): void {
    if (this.pongTimeout !== null) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private sendPing(ws: WebSocket, roomId: string): void {
    if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const event: ClientEvent = {
      type: "PING",
      roomId,
      sentAt: Date.now(),
    };
    ws.send(JSON.stringify(ClientEventSchema.parse(event)));

    if (this.pongTimeout !== null) {
      return;
    }

    this.pongTimeout = setTimeout(() => {
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      logDebug("room.ws", "pong timeout; closing socket for reconnect", { roomId });
      ws.close(4001, "Anidachi keepalive timeout");
    }, ROOM_KEEPALIVE_TIMEOUT_MS);
  }

  private flushPendingEvents(): void {
    const pending = this.pendingEvents;
    this.pendingEvents = [];
    for (const event of pending) {
      this.send(event);
    }
  }
}

function createRoomConnectionId(): string {
  return `connection-${crypto.randomUUID()}`;
}
