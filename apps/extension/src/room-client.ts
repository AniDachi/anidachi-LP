import {
  ClientEventSchema,
  ServerEventSchema,
  type ClientEvent,
  type Participant,
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
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: RoomConnectionStatus) => void;
}

export interface CreatedRoom {
  roomId: string;
  roomToken: string;
  shareableLink: string;
}

export interface CreateRoomInput {
  sourceUrl?: string;
  videoFingerprint?: string;
  title?: string | null;
  showId?: string;
  episodeId?: string;
}

const ROOM_HTTP_MESSAGE_TYPE = "ANIDACHI_ROOM_HTTP";

export type RoomHttpCommand = "create-room" | "connect-room";

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
    };

export type RoomHttpMessageResponse =
  | { ok: true; room: CreatedRoom }
  | { ok: true; connection: { roomToken: string } }
  | { ok: false; error: string };

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

async function websiteRoomHttpError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    code?: unknown;
  } | null;
  const detail =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.code === "string" && body.code) ||
    fallback;

  return new Error(`${detail} (${response.status})`);
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
    (input.episodeId === undefined || typeof input.episodeId === "string")
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

export function isRoomHttpMessage(value: unknown): value is RoomHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<RoomHttpMessage>;
  if (message.type !== ROOM_HTTP_MESSAGE_TYPE) return false;
  if (message.command === "create-room") {
    return typeof message.accessToken === "string" && isCreateRoomInput(message.input);
  }
  if (message.command === "connect-room") {
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
  };
  if (typeof payload.roomToken !== "string" || typeof payload.shareableLink !== "string") {
    throw new Error("Website room response is missing roomToken or shareableLink");
  }

  logDebug("room.http", "create website room success", payload);
  return {
    roomId: payload.roomId,
    roomToken: payload.roomToken,
    shareableLink: payload.shareableLink,
  };
}

export async function connectWebsiteRoomFromApi(
  roomId: string,
  accessToken: string,
): Promise<{ roomToken: string }> {
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

  const payload = (await response.json()) as { roomToken?: unknown };
  if (typeof payload.roomToken !== "string") {
    throw new Error("Website room connect response is missing roomToken");
  }
  return { roomToken: payload.roomToken };
}

export async function handleRoomHttpMessage(
  message: RoomHttpMessage,
): Promise<RoomHttpMessageResponse> {
  try {
    if (message.command === "create-room") {
      return { ok: true, room: await createWebsiteRoomFromApi(message.accessToken, message.input) };
    }
    return {
      ok: true,
      connection: await connectWebsiteRoomFromApi(message.roomId, message.accessToken),
    };
  } catch (error) {
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

export async function createRoom(accessToken: string, input?: CreateRoomInput): Promise<CreatedRoom> {
  logDebug("room.http", "create room through background bridge", { webHttpBase: WEB_HTTP_BASE });
  const response = assertRoomHttpResponse(
    await sendRoomHttpMessage(createRoomHttpMessage(accessToken, input)),
  );
  if (!response.ok || !("room" in response)) {
    throw new Error(response.ok ? "Room bridge response is missing room" : response.error);
  }
  return response.room;
}

export async function connectWebsiteRoom(
  roomId: string,
  accessToken: string,
): Promise<{ roomToken: string }> {
  logDebug("room.http", "connect room through background bridge", {
    webHttpBase: WEB_HTTP_BASE,
    roomId,
  });
  const response = assertRoomHttpResponse(
    await sendRoomHttpMessage(connectRoomHttpMessage(roomId, accessToken)),
  );
  if (!response.ok || !("connection" in response)) {
    throw new Error(response.ok ? "Room bridge response is missing connection" : response.error);
  }
  return response.connection;
}

export class RoomClient {
  private currentSenderConnectionId = createRoomConnectionId();
  private pendingEvents: ClientEvent[] = [];
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
      this.send(joinEvent);
      this.flushPendingEvents();
    });

    ws.addEventListener("message", (message) => {
      if (this.ws !== ws) {
        return;
      }

      try {
        const event = ServerEventSchema.parse(JSON.parse(String(message.data)));
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
      options.onStatus("closed");
    });
    ws.addEventListener("error", () => {
      if (this.ws !== ws) {
        return;
      }

      logDebug("room.ws", "error");
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
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.pendingEvents = [];
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
