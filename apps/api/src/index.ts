import {
  ClientEventSchema,
  MAX_ROOM_FRAME_BYTES,
  MAX_ROOM_ID_CHARS,
  type ClientEvent,
  type Participant,
  type ServerEvent,
} from "@anidachi/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyRoomToken, type VerifiedRoomToken } from "./auth";
import { createIceServersPayload } from "./ice-servers";
import { hasValidInternalAuthorization } from "./internal-auth";
import { notifyWebRoomEnded } from "./internal-web-client";
import {
  endedRoomTombstone,
  parseEndRoomCommand,
  type EndedRoomTombstone,
  type EndRoomCommand,
} from "./room-lifecycle";
import {
  getP2PSignalDedupeKey,
  RecentP2PSignalBuffer,
  type BufferedP2PSignalEvent,
} from "./p2p-signal-buffer";
import {
  initializeRoomStorage,
  activateStoredRoomLifecycle,
  claimStoredRoomEndAttempt,
  clearStoredRoomLifecycleAndAlarm,
  markStoredRoomEmpty,
  persistEndedRoomTombstoneAndClearRuntime,
  readEndedRoomTombstone,
  readNextP2PServerSeq,
  readStoredP2PReplay,
  readStoredRoomLifecycle,
  readStoredRoomState,
  writeNextP2PServerSeq,
  writeStoredP2PReplayEvent,
  writeStoredRoomState,
} from "./room-persistence";
import {
  attachmentToVerifiedRoomToken,
  createRoomSocketAttachment,
  parseRoomSocketAttachment,
  updateRoomSocketAttachment,
  type RoomSocketAttachment,
} from "./room-socket-attachment";
import {
  RoomRateLimiter,
  type RoomEventClass,
  type RoomRateLimitDecision,
} from "./room-rate-limit";
import { RoomState } from "./room-state";
import {
  emitRoomTelemetry,
  type AnalyticsEngineDataset,
  type RoomTelemetryContext,
} from "./telemetry";

export interface Env {
  ROOMS: DurableObjectNamespace;
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_KEY_API_TOKEN?: string;
  CLOUDFLARE_TURN_TTL_SECONDS?: string;
  ANIDACHI_JWT_SECRET?: string;
  ANIDACHI_ENV?: string;
  ANIDACHI_INTERNAL_API_SECRET?: string;
  ANIDACHI_WEB_INTERNAL_BASE_URL?: string;
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

app.post("/internal/rooms/:roomId/end", async (c) => {
  const authorization = c.req.header("authorization") ?? null;
  if (!hasValidInternalAuthorization(
    authorization,
    c.env.ANIDACHI_INTERNAL_API_SECRET,
  )) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid internal authorization" }, 401);
  }
  const roomId = c.req.param("roomId");
  if (roomId.length === 0 || roomId.length > MAX_ROOM_ID_CHARS) {
    return c.json({ error: "INVALID_ROOM_ID", message: "Invalid room id" }, 400);
  }
  const body = await c.req.json().catch(() => null);
  const command = parseEndRoomCommand(body);
  if (!command) {
    return c.json({ error: "INVALID_END_COMMAND", message: "Invalid room end command" }, 400);
  }
  const id = c.env.ROOMS.idFromName(roomId);
  const stub = c.env.ROOMS.get(id);
  return stub.fetch(new Request(`https://room.internal/internal/end`, {
    method: "POST",
    headers: {
      Authorization: authorization!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  }));
});

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

app.get("/ws/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  if (roomId.length === 0 || roomId.length > MAX_ROOM_ID_CHARS) {
    return c.json({ error: "INVALID_ROOM_ID", message: "Invalid room id" }, 400);
  }

  const roomToken = c.req.query("roomToken");
  if (!roomToken) {
    return c.json({ error: "ROOM_TOKEN_REQUIRED", message: "Room token is required" }, 401);
  }

  const verified = await verifyRoomToken(roomToken, roomId, c.env);
  if (!verified) {
    return c.json({ error: "INVALID_ROOM_TOKEN", message: "Invalid or expired room token" }, 401);
  }

  const id = c.env.ROOMS.idFromName(roomId);
  const stub = c.env.ROOMS.get(id);
  return stub.fetch(c.req.raw);
});

function encode(event: ServerEvent): string {
  return JSON.stringify(event);
}

const HIBERNATION_KEEPALIVE_PING = "ping";
const HIBERNATION_KEEPALIVE_PONG = "pong";

export function closeInvalidRoomFrame(socket: WebSocket, raw: string | ArrayBuffer): boolean {
  const frameBytes = typeof raw === "string" ? new TextEncoder().encode(raw).byteLength : raw.byteLength;
  if (typeof raw === "string" && frameBytes <= MAX_ROOM_FRAME_BYTES) {
    return false;
  }

  socket.close(1009, "Room frame exceeds supported size");
  return true;
}

export function isRoomEventInScope(event: ClientEvent, roomId: string): boolean {
  return event.roomId === roomId && (event.type !== "REACTION" || event.reaction.roomId === roomId);
}

export function consumeRoomFrameBoundary(
  socket: WebSocket,
  limiter: RoomRateLimiter,
  raw: string | ArrayBuffer,
  now = Date.now(),
): RoomRateLimitDecision | null {
  return closeInvalidRoomFrame(socket, raw) ? null : limiter.consumeTotal(now);
}

function getRoomEventClass(event: ClientEvent): RoomEventClass {
  if (event.type !== "P2P_SIGNAL") return "control";
  if (event.signal.kind === "ice") return "ice";
  if (event.signal.kind === "offer" || event.signal.kind === "answer") return "sdp";
  return "control";
}

export function consumeParsedRoomEventBoundary(
  limiter: RoomRateLimiter,
  event: ClientEvent,
  roomId: string,
  now = Date.now(),
): { rateLimit: RoomRateLimitDecision; inScope: boolean } {
  const rateLimit = limiter.consumeClass(getRoomEventClass(event), now);
  return {
    rateLimit,
    inScope: rateLimit.allowed && isRoomEventInScope(event, roomId),
  };
}

export function closeRoomRateLimitedSocket(
  socket: WebSocket,
  decision: RoomRateLimitDecision,
): void {
  if (decision.close) {
    socket.close(1008, "Room event rate exceeded");
  }
}

export function addP2PSignalForDispatch(
  buffer: RecentP2PSignalBuffer,
  event: BufferedP2PSignalEvent,
  now = Date.now(),
): BufferedP2PSignalEvent | null {
  const result = buffer.add(event, now);
  return result.duplicate ? null : result.event;
}

export function sendAndCloseEndedRoomSockets(
  sockets: Iterable<WebSocket>,
  event: Extract<ServerEvent, { type: "ROOM_ENDED" }>,
): void {
  const encoded = encode(event);
  for (const socket of sockets) {
    try {
      socket.send(encoded);
    } catch {
      /* stale socket */
    }
  }
  for (const socket of sockets) {
    try {
      socket.close(4004, "Room ended");
    } catch {
      /* stale socket */
    }
  }
}

function roomEndedEvent(
  roomId: string,
  tombstone: EndedRoomTombstone,
): Extract<ServerEvent, { type: "ROOM_ENDED" }> {
  return {
    type: "ROOM_ENDED",
    roomId,
    endedAt: tombstone.endedAt,
    reason: tombstone.reason,
  };
}

export function handleRoomWebSocketMessageBoundary(
  socket: WebSocket,
  roomId: string,
  tombstone: EndedRoomTombstone | null,
  dispatch: () => void,
): boolean {
  if (tombstone) {
    sendAndCloseEndedRoomSockets([socket], roomEndedEvent(roomId, tombstone));
    return false;
  }
  dispatch();
  return true;
}

export function persistRoomEndAfterDisablingAutoResponse(
  state: Pick<DurableObjectState, "setWebSocketAutoResponse">,
  persist: () => void,
): void {
  state.setWebSocketAutoResponse();
  persist();
}

export class RoomDurableObject {
  private room: RoomState;
  private readonly participantsBySocket = new Map<WebSocket, string>();
  private readonly p2pSignalBuffer = new RecentP2PSignalBuffer();
  private readonly socketsByParticipant = new Map<string, WebSocket>();
  private readonly verifiedBySocket = new Map<WebSocket, VerifiedRoomToken>();
  private readonly sessionIdBySocket = new Map<WebSocket, string | undefined>();
  private readonly rateLimiterBySocket = new Map<WebSocket, RoomRateLimiter>();
  private nextP2PServerSeq = 1;
  private endedTombstone: ReturnType<typeof endedRoomTombstone> | null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    initializeRoomStorage(state.storage);

    const roomId = state.id.name ?? "room";
    this.endedTombstone = readEndedRoomTombstone(state.storage);
    this.room = new RoomState(roomId, undefined, readStoredRoomState(state.storage) ?? undefined);
    if (!this.endedTombstone) {
      this.p2pSignalBuffer.hydrate(readStoredP2PReplay(state.storage));
    }
    const replaySnapshot = this.p2pSignalBuffer.snapshot();
    const latestStoredSeq = replaySnapshot.at(-1)?.serverSeq ?? 0;
    this.nextP2PServerSeq = Math.max(
      readNextP2PServerSeq(state.storage) ?? 1,
      latestStoredSeq + 1,
    );
    if (!this.endedTombstone) {
      state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(HIBERNATION_KEEPALIVE_PING, HIBERNATION_KEEPALIVE_PONG),
      );
      this.restoreWebSocketsFromAttachments();
    } else {
      state.setWebSocketAutoResponse();
      state.waitUntil(clearStoredRoomLifecycleAndAlarm(state.storage));
      this.clearTerminalRuntimeState();
      sendAndCloseEndedRoomSockets(
        this.state.getWebSockets(),
        roomEndedEvent(this.room.roomId, this.endedTombstone),
      );
    }
  }

  private get telemetryContext(): RoomTelemetryContext {
    return { env: this.env.ANIDACHI_ENV ?? "local", roomId: this.room.roomId };
  }

  private track(name: Parameters<typeof emitRoomTelemetry>[2]["name"], extra?: { role?: string; value?: number }): void {
    emitRoomTelemetry(this.env.ROOM_ANALYTICS, this.telemetryContext, { name, ...extra });
  }

  private restoreWebSocketsFromAttachments(): void {
    for (const socket of this.state.getWebSockets()) {
      const attachment = parseRoomSocketAttachment(
        socket.deserializeAttachment(),
        this.room.roomId,
      );
      if (!attachment) {
        socket.close(4000, "Invalid Anidachi socket state");
        continue;
      }

      this.verifiedBySocket.set(socket, attachmentToVerifiedRoomToken(attachment));
      if (attachment.verified.capabilities) {
        this.room.setCapabilities(attachment.verified.capabilities);
      }
      if (!attachment.participant) {
        continue;
      }

      const existingSocket = this.socketsByParticipant.get(attachment.participant.id);
      if (existingSocket && existingSocket !== socket) {
        const existingAttachment = this.getSocketAttachment(existingSocket);
        const keepExisting =
          (existingAttachment?.lastSeenAt ?? 0) >= attachment.lastSeenAt ||
          (existingAttachment?.connectedAt ?? 0) >= attachment.connectedAt;
        if (keepExisting) {
          socket.close(4000, "Duplicate stale Anidachi session");
          continue;
        }

        this.participantsBySocket.delete(existingSocket);
        this.verifiedBySocket.delete(existingSocket);
        this.sessionIdBySocket.delete(existingSocket);
        existingSocket.close(4000, "Duplicate stale Anidachi session");
      }

      if (!this.room.hasParticipant(attachment.participant.id)) {
        this.room.join(attachment.participant);
      }
      this.participantsBySocket.set(socket, attachment.participant.id);
      this.socketsByParticipant.set(attachment.participant.id, socket);
      this.sessionIdBySocket.set(socket, attachment.participantSessionId);
    }
  }

  private getSocketAttachment(socket: WebSocket): RoomSocketAttachment | null {
    return parseRoomSocketAttachment(socket.deserializeAttachment(), this.room.roomId);
  }

  private writeSocketAttachment(socket: WebSocket, attachment: RoomSocketAttachment): void {
    socket.serializeAttachment(attachment);
  }

  private touchSocketAttachment(socket: WebSocket): void {
    const attachment = this.getSocketAttachment(socket);
    if (!attachment) {
      return;
    }
    this.writeSocketAttachment(socket, updateRoomSocketAttachment(attachment, { lastSeenAt: Date.now() }));
  }

  private persistRoomState(): void {
    writeStoredRoomState(this.state.storage, this.room.toSnapshot());
  }

  private persistP2PState(): void {
    writeNextP2PServerSeq(this.state.storage, this.nextP2PServerSeq);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/internal/end") {
      if (!hasValidInternalAuthorization(
        request.headers.get("authorization"),
        this.env.ANIDACHI_INTERNAL_API_SECRET,
      )) {
        return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      const command = parseEndRoomCommand(await request.json().catch(() => null));
      if (!command) return Response.json({ error: "INVALID_END_COMMAND" }, { status: 400 });
      return this.endRoom(command);
    }
    if (this.endedTombstone) {
      this.clearTerminalRuntimeState();
      sendAndCloseEndedRoomSockets(
        this.state.getWebSockets(),
        roomEndedEvent(this.room.roomId, this.endedTombstone),
      );
      return Response.json({ error: "ROOM_ENDED", endedAt: this.endedTombstone.endedAt }, { status: 410 });
    }
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

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
    const tombstoneAfterVerification = readEndedRoomTombstone(this.state.storage);
    if (tombstoneAfterVerification) {
      this.endedTombstone = tombstoneAfterVerification;
      return Response.json(
        { error: "ROOM_ENDED", endedAt: tombstoneAfterVerification.endedAt },
        { status: 410 },
      );
    }
    const lifecycle = await readStoredRoomLifecycle(this.state.storage);
    if (lifecycle?.status === "ending") {
      return Response.json(
        { error: "ROOM_ENDING", endedAt: lifecycle.endedAt },
        { status: 409 },
      );
    }
    if (lifecycle?.status === "ended") {
      return Response.json(
        { error: "ROOM_ENDED", endedAt: lifecycle.endedAt },
        { status: 410 },
      );
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    this.writeSocketAttachment(
      server,
      createRoomSocketAttachment(this.room.roomId, verified),
    );
    this.verifiedBySocket.set(server, verified);
    this.track("ws_open", { role: verified.role });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async endRoom(command: EndRoomCommand): Promise<Response> {
    const alreadyEnded = this.endedTombstone !== null;
    const tombstone = this.endedTombstone ?? endedRoomTombstone(command);
    await this.applyTerminalRoomState(tombstone);
    return Response.json({ ok: true, alreadyEnded, ...tombstone });
  }

  private async applyTerminalRoomState(
    tombstone: ReturnType<typeof endedRoomTombstone>,
  ): Promise<void> {
    persistRoomEndAfterDisablingAutoResponse(this.state, () => {
      persistEndedRoomTombstoneAndClearRuntime(this.state.storage, tombstone);
    });
    await this.state.storage.sync();
    this.endedTombstone = tombstone;

    const event = roomEndedEvent(this.room.roomId, tombstone);
    const sockets = this.state.getWebSockets();
    this.clearTerminalRuntimeState();
    sendAndCloseEndedRoomSockets(sockets, event);
    await clearStoredRoomLifecycleAndAlarm(this.state.storage);
  }

  private clearTerminalRuntimeState(): void {
    this.p2pSignalBuffer.clear();
    this.nextP2PServerSeq = 1;
    this.room = new RoomState(this.room.roomId);
    this.participantsBySocket.clear();
    this.socketsByParticipant.clear();
    this.verifiedBySocket.clear();
    this.sessionIdBySocket.clear();
    this.rateLimiterBySocket.clear();
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (this.endedTombstone) {
      sendAndCloseEndedRoomSockets(
        [socket],
        roomEndedEvent(this.room.roomId, this.endedTombstone),
      );
      return;
    }
    await this.handleMessage(socket, raw);
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    await this.handleClose(socket);
    try {
      socket.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    console.error("[Anidachi] Room WebSocket error", error);
    await this.handleClose(socket);
  }

  async alarm(): Promise<void> {
    if (this.endedTombstone) {
      await clearStoredRoomLifecycleAndAlarm(this.state.storage);
      return;
    }
    if (this.participantsBySocket.size > 0) {
      const activation = await activateStoredRoomLifecycle(
        this.state.storage,
        Date.now(),
      );
      if (activation.accepted) return;
    }
    const attempt = await claimStoredRoomEndAttempt(
      this.state.storage,
      this.room.roomId,
      Date.now(),
    );
    if (!attempt) return;

    this.track(
      attempt.attempts > 1
        ? "room_end_callback_retry"
        : "room_end_callback_attempt",
      { value: attempt.attempts },
    );

    try {
      await notifyWebRoomEnded(this.env, this.room.roomId, {
        endedAt: attempt.endedAt,
        eventId: attempt.eventId,
        reason: "empty_timeout",
      });
    } catch {
      this.track("room_end_callback_failure", { value: attempt.attempts });
      // The transaction that claimed this attempt already persisted the next
      // retry alarm and the unchanged callback identity.
      return;
    }

    this.track("room_end_callback_success", { value: attempt.attempts });

    await this.applyTerminalRoomState(endedRoomTombstone({
      endedAt: attempt.endedAt,
      reason: "empty_timeout",
    }));
  }

  private async handleMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const limiter = this.rateLimiterBySocket.get(socket) ?? new RoomRateLimiter();
    this.rateLimiterBySocket.set(socket, limiter);
    const frameRateLimit = consumeRoomFrameBoundary(socket, limiter, raw);
    if (!frameRateLimit) {
      return;
    }
    if (this.rejectRateLimitedEvent(socket, frameRateLimit)) return;
    if (typeof raw !== "string") {
      return;
    }
    if (raw === HIBERNATION_KEEPALIVE_PING) {
      socket.send(HIBERNATION_KEEPALIVE_PONG);
      this.touchSocketAttachment(socket);
      return;
    }

    let event: ClientEvent;
    try {
      event = ClientEventSchema.parse(JSON.parse(raw));
    } catch {
      this.send(socket, { type: "ERROR", code: "INVALID_EVENT", message: "Invalid room event" });
      return;
    }

    const parsedBoundary = consumeParsedRoomEventBoundary(limiter, event, this.room.roomId);
    if (this.rejectRateLimitedEvent(socket, parsedBoundary.rateLimit)) return;
    if (!parsedBoundary.inScope) {
      this.send(socket, {
        type: "ERROR",
        code: "ROOM_SCOPE_MISMATCH",
        message: "Room event does not match this room",
      });
      return;
    }

    this.touchSocketAttachment(socket);

    switch (event.type) {
      case "PING":
        this.handlePing(socket, event);
        return;
      case "JOIN":
        await this.handleJoin(socket, event);
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
      case "MEDIA_JOIN_REQUEST":
      case "MEDIA_JOIN_CANCEL":
      case "MEDIA_SEAT_LEAVE":
      case "MEDIA_SEAT_GRANT":
      case "MEDIA_SEAT_REVOKE":
        this.handleMediaSeat(socket, event);
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

  private rejectRateLimitedEvent(socket: WebSocket, rateLimit: RoomRateLimitDecision): boolean {
    if (!rateLimit.allowed) {
      this.send(socket, {
        type: "ERROR",
        code: "RATE_LIMITED",
        message: `Room event rate exceeded; retry in ${rateLimit.retryAfterMs}ms`,
      });
      closeRoomRateLimitedSocket(socket, rateLimit);
      return true;
    }
    return false;
  }

  private handlePing(socket: WebSocket, event: Extract<ClientEvent, { type: "PING" }>): void {
    this.send(socket, {
      type: "PONG",
      roomId: this.room.roomId,
      sentAt: event.sentAt,
      serverTime: Date.now(),
    });
  }

  private async handleJoin(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "JOIN" }>,
  ): Promise<void> {
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
      mediaSeat: "none",
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

    const activation = await activateStoredRoomLifecycle(
      this.state.storage,
      Date.now(),
    );
    if (!activation.accepted) {
      if (activation.lifecycle?.status === "ending") {
        this.send(socket, {
          type: "ROOM_ENDED",
          roomId: this.room.roomId,
          endedAt: activation.lifecycle.endedAt,
          reason: "empty_timeout",
        });
        socket.close(4004, "Room is ending");
        return;
      }
      if (activation.lifecycle?.status === "ended") {
        this.send(socket, roomEndedEvent(
          this.room.roomId,
          endedRoomTombstone(activation.lifecycle),
        ));
        socket.close(4004, "Room ended");
        return;
      }
      socket.close(1011, "Room lifecycle state is unavailable");
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
    const attachment = this.getSocketAttachment(socket);
    if (attachment) {
      const patch: Parameters<typeof updateRoomSocketAttachment>[1] = {
        lastSeenAt: Date.now(),
        participant: joined,
      };
      if (event.participantSessionId !== undefined) {
        patch.participantSessionId = event.participantSessionId;
      }
      this.writeSocketAttachment(socket, updateRoomSocketAttachment(attachment, patch));
    }
    this.persistRoomState();
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
    const result = userId
      ? this.room.updateHostState(userId, event.state, event.source)
      : { accepted: false, sourceChanged: false };
    if (!userId || !result.accepted) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_HOST",
        message: "Only joined room participants can update playback state",
      });
      return;
    }
    this.persistRoomState();

    if (result.sourceChanged && result.source) {
      this.broadcast({
        type: "SOURCE_CHANGED",
        roomId: this.room.roomId,
        roomGeneration: this.room.roomGeneration,
        sourceGeneration: this.room.sourceGeneration,
        serverSeq: this.room.serverSeq,
        serverReceivedAt: Date.now(),
        source: result.source,
        ...(result.previousSource ? { previousSource: result.previousSource } : {}),
        hostState: event.state,
      });
    } else if (result.sourceChanged) {
      // If an old client sends a source-changing host state without a
      // descriptor, still publish the generation bump so clients can fence P2P.
      this.broadcast(this.room.snapshot);
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
        code:
          this.room.roomCapabilities.maxMediaSeats === 0
            ? "MEDIA_UNAVAILABLE"
            : "MEDIA_SEAT_REQUIRED",
        message:
          this.room.roomCapabilities.maxMediaSeats === 0
            ? "This room does not include live media seats."
            : "Join live media before turning on camera.",
      });
      return;
    }

    const participant = this.room.setCamera(userId, wantsCamera);
    if (!participant) {
      return;
    }

    const attachment = this.getSocketAttachment(socket);
    if (attachment) {
      this.writeSocketAttachment(
        socket,
        updateRoomSocketAttachment(attachment, {
          lastSeenAt: Date.now(),
          participant,
        }),
      );
    }
    this.persistRoomState();
    this.broadcast(this.room.snapshot);
  }

  private handleMediaSeat(
    socket: WebSocket,
    event: Extract<
      ClientEvent,
      {
        type:
          | "MEDIA_JOIN_REQUEST"
          | "MEDIA_JOIN_CANCEL"
          | "MEDIA_SEAT_LEAVE"
          | "MEDIA_SEAT_GRANT"
          | "MEDIA_SEAT_REVOKE";
      }
    >,
  ): void {
    const userId = this.participantsBySocket.get(socket);
    if (!userId) {
      this.send(socket, {
        type: "ERROR",
        code: "NOT_PARTICIPANT",
        message: "Only joined room participants can update live media seats",
      });
      return;
    }

    if (event.type === "MEDIA_JOIN_REQUEST") {
      if (event.userId !== userId) {
        this.send(socket, {
          type: "ERROR",
          code: "NOT_PARTICIPANT",
          message: "Participants can only request their own live media seat",
        });
        return;
      }
      const participant = this.room.requestMediaSeat(userId);
      this.writeParticipantAttachment(socket, participant);
      this.persistRoomState();
      this.broadcast(this.room.snapshot);
      return;
    }

    if (event.type === "MEDIA_JOIN_CANCEL") {
      if (event.userId !== userId) {
        this.send(socket, {
          type: "ERROR",
          code: "NOT_PARTICIPANT",
          message: "Participants can only cancel their own live media request",
        });
        return;
      }
      const participant = this.room.cancelMediaSeatRequest(userId);
      this.writeParticipantAttachment(socket, participant);
      this.persistRoomState();
      this.broadcast(this.room.snapshot);
      return;
    }

    if (event.type === "MEDIA_SEAT_LEAVE") {
      if (event.userId !== userId) {
        this.send(socket, {
          type: "ERROR",
          code: "NOT_PARTICIPANT",
          message: "Participants can only leave their own live media seat",
        });
        return;
      }
      const participant = this.room.leaveMediaSeat(userId);
      this.writeParticipantAttachment(socket, participant);
      this.persistRoomState();
      this.broadcast(this.room.snapshot);
      return;
    }

    const result =
      event.type === "MEDIA_SEAT_GRANT"
        ? this.room.grantMediaSeat(event.targetUserId, userId)
        : this.room.revokeMediaSeat(event.targetUserId, userId);

    if (!result.accepted) {
      this.send(socket, mediaSeatError(result.code, this.room.roomCapabilities.maxMediaSeats));
      return;
    }

    const targetSocket = this.socketsByParticipant.get(result.participant.id);
    if (targetSocket) {
      this.writeParticipantAttachment(targetSocket, result.participant);
    }
    this.persistRoomState();
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
        message: "P2P signals can only be sent between live media participants",
      });
      return;
    }

    const serverReceivedAt = Date.now();
    this.p2pSignalBuffer.prune(serverReceivedAt);
    if (this.p2pSignalBuffer.hasSeen(event)) {
      return;
    }

    const forwarded: BufferedP2PSignalEvent = {
      ...event,
      roomGeneration: this.room.roomGeneration,
      serverReceivedAt,
      serverSeq: this.nextP2PServerSeq++,
      sourceGeneration: this.room.sourceGeneration,
    };

    const buffered = addP2PSignalForDispatch(
      this.p2pSignalBuffer,
      forwarded,
      forwarded.serverReceivedAt,
    );
    if (!buffered) {
      return;
    }
    writeStoredP2PReplayEvent(
      this.state.storage,
      buffered,
      getP2PSignalDedupeKey(buffered),
      forwarded.serverReceivedAt,
    );
    this.persistP2PState();
    const target = this.socketsByParticipant.get(event.toUserId);
    if (!target) {
      console.log(
        JSON.stringify({
          event: "p2p.signal.buffered_offline_target",
          fromUserId: event.fromUserId,
          roomId: event.roomId,
          serverSeq: buffered.serverSeq,
          signalKind: event.signal.kind,
          toUserId: event.toUserId,
        }),
      );
      return;
    }

    this.track("p2p_signal");
    this.send(target, buffered);
  }

  private replayP2PSignals(socket: WebSocket, participantId: string, afterServerSeq: number): void {
    const replay = this.p2pSignalBuffer
      .replayFor(participantId, afterServerSeq, Date.now(), {
        roomGeneration: this.room.roomGeneration,
        sourceGeneration: this.room.sourceGeneration,
      })
      .filter((event) => this.room.canSignal(event.fromUserId, participantId));
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

  private async handleClose(socket: WebSocket): Promise<void> {
    const participantId = this.participantsBySocket.get(socket);
    this.verifiedBySocket.delete(socket);
    this.sessionIdBySocket.delete(socket);
    this.rateLimiterBySocket.delete(socket);
    if (!participantId) {
      return;
    }

    this.participantsBySocket.delete(socket);
    if (this.socketsByParticipant.get(participantId) === socket) {
      this.socketsByParticipant.delete(participantId);
    }
    const participant = this.room.leave(participantId);
    this.persistRoomState();
    this.track("ws_close", { value: this.room.participants.length });

    if (participant) {
      this.broadcast({ type: "PARTICIPANT_LEFT", participant });
      this.broadcast(this.room.snapshot);
    }
    if (this.participantsBySocket.size === 0 && !this.endedTombstone) {
      await markStoredRoomEmpty(this.state.storage, Date.now());
      if (this.participantsBySocket.size > 0) {
        await activateStoredRoomLifecycle(this.state.storage, Date.now());
      }
    }
  }

  private send(socket: WebSocket, event: ServerEvent): void {
    try {
      socket.send(encode(event));
    } catch {
      this.state.waitUntil(this.handleClose(socket));
    }
  }

  private broadcast(event: ServerEvent, except?: WebSocket): void {
    for (const socket of this.socketsByParticipant.values()) {
      if (socket !== except) {
        this.send(socket, event);
      }
    }
  }

  private writeParticipantAttachment(socket: WebSocket, participant: Participant | null): void {
    if (!participant) {
      return;
    }
    const attachment = this.getSocketAttachment(socket);
    if (!attachment) {
      return;
    }
    this.writeSocketAttachment(
      socket,
      updateRoomSocketAttachment(attachment, {
        lastSeenAt: Date.now(),
        participant,
      }),
    );
  }
}

function mediaSeatError(
  code: "MEDIA_SEATS_FULL" | "NOT_HOST" | "NOT_PARTICIPANT",
  maxMediaSeats: number,
): ServerEvent {
  if (code === "NOT_HOST") {
    return {
      type: "ERROR",
      code,
      message: "Only the host can manage live media seats",
    };
  }
  if (code === "NOT_PARTICIPANT") {
    return {
      type: "ERROR",
      code,
      message: "Live media participant was not found",
    };
  }
  return {
    type: "ERROR",
    code,
    message:
      maxMediaSeats === 0
        ? "This room does not include live media seats."
        : `This room has no free live media seats (max ${maxMediaSeats}).`,
  };
}

export default app;
