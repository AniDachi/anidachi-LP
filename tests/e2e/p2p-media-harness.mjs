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
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import {
	createHarnessRoomToken,
	getHarnessHostIdentity,
	getP95,
	summarizeSelectedCandidatePairs,
	TTFM_P95_BUDGET_MS,
} from "./p2p-media-harness-support.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const API_DIR = resolve(REPO, "apps/api");
const SECRET = "local-harness-secret";
const WORKER_PORT = 8787; // matches the constants.ts fallback ws base
const ROOM_ID = `media-harness-room-${randomUUID()}`;
const TTFM_BUDGET_MS = TTFM_P95_BUDGET_MS;
const RECOVERY_BUDGET_MS = 12000;
const HARNESS_FORCE_RELAY = parseBooleanEnv(process.env.HARNESS_FORCE_RELAY);
const HARNESS_ICE_SERVERS_FROM_ENV = parseHarnessIceServers(
	process.env.HARNESS_ICE_SERVERS_JSON,
);
const HARNESS_USE_WORKER_ICE_SERVERS =
	parseBooleanEnv(process.env.HARNESS_USE_WORKER_ICE_SERVERS) ||
	(HARNESS_FORCE_RELAY && !HARNESS_ICE_SERVERS_FROM_ENV);
const HARNESS_ONE_WAY_SMOKE = parseBooleanEnv(
	process.env.HARNESS_ONE_WAY_SMOKE,
);
const HARNESS_DEBUG_FILTERS = (process.env.HARNESS_DEBUG_FILTER ?? "")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

function signRoomToken(sub, role, participantSessionId) {
	return createHarnessRoomToken({
		sub,
		role,
		participantSessionId,
		roomId: ROOM_ID,
		secret: SECRET,
		mediaV2Size: MEDIA_V2_SIZE,
		mediaCapabilityRevision,
	});
}

const MEDIA_V2_SIZE = Number(process.env.HARNESS_MEDIA_V2 || 0);
let mediaCapabilityRevision = 1;
let mediaSettlementPending = false;
const results = [];
function record(name, ok, detail = "") {
	results.push({ name, ok });
	console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createVoiceTestWav(durationSeconds = 4, sampleRate = 48_000) {
	const channelCount = 1;
	const bitsPerSample = 16;
	const bytesPerSample = bitsPerSample / 8;
	const dataSize = durationSeconds * sampleRate * channelCount * bytesPerSample;
	const wav = Buffer.alloc(44 + dataSize);
	wav.write("RIFF", 0);
	wav.writeUInt32LE(36 + dataSize, 4);
	wav.write("WAVE", 8);
	wav.write("fmt ", 12);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(channelCount, 22);
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
	wav.writeUInt16LE(channelCount * bytesPerSample, 32);
	wav.writeUInt16LE(bitsPerSample, 34);
	wav.write("data", 36);
	wav.writeUInt32LE(dataSize, 40);
	for (let sample = MEDIA_V2_SIZE ? 0 : sampleRate; sample < durationSeconds * sampleRate; sample += 1) {
		const time = sample / sampleRate;
		const value = Math.round(Math.sin(2 * Math.PI * 440 * time) * 0.2 * 32767);
		wav.writeInt16LE(value, 44 + sample * bytesPerSample);
	}
	return wav;
}

function parseBooleanEnv(value) {
	return value === "1" || value === "true" || value === "yes";
}

function shouldPrintHarnessDebug(message) {
	return (
		HARNESS_DEBUG_FILTERS.length === 0 ||
		HARNESS_DEBUG_FILTERS.some((filter) => message.includes(filter))
	);
}

function parseHarnessIceServers(value) {
	if (!value) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed) || !parsed.every(isIceServer)) {
			throw new Error(
				"HARNESS_ICE_SERVERS_JSON must be a JSON array of RTCIceServer objects.",
			);
		}
		return parsed;
	} catch (error) {
		throw new Error(
			`Invalid HARNESS_ICE_SERVERS_JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function isIceServer(value) {
	if (!value || typeof value !== "object") {
		return false;
	}

	const urls = value.urls;
	return (
		typeof urls === "string" ||
		(Array.isArray(urls) &&
			urls.length > 0 &&
			urls.every((url) => typeof url === "string"))
	);
}

function hasTurnServer(iceServers) {
	return (iceServers ?? []).some((server) => {
		const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
		return urls.some((url) => typeof url === "string" && /^turns?:/i.test(url));
	});
}

function hasTurns443Server(iceServers) {
	return (iceServers ?? []).some((server) => {
		const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
		return urls.some(
			(url) => typeof url === "string" && /^turns:[^?]+:443(?:\?|$)/i.test(url),
		);
	});
}

function hasRelayCandidatePair(state) {
	return (state.candidatePairTypes ?? []).some((pair) =>
		pair.startsWith("relay/"),
	);
}

function summarizeIceServersForLog(iceServers) {
	const counts = { stun: 0, turn: 0, turns: 0, other: 0 };
	for (const server of iceServers ?? []) {
		for (const url of getIceServerUrls(server)) {
			if (/^stun:/i.test(url)) counts.stun += 1;
			else if (/^turn:/i.test(url)) counts.turn += 1;
			else if (/^turns:/i.test(url)) counts.turns += 1;
			else counts.other += 1;
		}
	}
	return `stun=${counts.stun} turn=${counts.turn} turns=${counts.turns} other=${counts.other}`;
}

function getIceServerUrls(server) {
	if (!server?.urls) return [];
	return Array.isArray(server.urls) ? server.urls : [server.urls];
}

function buildWorkerArgs() {
	const args = [
		"exec",
		"wrangler",
		"dev",
		"--local",
		"--port",
		String(WORKER_PORT),
		"--var",
		`ANIDACHI_JWT_SECRET:${SECRET}`,
		"--var",
		"ANIDACHI_ENV:test",
	];

	appendWorkerVar(args, "CLOUDFLARE_TURN_KEY_ID");
	appendWorkerVar(args, "CLOUDFLARE_TURN_KEY_API_TOKEN");
	appendWorkerVar(args, "CLOUDFLARE_TURN_TTL_SECONDS");

	return args;
}

function appendWorkerVar(args, name) {
	const value = process.env[name];
	if (!value) return;
	args.push("--var", `${name}:${value}`);
}

async function loadIceServersFromWorker(roomToken) {
	const url = new URL(
		`http://127.0.0.1:${WORKER_PORT}/rooms/${encodeURIComponent(ROOM_ID)}/ice-servers`,
	);

	const response = await fetch(url, {
		headers: { Accept: "application/json", Authorization: `Bearer ${roomToken}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		throw new Error(`Worker /ice-servers failed: ${response.status}`);
	}
	const hostIdentity = getHarnessHostIdentity(MEDIA_V2_SIZE);
	console.log(
		`   actual Worker ICE verifier accepted ${MEDIA_V2_SIZE ? "v2" : "legacy"} host ${hostIdentity.sub}/${hostIdentity.participantSessionId}`,
	);

	const payload = await response.json();
	const iceServers = parseHarnessIceServers(JSON.stringify(payload.iceServers));
	if (!iceServers?.length) {
		throw new Error("Worker /ice-servers returned no usable iceServers.");
	}
	const relay = payload.relay ?? {};
	const hasTurn = relay.hasTurn ?? hasTurnServer(iceServers);
	const hasTurns443 = relay.hasTurns443 ?? hasTurns443Server(iceServers);

	if (HARNESS_FORCE_RELAY && HARNESS_USE_WORKER_ICE_SERVERS) {
		if (payload.provider !== "cloudflare" || payload.configured !== true) {
			throw new Error(
				"Worker /ice-servers is not Cloudflare TURN-configured; relay-only mode cannot prove real network readiness.",
			);
		}
		if (!hasTurn) {
			throw new Error("Worker /ice-servers returned no usable TURN URLs.");
		}
		if (!hasTurns443) {
			throw new Error(
				"Worker /ice-servers returned TURN but no turns:443 fallback for restrictive networks.",
			);
		}
	}

	console.log(
		`   worker ICE: provider=${payload.provider ?? "unknown"} configured=${payload.configured === true} ttl=${payload.ttlSeconds ?? "?"} ${summarizeIceServersForLog(iceServers)} hasTurns443=${hasTurns443 === true}`,
	);
	return iceServers;
}

async function bundleHarness() {
	const harnessImportMetaEnv = {
		WXT_P2P_FORCE_RELAY: HARNESS_FORCE_RELAY ? "true" : "false",
	};
	const result = await build({
		entryPoints: [resolve(__dirname, "harness-entry.ts")],
        alias: { react: resolve(REPO, "apps/extension/node_modules/react"), "react-dom": resolve(REPO, "apps/extension/node_modules/react-dom") },
		bundle: true,
		format: "iife",
		write: false,
		define: { "import.meta.env": JSON.stringify(harnessImportMetaEnv) },
		logLevel: "silent",
	});
	return result.outputFiles[0].text;
}

async function waitForWorker() {
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		try {
			const r = await fetch(`http://127.0.0.1:${WORKER_PORT}/`, {
				signal: AbortSignal.timeout(2000),
			});
			if (r.ok) return true;
		} catch {
			/* not ready */
		}
		await sleep(500);
	}
	return false;
}

async function startPeer(
	page,
	{ sub, role, sessionId, iceServers, cameraEnabled = true, mediaV2 = false },
) {
	// Token role is the auth role (host|member); the participant role is host|viewer.
	const token = signRoomToken(
		sub,
		role === "host" ? "host" : "member",
		sessionId,
	);
	await page.evaluate(
		async ({ roomId, token, sub, role, sessionId, iceServers, cameraEnabled, mediaV2 }) => {
			await window.AnidachiHarness.start({
				roomId,
				token,
				sub,
				role,
				sessionId,
				iceServers,
				cameraEnabled,
                mediaV2,
			});
		},
		{
			roomId: ROOM_ID,
			token,
			sub,
			role,
			sessionId,
			iceServers,
			cameraEnabled,
            mediaV2,
		},
	);
}

async function waitForRemoteVideo(page, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if (state.remoteFramesDecoded > 0)
			return { ttfmMs: Date.now() - t0, state };
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { ttfmMs: null, state };
}

async function waitForRemoteVideoCount(page, expectedCount, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if (state.remoteVideoCount === expectedCount) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForCameraEnabledCount(page, expectedCount, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if ((state.cameraEnabledCount ?? 0) >= expectedCount) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForExactCameraEnabledCount(page, expectedCount, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if ((state.cameraEnabledCount ?? 0) === expectedCount) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForRemoteFramesAbove(
	page,
	previousFrames,
	budgetMs,
	minimumNewFrames = 1,
) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		const counterAdvanced =
			state.remoteFramesDecoded >= previousFrames + minimumNewFrames;
		const peerWasReplaced =
			state.remoteFramesDecoded < previousFrames &&
			state.remoteFramesDecoded >= minimumNewFrames;
		if (counterAdvanced || peerWasReplaced) {
			return { recoveredMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { recoveredMs: null, state };
}

async function waitForRemoteVideoActivity(page, expectedActivity, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if ((state.remoteVideoActivity ?? []).includes(expectedActivity)) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForRemoteAudioActivity(page, expectedActivity, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if ((state.remoteAudioActivity ?? []).includes(expectedActivity)) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForMeasuredRemoteAudioActivity(page, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if (
			(state.remoteAudioActivity ?? []).some(
				(activity) => activity === "active" || activity === "quiet",
			)
		) {
			return { observedMs: Date.now() - t0, state };
		}
		await sleep(150);
	}
	const state = await page.evaluate(() => window.AnidachiHarness.getState());
	return { observedMs: null, state };
}

async function waitForRemoteAudioBytesAbove(
	page,
	previousBytes,
	budgetMs,
	minimumNewBytes = 500,
) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const bytes = await page.evaluate(() =>
			window.AnidachiHarness.remoteAudioBytes(),
		);
		if (bytes >= previousBytes + minimumNewBytes) {
			return { observedMs: Date.now() - t0, bytes };
		}
		await sleep(50);
	}
	const bytes = await page.evaluate(() =>
		window.AnidachiHarness.remoteAudioBytes(),
	);
	return { observedMs: null, bytes };
}

async function waitForDroppedSignal(page, kind, previousCount, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const count = await page.evaluate(
			({ kind }) => window.AnidachiHarness.getDroppedSignalCount(kind),
			{ kind },
		);
		if (count > previousCount) {
			return { count, observedMs: Date.now() - t0 };
		}
		await sleep(50);
	}
	const count = await page.evaluate(
		({ kind }) => window.AnidachiHarness.getDroppedSignalCount(kind),
		{ kind },
	);
	return { count, observedMs: null };
}

function maxIceRestartCount(state) {
	return Math.max(0, ...(state.iceRestartCounts ?? []));
}

async function getRestartSnapshot(pages) {
	const entries = [];
	for (const page of pages) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		entries.push({ page, restartCount: maxIceRestartCount(state), state });
	}
	return entries;
}

async function closeHarnessServer(server) {
	if (!server?.listening) {
		return;
	}
	await new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function stopHarnessWorker(worker) {
	if (!worker || worker.exitCode !== null || worker.signalCode !== null) {
		return;
	}
	await new Promise((resolveStop) => {
		const timeout = setTimeout(resolveStop, 3000);
		worker.once("exit", () => {
			clearTimeout(timeout);
			resolveStop();
		});
		worker.kill("SIGTERM");
	});
}

async function cleanupHarness({ browser, server, worker, audioPath }) {
	await Promise.allSettled([
		browser?.close() ?? Promise.resolve(),
		closeHarnessServer(server),
		stopHarnessWorker(worker),
		audioPath ? rm(audioPath, { force: true }) : Promise.resolve(),
	]);
}

async function main() {
	if (
		HARNESS_FORCE_RELAY &&
		!HARNESS_USE_WORKER_ICE_SERVERS &&
		!hasTurnServer(HARNESS_ICE_SERVERS_FROM_ENV)
	) {
		throw new Error(
			"HARNESS_FORCE_RELAY=true requires HARNESS_ICE_SERVERS_JSON with at least one turn: or turns: URL, or HARNESS_USE_WORKER_ICE_SERVERS=true with local Cloudflare TURN bindings.",
		);
	}

	let browser = null;
	let server = null;
	let worker = null;
	let silentAudioPath = null;
	let workerLog = "";
	try {
		const bundle = await bundleHarness();
		silentAudioPath = resolve(
			tmpdir(),
			`anidachi-p2p-silence-${process.pid}.wav`,
		);
		await writeFile(silentAudioPath, createVoiceTestWav());
		const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${bundle}</script></body></html>`;
		server = createServer(async (_req, res) => {
            if (MEDIA_V2_SIZE && _req.method === "POST") {
              let raw = ""; for await (const chunk of _req) raw += chunk;
              const body = JSON.parse(raw); mediaCapabilityRevision++;
              if (process.env.HARNESS_MEDIA_TERMINAL && body.settleOnly) { mediaSettlementPending = true; return; }
              const day = new Date().toISOString().slice(0, 10);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true, roomId: ROOM_ID, roomGeneration: 1, acknowledged: body.usage, policy: body.settleOnly ? null : { denied: false, roomToken: signRoomToken("p0", "host", "internal-renewal"), quota: MEDIA_V2_SIZE === 4 ? { day, remainingSeconds: process.env.HARNESS_MEDIA_TERMINAL ? 6 : 1800, resetAt: new Date((Math.floor(Date.now()/86400000)+1)*86400000).toISOString() } : null } }));
              return;
            }
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(html);
		});
		await new Promise((r) => server.listen(0, "127.0.0.1", r));
		const address = server.address();
		if (!address || typeof address === "string") {
			throw new Error("Harness HTTP server did not expose a TCP port.");
		}
		const pageUrl = `http://127.0.0.1:${address.port}/`;

		const iceMode = HARNESS_FORCE_RELAY ? "relay-only" : "direct-first";
		console.log(`booting wrangler dev on :${WORKER_PORT} (${iceMode}) ...`);
		worker = spawn("pnpm", [...buildWorkerArgs(), ...(MEDIA_V2_SIZE ? ["--var", `ANIDACHI_WEB_INTERNAL_BASE_URL:${pageUrl}`, "--var", "ANIDACHI_INTERNAL_API_SECRET:owned-media-harness"] : [])], {
			cwd: API_DIR,
			stdio: ["ignore", "pipe", "pipe"],
		});
		worker.stdout.on("data", (d) => (workerLog += d));
		worker.stderr.on("data", (d) => (workerLog += d));

		if (!(await waitForWorker())) {
			throw new Error(
				`wrangler dev not ready:\n${workerLog.slice(-1200)}`,
			);
		}

		let activeIceServers = HARNESS_ICE_SERVERS_FROM_ENV;
		let workerIceServers;
		if (MEDIA_V2_SIZE || HARNESS_USE_WORKER_ICE_SERVERS) {
			const hostIdentity = getHarnessHostIdentity(MEDIA_V2_SIZE);
			workerIceServers = await loadIceServersFromWorker(
				signRoomToken(
					hostIdentity.sub,
					"host",
					hostIdentity.participantSessionId,
				),
			);
		}
		if (HARNESS_USE_WORKER_ICE_SERVERS) {
			activeIceServers = workerIceServers;
		}
		if (HARNESS_FORCE_RELAY && !hasTurnServer(activeIceServers)) {
			throw new Error(
				"Relay-only harness needs TURN URLs, but the active ICE config has no turn: or turns: server. Configure Cloudflare TURN locally or pass HARNESS_ICE_SERVERS_JSON.",
			);
		}

		browser = await chromium.launch({
			args: [
				"--disable-features=WebRtcHideLocalIpsWithMdns",
				"--use-fake-device-for-media-stream",
				"--use-fake-ui-for-media-stream",
				`--use-file-for-fake-audio-capture=${silentAudioPath}`,
			],
		});

		if (MEDIA_V2_SIZE) {
            await runVersionedMediaCase(browser, pageUrl, activeIceServers);
            return;
        }
		let failed = 0;
		try {
		const hostCtx = await browser.newContext();
		const guestCtx = await browser.newContext();
		const hostPage = await hostCtx.newPage();
		const guestPage = await guestCtx.newPage();
		if (process.env.HARNESS_DEBUG) {
			await Promise.all([
				hostPage.addInitScript(() =>
					localStorage.setItem("anidachi:debug-console", "true"),
				),
				guestPage.addInitScript(() =>
					localStorage.setItem("anidachi:debug-console", "true"),
				),
			]);
			hostPage.on("console", (m) => {
				if (shouldPrintHarnessDebug(m.text())) {
					console.log(`[host] ${m.text()}`);
				}
			});
			guestPage.on("console", (m) => {
				if (shouldPrintHarnessDebug(m.text())) {
					console.log(`[guest] ${m.text()}`);
				}
			});
			hostPage.on("pageerror", (e) => console.log(`[host err] ${e.message}`));
		}
		await hostPage.goto(pageUrl);
		await guestPage.goto(pageUrl);

		await startPeer(hostPage, {
			sub: "host",
			role: "host",
			sessionId: "host-sess",
			iceServers: activeIceServers,
			cameraEnabled: !HARNESS_ONE_WAY_SMOKE,
		});
		if (!HARNESS_ONE_WAY_SMOKE) {
			await hostPage.evaluate(() => window.AnidachiHarness.startOpenMic());
			await sleep(500);
			const hostOpenMic = await hostPage.evaluate(() =>
				window.AnidachiHarness.getState(),
			);
			record(
				"Open mic publishes through deterministic silence",
				hostOpenMic.microphonePublishingWanted === true &&
					hostOpenMic.microphonePublishing === true &&
					hostOpenMic.localSpeaking === false,
				`wanted=${hostOpenMic.microphonePublishingWanted} publishing=${hostOpenMic.microphonePublishing} speaking=${hostOpenMic.localSpeaking}`,
			);
		}
		await startPeer(guestPage, {
			sub: "guest",
			role: "viewer",
			sessionId: "guest-sess",
			iceServers: activeIceServers,
		});

		if (HARNESS_ONE_WAY_SMOKE) {
			const hostCameraSnapshot = await waitForCameraEnabledCount(
				hostPage,
				1,
				RECOVERY_BUDGET_MS,
			);
			const guestCameraSnapshot = await waitForCameraEnabledCount(
				guestPage,
				1,
				RECOVERY_BUDGET_MS,
			);
			record(
				"room snapshot exposes the guest as the only camera publisher",
				hostCameraSnapshot.observedMs !== null &&
					guestCameraSnapshot.observedMs !== null,
				`host=${hostCameraSnapshot.state.cameraEnabledCount} guest=${guestCameraSnapshot.state.cameraEnabledCount}`,
			);

			const hostSees = await waitForRemoteVideo(hostPage, TTFM_BUDGET_MS);
			record(
				"camera-off host receives guest video",
				hostSees.ttfmMs !== null,
				`ttfm=${hostSees.ttfmMs}ms frames=${hostSees.state.remoteFramesDecoded}`,
			);

			await hostPage.evaluate(() => window.AnidachiHarness.stop());
			await guestPage.evaluate(() => window.AnidachiHarness.stop());
			failed = results.filter((result) => !result.ok).length;
			console.log(`\n${results.length - failed}/${results.length} checks passed`);
			process.exitCode = failed ? 1 : 0;
			return;
		}

		const hostCameraSnapshot = await waitForCameraEnabledCount(
			hostPage,
			2,
			RECOVERY_BUDGET_MS,
		);
		const guestCameraSnapshot = await waitForCameraEnabledCount(
			guestPage,
			2,
			RECOVERY_BUDGET_MS,
		);
		record(
			"room snapshot includes both active cameras before media SLOs",
			hostCameraSnapshot.observedMs !== null &&
				guestCameraSnapshot.observedMs !== null,
			`host=${hostCameraSnapshot.state.cameraEnabledCount} guest=${guestCameraSnapshot.state.cameraEnabledCount}`,
		);

		const hostSees = await waitForRemoteVideo(hostPage, TTFM_BUDGET_MS);
		const guestSees = await waitForRemoteVideo(guestPage, TTFM_BUDGET_MS);

		record(
			"host receives guest video",
			hostSees.ttfmMs !== null,
			`ttfm=${hostSees.ttfmMs}ms frames=${hostSees.state.remoteFramesDecoded}`,
		);
		record(
			"guest receives host video",
			guestSees.ttfmMs !== null,
			`ttfm=${guestSees.ttfmMs}ms frames=${guestSees.state.remoteFramesDecoded}`,
		);
		if (hostSees.ttfmMs !== null && guestSees.ttfmMs !== null) {
			record(
				"TTFM within budget both directions (S3)",
				hostSees.ttfmMs < TTFM_BUDGET_MS && guestSees.ttfmMs < TTFM_BUDGET_MS,
				`host=${hostSees.ttfmMs}ms guest=${guestSees.ttfmMs}ms`,
			);
			console.log(
				`   candidate pairs: host=${JSON.stringify(hostSees.state.candidatePairTypes)} guest=${JSON.stringify(guestSees.state.candidatePairTypes)}`,
			);
		}
		if (HARNESS_FORCE_RELAY) {
			record(
				"relay-only mode uses TURN relay candidates",
				hasRelayCandidatePair(hostSees.state) &&
					hasRelayCandidatePair(guestSees.state),
				`host=${JSON.stringify(hostSees.state.candidatePairTypes)} guest=${JSON.stringify(guestSees.state.candidatePairTypes)}`,
			);
		}

		// Health monitor (Block 5.4): a connected, responsive peer classifies "good".
		const hostHealth = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		record(
			"peer health classifies good on a live connection (S10/5.4)",
			hostHealth.peerHealth.length > 0 &&
				hostHealth.peerHealth.every((h) => h === "good"),
			`health=${JSON.stringify(hostHealth.peerHealth)}`,
		);

		const hostVideoFlow = await waitForRemoteVideoActivity(
			hostPage,
			"flowing",
			RECOVERY_BUDGET_MS,
		);
		const guestVideoFlow = await waitForRemoteVideoActivity(
			guestPage,
			"flowing",
			RECOVERY_BUDGET_MS,
		);
		record(
			"video health monitor sees expected remote camera flow",
			hostVideoFlow.observedMs !== null && guestVideoFlow.observedMs !== null,
			`host=${JSON.stringify(hostVideoFlow.state.remoteVideoActivity)} guest=${JSON.stringify(guestVideoFlow.state.remoteVideoActivity)}`,
		);

		const latePeerOpenMic = await waitForRemoteAudioBytesAbove(
			guestPage,
			0,
			RECOVERY_BUDGET_MS,
		);
		const latePeerState = await guestPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		record(
			"late peer receives active Open mic publication",
			latePeerOpenMic.observedMs !== null &&
				latePeerState.remoteAudioExpectedIds.includes("host") &&
				latePeerState.remoteAudioFlowActivity.includes("flowing"),
			`received=${latePeerOpenMic.bytes} expected=${JSON.stringify(latePeerState.remoteAudioExpectedIds)} flow=${JSON.stringify(latePeerState.remoteAudioFlowActivity)}`,
		);
		const latePeerSpeech = await waitForRemoteAudioActivity(
			guestPage,
			"active",
			RECOVERY_BUDGET_MS,
		);
		record(
			"late peer classifies deterministic Open mic speech as active",
			latePeerSpeech.observedMs !== null,
			`activity=${JSON.stringify(latePeerSpeech.state.remoteAudioActivity)}`,
		);

		const beforeOpenMicReconnect = await guestPage.evaluate(() =>
			window.AnidachiHarness.remoteAudioBytes(),
		);
		await hostPage.evaluate(() =>
			window.AnidachiHarness.reconnect("open-mic-active"),
		);
		const afterOpenMicReconnect = await waitForRemoteAudioBytesAbove(
			guestPage,
			beforeOpenMicReconnect,
			RECOVERY_BUDGET_MS,
		);
		const hostAfterOpenMicReconnect = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		record(
			"Open mic survives signaling reconnect",
			afterOpenMicReconnect.observedMs !== null &&
				hostAfterOpenMicReconnect.microphonePublishingWanted === true,
			`received=${afterOpenMicReconnect.bytes} wanted=${hostAfterOpenMicReconnect.microphonePublishingWanted}`,
		);

		const beforeCameraOffAudio = await guestPage.evaluate(() =>
			window.AnidachiHarness.remoteAudioBytes(),
		);
		await hostPage.evaluate(() =>
			window.AnidachiHarness.setCameraEnabled(false),
		);
		const cameraOffAudio = await waitForRemoteAudioBytesAbove(
			guestPage,
			beforeCameraOffAudio,
			RECOVERY_BUDGET_MS,
		);
		const cameraOffSnapshot = await waitForExactCameraEnabledCount(
			guestPage,
			1,
			RECOVERY_BUDGET_MS,
		);
		const cameraOffVideoInactive = await waitForRemoteVideoActivity(
			guestPage,
			"not-expected",
			RECOVERY_BUDGET_MS,
		);
		await sleep(500);
		const cameraOffBaseline = await guestPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		await hostPage.evaluate(() =>
			window.AnidachiHarness.setCameraEnabled(true),
		);
		const beforeCameraOnAudio = cameraOffAudio.bytes;
		const cameraOnAudio = await waitForRemoteAudioBytesAbove(
			guestPage,
			beforeCameraOnAudio,
			RECOVERY_BUDGET_MS,
		);
		const cameraOnSnapshot = await waitForCameraEnabledCount(
			guestPage,
			2,
			RECOVERY_BUDGET_MS,
		);
		const cameraOnVideoMounted = await waitForRemoteVideoCount(
			guestPage,
			1,
			RECOVERY_BUDGET_MS,
		);
		const cameraOnVideoFlowing = await waitForRemoteVideoActivity(
			guestPage,
			"flowing",
			RECOVERY_BUDGET_MS,
		);
		const cameraOnVideo = await waitForRemoteFramesAbove(
			guestPage,
			cameraOffBaseline.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
			3,
		);
		record(
			"Open mic audio survives camera off and on",
			cameraOffAudio.observedMs !== null &&
				cameraOffSnapshot.observedMs !== null &&
				cameraOffVideoInactive.observedMs !== null &&
				cameraOnAudio.observedMs !== null &&
				cameraOnSnapshot.observedMs !== null &&
				cameraOnVideoMounted.observedMs !== null &&
				cameraOnVideoFlowing.observedMs !== null &&
				cameraOnVideo.recoveredMs !== null,
			`cameraOffAudio=${cameraOffAudio.observedMs}ms cameraOffSnapshot=${cameraOffSnapshot.observedMs}ms cameraOffActivity=${cameraOffVideoInactive.observedMs}ms cameraOnAudio=${cameraOnAudio.observedMs}ms cameraOnSnapshot=${cameraOnSnapshot.observedMs}ms cameraOnMounted=${cameraOnVideoMounted.observedMs}ms cameraOnActivity=${cameraOnVideoFlowing.observedMs}ms baselineFrames=${cameraOffBaseline.remoteFramesDecoded} videoRecovered=${cameraOnVideo.recoveredMs}ms`,
		);

		const beforeMicStopVideo = cameraOnVideo.state;
		await hostPage.evaluate(() => window.AnidachiHarness.stopOpenMic());
		const afterMicStopVideo = await waitForRemoteFramesAbove(
			guestPage,
			beforeMicStopVideo.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
			1,
		);
		record(
			"stopping microphone leaves healthy video publishing",
			afterMicStopVideo.recoveredMs !== null,
			`recovered=${afterMicStopVideo.recoveredMs}ms frames=${afterMicStopVideo.state.remoteFramesDecoded}`,
		);

		// Push-to-talk latency (S6): time from startVoice() to the peer receiving
		// audio bytes, measured twice to expose mic spin-up cost on repeat presses.
		async function pressToAudioMs(speaker, listener, budgetMs) {
			const before = await listener.evaluate(() =>
				window.AnidachiHarness.remoteAudioBytes(),
			);
			const t0 = Date.now();
			await speaker.evaluate(() => window.AnidachiHarness.startVoice());
			while (Date.now() - t0 < budgetMs) {
				const bytes = await listener.evaluate(() =>
					window.AnidachiHarness.remoteAudioBytes(),
				);
				if (bytes > before + 500) return Date.now() - t0;
				await sleep(50);
			}
			return null;
		}

		const captureCountBeforeFirstPress = await hostPage.evaluate(
			() => window.AnidachiHarness.getState().then((state) => state.microphoneCaptureCount),
		);
		const firstPress = await pressToAudioMs(hostPage, guestPage, 9000);
		const captureCountAfterFirstPress = await hostPage.evaluate(
			() => window.AnidachiHarness.getState().then((state) => state.microphoneCaptureCount),
		);
		record(
			"push-to-talk audio reaches peer (S6)",
			firstPress !== null,
			`press1=${firstPress}ms captures=${captureCountAfterFirstPress}`,
		);
		await hostPage.evaluate(() => window.AnidachiHarness.stopVoice());

		await hostPage.evaluate(() =>
			window.AnidachiHarness.setParticipantAudioOutput("guest", {
				muted: true,
				volume: 0.25,
			}),
		);
		const beforeMutedGuestAudio = await hostPage.evaluate(() =>
			window.AnidachiHarness.remoteAudioBytes(),
		);
		await guestPage.evaluate(() => window.AnidachiHarness.startOpenMic());
		const mutedGuestAudio = await waitForRemoteAudioBytesAbove(
			hostPage,
			beforeMutedGuestAudio,
			RECOVERY_BUDGET_MS,
		);
		const mutedGuestSpeech = await waitForMeasuredRemoteAudioActivity(
			hostPage,
			RECOVERY_BUDGET_MS,
		);
		const hostMutedOutput = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		const guestOutput = hostMutedOutput.participantAudioOutputs.find(
			(entry) => entry.remoteUserId === "guest",
		);
		record(
			"local mute and volume do not stop incoming RTP",
			mutedGuestAudio.observedMs !== null &&
				mutedGuestSpeech.observedMs !== null &&
				guestOutput?.muted === true &&
				guestOutput?.volume === 0.25,
			`received=${mutedGuestAudio.bytes} activity=${JSON.stringify(mutedGuestSpeech.state.remoteAudioActivity)} output=${JSON.stringify(guestOutput)}`,
		);
		await guestPage.evaluate(() => window.AnidachiHarness.stopOpenMic());
		await sleep(500);
		const secondPress = await pressToAudioMs(hostPage, guestPage, 9000);
		const captureCountAfterSecondPress = await hostPage.evaluate(
			() => window.AnidachiHarness.getState().then((state) => state.microphoneCaptureCount),
		);
		record(
			"repeat push-to-talk also reaches peer",
			secondPress !== null,
			`press2=${secondPress}ms`,
		);
		record(
			"repeat push-to-talk reuses the warm microphone capture",
			captureCountAfterFirstPress === captureCountBeforeFirstPress + 1 &&
				captureCountAfterSecondPress === captureCountAfterFirstPress,
			`before=${captureCountBeforeFirstPress} first=${captureCountAfterFirstPress} second=${captureCountAfterSecondPress}`,
		);
		if (firstPress !== null && secondPress !== null) {
			console.log(
				`   push-to-talk: first=${firstPress}ms repeat=${secondPress}ms`,
			);
		}

		await hostPage.evaluate(() => window.AnidachiHarness.stopVoice());

		// A signal can be lost while the WebSocket is between transports even
		// though the RTCPeerConnection remains alive. Prove both halves of the
		// recovery protocol with real browser peers: offerer rollback/fresh offer,
		// then answerer-driven renegotiation after a dropped answer.
		const droppedOffersBefore = await guestPage.evaluate(() =>
			window.AnidachiHarness.getDroppedSignalCount("offer"),
		);
		await guestPage.evaluate(() => {
			window.AnidachiHarness.dropNextSignal("offer");
			return window.AnidachiHarness.setCameraEnabled(false);
		});
		const droppedOffer = await waitForDroppedSignal(
			guestPage,
			"offer",
			droppedOffersBefore,
			RECOVERY_BUDGET_MS,
		);
		record(
			"harness intentionally drops one offer",
			droppedOffer.observedMs !== null,
			`count=${droppedOffer.count}`,
		);
		await sleep(500);
		const beforeDroppedOfferRecovery = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		await guestPage.evaluate(() =>
			window.AnidachiHarness.setCameraEnabled(true),
		);
		await guestPage.evaluate(() =>
			window.AnidachiHarness.reconnect("dropped-offer"),
		);
		const afterDroppedOffer = await waitForRemoteFramesAbove(
			hostPage,
			beforeDroppedOfferRecovery.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
			3,
		);
		record(
			"media recovers after a dropped offer and signaling reconnect",
			afterDroppedOffer.recoveredMs !== null,
			`recovered=${afterDroppedOffer.recoveredMs}ms frames=${afterDroppedOffer.state.remoteFramesDecoded}`,
		);

		const droppedAnswersBefore = await hostPage.evaluate(() =>
			window.AnidachiHarness.getDroppedSignalCount("answer"),
		);
		await hostPage.evaluate(() =>
			window.AnidachiHarness.dropNextSignal("answer"),
		);
		await guestPage.evaluate(() =>
			window.AnidachiHarness.setCameraEnabled(false),
		);
		const droppedAnswer = await waitForDroppedSignal(
			hostPage,
			"answer",
			droppedAnswersBefore,
			RECOVERY_BUDGET_MS,
		);
		record(
			"harness intentionally drops one answer",
			droppedAnswer.observedMs !== null,
			`count=${droppedAnswer.count}`,
		);
		await sleep(500);
		const beforeDroppedAnswerRecovery = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		await guestPage.evaluate(() =>
			window.AnidachiHarness.setCameraEnabled(true),
		);
		await hostPage.evaluate(() =>
			window.AnidachiHarness.reconnect("dropped-answer"),
		);
		const afterDroppedAnswer = await waitForRemoteFramesAbove(
			hostPage,
			beforeDroppedAnswerRecovery.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
			3,
		);
		record(
			"media recovers after a dropped answer and signaling reconnect",
			afterDroppedAnswer.recoveredMs !== null,
			`recovered=${afterDroppedAnswer.recoveredMs}ms frames=${afterDroppedAnswer.state.remoteFramesDecoded}`,
		);

		// S5: reload the guest, restart, and confirm media recovers without
		// recreating the room.
		await guestPage.evaluate(() => window.AnidachiHarness.stop());
		const hostClearedOldGuestVideo = await waitForRemoteVideoCount(
			hostPage,
			0,
			RECOVERY_BUDGET_MS,
		);
		await guestPage.reload();
		await guestPage.goto(pageUrl);
		await startPeer(guestPage, {
			sub: "guest",
			role: "viewer",
			sessionId: "guest-sess",
			iceServers: activeIceServers,
		});
		await guestPage.evaluate(() => window.AnidachiHarness.startOpenMic());
		const replacedTrackAudio = await waitForRemoteAudioBytesAbove(
			hostPage,
			0,
			RECOVERY_BUDGET_MS,
		);
		const replacedTrackSpeech = await waitForMeasuredRemoteAudioActivity(
			hostPage,
			RECOVERY_BUDGET_MS,
		);
		const hostAfterGuestReplacement = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		const guestOutputAfterReplacement =
			hostAfterGuestReplacement.participantAudioOutputs.find(
				(entry) => entry.remoteUserId === "guest",
			);
		record(
			"participant output preference survives remote track replacement",
			replacedTrackAudio.observedMs !== null &&
				replacedTrackSpeech.observedMs !== null &&
				guestOutputAfterReplacement?.muted === true &&
				guestOutputAfterReplacement?.volume === 0.25,
			`received=${replacedTrackAudio.bytes} activity=${JSON.stringify(replacedTrackSpeech.state.remoteAudioActivity)} output=${JSON.stringify(guestOutputAfterReplacement)}`,
		);
		await guestPage.evaluate(() => window.AnidachiHarness.stopOpenMic());
		const guestRecovered = await waitForRemoteVideo(
			guestPage,
			RECOVERY_BUDGET_MS,
		);
		const hostStillSees = await waitForRemoteVideo(
			hostPage,
			RECOVERY_BUDGET_MS,
		);
		record(
			"host clears stale guest video before reload recovery (S5)",
			hostClearedOldGuestVideo.observedMs !== null,
			`remoteVideos=${hostClearedOldGuestVideo.state.remoteVideoCount}`,
		);
		record(
			"guest recovers video after reload (S5)",
			guestRecovered.ttfmMs !== null,
			`ttfm=${guestRecovered.ttfmMs}ms`,
		);
		record(
			"host re-establishes video to reloaded guest (S5)",
			hostStillSees.ttfmMs !== null,
			`ttfm=${hostStillSees.ttfmMs}ms frames=${hostStillSees.state.remoteFramesDecoded}`,
		);

		// S5 network-loss recovery: a short offline/online transition should
		// proactively restart ICE and return decoded video without recreating the
		// room. Playwright setOffline emulates the network at the whole browser
		// context level; the synthetic online event makes the harness deterministic
		// across Chromium versions.
		const beforeNetworkGuest = await guestPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		const beforeNetworkHost = await hostPage.evaluate(() =>
			window.AnidachiHarness.getState(),
		);
		const restartBeforeNetwork = await getRestartSnapshot([
			hostPage,
			guestPage,
		]);
		await guestCtx.setOffline(true);
		await sleep(1800);
		await guestCtx.setOffline(false);
		await guestPage.evaluate(() => window.dispatchEvent(new Event("online")));
		const guestAfterNetwork = await waitForRemoteFramesAbove(
			guestPage,
			beforeNetworkGuest.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
		);
		const hostAfterNetwork = await waitForRemoteFramesAbove(
			hostPage,
			beforeNetworkHost.remoteFramesDecoded,
			RECOVERY_BUDGET_MS,
		);
		record(
			"guest video resumes after short network loss (S5)",
			guestAfterNetwork.recoveredMs !== null,
			`recovered=${guestAfterNetwork.recoveredMs}ms frames=${guestAfterNetwork.state.remoteFramesDecoded}`,
		);
		record(
			"host video resumes from guest after short network loss (S5)",
			hostAfterNetwork.recoveredMs !== null,
			`recovered=${hostAfterNetwork.recoveredMs}ms frames=${hostAfterNetwork.state.remoteFramesDecoded}`,
		);
		const restartAfterNetwork = await getRestartSnapshot([hostPage, guestPage]);
		console.log(
			`   ICE restarts after network loss: before=${JSON.stringify(
				restartBeforeNetwork.map((entry) => entry.restartCount),
			)} after=${JSON.stringify(restartAfterNetwork.map((entry) => entry.restartCount))}`,
		);

		await hostPage.evaluate(() => window.AnidachiHarness.stop());
		await guestPage.evaluate(() => window.AnidachiHarness.stop());
		failed = results.filter((r) => !r.ok).length;
		} catch (error) {
			console.error(`harness error: ${error.message}`);
			console.error(`worker log tail:\n${workerLog.slice(-1500)}`);
			failed = 1;
		}

		console.log(`\n${results.length - failed}/${results.length} checks passed`);
		process.exitCode = failed ? 1 : 0;
	} finally {
		await cleanupHarness({
			audioPath: silentAudioPath,
			browser,
			server,
			worker,
		});
	}
}

async function runVersionedMediaCase(browser, pageUrl, iceServers) {
  if (![4, 6, 15].includes(MEDIA_V2_SIZE)) throw new Error("HARNESS_MEDIA_V2 must be 4,6,15");
  const started = Date.now();
  const watchdog = setTimeout(() => { void browser.close(); }, 60000);
  const contexts = [], pages = [];
  const cameras = MEDIA_V2_SIZE === 15 ? 4 : MEDIA_V2_SIZE === 6 ? 2 : 1;
  const microphones = MEDIA_V2_SIZE === 15 ? 8 : MEDIA_V2_SIZE === 6 ? 3 : 2;
  const receipt = { size: MEDIA_V2_SIZE, cameras, microphones, engine: "P2PMediaController+RoomClient+Worker", browser: browser.version(), tests: [], diagnostics: [] };
  const check = (name, ok, detail) => { receipt.tests.push({ name, ok, detail }); record(name, ok, JSON.stringify(detail)); if (!ok) throw new Error(name); };
  try {
    for (let i = 0; i < MEDIA_V2_SIZE; i++) {
      const context = await browser.newContext(); contexts.push(context);
      const page = await context.newPage(); pages.push(page);
      page.on("pageerror", e => console.error(`p${i}: ${e.message}`));
      if (process.env.HARNESS_DEBUG) { await page.addInitScript(() => localStorage.setItem("anidachi:debug-console", "true")); page.on("console", m => { if (shouldPrintHarnessDebug(m.text())) console.log(`p${i}: ${m.text()}`); }); }
      await page.goto(pageUrl);
      await startPeer(page, { sub: `p${i}`, role: i ? "viewer" : "host", sessionId: `s${i}`, iceServers, cameraEnabled: i < cameras, mediaV2: true });
      if (i >= cameras && i < cameras + microphones) await page.evaluate(() => window.AnidachiHarness.startOpenMic());
    }
    let diagnostics;
    const readyStart = Date.now();
    const allDecoded = ds => ds.every((d, i) => {
      const peers = d.stats?.peers || [];
      return Array.from({ length: cameras }, (_, j) => j).filter(j => j !== i).every(j => peers.some(p => p.remoteUserId === `p${j}` && p.stats?.videoInbound?.framesDecoded > 0)) &&
        Array.from({ length: microphones }, (_, j) => j + cameras).filter(j => j !== i).every(j => peers.some(p => p.remoteUserId === `p${j}` && p.stats?.audioDecoded?.totalAudioEnergy > 0));
    });
    do { diagnostics = await Promise.all(pages.map(p => p.evaluate(() => window.AnidachiHarness.diagnostics()))); if (allDecoded(diagnostics)) break; await sleep(200); } while (Date.now() - readyStart < 10000);
    receipt.diagnostics = diagnostics;
    check("every participant decodes every permitted camera and microphone", allDecoded(diagnostics), { afterLastJoinMs: Date.now()-readyStart, entireSetupMs: Date.now()-started });
    check("receiver-only participants call zero getUserMedia", diagnostics.slice(cameras+microphones).every(d => d.captureCount === 0), diagnostics.map(d => d.captureCount));
    check("bounded graph excludes receiver-to-receiver pairs", diagnostics.every((d,i) => d.stats.peers.length === (i < cameras+microphones ? MEDIA_V2_SIZE-1 : cameras+microphones)), diagnostics.map(d => d.stats.peers.length));
    const before = diagnostics;
    const resourceRows = execFileSync("ps", ["-axo", "pid=,ppid=,pcpu=,rss="], {encoding:"utf8"}).trim().split("\n").map(row=>row.trim().split(/\s+/).map(Number));
    const owned = new Set([process.pid]); for(let pass=0;pass<8;pass++) for(const [pid,ppid] of resourceRows) if(owned.has(ppid)) owned.add(pid);
    const descendants = resourceRows.filter(([pid])=>owned.has(pid));
    receipt.hostResourceSample = { scope:"owned Node harness, Chromium and local Worker descendants", cpuPercentLifetime: descendants.reduce((n,r)=>n+r[2],0), rssMiB: descendants.reduce((n,r)=>n+r[3],0)/1024, processCount:descendants.length };
    const advanceStarted = Date.now();
    await sleep(1000);
    const after = await Promise.all(pages.map(p => p.evaluate(() => window.AnidachiHarness.diagnostics())));
    const advancing = after.every((d,i) => d.stats.peers.every(p => {
      const old = before[i].stats.peers.find(old => old.remoteUserId === p.remoteUserId);
      return (!p.stats?.videoInbound || p.stats.videoInbound.framesDecoded > (old?.stats?.videoInbound?.framesDecoded ?? -1)) && (!p.stats?.audioDecoded || p.stats.audioDecoded.totalSamplesReceived > (old?.stats?.audioDecoded?.totalSamplesReceived ?? -1));
    }));
    check("all endpoints continue decoding video and audio", advancing, { endpoints: after.reduce((sum,d)=>sum+d.stats.peers.length,0) });
    const publishers = cameras + microphones;
    const expectedMediaEdges = publishers * (MEDIA_V2_SIZE - publishers) + publishers * (publishers - 1) / 2;
    const expectedPeerEndpoints = expectedMediaEdges * 2;
    const candidateSampleStarted = Date.now();
    let candidateDiagnostics = after;
    let selectedCandidatePairs = summarizeSelectedCandidatePairs(candidateDiagnostics);
    while (
      selectedCandidatePairs.selectedCount < expectedPeerEndpoints &&
      Date.now() - candidateSampleStarted < 5_000
    ) {
      await sleep(100);
      candidateDiagnostics = await Promise.all(
        pages.map(p => p.evaluate(() => window.AnidachiHarness.diagnostics())),
      );
      selectedCandidatePairs = summarizeSelectedCandidatePairs(candidateDiagnostics);
    }
    receipt.diagnostics = candidateDiagnostics;
    check(
      "selected candidate pair exists at both endpoints of every expected media edge",
      selectedCandidatePairs.selectedCount === expectedPeerEndpoints,
      { expectedMediaEdges, expectedPeerEndpoints, sampleWaitMs: Date.now() - candidateSampleStarted, ...selectedCandidatePairs },
    );
    if (HARNESS_FORCE_RELAY) {
      check(
        "relay-only mode selects relay at every expected media edge endpoint",
        selectedCandidatePairs.relayCount === expectedPeerEndpoints,
        { expectedMediaEdges, expectedPeerEndpoints, ...selectedCandidatePairs },
      );
    }
    const ttfm = candidateDiagnostics.flatMap(d=>Object.values(d.videoTtfm));
    const expectedTtfmSamples = cameras * (MEDIA_V2_SIZE - 1);
    const p95Ms = getP95(ttfm);
    check("complete decoded video first-frame sample", ttfm.length === expectedTtfmSamples, {samples:ttfm.length,expected:expectedTtfmSamples,p95Ms});
    check("decoded video TTFM p95 is below 6s (S3)", p95Ms !== null && p95Ms < TTFM_P95_BUDGET_MS, {samples:ttfm.length,p95Ms,budgetMs:TTFM_P95_BUDGET_MS,boundary:"strictly below"});
    const deltaMs = Date.now()-advanceStarted;
    receipt.publisherUplink = after.map((d,i)=>({participant:`p${i}`,kbps: d.stats.peers.reduce((n,p)=>{const old=before[i].stats.peers.find(o=>o.remoteUserId===p.remoteUserId); return n+Math.max(0,(p.stats?.audioOutbound?.bytesSent??0)-(old?.stats?.audioOutbound?.bytesSent??0))+Math.max(0,(p.stats?.videoOutbound?.bytesSent??0)-(old?.stats?.videoOutbound?.bytesSent??0));},0)*8/deltaMs})).filter(p=>p.kbps>0);
    receipt.uplinkSampleMs=deltaMs;
    for (const width of [392,320]) for (const i of [0, MEDIA_V2_SIZE-1]) {
      await pages[i].setViewportSize({width,height:900});
      await pages[i].evaluate(width => window.AnidachiHarness.renderControls(width,true),width);
      await pages[i].screenshot({path:`/private/tmp/task8-media-${MEDIA_V2_SIZE}-${i===0?"host":"receiver"}-${width}.png`,fullPage:false});
    }
    if (process.env.HARNESS_MEDIA_REVIEW_FIX) {
      const wait = async (fn) => {const start=Date.now();do {if(await fn())return Date.now()-start;await sleep(25);}while(Date.now()-start<10000);throw new Error("review fix media timeout");};
      const grant = async (i,kind) => {const d=await pages[i].evaluate(()=>window.AnidachiHarness.diagnostics());return d.media.participants.find(p=>p.participantSessionId===`s${i}`)[`${kind}Granted`];};
      for (const [i,kind] of [[0,"camera"],[1,"microphone"]]) {
        await pages[i].evaluate(kind=>window.AnidachiHarness.interruptDisable(kind),kind);
        const ms=await wait(async()=>!(await grant(i,kind)));
        check(`interrupted ${kind} off reconciles server grant after same-instance reconnect`,true,{ms});
      }
      await sleep(10500); // Permission failures are independent of the preceding reconnect mutations.
      for (const kind of ["camera","microphone"]) {
        await pages[3].evaluate(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{navigator.mediaDevices.getUserMedia=original;throw new DOMException("Synthetic denial","NotAllowedError");};});
        await pages[3].evaluate(kind=>kind==="camera"?window.AnidachiHarness.setCameraEnabled(true):window.AnidachiHarness.startOpenMic(),kind);
        const ms=await wait(async()=>!(await grant(3,kind)));
        const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());
        check(`terminal ${kind} permission denial releases only failed grant`,!d.stats.cameraEnabled&&!d.stats.microphonePublishing&&d.media.participants.find(p=>p.participantSessionId==="s2").microphoneGranted,{ms,grants:d.media.participants});
      }
      await sleep(10500); // Independent exhaustion case uses a fresh existing rate window.
      await pages[3].evaluate(()=>window.AnidachiHarness.setCameraEnabled(true));
      for(let n=0;n<3;n++) {
        const count=(await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics())).captureCount;
        await pages[3].evaluate(()=>window.AnidachiHarness.simulateDeviceRemoval());
        if(n<2) {await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());return d.captureCount>count&&d.stats.cameraEnabled&&d.stats.localTrackCount>0;});check("recoverable camera retry retains grant",await grant(3,"camera"));}
      }
      await wait(async()=>!(await grant(3,"camera")));
      const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());
      check("exhausted camera recovery releases grant and preserves other microphone reception",!d.stats.cameraEnabled&&d.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0),{grants:d.media.participants});
      await sleep(10500); // Separate microphone exhaustion from camera exhaustion signaling.
      await pages[3].evaluate(()=>window.AnidachiHarness.startOpenMic());
      for(let n=0;n<3;n++) {
        const count=(await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics())).captureCount;
        await pages[3].evaluate(()=>window.AnidachiHarness.simulateDeviceRemoval("microphone"));
        if(n<2) {await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());return d.captureCount>count&&d.stats.microphonePublishing&&d.stats.localTrackCount>0;});check("recoverable microphone retry retains grant",await grant(3,"microphone"));}
      }
      await wait(async()=>!(await grant(3,"microphone")));
      const mic=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());
      check("exhausted microphone recovery releases grant and preserves reception",!mic.stats.microphonePublishing&&mic.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0),{grants:mic.media.participants});
      return;
    }
    if (process.env.HARNESS_MEDIA_RELOAD_LIVE) {
      const wait = async (fn) => {const started=Date.now(); do {if(await fn()) return Date.now()-started; await sleep(25);} while(Date.now()-started<10000); throw new Error("live-grant reload timeout");};
      await pages[1].evaluate(()=>window.AnidachiHarness.reconnect("live-grant-socket"));
      const socket=await pages[1].evaluate(()=>window.AnidachiHarness.diagnostics());
      check("same RoomClient socket reconnect preserves explicit mic capture",socket.captureCount===1&&socket.stats.microphonePublishing&&socket.media.participants.find(p=>p.participantSessionId==="s1").microphoneGranted);
      for (const [i,media] of [[0,"camera"],[1,"microphone"]]) {
        await pages[i].reload(); await startPeer(pages[i],{sub:`p${i}`,role:i?"viewer":"host",sessionId:`s${i}`,cameraEnabled:false,mediaV2:true,iceServers});
        const released=await wait(async()=>{const d=await pages[i].evaluate(()=>window.AnidachiHarness.diagnostics());return d.media && !d.media.participants.find(p=>p.participantSessionId===`s${i}`)[`${media}Granted`]&&d.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0);});
        const d=await pages[i].evaluate(()=>window.AnidachiHarness.diagnostics());
        check(`fresh RoomClient releases restored ${media} grant and receives without capture`,d.captureCount===0,{recoveryMs:released,media:d.media.participants.find(p=>p.participantSessionId===`s${i}`)});
      }
      return;
    }
    await pages[0].evaluate(() => window.AnidachiHarness.setCameraEnabled(false));
    await sleep(500);
    const revoked = await pages[0].evaluate(() => window.AnidachiHarness.diagnostics());
    check("camera release preserves microphone reception", revoked.stats.peers.some(p => p.stats?.audioDecoded?.totalAudioEnergy > 0), { peers: revoked.stats.peers.length });
    if (process.env.HARNESS_MEDIA_TERMINAL) {
      const end = Date.now()+12000; let ended;
      do { ended=await Promise.all(pages.map(p=>p.evaluate(()=>window.AnidachiHarness.diagnostics()))); if(ended.every(d=>d.terminalEnded)) break; await sleep(50); } while(Date.now()<end);
      check("ROOM_ENDED tears down actual RTC before stalled accounting ACK", ended.every(d=>d.terminalEnded && d.stats.peers.length===0 && d.stats.localTrackCount===0 && !d.stats.microphonePublishing && !d.stats.cameraEnabled), { settlementPending: mediaSettlementPending, states: ended.map(d=>({terminal:d.terminalEnded,peers:d.stats.peers.length,microphonePublishing:d.stats.microphonePublishing})) });
    }
    if (process.env.HARNESS_MEDIA_FAULTS) await runVersionedMediaFaults(pages,contexts,pageUrl,iceServers,check,receipt);

  } finally {
    receipt.finalDiagnostics = await Promise.all(pages.map(p => p.evaluate(()=>window.AnidachiHarness.diagnostics()).catch(()=>null)));
    clearTimeout(watchdog);
    await Promise.allSettled(pages.map(p => p.evaluate(() => window.AnidachiHarness.stop())));
    await Promise.allSettled(contexts.map(c => c.close()));
    receipt.elapsedMs = Date.now() - started;
    await writeFile(process.env.HARNESS_MEDIA_REPORT || `/private/tmp/task8-media-${MEDIA_V2_SIZE}.json`, JSON.stringify(receipt, null, 2));
  }
}

async function runVersionedMediaFaults(pages,contexts,pageUrl,iceServers,check,receipt) {
  const wait = async (fn,limit=10000) => { const start=Date.now(); do {if(await fn()) return Date.now()-start; await sleep(25);} while(Date.now()-start<limit); throw new Error("media recovery timeout"); };
  await sleep(10500); // Start the independent fault phase in a new existing server rate window.
  const beforePtt=await pages[1].evaluate(()=>window.AnidachiHarness.diagnostics());
  await pages[1].evaluate(()=>window.AnidachiHarness.stopOpenMic());
  const ptt=[];
  for(let press=0;press<2;press++) {
    const baseline=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());
    const energy=baseline.stats.peers.find(p=>p.remoteUserId==="p1")?.stats?.audioDecoded?.totalAudioEnergy??0;
    const start=Date.now(); await pages[1].evaluate(()=>window.AnidachiHarness.startVoice());
    await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());return (d.stats.peers.find(p=>p.remoteUserId==="p1")?.stats?.audioDecoded?.totalAudioEnergy??0)>energy;},3000);
    ptt.push(Date.now()-start); await pages[1].evaluate(()=>window.AnidachiHarness.stopVoice()); await sleep(80);
  }
  const mic=await pages[1].evaluate(()=>window.AnidachiHarness.diagnostics());
  check("PTT first/repeat presses retain grant and reuse warm capture",mic.peerConstructionCount===beforePtt.peerConstructionCount && mic.captureCount===2 && mic.media.participants.find(p=>p.participantSessionId==="s1").microphoneGranted,{latencyMs:ptt,captureCount:mic.captureCount,signalCounts:mic.signalCounts});
  receipt.ptt=ptt;
  await pages[1].evaluate(()=>window.AnidachiHarness.startOpenMic());
  await pages[3].evaluate(()=>window.AnidachiHarness.setCameraEnabled(true));
  const late=await wait(async()=>{const d=await pages[2].evaluate(()=>window.AnidachiHarness.diagnostics()); return d.stats.peers.some(p=>p.remoteUserId==="p3"&&p.stats?.videoInbound?.framesDecoded>0);});
  check("receive-only participant can publish later",true,{decodedMs:late});
  await sleep(1000);
  await pages[3].evaluate(()=>window.AnidachiHarness.simulateDeviceRemoval());
  const removed=await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics()); return d.captureCount>=2 && d.stats.cameraEnabled;});
  check("synthetic device-ended event recovers via actual capture owner",true,{recoveryMs:removed});
  await pages[3].evaluate(()=>window.AnidachiHarness.setCameraEnabled(false));
  await pages[3].evaluate(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{navigator.mediaDevices.getUserMedia=original;throw new DOMException("Synthetic permission denial","NotAllowedError");};});
  await pages[3].evaluate(()=>window.AnidachiHarness.setCameraEnabled(true));
  const denied=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());
  check("permission denial leaves camera capture off",!denied.stats.cameraEnabled,{cameraState:denied.stats.cameraState});
  await pages[3].evaluate(()=>window.AnidachiHarness.setCameraEnabled(false));
  await sleep(10500); // Reload is a separate recovery case, after repeated capture fault mutations.
  const reloadStart=Date.now();await pages[3].reload();await startPeer(pages[3],{sub:"p3",role:"viewer",sessionId:"s3",cameraEnabled:false,mediaV2:true,iceServers});
  await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());return d.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0);});
  const reloaded=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());check("viewer reload receives without capture",reloaded.captureCount===0,{recoveryMs:Date.now()-reloadStart});
  await sleep(10500); // Independently exercise host replacement without prior viewer fault traffic.
  const hostStart=Date.now();await pages[0].reload();await startPeer(pages[0],{sub:"p0",role:"host",sessionId:"s0",cameraEnabled:false,mediaV2:true,iceServers});
  await wait(async()=>{const d=await pages[0].evaluate(()=>window.AnidachiHarness.diagnostics());return d.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0);});
  const host=await pages[0].evaluate(()=>window.AnidachiHarness.diagnostics());check("host reload receives without auto capture",host.captureCount===0,{recoveryMs:Date.now()-hostStart});
  const netStart=Date.now();await contexts[3].setOffline(true);await sleep(300);await contexts[3].setOffline(false);
  await wait(async()=>{const d=await pages[3].evaluate(()=>window.AnidachiHarness.diagnostics());return d.status==="connected"&&d.stats.peers.some(p=>p.stats?.audioDecoded?.totalAudioEnergy>0);});
  check("emulated short network loss recovers receiver",true,{recoveryMs:Date.now()-netStart});
}

/** Opt-in bounded transport experiment, never imported by production code.
 * Run HARNESS_CAPACITY_EXPERIMENT=1 node p2p-media-harness.mjs.
 * Default scenarios are 4-receiver,6-receiver. Set HARNESS_CAPACITY_SCENARIOS
 * explicitly to 15-overlap or 15-disjoint for an isolated, supervised run.
 * HARNESS_CAPACITY_TIMEOUT_MS bounds each whole scenario (default45s,max60s).
 * Synthetic 320x180@10fps canvas + oscillator audio; no receiver getUserMedia.
 * In-process signaling deliberately bypasses Worker limits to isolate raw mesh
 * capacity. Localhost results are not TURN, mobile, or production acceptance.
 */
async function runCapacityExperiment() {
	const scenarios = [
		{
			name: "4-receiver",
			count: 4,
			cameras: [0, 1, 2],
			microphones: [0, 1, 2],
		},
		{
			name: "6-receiver",
			count: 6,
			cameras: [0, 1, 2, 3],
			microphones: [0, 1, 2, 3, 4],
		},
		{
			name: "15-overlap",
			count: 15,
			cameras: [0, 1, 2, 3],
			microphones: [0, 1, 2, 3, 4, 5, 6, 7],
		},
		{
			name: "15-disjoint",
			count: 15,
			cameras: [0, 1, 2, 3],
			microphones: [4, 5, 6, 7, 8, 9, 10, 11],
		},
	];
	const selected = (
		process.env.HARNESS_CAPACITY_SCENARIOS || "4-receiver,6-receiver"
	).split(",");
	if (
		!selected.length ||
		selected.some((name) => !scenarios.some((s) => s.name === name)) ||
		new Set(selected).size !== selected.length
	)
		throw new Error("Unknown or duplicate capacity scenario");
	const timeoutMs = Number(process.env.HARNESS_CAPACITY_TIMEOUT_MS || 45000);
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000)
		throw new Error(
			"Capacity scenario timeout must be between 1000 and 60000ms",
		);
	const server = createServer((_req, res) => {
		res.writeHead(200, { "content-type": "text/html" });
		res.end("<!doctype html><title>Bounded P2P capacity experiment</title>");
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	let browser, browserServer;
	const report = {
		experiment: "receiver-only-raw-webrtc-v1",
		createdAt: new Date().toISOString(),
		environment: "single-machine Chromium localhost, synthetic media",
		forceRelay: HARNESS_FORCE_RELAY,
		selectedScenarios: selected,
		scenarioTimeoutMs: timeoutMs,
		activeScenario: null,
		results: [],
	};
	// Serialize writes so a slower earlier snapshot cannot overwrite a newer one.
	let reportWrite = Promise.resolve();
	const persist = () => {
		const json = JSON.stringify(report, null, 2) + "\n";
		reportWrite = reportWrite.then(() =>
			process.env.HARNESS_CAPACITY_REPORT
				? writeFile(process.env.HARNESS_CAPACITY_REPORT, json)
				: undefined,
		);
		return reportWrite;
	};
	try {
		if (HARNESS_FORCE_RELAY && !HARNESS_ICE_SERVERS_FROM_ENV)
			throw new Error(
				"Capacity relay experiment requires explicit HARNESS_ICE_SERVERS_JSON; no production token lookup",
			);
		browserServer = await chromium.launchServer({
			headless: true,
			args: [
				"--autoplay-policy=no-user-gesture-required",
				"--disable-background-timer-throttling",
				"--disable-renderer-backgrounding",
				"--disable-backgrounding-occluded-windows",
			],
		});
		browser = await chromium.connect(browserServer.wsEndpoint());
		report.browserVersion = browser.version();
		const system = await browser.newBrowserCDPSession();
		const cpu = async () =>
			(await system.send("SystemInfo.getProcessInfo")).processInfo.reduce(
				(sum, p) => sum + p.cpuTime,
				0,
			);
		for (const scenario of scenarios.filter((s) => selected.includes(s.name))) {
			const contexts = [],
				pages = [],
				roles = Array.from({ length: scenario.count }, (_, i) => ({
					camera: scenario.cameras.includes(i),
					microphone: scenario.microphones.includes(i),
				}));
			report.activeScenario = {
				name: scenario.name,
				startedAt: new Date().toISOString(),
				phase: "setup",
				pairsNegotiated: 0,
			};
			await persist();
			let timedOut = false;
			const watchdog = setTimeout(() => {
				timedOut = true;
				// BrowserServer.kill terminates this owned browser even when renderer
				// evaluation/normal close cannot finish. Do not start another scenario.
				void browserServer.kill().catch(() => {});
			}, timeoutMs);
			try {
				for (let i = 0; i < scenario.count; i++) {
					const context = await browser.newContext();
					contexts.push(context);
					const page = await context.newPage();
					pages.push(page);
					await page.goto(`http://127.0.0.1:${server.address().port}`);
					await page.evaluate(
						async ({ role, iceServers, forceRelay }) => {
							const tracks = {},
								peers = new Map();
							let gumCalls = 0;
							navigator.mediaDevices.getUserMedia = async () => {
								gumCalls++;
								throw new Error(
									"Synthetic experiment must not capture devices",
								);
							};
							if (role.camera) {
								const canvas = document.createElement("canvas");
								canvas.width = 320;
								canvas.height = 180;
								document.body.append(canvas);
								const ctx = canvas.getContext("2d");
								let frame = 0;
								setInterval(() => {
									ctx.fillStyle = `hsl(${frame++ % 360},70%,50%)`;
									ctx.fillRect(0, 0, 320, 180);
									ctx.fillStyle = "black";
									ctx.fillText(String(frame), 30, 50);
								}, 100);
								tracks.video = canvas.captureStream(10).getVideoTracks()[0];
							}
							if (role.microphone) {
								const audio = new AudioContext();
								const source = audio.createOscillator();
								source.frequency.value = 440;
								const output = audio.createMediaStreamDestination();
								source.connect(output);
								source.start();
								await audio.resume();
								tracks.audio = output.stream.getAudioTracks()[0];
							}
							window.capacity = {
								peers,
								tracks,
								create(id, remote, offerer) {
									const pc = new RTCPeerConnection({
										iceServers,
										iceTransportPolicy: forceRelay ? "relay" : "all",
									});
									peers.set(id, pc);
									pc.capacityRemote = remote;
									pc.ontrack = (event) => {
										const el = document.createElement(
											event.track.kind === "video" ? "video" : "audio",
										);
										el.autoplay = true;
										el.muted = true;
										el.srcObject = new MediaStream([event.track]);
										el.dataset.peer = String(id);
										document.body.append(el);
										el.play().catch(() => {});
									};
									for (const [kind, key] of [
										["video", "camera"],
										["audio", "microphone"],
									]) {
										if (offerer && (role[key] || remote[key]))
											pc.addTransceiver(tracks[kind] || kind, {
												direction: role[key]
													? remote[key]
														? "sendrecv"
														: "sendonly"
													: "recvonly",
											});
									}
								},
								async offer(id) {
									const pc = peers.get(id);
									await pc.setLocalDescription(await pc.createOffer());
									await this.gather(pc);
									return pc.localDescription.toJSON();
								},
								async answer(id, offer) {
									const pc = peers.get(id);
									await pc.setRemoteDescription(offer);
									// Answer on the offered m-lines. Pre-creating answerer
									// transceivers leaves detached senders in Unified Plan.
									for (const transceiver of pc.getTransceivers()) {
										const kind = transceiver.receiver.track.kind;
										const key = kind === "video" ? "camera" : "microphone";
										await transceiver.sender.replaceTrack(tracks[kind] || null);
										transceiver.direction = role[key]
											? pc.capacityRemote[key]
												? "sendrecv"
												: "sendonly"
											: "recvonly";
									}
									await pc.setLocalDescription(await pc.createAnswer());
									await this.gather(pc);
									return pc.localDescription.toJSON();
								},
								async accept(id, answer) {
									await peers.get(id).setRemoteDescription(answer);
								},
								async gather(pc) {
									if (pc.iceGatheringState === "complete") return;
									await new Promise((resolve, reject) => {
										const timeout = setTimeout(
											() => reject(new Error("ICE gathering timeout")),
											8000,
										);
										pc.addEventListener("icegatheringstatechange", () => {
											if (pc.iceGatheringState === "complete") {
												clearTimeout(timeout);
												resolve();
											}
										});
									});
								},
								close(id) {
									peers.get(id)?.close();
									peers.delete(id);
									document
										.querySelectorAll(`[data-peer="${id}"]`)
										.forEach((el) => el.remove());
								},
								async stats() {
									const result = {
										peerCount: peers.size,
										connected: 0,
										bytesSent: 0,
										framesDecoded: 0,
										audioSamples: 0,
										receivingVideo: 0,
										receivingAudio: 0,
										relayPairs: 0,
										gumCalls,
										localTracks: Object.keys(tracks).length,
										streams: [],
									};
									for (const [id, pc] of peers) {
										if (pc.connectionState === "connected") result.connected++;
										const stats = await pc.getStats();
										for (const stat of stats.values()) {
											if (stat.type === "outbound-rtp")
												result.bytesSent += stat.bytesSent || 0;
											if (stat.type === "inbound-rtp") {
												if (stat.kind === "video") {
													result.framesDecoded += stat.framesDecoded || 0;
													if (stat.framesDecoded > 0) result.receivingVideo++;
												}
												if (stat.kind === "audio") {
													result.audioSamples += stat.totalSamplesReceived || 0;
													if (stat.totalSamplesReceived > 0)
														result.receivingAudio++;
												}
												result.streams.push({
													peer: id,
													kind: stat.kind,
													decoded:
														stat.kind === "video"
															? stat.framesDecoded || 0
															: stat.totalSamplesReceived || 0,
												});
											}
											if (
												stat.type === "transport" &&
												stat.selectedCandidatePairId
											) {
												const pair = stats.get(stat.selectedCandidatePairId),
													local = stats.get(pair?.localCandidateId),
													remote = stats.get(pair?.remoteCandidateId);
												if (
													local?.candidateType === "relay" ||
													remote?.candidateType === "relay"
												)
													result.relayPairs++;
											}
										}
									}
									return result;
								},
							};
						},
						{
							role: roles[i],
							iceServers: HARNESS_ICE_SERVERS_FROM_ENV || [],
							forceRelay: HARNESS_FORCE_RELAY,
						},
					);
				}
				const edges = [];
				for (let a = 0; a < scenario.count; a++)
					for (let b = a + 1; b < scenario.count; b++)
						if (
							roles[a].camera ||
							roles[a].microphone ||
							roles[b].camera ||
							roles[b].microphone
						)
							edges.push([a, b]);
				const connect = async ([a, b]) => {
					await Promise.all([
						pages[a].evaluate(
							({ b, role }) => window.capacity.create(b, role, true),
							{ b, role: roles[b] },
						),
						pages[b].evaluate(
							({ a, role }) => window.capacity.create(a, role, false),
							{ a, role: roles[a] },
						),
					]);
					const offer = await pages[a].evaluate(
						(b) => window.capacity.offer(b),
						b,
					);
					const answer = await pages[b].evaluate(
						({ a, offer }) => window.capacity.answer(a, offer),
						{ a, offer },
					);
					await pages[a].evaluate(
						({ b, answer }) => window.capacity.accept(b, answer),
						{ b, answer },
					);
				};
				const setupStart = Date.now();
				for (let i = 0; i < edges.length; i += 8) {
					await Promise.all(edges.slice(i, i + 8).map(connect));
					report.activeScenario.pairsNegotiated = Math.min(edges.length, i + 8);
					await persist();
				}
				report.activeScenario.phase = "measurement";
				await persist();
				const sample = () =>
					Promise.all(
						pages.map((page) => page.evaluate(() => window.capacity.stats())),
					);
				const expectedVideo = scenario.cameras.length * (scenario.count - 1),
					expectedAudio = scenario.microphones.length * (scenario.count - 1);
				let ready;
				const deadline = Date.now() + 20000;
				do {
					ready = await sample();
					if (
						ready.reduce((s, p) => s + p.receivingVideo, 0) === expectedVideo &&
						ready.reduce((s, p) => s + p.receivingAudio, 0) === expectedAudio
					)
						break;
					await sleep(500);
				} while (Date.now() < deadline);
				const setupAndDecodeMs = Date.now() - setupStart;
				const start = await sample(),
					cpuStart = await cpu(),
					measureStart = Date.now();
				await sleep(10000);
				const end = await sample(),
					seconds = (Date.now() - measureStart) / 1000,
					cpuSeconds = (await cpu()) - cpuStart;
				const receiver = roles.findLastIndex((r) => !r.camera && !r.microphone),
					reconnectEdges = edges.filter((e) => e.includes(receiver));
				const reconnectStart = Date.now();
				for (const [a, b] of reconnectEdges)
					await Promise.all([
						pages[a].evaluate((b) => window.capacity.close(b), b),
						pages[b].evaluate((a) => window.capacity.close(a), a),
					]);
				for (let i = 0; i < reconnectEdges.length; i += 8)
					await Promise.all(reconnectEdges.slice(i, i + 8).map(connect));
				let recovered;
				do {
					recovered = await pages[receiver].evaluate(() =>
						window.capacity.stats(),
					);
					if (
						recovered.receivingVideo === scenario.cameras.length &&
						recovered.receivingAudio === scenario.microphones.length
					)
						break;
					await sleep(250);
				} while (Date.now() - reconnectStart < 20000);
				const result = {
					...scenario,
					pairCount: edges.length,
					maxPeers: Math.max(...end.map((p) => p.peerCount)),
					expectedVideo,
					expectedAudio,
					decodedVideoStreams: end.reduce((s, p) => s + p.receivingVideo, 0),
					decodedAudioStreams: end.reduce((s, p) => s + p.receivingAudio, 0),
					setupAndDecodeMs,
					measurementSeconds: seconds,
					browserCpuCorePercent: Math.round((cpuSeconds / seconds) * 100),
					uplinkKbpsPerClient: end.map((p, i) =>
						Math.round(
							((p.bytesSent - start[i].bytesSent) * 8) / seconds / 1000,
						),
					),
					decodedFramesDuringWindow: end.reduce(
						(s, p, i) => s + p.framesDecoded - start[i].framesDecoded,
						0,
					),
					audioSamplesDuringWindow: end.reduce(
						(s, p, i) => s + p.audioSamples - start[i].audioSamples,
						0,
					),
					stalledStreams: end.flatMap((p, i) =>
						p.streams
							.filter(
								(t) =>
									t.decoded <=
									(start[i].streams.find(
										(s) => s.peer === t.peer && s.kind === t.kind,
									)?.decoded ?? 0),
							)
							.map((t) => ({ client: i, ...t })),
					),
					receiverOnlyGetUserMediaCalls: end
						.filter((_, i) => !roles[i].camera && !roles[i].microphone)
						.reduce((s, p) => s + p.gumCalls, 0),
					receiverOnlyLocalTracks: end
						.filter((_, i) => !roles[i].camera && !roles[i].microphone)
						.reduce((s, p) => s + p.localTracks, 0),
					selectedRelayPeerEndpoints: end.reduce((s, p) => s + p.relayPairs, 0),
					connectedPeerEndpoints: end.reduce((s, p) => s + p.connected, 0),
					reconnectReceiver: receiver,
					reconnectMs: Date.now() - reconnectStart,
					reconnectDecodedVideo: recovered.receivingVideo,
					reconnectDecodedAudio: recovered.receivingAudio,
				};
				result.pass =
					result.decodedVideoStreams === expectedVideo &&
					result.decodedAudioStreams === expectedAudio &&
					result.connectedPeerEndpoints === edges.length * 2 &&
					result.stalledStreams.length === 0 &&
					result.reconnectDecodedVideo === scenario.cameras.length &&
					result.reconnectDecodedAudio === scenario.microphones.length &&
					result.receiverOnlyGetUserMediaCalls === 0 &&
					result.receiverOnlyLocalTracks === 0;
				report.results.push(result);
				report.activeScenario = null;
				await persist();
			} catch (error) {
				report.results.push({
					name: scenario.name,
					pass: false,
					timedOut,
					error: error instanceof Error ? error.message : String(error),
					progress: report.activeScenario,
				});
				await persist();
				throw error;
			} finally {
				// Keep the watchdog armed throughout cleanup as well.
				await Promise.allSettled(contexts.map((context) => context.close()));
				clearTimeout(watchdog);
				if (timedOut) {
					const outcome = report.results.findLast(
						(result) => result.name === scenario.name,
					);
					Object.assign(outcome, {
						pass: false,
						timedOut: true,
						error: "Capacity scenario deadline exceeded, including cleanup",
					});
					await persist();
					throw new Error(outcome.error);
				}
			}
			console.log(JSON.stringify(report.results.at(-1)));
		}
	} finally {
		// Force-close only the browser owned by this experiment, including failure paths.
		if (browserServer) await browserServer.kill().catch(() => {});
		if (browser) await browser.close().catch(() => {});
		await new Promise((resolve) => server.close(resolve));
		await persist();
	}
	if (report.results.some((r) => !r.pass)) process.exitCode = 1;
}

try {
	if (parseBooleanEnv(process.env.HARNESS_CAPACITY_EXPERIMENT))
		await runCapacityExperiment();
	else await main();
} catch (error) {
	console.error(
		`harness setup error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
}
