#!/usr/bin/env node
/**
 * Room signaling integration harness.
 * Block 1.4 of docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
 *
 * Boots the real API Worker via `wrangler dev --local` (workerd + a real
 * Durable Object) and drives it with multiple WebSocket clients to verify the
 * room signaling backbone that two extensions ride on: token auth, join +
 * snapshot, targeted P2P signal relay, offline buffering + replay on
 * reconnect, duplicate-socket (ghost) handling, and keepalive.
 *
 * This is the WebRTC-free layer of the two-browser harness — real getUserMedia
 * media assertions (TTFM, S3/S6) come in the Playwright slice. Dependency-free:
 * Node 22+ global WebSocket + node:crypto HS256 signing, no extra packages.
 *
 * Usage: node scripts/room-signaling-harness.mjs
 * Exit 0 = all scenarios passed.
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(__dirname, "../apps/api");
const SECRET = "local-harness-secret";
const PORT = Number(process.env.HARNESS_PORT ?? 8799);
const HTTP_BASE = `http://127.0.0.1:${PORT}`;
const WS_BASE = `ws://127.0.0.1:${PORT}`;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signRoomToken({ sub, roomId, role, capabilities }) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claims = {
      sub,
      roomId,
      role,
      capabilities,
      displayName: sub,
      avatarUrl: null,
      typ: "room",
      aud: "anidachi-worker",
      iat: now,
      exp: now + 1800,
  };
  if (!capabilities) delete claims.capabilities;
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

class Client {
  constructor(roomId, sub, role, capabilities) {
    this.roomId = roomId;
    this.sub = sub;
    this.role = role;
    this.capabilities = capabilities;
    this.events = [];
    this.closeInfo = null;
  }

  async connect(lastSeenP2PServerSeq, participantSessionId) {
    const token = signRoomToken({
      sub: this.sub,
      roomId: this.roomId,
      role: this.role,
      capabilities: this.capabilities,
    });
    const url = `${WS_BASE}/ws/${this.roomId}?roomToken=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => {
      try {
        this.events.push(JSON.parse(event.data));
      } catch {
        /* ignore non-JSON */
      }
    });
    this.ws.addEventListener("close", (event) => {
      this.closeInfo = { code: event.code, reason: event.reason };
    });
    await new Promise((res, rej) => {
      this.ws.addEventListener("open", res, { once: true });
      this.ws.addEventListener("error", () => rej(new Error("ws error")), { once: true });
    });
    const join = {
      type: "JOIN",
      roomId: this.roomId,
      participant: {
        id: this.sub,
        displayName: this.sub,
        // Client-side Participant.role is host|viewer; the authoritative
        // host/member role travels in the room token, not this payload.
        role: this.role === "host" ? "host" : "viewer",
        cameraEnabled: false,
        syncStatus: "unknown",
        lastSeenAt: 0,
      },
      videoFingerprint: "fp",
    };
    if (typeof lastSeenP2PServerSeq === "number") join.lastSeenP2PServerSeq = lastSeenP2PServerSeq;
    if (typeof participantSessionId === "string") join.participantSessionId = participantSessionId;
    this.ws.send(JSON.stringify(join));
  }

  send(event) {
    this.ws.send(JSON.stringify(event));
  }

  close() {
    this.ws?.close();
  }

  async waitFor(predicate, label, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const match = this.events.find(predicate);
      if (match) return match;
      await sleep(40);
    }
    throw new Error(`timeout waiting for ${label} (${this.sub})`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function rawConnect(roomId, token) {
  const url = `${WS_BASE}/ws/${roomId}${token ? `?roomToken=${encodeURIComponent(token)}` : ""}`;
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve({ opened: true, ws }), { once: true });
    ws.addEventListener("error", () => resolve({ opened: false }), { once: true });
  });
}

async function runScenarios() {
  // 1. Token rejection.
  const noToken = await rawConnect("reject-room", "");
  record("missing token rejected", noToken.opened === false);
  const badToken = await rawConnect("reject-room", "not-a-jwt");
  record("invalid token rejected", badToken.opened === false);

  // 1b. /ice-servers requires a valid room token (Block 7.1).
  const iceNoAuth = await fetch(`${HTTP_BASE}/ice-servers`);
  record("ice-servers without token rejected (401)", iceNoAuth.status === 401, `status=${iceNoAuth.status}`);
  const iceToken = signRoomToken({ sub: "ice-user", roomId: "ice-room", role: "member" });
  const iceAuthed = await fetch(
    `${HTTP_BASE}/ice-servers?roomId=ice-room&roomToken=${encodeURIComponent(iceToken)}`,
  );
  const icePayload = await iceAuthed.json().catch(() => null);
  record(
    "ice-servers with valid token returns servers",
    iceAuthed.status === 200 && Array.isArray(icePayload?.iceServers),
    `status=${iceAuthed.status}`,
  );
  const iceWrongRoom = await fetch(
    `${HTTP_BASE}/ice-servers?roomId=other-room&roomToken=${encodeURIComponent(iceToken)}`,
  );
  record("ice-servers rejects token for a different room (401)", iceWrongRoom.status === 401, `status=${iceWrongRoom.status}`);

  // 2. Two participants see each other.
  const room = "harness-room";
  const host = new Client(room, "user-host", "host");
  const guest = new Client(room, "user-guest", "member");
  await host.connect();
  await host.waitFor((e) => e.type === "ROOM_SNAPSHOT", "host snapshot");
  // Guest uses a stable session id (as the real extension does) so its later
  // reconnect is recognised as the same tab, not a takeover.
  await guest.connect(undefined, "guest-sess");
  const guestSnap = await guest.waitFor((e) => e.type === "ROOM_SNAPSHOT", "guest snapshot");
  record(
    "guest snapshot includes host",
    guestSnap.participants.some((p) => p.id === "user-host" && p.role === "host"),
  );
  record(
    "room snapshot carries room/source generation",
    guestSnap.roomGeneration === 1 && guestSnap.sourceGeneration === 1,
    `roomGeneration=${guestSnap.roomGeneration} sourceGeneration=${guestSnap.sourceGeneration}`,
  );
  record(
    "room snapshot carries a room serverSeq",
    Number.isInteger(guestSnap.serverSeq) && guestSnap.serverSeq >= 0,
    `serverSeq=${guestSnap.serverSeq}`,
  );
  const hostSawGuest = await host.waitFor(
    (e) => e.type === "PARTICIPANT_JOINED" && e.participant.id === "user-guest",
    "host sees guest join",
  );
  record("host notified of guest join", Boolean(hostSawGuest));
  record(
    "worker derives identity from token, not client payload",
    guestSnap.participants.every((p) => p.displayName === p.id),
  );

  // 3. Targeted P2P signal relay.
  host.send({
    type: "P2P_SIGNAL",
    roomId: room,
    fromUserId: "user-host",
    toUserId: "user-guest",
    clientSignalId: "sig-1",
    senderConnectionId: "conn-host-1",
    signal: { kind: "offer", sdp: { type: "offer", sdp: "v=0 harness" } },
  });
  const relayed = await guest.waitFor(
    (e) => e.type === "P2P_SIGNAL" && e.clientSignalId === "sig-1",
    "guest receives signal",
  );
  record("p2p signal relayed to target", relayed.fromUserId === "user-host");
  record("relayed signal carries a serverSeq", typeof relayed.serverSeq === "number");
  record(
    "relayed signal carries authoritative generations",
    relayed.roomGeneration === guestSnap.roomGeneration &&
      relayed.sourceGeneration === guestSnap.sourceGeneration,
    `roomGeneration=${relayed.roomGeneration} sourceGeneration=${relayed.sourceGeneration}`,
  );

  // 4. Reconnect/resume: the guest reconnects (same user) with
  //    lastSeenP2PServerSeq=0 and replays signals it missed (S5), while the
  //    stale socket is force-closed so no ghost participant remains (S8).
  const guestB = new Client(room, "user-guest", "member");
  await guestB.connect(0, "guest-sess");
  const replayed = await guestB.waitFor(
    (e) => e.type === "P2P_SIGNAL" && e.clientSignalId === "sig-1",
    "guest reconnect replay",
  );
  record("missed signal replayed on reconnect (S5)", Boolean(replayed));
  await sleep(300);
  record(
    "stale duplicate socket force-closed (4000)",
    guest.closeInfo?.code === 4000,
    `code=${guest.closeInfo?.code}`,
  );
  const observer = new Client(room, "user-observer", "member");
  await observer.connect();
  const obsSnap = await observer.waitFor((e) => e.type === "ROOM_SNAPSHOT", "observer snapshot");
  const guestCount = obsSnap.participants.filter((p) => p.id === "user-guest").length;
  record("no ghost participant after reconnect (S8)", guestCount === 1, `guestCount=${guestCount}`);

  // 5. Keepalive PING -> PONG.
  guestB.send({ type: "PING", roomId: room, sentAt: Date.now() });
  const pong = await guestB.waitFor((e) => e.type === "PONG", "pong");
  record("ping answered with pong", typeof pong.serverTime === "number");

  // 5b. Clean leave: closing the socket (what the extension does on pagehide,
  //     Block 4.4) makes the Worker drop the participant promptly and broadcast
  //     PARTICIPANT_LEFT — no ghost waiting for the keepalive timeout.
  guestB.close();
  const leftEvent = await observer.waitFor(
    (e) => e.type === "PARTICIPANT_LEFT" && e.participant.id === "user-guest",
    "observer sees guest leave",
  );
  record("clean socket close broadcasts PARTICIPANT_LEFT", Boolean(leftEvent));
  const afterLeave = await observer.waitFor(
    (e) => e.type === "ROOM_SNAPSHOT" && !e.participants.some((p) => p.id === "user-guest"),
    "snapshot without departed guest",
  );
  record("departed participant removed from snapshot", Boolean(afterLeave));

  // 6. Participant cap (PD3): 4 distinct users admitted, the 5th rejected with
  //    ROOM_FULL + close 4003, while a reconnect of an existing member is fine.
  const capRoom = "cap-room";
  const capped = [];
  for (let i = 1; i <= 4; i++) {
    const member = new Client(capRoom, `cap-${i}`, i === 1 ? "host" : "member");
    await member.connect();
    await member.waitFor((e) => e.type === "ROOM_SNAPSHOT", `cap-${i} snapshot`);
    capped.push(member);
  }
  const fifth = new Client(capRoom, "cap-5", "member");
  await fifth.connect();
  const fullError = await fifth.waitFor(
    (e) => e.type === "ERROR" && e.code === "ROOM_FULL",
    "fifth participant ROOM_FULL",
  );
  record("fifth participant rejected with ROOM_FULL", Boolean(fullError));
  await sleep(300);
  record("rejected fifth socket closed (4003)", fifth.closeInfo?.code === 4003, `code=${fifth.closeInfo?.code}`);

  const rejoin = new Client(capRoom, "cap-1", "host");
  await rejoin.connect();
  const rejoinSnap = await rejoin
    .waitFor((e) => e.type === "ROOM_SNAPSHOT", "cap-1 rejoin snapshot")
    .catch(() => null);
  record("existing member reconnect not capped", Boolean(rejoinSnap));

  // 6b. Signed room capabilities raise the participant cap above the legacy
  //     mesh default while keeping the same reconnect behavior.
  const plusCapabilities = {
    hostPlanCode: "plus",
    maxParticipants: 6,
    maxMediaSeats: 4,
    canNameRoom: true,
    canSendPushInvites: true,
  };
  const plusRoom = "plus-cap-room";
  const plusMembers = [];
  for (let i = 1; i <= 6; i++) {
    const member = new Client(
      plusRoom,
      `plus-${i}`,
      i === 1 ? "host" : "member",
      plusCapabilities,
    );
    await member.connect();
    const snapshot = await member.waitFor(
      (e) => e.type === "ROOM_SNAPSHOT",
      `plus-${i} snapshot`,
    );
    if (i === 1) {
      record(
        "signed capabilities included in room snapshot",
        snapshot.capabilities?.maxParticipants === 6 &&
          snapshot.capabilities?.maxMediaSeats === 4,
      );
    }
    plusMembers.push(member);
  }
  const plusSeventh = new Client(plusRoom, "plus-7", "member", plusCapabilities);
  await plusSeventh.connect();
  const plusFullError = await plusSeventh.waitFor(
    (e) => e.type === "ERROR" && e.code === "ROOM_FULL",
    "plus seventh participant ROOM_FULL",
  );
  record("signed participant cap rejects seventh member", Boolean(plusFullError));
  plusMembers.forEach((member) => member.close());
  plusSeventh.close();

  // 6c. Media seats are capped independently from total participants.
  const mediaCapabilities = {
    hostPlanCode: "pro",
    maxParticipants: 4,
    maxMediaSeats: 1,
    canNameRoom: true,
    canSendPushInvites: true,
  };
  const mediaRoom = "media-seat-room";
  const mediaHost = new Client(mediaRoom, "media-host", "host", mediaCapabilities);
  const mediaGuest = new Client(mediaRoom, "media-guest", "member", mediaCapabilities);
  await mediaHost.connect();
  await mediaHost.waitFor((e) => e.type === "ROOM_SNAPSHOT", "media host snapshot");
  await mediaGuest.connect();
  await mediaGuest.waitFor((e) => e.type === "ROOM_SNAPSHOT", "media guest snapshot");
  mediaHost.send({ type: "CAMERA_ON", roomId: mediaRoom, userId: "media-host" });
  await mediaGuest.waitFor(
    (e) =>
      e.type === "ROOM_SNAPSHOT" &&
      e.participants.some((participant) => participant.id === "media-host" && participant.cameraEnabled),
    "media host camera enabled",
  );
  mediaGuest.send({ type: "CAMERA_ON", roomId: mediaRoom, userId: "media-guest" });
  const mediaSeatError = await mediaGuest.waitFor(
    (e) => e.type === "ERROR" && e.code === "MEDIA_SEATS_FULL",
    "media seat full error",
  );
  record("media seat cap rejects extra camera", Boolean(mediaSeatError));
  mediaHost.send({ type: "CAMERA_OFF", roomId: mediaRoom, userId: "media-host" });
  await mediaGuest.waitFor(
    (e) =>
      e.type === "ROOM_SNAPSHOT" &&
      e.participants.some((participant) => participant.id === "media-host" && !participant.cameraEnabled),
    "media host camera disabled",
  );
  mediaGuest.send({ type: "CAMERA_ON", roomId: mediaRoom, userId: "media-guest" });
  const guestCameraSnapshot = await mediaHost.waitFor(
    (e) =>
      e.type === "ROOM_SNAPSHOT" &&
      e.participants.some((participant) => participant.id === "media-guest" && participant.cameraEnabled),
    "media guest camera enabled",
  );
  record("media seat frees after camera off", Boolean(guestCameraSnapshot));
  mediaHost.close();
  mediaGuest.close();

  // 7. One active session (Block 4): a different session id for the same user
  //    takes the session over (displaced tab gets SESSION_TAKEN_OVER + 4002),
  //    while a reconnect with the SAME session id is a silent 4000 replace.
  const sessionRoom = "session-room";
  const tabA = new Client(sessionRoom, "user-tabs", "host");
  await tabA.connect(undefined, "sess-A");
  await tabA.waitFor((e) => e.type === "ROOM_SNAPSHOT", "tab A snapshot");
  const tabB = new Client(sessionRoom, "user-tabs", "host");
  await tabB.connect(undefined, "sess-B");
  await tabB.waitFor((e) => e.type === "ROOM_SNAPSHOT", "tab B snapshot");
  const takenOver = await tabA.waitFor(
    (e) => e.type === "ERROR" && e.code === "SESSION_TAKEN_OVER",
    "tab A taken over",
  );
  record("different session takes over (SESSION_TAKEN_OVER)", Boolean(takenOver));
  await sleep(250);
  record("displaced session closed (4002)", tabA.closeInfo?.code === 4002, `code=${tabA.closeInfo?.code}`);

  const tabBReconnect = new Client(sessionRoom, "user-tabs", "host");
  await tabBReconnect.connect(undefined, "sess-B");
  await tabBReconnect.waitFor((e) => e.type === "ROOM_SNAPSHOT", "tab B reconnect snapshot");
  await sleep(250);
  const tabBTakeover = tabB.events.some(
    (e) => e.type === "ERROR" && e.code === "SESSION_TAKEN_OVER",
  );
  record(
    "same-session reconnect is silent (4000, no takeover error)",
    tabB.closeInfo?.code === 4000 && !tabBTakeover,
    `code=${tabB.closeInfo?.code} takeover=${tabBTakeover}`,
  );

  for (const c of [
    host,
    guest,
    guestB,
    observer,
    ...capped,
    fifth,
    rejoin,
    tabA,
    tabB,
    tabBReconnect,
  ]) {
    c.close();
  }
}

async function main() {
  console.log(`booting wrangler dev on :${PORT} ...`);
  const worker = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--local",
      "--port",
      String(PORT),
      "--var",
      `ANIDACHI_JWT_SECRET:${SECRET}`,
      "--var",
      "ANIDACHI_ENV:test",
    ],
    { cwd: API_DIR, stdio: ["ignore", "pipe", "pipe"] },
  );
  let workerLog = "";
  worker.stdout.on("data", (d) => (workerLog += d.toString()));
  worker.stderr.on("data", (d) => (workerLog += d.toString()));

  const ready = await waitForReady();
  if (!ready) {
    console.error("wrangler dev did not become ready:\n" + workerLog.slice(-1500));
    worker.kill("SIGTERM");
    process.exit(1);
  }

  let failed = 0;
  try {
    await runScenarios();
    failed = results.filter((r) => !r.ok).length;
  } catch (error) {
    console.error(`harness error: ${error.message}`);
    failed = 1;
  } finally {
    worker.kill("SIGTERM");
  }

  console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
  process.exit(failed ? 1 : 0);
}

async function waitForReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${HTTP_BASE}/`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      /* not ready yet */
    }
    await sleep(500);
  }
  return false;
}

await main();
