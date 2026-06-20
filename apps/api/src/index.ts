import {
  ClientEventSchema,
  type ClientEvent,
  type Participant,
  type ServerEvent,
} from "@anidachi/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyRoomToken, type VerifiedRoomToken } from "./auth";
import { createIceServersPayload } from "./ice-servers";
import { createLiveKitToken } from "./livekit-token";
import { RecentP2PSignalBuffer, type BufferedP2PSignalEvent } from "./p2p-signal-buffer";
import { RoomState } from "./room-state";
import {
  emitRoomTelemetry,
  type AnalyticsEngineDataset,
  type RoomTelemetryContext,
} from "./telemetry";

export interface Env {
  ROOMS: DurableObjectNamespace;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_KEY_API_TOKEN?: string;
  CLOUDFLARE_TURN_TTL_SECONDS?: string;
  ANIDACHI_JWT_SECRET?: string;
  ANIDACHI_ENV?: string;
  ROOM_ANALYTICS?: AnalyticsEngineDataset;
}

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) => c.json({ ok: true, service: "anidachi-api" }));

app.post("/rooms", (c) => {
  return c.json(
    {
      error: "AUTH_REQUIRED",
      message: "Create Anidachi rooms through the website API.",
    },
    410,
  );
});

app.get("/ice-servers", async (c) => {
  // Require a valid room token so anonymous callers can't mint Cloudflare TURN
  // credentials at the project's expense (Block 7.1). The token proves the
  // caller is a participant of a real room; roomId scopes the check.
  const roomToken = c.req.query("roomToken");
  const roomId = c.req.query("roomId");
  if (!roomToken || !roomId) {
    return c.json({ error: "ROOM_TOKEN_REQUIRED", message: "roomToken and roomId are required" }, 401);
  }

  const verified = await verifyRoomToken(roomToken, roomId, c.env);
  if (!verified) {
    return c.json({ error: "INVALID_ROOM_TOKEN", message: "Invalid or expired room token" }, 401);
  }

  try {
    return c.json(await createIceServersPayload(c.env));
  } catch (error) {
    console.error("[Anidachi] ICE server generation failed", error);
    return c.json(
      {
        error: "ICE_SERVER_GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate ICE servers",
      },
      502,
    );
  }
});

app.get("/ws/:roomId", (c) => {
  const roomId = c.req.param("roomId");
  const id = c.env.ROOMS.idFromName(roomId);
  const stub = c.env.ROOMS.get(id);
  return stub.fetch(c.req.raw);
});

app.post("/livekit/token", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    roomId?: string;
    identity?: string;
    name?: string;
  } | null;

  if (!body?.roomId || !body.identity || !body.name) {
    return c.json({ error: "roomId, identity and name are required" }, 400);
  }

  const apiKey = c.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = c.env.LIVEKIT_API_SECRET ?? "secret";
  const serverUrl = c.env.LIVEKIT_URL ?? "ws://localhost:7880";
  const token = await createLiveKitToken({
    apiKey,
    apiSecret,
    roomId: body.roomId,
    identity: body.identity,
    name: body.name,
  });

  return c.json({ serverUrl, token });
});

function encode(event: ServerEvent): string {
  return JSON.stringify(event);
}

export class RoomDurableObject {
  private readonly room: RoomState;
  private readonly participantsBySocket = new Map<WebSocket, string>();
  private readonly p2pSignalBuffer = new RecentP2PSignalBuffer();
  private readonly socketsByParticipant = new Map<string, WebSocket>();
  private readonly verifiedBySocket = new Map<WebSocket, VerifiedRoomToken>();
  private readonly sessionIdBySocket = new Map<WebSocket, string | undefined>();
  private nextP2PServerSeq = 1;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.room = new RoomState(state.id.name ?? "room");
  }

  private get telemetryContext(): RoomTelemetryContext {
    return { env: this.env.ANIDACHI_ENV ?? "local", roomId: this.room.roomId };
  }

  private track(name: Parameters<typeof emitRoomTelemetry>[2]["name"], extra?: { role?: string; value?: number }): void {
    emitRoomTelemetry(this.env.ROOM_ANALYTICS, this.telemetryContext, { name, ...extra });
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const roomToken = url.searchParams.get("roomToken");
    if (!roomToken) {
      this.track("ws_token_reject");
      return new Response("Missing room token", { status: 401 });
    }

    const verified = await verifyRoomToken(roomToken, this.room.roomId, this.env);
    if (!verified) {
      this.track("ws_token_reject");
      return new Response("Invalid room token", { status: 401 });
    }
    if (verified.capabilities) {
      this.room.setCapabilities(verified.capabilities);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.verifiedBySocket.set(server, verified);
    this.track("ws_open", { role: verified.role });

    server.addEventListener("message", (event) => this.handleMessage(server, event.data));
    server.addEventListener("close", () => this.handleClose(server));
    server.addEventListener("error", () => this.handleClose(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(socket: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== "string") {
      this.send(socket, {
        type: "ERROR",
        code: "INVALID_PAYLOAD",
        message: "Expected JSON string",
      });
      return;
    }

    let event: ClientEvent;
    try {
      event = ClientEventSchema.parse(JSON.parse(raw));
    } catch {
      this.send(socket, { type: "ERROR", code: "INVALID_EVENT", message: "Invalid room event" });
      return;
    }

    switch (event.type) {
      case "PING":
        this.handlePing(socket, event);
        return;
      case "JOIN":
        this.handleJoin(socket, event);
        return;
      case "HOST_STATE":
        this.handleHostState(socket, event);
        return;
      case "REACTION":
        this.handleReaction(socket, event);
        return;
      case "CAMERA_ON":
      case "CAMERA_OFF":
        this.handleCamera(socket, event);
        return;
      case "P2P_SIGNAL":
        this.handleP2PSignal(socket, event);
        return;
      case "PLAY":
      case "PAUSE":
      case "SEEK":
        this.handlePlaybackCommand(socket, event);
        return;
    }
  }

  private handlePing(socket: WebSocket, event: Extract<ClientEvent, { type: "PING" }>): void {
    this.send(socket, {
      type: "PONG",
      roomId: this.room.roomId,
      sentAt: event.sentAt,
      serverTime: Date.now(),
    });
  }

  private handleJoin(socket: WebSocket, event: Extract<ClientEvent, { type: "JOIN" }>): void {
    const verified = this.verifiedBySocket.get(socket);
    if (!verified) {
      this.send(socket, {
        type: "ERROR",
        code: "AUTH_REQUIRED",
        message: "Room token is required before joining",
      });
      return;
    }

    const serverParticipant: Participant = {
      id: verified.sub,
      displayName: verified.displayName || `User ${verified.sub.slice(0, 4)}`,
      avatarUrl: verified.avatarUrl ?? undefined,
      role: verified.role === "host" ? "host" : "viewer",
      cameraEnabled: false,
      syncStatus: "unknown",
      lastSeenAt: Date.now(),
    };

    // Checked before stale-socket replacement so a reconnecting member is never
    // rejected as an extra participant.
    if (!this.room.canAdmit(serverParticipant.id)) {
      this.track("room_full", { role: serverParticipant.role });
      this.send(socket, {
        type: "ERROR",
        code: "ROOM_FULL",
        message: `This watch room is full (max ${this.room.roomCapabilities.maxParticipants} people).`,
      });
      socket.close(4003, "Room is full");
      return;
    }

    const existingSocket = this.socketsByParticipant.get(serverParticipant.id);
    if (existingSocket && existingSocket !== socket) {
      const existingSessionId = this.sessionIdBySocket.get(existingSocket);
      const sameSession =
        event.participantSessionId !== undefined &&
        existingSessionId === event.participantSessionId;

      this.participantsBySocket.delete(existingSocket);
      this.verifiedBySocket.delete(existingSocket);
      this.sessionIdBySocket.delete(existingSocket);

      if (sameSession) {
        // Same tab reconnecting: silently retire the stale socket.
        existingSocket.close(4000, "Replaced by a newer Anidachi session");
      } else {
        // A different tab/device took the session over. Tell the displaced
        // socket terminally so it stops instead of reconnect-fighting (one
        // active session). The displaced client suppresses reconnect on this.
        this.track("session_taken_over");
        this.send(existingSocket, {
          type: "ERROR",
          code: "SESSION_TAKEN_OVER",
          message: "This room was opened in another tab or device.",
        });
        existingSocket.close(4002, "Session taken over");
      }
    }

    const joined = this.room.join(serverParticipant);
    this.participantsBySocket.set(socket, joined.id);
    this.socketsByParticipant.set(joined.id, socket);
    this.sessionIdBySocket.set(socket, event.participantSessionId);
    this.send(socket, this.room.snapshot);
    this.replayP2PSignals(socket, joined.id, event.lastSeenP2PServerSeq ?? 0);
    this.broadcast({ type: "PARTICIPANT_JOINED", participant: joined }, socket);
    this.track("join", { role: joined.role, value: this.room.participants.length });
  }

  private handleReaction(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "REACTION" }>,
  ): void {
    const userId = this.participantsBySocket.get(socket);
    if (!userId || userId !== event.reaction.userId) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_PARTICIPANT",
        message: "Only joined room participants can send reactions",
      });
      return;
    }

    this.broadcast({ type: "REACTION", reaction: event.reaction });
  }

  private handleHostState(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "HOST_STATE" }>,
  ): void {
    const userId = this.participantsBySocket.get(socket);
    if (!userId || !this.room.updateHostState(userId, event.state)) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_HOST",
        message: "Only joined room participants can update playback state",
      });
      return;
    }

    this.broadcast({ type: "HOST_STATE", state: event.state }, socket);
  }

  private handlePlaybackCommand(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "PLAY" | "PAUSE" | "SEEK" }>,
  ): void {
    const userId = this.participantsBySocket.get(socket);
    if (!userId || userId !== event.byUserId || !this.room.canControlPlayback(userId)) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_PARTICIPANT",
        message: "Only joined room participants can control playback",
      });
      return;
    }

    this.broadcast(event, socket);
  }

  private handleCamera(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "CAMERA_ON" | "CAMERA_OFF" }>,
  ): void {
    const userId = this.participantsBySocket.get(socket);
    if (!userId || userId !== event.userId) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_PARTICIPANT",
        message: "Only joined room participants can update their camera",
      });
      return;
    }

    const wantsCamera = event.type === "CAMERA_ON";
    if (wantsCamera && !this.room.canEnableCamera(userId)) {
      this.send(socket, {
        type: "ERROR",
        code: "MEDIA_SEATS_FULL",
        message:
          this.room.roomCapabilities.maxMediaSeats === 0
            ? "This room does not include live media seats."
            : `This room has no free media seats (max ${this.room.roomCapabilities.maxMediaSeats}).`,
      });
      return;
    }

    const participant = this.room.setCamera(userId, wantsCamera);
    if (!participant) {
      return;
    }

    this.broadcast(this.room.snapshot);
  }

  private handleP2PSignal(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "P2P_SIGNAL" }>,
  ): void {
    const senderId = this.participantsBySocket.get(socket);
    if (
      !senderId ||
      senderId !== event.fromUserId ||
      !this.room.canSignal(senderId, event.toUserId)
    ) {
      this.send(socket, {
        type: "ERROR",
        code: "INVALID_P2P_SIGNAL",
        message: "P2P signals can only be sent between joined room participants",
      });
      return;
    }

    const forwarded: BufferedP2PSignalEvent = {
      ...event,
      serverReceivedAt: Date.now(),
      serverSeq: this.nextP2PServerSeq++,
    };

    const buffered = this.p2pSignalBuffer.add(forwarded, forwarded.serverReceivedAt);
    const target = this.socketsByParticipant.get(event.toUserId);
    if (!target) {
      console.log(
        JSON.stringify({
          event: "p2p.signal.buffered_offline_target",
          fromUserId: event.fromUserId,
          roomId: event.roomId,
          serverSeq: buffered.event.serverSeq,
          signalKind: event.signal.kind,
          toUserId: event.toUserId,
        }),
      );
      return;
    }

    this.track("p2p_signal");
    this.send(target, buffered.event);
  }

  private replayP2PSignals(socket: WebSocket, participantId: string, afterServerSeq: number): void {
    const replay = this.p2pSignalBuffer.replayFor(participantId, afterServerSeq);
    for (const event of replay) {
      this.send(socket, event);
    }

    if (replay.length > 0) {
      this.track("p2p_replay", { value: replay.length });
      console.log(
        JSON.stringify({
          event: "p2p.signal.replay",
          afterServerSeq,
          participantId,
          replayed: replay.length,
          roomId: this.room.roomId,
        }),
      );
    }
  }

  private handleClose(socket: WebSocket): void {
    const participantId = this.participantsBySocket.get(socket);
    this.verifiedBySocket.delete(socket);
    this.sessionIdBySocket.delete(socket);
    if (!participantId) {
      return;
    }

    this.participantsBySocket.delete(socket);
    this.socketsByParticipant.delete(participantId);
    const participant = this.room.leave(participantId);
    this.track("ws_close", { value: this.room.participants.length });

    if (participant) {
      this.broadcast({ type: "PARTICIPANT_LEFT", participant });
      this.broadcast(this.room.snapshot);
    }
  }

  private send(socket: WebSocket, event: ServerEvent): void {
    try {
      socket.send(encode(event));
    } catch {
      this.handleClose(socket);
    }
  }

  private broadcast(event: ServerEvent, except?: WebSocket): void {
    for (const socket of this.socketsByParticipant.values()) {
      if (socket !== except) {
        this.send(socket, event);
      }
    }
  }
}

export default app;
