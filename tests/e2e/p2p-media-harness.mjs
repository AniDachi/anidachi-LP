#!/usr/bin/env node
/**
 * Real-WebRTC two-browser P2P harness (Block 1.5).
 *
 * Bundles the *actual* extension P2P engine + room client (tests/e2e/harness-entry.ts)
 * with esbuild, boots the real Worker via `wrangler dev`, serves the harness page
 * over http://127.0.0.1 (a secure context for getUserMedia), and drives two
 * Chromium contexts with a fake camera. It asserts the SLOs that matter for
 * "p2p works": both peers actually receive decoded video (TTFM, S3/S4), and a
 * reloaded peer recovers media without recreating the room (S5).
 *
 * Run from tests/e2e: `node p2p-media-harness.mjs` (after `pnpm install` here and
 * `npx playwright install chromium`).
 */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const API_DIR = resolve(REPO, "apps/api");
const SECRET = "local-harness-secret";
const WORKER_PORT = 8787; // matches the constants.ts fallback ws base
const ROOM_ID = "media-harness-room";
const TTFM_BUDGET_MS = 8000;
const RECOVERY_BUDGET_MS = 12000;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}
function signRoomToken(sub, role) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub,
      roomId: ROOM_ID,
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
  return `${data}.${createHmac("sha256", SECRET).update(data).digest("base64url")}`;
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bundleHarness() {
  const result = await build({
    entryPoints: [resolve(__dirname, "harness-entry.ts")],
    bundle: true,
    format: "iife",
    write: false,
    define: { "import.meta.env": "{}" },
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

async function waitForWorker() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${WORKER_PORT}/`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await sleep(500);
  }
  return false;
}

async function startPeer(page, { sub, role, sessionId }) {
  // Token role is the auth role (host|member); the participant role is host|viewer.
  const token = signRoomToken(sub, role === "host" ? "host" : "member");
  await page.evaluate(
    async ({ roomId, token, sub, role, sessionId }) => {
      await window.AnidachiHarness.start({ roomId, token, sub, role, sessionId });
    },
    { roomId: ROOM_ID, token, sub, role, sessionId },
  );
}

async function waitForRemoteVideo(page, budgetMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const state = await page.evaluate(() => window.AnidachiHarness.getState());
    if (state.remoteFramesDecoded > 0) return { ttfmMs: Date.now() - t0, state };
    await sleep(150);
  }
  const state = await page.evaluate(() => window.AnidachiHarness.getState());
  return { ttfmMs: null, state };
}

async function main() {
  const bundle = await bundleHarness();
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${bundle}</script></body></html>`;
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const pagePort = server.address().port;
  const pageUrl = `http://127.0.0.1:${pagePort}/`;

  console.log(`booting wrangler dev on :${WORKER_PORT} ...`);
  const worker = spawn(
    "pnpm",
    ["exec", "wrangler", "dev", "--local", "--port", String(WORKER_PORT),
     "--var", `ANIDACHI_JWT_SECRET:${SECRET}`, "--var", "ANIDACHI_ENV:test"],
    { cwd: API_DIR, stdio: ["ignore", "pipe", "pipe"] },
  );
  let workerLog = "";
  worker.stdout.on("data", (d) => (workerLog += d));
  worker.stderr.on("data", (d) => (workerLog += d));

  if (!(await waitForWorker())) {
    console.error("wrangler dev not ready:\n" + workerLog.slice(-1200));
    worker.kill("SIGTERM");
    server.close();
    process.exit(1);
  }

  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });

  let failed = 0;
  try {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    let guestPage = await guestCtx.newPage();
    if (process.env.HARNESS_DEBUG) {
      hostPage.on("console", (m) => console.log(`[host] ${m.text()}`));
      guestPage.on("console", (m) => console.log(`[guest] ${m.text()}`));
      hostPage.on("pageerror", (e) => console.log(`[host err] ${e.message}`));
    }
    await hostPage.goto(pageUrl);
    await guestPage.goto(pageUrl);

    await startPeer(hostPage, { sub: "host", role: "host", sessionId: "host-sess" });
    await startPeer(guestPage, { sub: "guest", role: "viewer", sessionId: "guest-sess" });

    const hostSees = await waitForRemoteVideo(hostPage, TTFM_BUDGET_MS);
    const guestSees = await waitForRemoteVideo(guestPage, TTFM_BUDGET_MS);

    record("host receives guest video", hostSees.ttfmMs !== null, `ttfm=${hostSees.ttfmMs}ms frames=${hostSees.state.remoteFramesDecoded}`);
    record("guest receives host video", guestSees.ttfmMs !== null, `ttfm=${guestSees.ttfmMs}ms frames=${guestSees.state.remoteFramesDecoded}`);
    if (hostSees.ttfmMs !== null && guestSees.ttfmMs !== null) {
      record(
        "TTFM within budget both directions (S3)",
        hostSees.ttfmMs < TTFM_BUDGET_MS && guestSees.ttfmMs < TTFM_BUDGET_MS,
        `host=${hostSees.ttfmMs}ms guest=${guestSees.ttfmMs}ms`,
      );
      console.log(`   candidate pairs: host=${JSON.stringify(hostSees.state.candidatePairTypes)} guest=${JSON.stringify(guestSees.state.candidatePairTypes)}`);
    }

    // S5: reload the guest, restart, and confirm media recovers without
    // recreating the room.
    await guestPage.evaluate(() => window.AnidachiHarness.stop());
    await guestPage.reload();
    await guestPage.goto(pageUrl);
    await startPeer(guestPage, { sub: "guest", role: "viewer", sessionId: "guest-sess" });
    const guestRecovered = await waitForRemoteVideo(guestPage, RECOVERY_BUDGET_MS);
    const hostStillSees = await waitForRemoteVideo(hostPage, RECOVERY_BUDGET_MS);
    record("guest recovers video after reload (S5)", guestRecovered.ttfmMs !== null, `ttfm=${guestRecovered.ttfmMs}ms`);
    record("host re-establishes video to reloaded guest (S5)", hostStillSees.ttfmMs !== null, `frames=${hostStillSees.state.remoteFramesDecoded}`);

    await hostPage.evaluate(() => window.AnidachiHarness.stop());
    await guestPage.evaluate(() => window.AnidachiHarness.stop());
    failed = results.filter((r) => !r.ok).length;
  } catch (error) {
    console.error(`harness error: ${error.message}`);
    console.error("worker log tail:\n" + workerLog.slice(-1500));
    failed = 1;
  } finally {
    await browser.close();
    worker.kill("SIGTERM");
    server.close();
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

await main();
