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

export interface Env {
  ROOMS: DurableObjectNamespace;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_KEY_API_TOKEN?: string;
  CLOUDFLARE_TURN_TTL_SECONDS?: string;
  ANIDACHI_JWT_SECRET?: string;
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
  private nextP2PServerSeq = 1;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.room = new RoomState(state.id.name ?? "room");
    void this.env;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const roomToken = url.searchParams.get("roomToken");
    if (!roomToken) {
      return new Response("Missing room token", { status: 401 });
    }

    const verified = await verifyRoomToken(roomToken, this.room.roomId, this.env);
    if (!verified) {
      return new Response("Invalid room token", { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.verifiedBySocket.set(server, verified);

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

    const existingSocket = this.socketsByParticipant.get(serverParticipant.id);
    if (existingSocket && existingSocket !== socket) {
      this.participantsBySocket.delete(existingSocket);
      this.verifiedBySocket.delete(existingSocket);
      existingSocket.close(4000, "Replaced by a newer Anidachi session");
    }

    const joined = this.room.join(serverParticipant);
    this.participantsBySocket.set(socket, joined.id);
    this.socketsByParticipant.set(joined.id, socket);
    this.send(socket, this.room.snapshot);
    this.replayP2PSignals(socket, joined.id, event.lastSeenP2PServerSeq ?? 0);
    this.broadcast({ type: "PARTICIPANT_JOINED", participant: joined }, socket);
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

    const participant = this.room.setCamera(userId, event.type === "CAMERA_ON");
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

    this.send(target, buffered.event);
  }

  private replayP2PSignals(socket: WebSocket, participantId: string, afterServerSeq: number): void {
    const replay = this.p2pSignalBuffer.replayFor(participantId, afterServerSeq);
    for (const event of replay) {
      this.send(socket, event);
    }

    if (replay.length > 0) {
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
    if (!participantId) {
      return;
    }

    this.participantsBySocket.delete(socket);
    this.socketsByParticipant.delete(participantId);
    const participant = this.room.leave(participantId);

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
