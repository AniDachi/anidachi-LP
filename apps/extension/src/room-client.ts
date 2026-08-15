import {
  ClientEventSchema,
  RoomCapabilitiesSchema,
  ServerEventSchema,
  type ClientEvent,
  type Participant,
  type RoomCapabilities,
  type RoomHistoryAuthority,
  type ServerEvent,
} from "@anidachi/protocol";
import { API_WS_BASE, WEB_HTTP_BASE } from "./constants";
import { logDebug, roomEventDebugSnapshot } from "./debug-log";
import type { RoomSendDisposition, SignalingTransportReady } from "./media-types";

export type RoomConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface RoomClientOptions {
  roomId: string;
  roomToken: string;
  participant: Participant;
  videoFingerprint: string;
  lastSeenP2PServerSeq?: number;
  participantSessionId?: string;
  reconnect?: boolean;
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: RoomConnectionStatus) => void;
  onHistoryAuthority?: (authority: RoomHistoryAuthority | null) => void;
  onTerminalClose?: () => void;
  onTransportReady?: (ready: SignalingTransportReady) => void;
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
const HIBERNATION_KEEPALIVE_PING = "ping";
const HIBERNATION_KEEPALIVE_PONG = "pong";
export const ROOM_ENDED_CLOSE_CODE = 4004;

export function isTerminalRoomCloseCode(code: number): boolean {
  return code === ROOM_ENDED_CLOSE_CODE;
}

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
  private currentHistoryAuthority: RoomHistoryAuthority | null = null;
  private currentHistoryBoundary: {
    roomId: string;
    participantSessionId: string;
    roomGeneration: number;
    sourceGeneration: number;
  } | null = null;
  private currentHistoryConnection: {
    roomId: string;
    participantSessionId: string;
  } | null = null;
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private pendingEvents: ClientEvent[] = [];
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentStatusPublisher: ((status: RoomConnectionStatus) => void) | null = null;
  private ws: WebSocket | null = null;

  get senderConnectionId(): string {
    return this.currentSenderConnectionId;
  }

  get historyAuthority(): RoomHistoryAuthority | null {
    return this.currentHistoryAuthority;
  }

  connect(options: RoomClientOptions): void {
    this.closeSocket("reconnect", false);
    const historyConnection = options.participantSessionId
      ? { roomId: options.roomId, participantSessionId: options.participantSessionId }
      : null;
    const sameHistoryConnection = historyConnection !== null &&
      this.currentHistoryConnection?.roomId === historyConnection.roomId &&
      this.currentHistoryConnection.participantSessionId === historyConnection.participantSessionId;
    if (!sameHistoryConnection) {
      this.currentHistoryAuthority = null;
      this.currentHistoryBoundary = null;
    }
    this.currentHistoryConnection = historyConnection;
    const senderConnectionId = createRoomConnectionId();
    this.currentSenderConnectionId = senderConnectionId;
    this.pendingEvents = [];
    let lastStatus: RoomConnectionStatus = "idle";
    const publishStatus = (status: RoomConnectionStatus): void => {
      if (lastStatus === status) return;
      lastStatus = status;
      options.onStatus(status);
    };
    this.currentStatusPublisher = publishStatus;
    publishStatus("connecting");
    logDebug("room.ws", "connecting", {
      apiWsBase: API_WS_BASE,
      senderConnectionId,
      roomId: options.roomId,
      participantId: options.participant.id,
      participantSessionId: options.participantSessionId,
      videoFingerprint: options.videoFingerprint,
    });

    const ws = new WebSocket(buildRoomWebSocketUrl(options.roomId, options.roomToken));
    this.ws = ws;
    let socketClosed = false;
    let transportReadyPublished = false;

    ws.addEventListener("open", () => {
      if (this.ws !== ws || socketClosed) {
        return;
      }

      logDebug("room.ws", "open", {
        roomId: options.roomId,
        participantId: options.participant.id,
        participantSessionId: options.participantSessionId,
        senderConnectionId,
      });
      publishStatus("connected");
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
      if (this.ws !== ws || socketClosed) {
        return;
      }

      try {
        if (String(message.data) === HIBERNATION_KEEPALIVE_PONG) {
          this.clearPongTimeout();
          return;
        }
        const event = ServerEventSchema.parse(JSON.parse(String(message.data)));
        if (event.type === "PONG") {
          this.clearPongTimeout();
          return;
        }

        logDebug("room.recv", event.type, roomEventDebugSnapshot(event));
        this.consumeHistoryAuthorityEvent(event, options);
        options.onEvent(event);
        if (
          event.type === "ROOM_SNAPSHOT" &&
          !transportReadyPublished &&
          this.ws === ws &&
          !socketClosed
        ) {
          transportReadyPublished = true;
          options.onTransportReady?.({
            senderConnectionId,
            reconnect: options.reconnect === true,
            ...(event.p2pResyncRequired ? { forceMediaResync: true } : {}),
          });
        }
      } catch (error) {
        logDebug("room.recv", "invalid server event", {
          error: error instanceof Error ? error.message : String(error),
          raw: String(message.data).slice(0, 500),
        });
      }
    });

    ws.addEventListener("close", (event) => {
      if (this.ws !== ws) {
        return;
      }

      socketClosed = true;
      logDebug("room.ws", "closed", {
        code: event.code,
        participantId: options.participant.id,
        participantSessionId: options.participantSessionId,
        reason: event.reason,
        roomId: options.roomId,
        senderConnectionId,
        wasClean: event.wasClean,
      });
      this.ws = null;
      if (this.currentStatusPublisher === publishStatus) {
        this.currentStatusPublisher = null;
      }
      this.stopKeepalive();
      if (isTerminalRoomCloseCode(event.code)) {
        options.onTerminalClose?.();
      }
      publishStatus("closed");
    });
    ws.addEventListener("error", () => {
      if (this.ws !== ws || socketClosed) {
        return;
      }

      logDebug("room.ws", "error");
      this.stopKeepalive();
      publishStatus("error");
    });
  }

  private consumeHistoryAuthorityEvent(event: ServerEvent, options: RoomClientOptions): void {
    const participantSessionId = options.participantSessionId;
    if (!participantSessionId) return;

    if (event.type === "ROOM_SNAPSHOT" || event.type === "SOURCE_CHANGED") {
      if (event.roomId !== options.roomId) return;
      const nextBoundary = {
        roomId: event.roomId,
        participantSessionId,
        roomGeneration: event.roomGeneration,
        sourceGeneration: event.sourceGeneration,
      };
      const current = this.currentHistoryBoundary;
      if (current && isOlderHistoryBoundary(nextBoundary, current)) return;
      if (current && sameHistoryBoundary(current, nextBoundary)) return;
      this.currentHistoryBoundary = nextBoundary;
      this.currentHistoryAuthority = null;
      options.onHistoryAuthority?.(null);
      return;
    }

    if (event.type !== "ROOM_HISTORY_AUTHORITY") return;
    const boundary = this.currentHistoryBoundary;
    if (!boundary ||
      event.roomId !== options.roomId ||
      event.participantSessionId !== participantSessionId ||
      !sameHistoryBoundary(boundary, event)) return;

    const authority: RoomHistoryAuthority = {
      roomId: event.roomId,
      participantSessionId: event.participantSessionId,
      roomGeneration: event.roomGeneration,
      sourceGeneration: event.sourceGeneration,
      attestation: event.attestation,
    };
    this.currentHistoryAuthority = authority;
    options.onHistoryAuthority?.(authority);
  }

  send(event: ClientEvent): RoomSendDisposition {
    const parsed = ClientEventSchema.parse(event);
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      logDebug("room.send", parsed.type, roomEventDebugSnapshot(parsed));
      ws.send(JSON.stringify(parsed));
      return "sent";
    }

    const shouldQueue = ws?.readyState === WebSocket.CONNECTING;
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
    return shouldQueue ? "queued" : "dropped";
  }

  close(reason = "manual"): void {
    this.closeSocket(reason, true);
  }

  private closeSocket(reason: string, publishClosed: boolean): void {
    this.stopKeepalive();
    const ws = this.ws;
    const statusPublisher = this.currentStatusPublisher;
    if (ws) {
      logDebug("room.ws", "closing", {
        reason,
        readyState: ws.readyState,
        senderConnectionId: this.currentSenderConnectionId,
      });
    }
    this.ws = null;
    this.currentStatusPublisher = null;
    if (publishClosed && ws) {
      statusPublisher?.("closed");
    }
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

    logDebug("room.send", "PING", { hibernationSafe: true, roomId });
    ws.send(HIBERNATION_KEEPALIVE_PING);

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

function sameHistoryBoundary(
  left: Pick<RoomHistoryAuthority, "roomId" | "participantSessionId" | "roomGeneration" | "sourceGeneration">,
  right: Pick<RoomHistoryAuthority, "roomId" | "participantSessionId" | "roomGeneration" | "sourceGeneration">,
): boolean {
  return left.roomId === right.roomId &&
    left.participantSessionId === right.participantSessionId &&
    left.roomGeneration === right.roomGeneration &&
    left.sourceGeneration === right.sourceGeneration;
}

function isOlderHistoryBoundary(
  candidate: Pick<RoomHistoryAuthority, "roomGeneration" | "sourceGeneration">,
  current: Pick<RoomHistoryAuthority, "roomGeneration" | "sourceGeneration">,
): boolean {
  return candidate.roomGeneration < current.roomGeneration ||
    (candidate.roomGeneration === current.roomGeneration &&
      candidate.sourceGeneration < current.sourceGeneration);
}

function createRoomConnectionId(): string {
  return `connection-${crypto.randomUUID()}`;
}
