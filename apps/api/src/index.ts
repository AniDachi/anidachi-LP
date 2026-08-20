import {
  ClientEventSchema,
  MAX_ROOM_FRAME_BYTES,
  MAX_ROOM_ID_CHARS,
  type ClientEvent,
  type Participant,
  type RoomUsageSummary,
  type ServerEvent,
} from "@anidachi/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  signRoomHistoryAttestation,
  verifyRoomToken,
  type VerifiedRoomToken,
} from "./auth";
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
  createRoomMeterState,
  reconcileRoomMeter,
  roomUsageSummary,
  type RoomMeterState,
} from "./room-metering";
import {
  initializeRoomStorage,
  activateStoredRoomLifecycle,
  claimStoredRoomEndAttempt,
  clearStoredRoomLifecycleAndAlarm,
  markStoredRoomEmpty,
  persistEndedRoomTombstoneAndClearRuntime,
  readEndedRoomTombstone,
  readNextP2PServerSeq,
  readStoredP2PReplayMetadata,
  readStoredRoomLifecycle,
  readStoredRoomMeter,
  readStoredRoomState,
  createStoredP2PReplayMetadata,
  writeNextP2PServerSeq,
  writeStoredP2PReplayMetadata,
  writeStoredRoomMeter,
  writeStoredRoomState,
} from "./room-persistence";
import { createPrivacySafeHmacId } from "./privacy-id";
import {
  attachmentToVerifiedRoomToken,
  createRoomSocketAttachment,
  parseRoomSocketAttachment,
  updateRoomSocketAttachment,
  type RoomSocketAttachment,
} from "./room-socket-attachment";
import {
  RoomRateLimiter,
  RoomSubjectRateLimiters,
  type RoomEventClass,
  type RoomRateLimitDecision,
} from "./room-rate-limit";
import { RoomAdmission } from "./room-admission";
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
    allowHeaders: ["Authorization", "Content-Type"],
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

app.get("/rooms/:roomId/ice-servers", async (c) => {
  c.header("Cache-Control", "no-store");
  const roomId = c.req.param("roomId");
  const roomToken = readBearerToken(c.req.header("authorization"));
  if (!roomToken) {
    return c.json(
      {
        error: "ROOM_TOKEN_REQUIRED",
        message: "Bearer room token is required",
      },
      401,
    );
  }

  const verified = await verifyRoomToken(roomToken, roomId, c.env);
  if (!verified) {
    return c.json({ error: "INVALID_ROOM_TOKEN", message: "Invalid or expired room token" }, 401);
  }

  try {
    return c.json(
      await createIceServersPayload(c.env, {
        now: Date.now(),
        roomId,
        userId: verified.sub,
      }),
    );
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

app.get("/ice-servers", async (c) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Anidachi-Auth-Fallback", "query");
  const roomToken = c.req.query("roomToken");
  const roomId = c.req.query("roomId");
  if (!roomToken || !roomId) {
    return c.json(
      { error: "ROOM_TOKEN_REQUIRED", message: "roomToken and roomId are required" },
      401,
    );
  }

  const verified = await verifyRoomToken(roomToken, roomId, c.env);
  if (!verified) {
    return c.json({ error: "INVALID_ROOM_TOKEN", message: "Invalid or expired room token" }, 401);
  }
  emitRoomTelemetry(
    c.env.ROOM_ANALYTICS,
    { env: c.env.ANIDACHI_ENV ?? "local", roomId },
    { name: "ice_query_auth_fallback" },
  );

  try {
    return c.json(
      await createIceServersPayload(c.env, {
        now: Date.now(),
        roomId,
        userId: verified.sub,
      }),
    );
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
  private readonly p2pSignalOperationsBySocket = new Map<WebSocket, Promise<void>>();
  private readonly persistedP2PDedupeHashes = new Set<string>();
  private readonly socketsByParticipant = new Map<string, WebSocket>();
  private readonly verifiedBySocket = new Map<WebSocket, VerifiedRoomToken>();
  private readonly sessionIdBySocket = new Map<WebSocket, string | undefined>();
  private readonly admissionIdBySocket = new Map<WebSocket, string>();
  private readonly admissionTimeoutBySocket = new Map<WebSocket, ReturnType<typeof setTimeout>>();
  private admission: RoomAdmission;
  private readonly rateLimitersBySubject = new RoomSubjectRateLimiters();
  private nextP2PServerSeq = 1;
  private endedTombstone: ReturnType<typeof endedRoomTombstone> | null;
  private roomMeter: RoomMeterState;
  private roomEndQueue: Promise<void> = Promise.resolve();
  private roomEndInProgress = false;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    initializeRoomStorage(state.storage);

    const roomId = state.id.name ?? "room";
    this.endedTombstone = readEndedRoomTombstone(state.storage);
    this.roomMeter = readStoredRoomMeter(state.storage) ?? createRoomMeterState();
    this.room = new RoomState(roomId, undefined, readStoredRoomState(state.storage) ?? undefined);
    this.admission = new RoomAdmission({
      maxParticipants: this.room.roomCapabilities.maxParticipants,
    });
    const replayMetadata = this.endedTombstone ? [] : readStoredP2PReplayMetadata(state.storage);
    const latestStoredSeq = replayMetadata.at(-1)?.serverSeq ?? 0;
    for (const item of replayMetadata) {
      this.persistedP2PDedupeHashes.add(item.dedupeHash);
    }
    this.nextP2PServerSeq = Math.max(
      readNextP2PServerSeq(state.storage) ?? 1,
      latestStoredSeq + 1,
    );
    // A newly constructed object has no raw SDP/ICE replay in memory. The
    // durable sequence high-water mark survives longer than metadata TTL, so
    // any client behind it must renegotiate instead of waiting for media
    // signals that cannot be replayed.
    this.p2pSignalBuffer.markReplayGapThrough(this.nextP2PServerSeq - 1);
    if (!this.endedTombstone) {
      state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(HIBERNATION_KEEPALIVE_PING, HIBERNATION_KEEPALIVE_PONG),
      );
      this.restoreWebSocketsFromAttachments();
      this.reconcileRoomUsage(Date.now());
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
    const now = Date.now();
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
        this.admission.setMaxParticipants(attachment.verified.capabilities.maxParticipants);
        this.rateLimitersBySubject.setMaxParticipants(
          attachment.verified.capabilities.maxParticipants,
        );
      }
      const admissionId = crypto.randomUUID();
      this.admissionIdBySocket.set(socket, admissionId);
      if (!attachment.admission.joined) {
        if (now >= attachment.admission.deadlineAt || !this.admission.restore({
          deadlineAt: attachment.admission.deadlineAt,
          joined: false,
          socketId: admissionId,
          subject: attachment.verified.sub,
        })) {
          this.admissionIdBySocket.delete(socket);
          this.verifiedBySocket.delete(socket);
          socket.close(4001, "Room JOIN admission expired");
          continue;
        }
        this.scheduleAdmissionTimeout(socket, attachment.admission.deadlineAt);
      } else {
        this.admission.restore({
          deadlineAt: attachment.admission.deadlineAt,
          joined: true,
          socketId: admissionId,
          subject: attachment.verified.sub,
        });
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

  private scheduleAdmissionTimeout(socket: WebSocket, deadlineAt: number): void {
    const timeout = setTimeout(() => {
      this.expirePendingAdmission(socket, deadlineAt);
    }, Math.max(0, deadlineAt - Date.now()));
    this.admissionTimeoutBySocket.set(socket, timeout);
  }

  private clearAdmissionTimeout(socket: WebSocket): void {
    const timeout = this.admissionTimeoutBySocket.get(socket);
    if (timeout !== undefined) clearTimeout(timeout);
    this.admissionTimeoutBySocket.delete(socket);
  }

  private releaseAdmission(socket: WebSocket): boolean {
    this.clearAdmissionTimeout(socket);
    const admissionId = this.admissionIdBySocket.get(socket);
    this.admissionIdBySocket.delete(socket);
    return admissionId ? this.admission.release(admissionId) : false;
  }

  private expirePendingAdmission(socket: WebSocket, deadlineAt: number): void {
    const attachment = this.getSocketAttachment(socket);
    if (!attachment || attachment.admission.joined || attachment.admission.deadlineAt !== deadlineAt) {
      return;
    }
    this.send(socket, {
      type: "ERROR",
      code: "JOIN_DEADLINE_EXCEEDED",
      message: "Join the room within 10 seconds of connecting.",
    });
    this.releaseAdmission(socket);
    try {
      socket.close(4001, "Room JOIN admission expired");
    } catch {
      /* stale socket */
    }
  }

  private hasJoinDeadlineElapsed(socket: WebSocket, now = Date.now()): boolean {
    const attachment = this.getSocketAttachment(socket);
    if (!attachment || attachment.admission.joined) return false;
    if (now < attachment.admission.deadlineAt) return false;
    this.expirePendingAdmission(socket, attachment.admission.deadlineAt);
    return true;
  }

  private hasSocketForSubject(subject: string): boolean {
    for (const verified of this.verifiedBySocket.values()) {
      if (verified.sub === subject) return true;
    }
    return false;
  }

  private persistRoomState(): void {
    writeStoredRoomState(this.state.storage, this.room.toSnapshot());
  }

  private persistP2PState(): void {
    writeNextP2PServerSeq(this.state.storage, this.nextP2PServerSeq);
  }

  private isFreeRoom(): boolean {
    return this.room.roomCapabilities.hostPlanCode === "free";
  }

  private shouldMeterRoom(): boolean {
    if (!this.isFreeRoom()) return false;
    let hostJoined = false;
    let guestJoined = false;
    for (const socket of this.participantsBySocket.keys()) {
      const verified = this.verifiedBySocket.get(socket);
      if (verified?.role === "host") hostJoined = true;
      if (verified?.role === "member") guestJoined = true;
      if (hostJoined && guestJoined) return true;
    }
    return false;
  }

  private updateRoomMeter(next: RoomMeterState, now: number): void {
    if (next === this.roomMeter) return;
    writeStoredRoomMeter(this.state.storage, next, now);
    this.roomMeter = next;
  }

  private reconcileRoomUsage(now: number): void {
    this.updateRoomMeter(
      reconcileRoomMeter(this.roomMeter, this.shouldMeterRoom(), now),
      now,
    );
  }

  private stopRoomUsage(now: number): RoomUsageSummary | undefined {
    if (!this.isFreeRoom()) return undefined;
    this.updateRoomMeter(reconcileRoomMeter(this.roomMeter, false, now), now);
    return roomUsageSummary(this.roomMeter, now);
  }

  private currentRoomSnapshot(
    now = Date.now(),
  ): Extract<ServerEvent, { type: "ROOM_SNAPSHOT" }> {
    const snapshot = this.room.snapshot;
    if (snapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Room state returned a non-snapshot event");
    }
    return this.isFreeRoom()
      ? { ...snapshot, roomUsage: roomUsageSummary(this.roomMeter, now) }
      : snapshot;
  }

  private async runRoomEndExclusively<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.roomEndQueue;
    let release: () => void = () => {};
    this.roomEndQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
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
      return Response.json(
        { error: "ROOM_ENDED", endedAt: this.endedTombstone.endedAt },
        { status: 410 },
      );
    }
    if (this.roomEndInProgress) {
      return Response.json({ error: "ROOM_ENDING" }, { status: 409 });
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
      this.admission.setMaxParticipants(verified.capabilities.maxParticipants);
      this.rateLimitersBySubject.setMaxParticipants(verified.capabilities.maxParticipants);
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
    if (this.roomEndInProgress) {
      return Response.json({ error: "ROOM_ENDING" }, { status: 409 });
    }

    const admissionId = crypto.randomUUID();
    const admittedAt = Date.now();
    const reservation = this.admission.reserve(verified.sub, admissionId, admittedAt);
    if (!reservation.allowed) {
      return Response.json({ error: "ROOM_ADMISSION_LIMIT" }, { status: 429 });
    }

    let server: WebSocket | undefined;
    let accepted = false;
    try {
      const pair = new WebSocketPair();
      const client = pair[0];
      server = pair[1];
      this.state.acceptWebSocket(server);
      accepted = true;
      this.writeSocketAttachment(
        server,
        createRoomSocketAttachment(this.room.roomId, verified, admittedAt, {
          deadlineAt: reservation.deadlineAt,
          joined: false,
        }),
      );
      this.admissionIdBySocket.set(server, admissionId);
      this.scheduleAdmissionTimeout(server, reservation.deadlineAt);
      this.verifiedBySocket.set(server, verified);
      this.track("ws_open", { role: verified.role });

      return new Response(null, { status: 101, webSocket: client });
    } catch {
      if (server && this.admissionIdBySocket.has(server)) {
        this.releaseAdmission(server);
        this.verifiedBySocket.delete(server);
      } else {
        this.admission.release(admissionId);
      }
      if (accepted && server) {
        try {
          server.close(1011, "Room admission setup failed");
        } catch {
          /* stale socket */
        }
      }
      return Response.json({ error: "ROOM_ADMISSION_SETUP_FAILED" }, { status: 503 });
    }
  }

  private endRoom(command: EndRoomCommand): Promise<Response> {
    return this.runRoomEndExclusively(() => this.endRoomExclusive(command));
  }

  private async endRoomExclusive(command: EndRoomCommand): Promise<Response> {
    if (this.endedTombstone) {
      await this.applyTerminalRoomState(this.endedTombstone);
      return Response.json({
        ok: true,
        alreadyEnded: true,
        webFinalized: this.endedTombstone.usageFinalized === true,
        ...this.endedTombstone,
      });
    }

    const meteredAt = Date.now();
    const usage = this.stopRoomUsage(meteredAt);
    this.roomEndInProgress = true;
    try {
      await notifyWebRoomEnded(this.env, this.room.roomId, {
        ...command,
        ...(usage ? { usage } : {}),
      });
    } catch {
      this.reconcileRoomUsage(Date.now());
      this.roomEndInProgress = false;
      return Response.json(
        {
          error: "ROOM_END_CALLBACK_FAILED",
          message: "Room finalization callback failed",
          retryable: true,
        },
        { status: 502 },
      );
    }

    const tombstone = endedRoomTombstone(command, {
      ...(usage ? { usage } : {}),
      usageFinalized: true,
    });
    try {
      await this.applyTerminalRoomState(tombstone);
      return Response.json({
        ok: true,
        alreadyEnded: false,
        webFinalized: true,
        ...tombstone,
      });
    } finally {
      this.roomEndInProgress = false;
    }
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
    for (const timeout of this.admissionTimeoutBySocket.values()) clearTimeout(timeout);
    this.admissionTimeoutBySocket.clear();
    this.admissionIdBySocket.clear();
    this.admission = new RoomAdmission({
      maxParticipants: this.room.roomCapabilities.maxParticipants,
    });
    this.rateLimitersBySubject.clear();
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (this.endedTombstone) {
      sendAndCloseEndedRoomSockets(
        [socket],
        roomEndedEvent(this.room.roomId, this.endedTombstone),
      );
      return;
    }
    if (this.roomEndInProgress) return;
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
    console.error("[Anidachi] Room WebSocket error", {
      name: error instanceof Error ? error.name : "WebSocketError",
    });
    await this.handleClose(socket);
    try {
      socket.close(1011, "Room WebSocket error");
    } catch {
      /* already closed */
    }
  }

  async alarm(): Promise<void> {
    await this.runRoomEndExclusively(() => this.runAlarmExclusive());
  }

  private async runAlarmExclusive(): Promise<void> {
    this.roomEndInProgress = true;
    try {
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
      const usage = this.stopRoomUsage(attempt.endedAt);

      try {
        await notifyWebRoomEnded(this.env, this.room.roomId, {
          endedAt: attempt.endedAt,
          eventId: attempt.eventId,
          reason: "empty_timeout",
          ...(usage ? { usage } : {}),
        });
      } catch {
        this.track("room_end_callback_failure", { value: attempt.attempts });
        // The claim already persisted the next retry alarm and callback identity.
        return;
      }

      this.track("room_end_callback_success", { value: attempt.attempts });
      await this.applyTerminalRoomState(
        endedRoomTombstone(
          {
            endedAt: attempt.endedAt,
            reason: "empty_timeout",
          },
          {
            ...(usage ? { usage } : {}),
            usageFinalized: true,
          },
        ),
      );
    } finally {
      this.roomEndInProgress = false;
    }
  }

  private async handleMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (this.hasJoinDeadlineElapsed(socket)) return;
    const verified = this.verifiedBySocket.get(socket);
    if (!verified) {
      socket.close(4000, "Invalid Anidachi socket state");
      return;
    }
    const limiter = this.rateLimitersBySubject.forSubject(verified.sub);
    if (!limiter) {
      socket.close(1008, "Room event rate capacity exceeded");
      return;
    }
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
        await this.handleHostState(socket, event);
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
        await this.handleP2PSignal(socket, event);
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
    if (this.hasJoinDeadlineElapsed(socket)) return;
    const verified = this.verifiedBySocket.get(socket);
    if (!verified) {
      this.send(socket, {
        type: "ERROR",
        code: "AUTH_REQUIRED",
        message: "Room token is required before joining",
      });
      return;
    }

    const admissionId = this.admissionIdBySocket.get(socket);
    const admission = admissionId ? this.admission.canJoin(admissionId, Date.now()) : null;
    if (!admission?.allowed) {
      this.expirePendingAdmission(socket, this.getSocketAttachment(socket)?.admission.deadlineAt ?? 0);
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
    if (this.endedTombstone) {
      this.send(socket, roomEndedEvent(this.room.roomId, this.endedTombstone));
      socket.close(4004, "Room ended");
      return;
    }
    if (this.roomEndInProgress) {
      socket.close(1013, "Room end in progress");
      return;
    }

    const existingSocket = this.socketsByParticipant.get(serverParticipant.id);
    const attachment = this.getSocketAttachment(socket);
    if (!attachment) {
      this.send(socket, {
        type: "ERROR",
        code: "JOIN_COMMIT_FAILED",
        message: "Unable to commit this room join. Please reconnect and try again.",
      });
      socket.close(1011, "Room admission attachment is unavailable");
      return;
    }

    // Keep the existing participant socket and the pending admission intact
    // until both durable writes have succeeded. A failed attachment or room
    // persistence write must leave this socket eligible to retry before its
    // original absolute deadline.
    const roomBeforeJoin = this.room.toSnapshot();
    const joined = this.room.join(serverParticipant);
    const commitAt = Date.now();
    const commitAdmission = admissionId ? this.admission.canJoin(admissionId, commitAt) : null;
    if (!commitAdmission?.allowed) {
      this.room = new RoomState(this.room.roomId, undefined, roomBeforeJoin);
      this.expirePendingAdmission(socket, attachment.admission.deadlineAt);
      return;
    }

    const patch: Parameters<typeof updateRoomSocketAttachment>[1] = {
      admission: { ...attachment.admission, joined: true },
      lastSeenAt: commitAt,
      participant: joined,
    };
    if (event.participantSessionId !== undefined) {
      patch.participantSessionId = event.participantSessionId;
    }
    const joinedAttachment = updateRoomSocketAttachment(attachment, patch);

    try {
      this.writeSocketAttachment(socket, joinedAttachment);
      this.persistRoomState();
    } catch {
      this.room = new RoomState(this.room.roomId, undefined, roomBeforeJoin);
      try {
        this.writeSocketAttachment(socket, attachment);
        this.persistRoomState();
      } catch {
        this.releaseAdmission(socket);
        try {
          socket.close(1011, "Room join rollback failed");
        } catch {
          /* stale socket */
        }
        return;
      }
      this.send(socket, {
        type: "ERROR",
        code: "JOIN_COMMIT_FAILED",
        message: "Unable to commit this room join. Please retry before the join deadline.",
      });
      return;
    }

    const joinedAdmission = admissionId ? this.admission.join(admissionId, commitAt) : null;
    if (!joinedAdmission?.allowed) {
      // `canJoin` above and this call share the same timestamp, so this is only
      // defensive against an unexpected in-memory admission inconsistency.
      this.room = new RoomState(this.room.roomId, undefined, roomBeforeJoin);
      try {
        this.writeSocketAttachment(socket, attachment);
        this.persistRoomState();
      } catch {
        this.releaseAdmission(socket);
        try {
          socket.close(1011, "Room join rollback failed");
        } catch {
          /* stale socket */
        }
        return;
      }
      this.expirePendingAdmission(socket, attachment.admission.deadlineAt);
      return;
    }
    this.clearAdmissionTimeout(socket);

    const existingSessionId = existingSocket && existingSocket !== socket
      ? this.sessionIdBySocket.get(existingSocket)
      : undefined;
    if (existingSocket && existingSocket !== socket) {
      this.participantsBySocket.delete(existingSocket);
      this.verifiedBySocket.delete(existingSocket);
      this.sessionIdBySocket.delete(existingSocket);
    }

    // Install the replacement before attempting best-effort retirement of the
    // incumbent. A stale socket can throw from send/close, but it must never
    // prevent the already durable replacement from becoming authoritative.
    this.participantsBySocket.set(socket, joined.id);
    this.socketsByParticipant.set(joined.id, socket);
    this.sessionIdBySocket.set(socket, event.participantSessionId);

    if (existingSocket && existingSocket !== socket) {
      const sameSession =
        event.participantSessionId !== undefined &&
        existingSessionId === event.participantSessionId;

      try {
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
      } catch {
        // The incumbent is no longer authoritative; continue the committed
        // replacement's snapshot/history path even if stale-socket cleanup
        // cannot be observed by the platform.
      }
    }

    this.reconcileRoomUsage(Date.now());
    const lastSeenP2PServerSeq = event.lastSeenP2PServerSeq ?? 0;
    const replayAt = Date.now();
    const p2pResyncRequired = this.p2pSignalBuffer.requiresResyncAfter(
      lastSeenP2PServerSeq,
      replayAt,
    );
    this.send(socket, {
      ...this.currentRoomSnapshot(replayAt),
      ...(p2pResyncRequired ? { p2pResyncRequired: true } : {}),
    });
    await this.sendRoomHistoryAuthority(socket);
    this.replayP2PSignals(socket, joined.id, lastSeenP2PServerSeq, replayAt);
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

  private async handleHostState(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "HOST_STATE" }>,
  ): Promise<void> {
    const userId = this.participantsBySocket.get(socket);
    const result = userId
      ? this.room.updateHostState(userId, event.state, event.source)
      : { accepted: false, sourceChanged: false, code: "NOT_HOST" as const };
    if (!userId || !result.accepted) {
      const code = result.code ?? "NOT_HOST";
      this.send(socket, {
        type: "ERROR",
        code,
        message:
          code === "SOURCE_PROVIDER_MISMATCH"
            ? "Source provider does not match the room provider"
            : code === "INVALID_SOURCE"
              ? "Source descriptor is invalid"
              : "Only joined room participants can update playback state",
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
      this.broadcast(this.currentRoomSnapshot());
    }

    if (result.sourceChanged) {
      await this.refreshRoomHistoryAuthorities();
    }

    this.broadcast({ type: "HOST_STATE", state: event.state }, socket);
  }

  private async refreshRoomHistoryAuthorities(): Promise<void> {
    for (const socket of this.socketsByParticipant.values()) {
      await this.sendRoomHistoryAuthority(socket);
    }
  }

  private async sendRoomHistoryAuthority(socket: WebSocket): Promise<void> {
    if (this.endedTombstone || this.roomEndInProgress) {
      return;
    }

    const lifecycleBeforeSigning = await readStoredRoomLifecycle(this.state.storage);
    if (
      lifecycleBeforeSigning?.status === "ending" ||
      lifecycleBeforeSigning?.status === "ended" ||
      this.endedTombstone ||
      this.roomEndInProgress
    ) {
      return;
    }

    const verified = this.verifiedBySocket.get(socket);
    const participantId = this.participantsBySocket.get(socket);
    const participantSessionId = this.sessionIdBySocket.get(socket);
    const attachment = this.getSocketAttachment(socket);
    if (
      !verified ||
      !participantId ||
      !participantSessionId ||
      participantId !== verified.sub ||
      this.socketsByParticipant.get(participantId) !== socket ||
      !this.room.hasParticipant(participantId) ||
      attachment?.participant?.id !== participantId ||
      attachment.participantSessionId !== participantSessionId ||
      attachment.verified.sub !== verified.sub
    ) {
      return;
    }

    const roomGeneration = this.room.roomGeneration;
    const sourceGeneration = this.room.sourceGeneration;
    let attestation: string;
    try {
      attestation = await signRoomHistoryAttestation(
        {
          sub: verified.sub,
          roomId: this.room.roomId,
          participantSessionId,
          roomGeneration,
          sourceGeneration,
        },
        this.env,
      );
    } catch {
      return;
    }

    const lifecycleAfterSigning = await readStoredRoomLifecycle(this.state.storage);
    if (
      lifecycleAfterSigning?.status === "ending" ||
      lifecycleAfterSigning?.status === "ended" ||
      this.endedTombstone ||
      this.roomEndInProgress ||
      this.room.roomGeneration !== roomGeneration ||
      this.room.sourceGeneration !== sourceGeneration ||
      this.verifiedBySocket.get(socket)?.sub !== verified.sub ||
      this.participantsBySocket.get(socket) !== participantId ||
      this.sessionIdBySocket.get(socket) !== participantSessionId ||
      this.socketsByParticipant.get(participantId) !== socket
    ) {
      return;
    }

    this.send(socket, {
      type: "ROOM_HISTORY_AUTHORITY",
      roomId: this.room.roomId,
      participantSessionId,
      roomGeneration,
      sourceGeneration,
      attestation,
    });
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
    this.broadcast(this.currentRoomSnapshot());
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
      this.broadcast(this.currentRoomSnapshot());
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
      this.broadcast(this.currentRoomSnapshot());
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
      this.broadcast(this.currentRoomSnapshot());
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
    this.broadcast(this.currentRoomSnapshot());
  }

  private handleP2PSignal(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "P2P_SIGNAL" }>,
  ): Promise<void> {
    const previous = this.p2pSignalOperationsBySocket.get(socket) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(() => this.handleP2PSignalInOrder(socket, event));
    this.p2pSignalOperationsBySocket.set(socket, operation);
    return operation.finally(() => {
      if (this.p2pSignalOperationsBySocket.get(socket) === operation) {
        this.p2pSignalOperationsBySocket.delete(socket);
      }
    });
  }

  private async handleP2PSignalInOrder(
    socket: WebSocket,
    event: Extract<ClientEvent, { type: "P2P_SIGNAL" }>,
  ): Promise<void> {
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

    const authorizedRoomGeneration = this.room.roomGeneration;
    const authorizedSourceGeneration = this.room.sourceGeneration;

    this.p2pSignalBuffer.prune(Date.now());
    if (this.p2pSignalBuffer.hasSeen(event)) {
      return;
    }

    const dedupeHash = await createPrivacySafeHmacId(
      this.env.ANIDACHI_JWT_SECRET,
      "anidachi:p2p-replay-dedupe:v1",
      [getP2PSignalDedupeKey(event)],
    );
    if (
      this.endedTombstone ||
      this.participantsBySocket.get(socket) !== senderId ||
      this.socketsByParticipant.get(senderId) !== socket ||
      this.room.roomGeneration !== authorizedRoomGeneration ||
      this.room.sourceGeneration !== authorizedSourceGeneration ||
      !this.room.canSignal(senderId, event.toUserId)
    ) {
      return;
    }
    if (this.persistedP2PDedupeHashes.has(dedupeHash)) {
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
    writeStoredP2PReplayMetadata(
      this.state.storage,
      createStoredP2PReplayMetadata(buffered, dedupeHash),
      forwarded.serverReceivedAt,
    );
    this.persistP2PState();
    const target = this.socketsByParticipant.get(event.toUserId);
    if (!target) {
      console.log(
        JSON.stringify({
          event: "p2p.signal.buffered_offline_target",
          serverSeq: buffered.serverSeq,
          signalKind: event.signal.kind,
        }),
      );
      return;
    }

    this.track("p2p_signal");
    this.send(target, buffered);
  }

  private replayP2PSignals(
    socket: WebSocket,
    participantId: string,
    afterServerSeq: number,
    now = Date.now(),
  ): void {
    const replay = this.p2pSignalBuffer
      .replayFor(participantId, afterServerSeq, now, {
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
          replayed: replay.length,
        }),
      );
    }
  }

  private async handleClose(socket: WebSocket): Promise<void> {
    const participantId = this.participantsBySocket.get(socket);
    const verified = this.verifiedBySocket.get(socket);
    this.releaseAdmission(socket);
    this.verifiedBySocket.delete(socket);
    this.sessionIdBySocket.delete(socket);
    if (verified && !this.hasSocketForSubject(verified.sub)) {
      this.rateLimitersBySubject.releaseSubject(verified.sub);
    }
    if (!participantId) {
      return;
    }

    this.participantsBySocket.delete(socket);
    if (this.socketsByParticipant.get(participantId) === socket) {
      this.socketsByParticipant.delete(participantId);
    }
    const participant = this.room.leave(participantId);
    this.persistRoomState();
    this.reconcileRoomUsage(Date.now());
    this.track("ws_close", { value: this.room.participants.length });

    if (participant) {
      this.broadcast({ type: "PARTICIPANT_LEFT", participant });
      this.broadcast(this.currentRoomSnapshot());
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

function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

export default app;
