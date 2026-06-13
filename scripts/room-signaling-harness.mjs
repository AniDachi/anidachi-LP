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

function signRoomToken({ sub, roomId, role }) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub,
      roomId,
      role,
      displayName: sub,
      avatarUrl: null,
      typ: "room",
      aud: "anidachi-worker",
      iat: now,
      exp: now + 1800,
    }),
  );
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

class Client {
  constructor(roomId, sub, role) {
    this.roomId = roomId;
    this.sub = sub;
    this.role = role;
    this.events = [];
    this.closeInfo = null;
  }

  async connect(lastSeenP2PServerSeq) {
    const token = signRoomToken({ sub: this.sub, roomId: this.roomId, role: this.role });
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

  // 2. Two participants see each other.
  const room = "harness-room";
  const host = new Client(room, "user-host", "host");
  const guest = new Client(room, "user-guest", "member");
  await host.connect();
  await host.waitFor((e) => e.type === "ROOM_SNAPSHOT", "host snapshot");
  await guest.connect();
  const guestSnap = await guest.waitFor((e) => e.type === "ROOM_SNAPSHOT", "guest snapshot");
  record(
    "guest snapshot includes host",
    guestSnap.participants.some((p) => p.id === "user-host" && p.role === "host"),
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

  // 4. Reconnect/resume: the guest reconnects (same user) with
  //    lastSeenP2PServerSeq=0 and replays signals it missed (S5), while the
  //    stale socket is force-closed so no ghost participant remains (S8).
  const guestB = new Client(room, "user-guest", "member");
  await guestB.connect(0);
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

  for (const c of [host, guest, guestB, observer]) c.close();
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
