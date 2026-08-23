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
import { createHmac, randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const API_DIR = resolve(REPO, "apps/api");
const SECRET = "local-harness-secret";
const WORKER_PORT = 8787; // matches the constants.ts fallback ws base
const ROOM_ID = `media-harness-room-${randomUUID()}`;
const TTFM_BUDGET_MS = 8000;
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

function b64url(input) {
	return Buffer.from(input).toString("base64url");
}
function signRoomToken(sub, role, participantSessionId) {
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const now = Math.floor(Date.now() / 1000);
	const payload = b64url(
		JSON.stringify({
			sub,
			roomId: ROOM_ID,
			role,
			participantSessionId,
			displayName: sub,
			avatarUrl: null,
			typ: "room",
			iss: "anidachi-auth",
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
	for (let sample = sampleRate; sample < durationSeconds * sampleRate; sample += 1) {
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

	const payload = await response.json();
	const iceServers = parseHarnessIceServers(JSON.stringify(payload.iceServers));
	if (!iceServers?.length) {
		throw new Error("Worker /ice-servers returned no usable iceServers.");
	}
	const relay = payload.relay ?? {};
	const hasTurn = relay.hasTurn ?? hasTurnServer(iceServers);
	const hasTurns443 = relay.hasTurns443 ?? hasTurns443Server(iceServers);

	if (HARNESS_FORCE_RELAY) {
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
	{ sub, role, sessionId, iceServers, cameraEnabled = true },
) {
	// Token role is the auth role (host|member); the participant role is host|viewer.
	const token = signRoomToken(
		sub,
		role === "host" ? "host" : "member",
		sessionId,
	);
	await page.evaluate(
		async ({ roomId, token, sub, role, sessionId, iceServers, cameraEnabled }) => {
			await window.AnidachiHarness.start({
				roomId,
				token,
				sub,
				role,
				sessionId,
				iceServers,
				cameraEnabled,
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
		server = createServer((_req, res) => {
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
		worker = spawn("pnpm", buildWorkerArgs(), {
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
		if (HARNESS_USE_WORKER_ICE_SERVERS) {
			activeIceServers = await loadIceServersFromWorker(
				signRoomToken("host", "host", "host-sess"),
			);
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

try {
	await main();
} catch (error) {
	console.error(
		`harness setup error: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
}
