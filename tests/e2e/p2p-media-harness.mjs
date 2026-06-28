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
const HARNESS_FORCE_RELAY = parseBooleanEnv(process.env.HARNESS_FORCE_RELAY);
const HARNESS_ICE_SERVERS_FROM_ENV = parseHarnessIceServers(
	process.env.HARNESS_ICE_SERVERS_JSON,
);
const HARNESS_USE_WORKER_ICE_SERVERS =
	parseBooleanEnv(process.env.HARNESS_USE_WORKER_ICE_SERVERS) ||
	(HARNESS_FORCE_RELAY && !HARNESS_ICE_SERVERS_FROM_ENV);

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

function parseBooleanEnv(value) {
	return value === "1" || value === "true" || value === "yes";
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
	const url = new URL(`http://127.0.0.1:${WORKER_PORT}/ice-servers`);
	url.searchParams.set("roomId", ROOM_ID);
	url.searchParams.set("roomToken", roomToken);

	const response = await fetch(url, {
		headers: { Accept: "application/json" },
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

async function startPeer(page, { sub, role, sessionId, iceServers }) {
	// Token role is the auth role (host|member); the participant role is host|viewer.
	const token = signRoomToken(sub, role === "host" ? "host" : "member");
	await page.evaluate(
		async ({ roomId, token, sub, role, sessionId, iceServers }) => {
			await window.AnidachiHarness.start({
				roomId,
				token,
				sub,
				role,
				sessionId,
				iceServers,
			});
		},
		{
			roomId: ROOM_ID,
			token,
			sub,
			role,
			sessionId,
			iceServers,
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

async function waitForRemoteFramesAbove(page, previousFrames, budgetMs) {
	const t0 = Date.now();
	while (Date.now() - t0 < budgetMs) {
		const state = await page.evaluate(() => window.AnidachiHarness.getState());
		if (state.remoteFramesDecoded > previousFrames) {
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

	const bundle = await bundleHarness();
	const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${bundle}</script></body></html>`;
	const server = createServer((_req, res) => {
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
	});
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	const pagePort = server.address().port;
	const pageUrl = `http://127.0.0.1:${pagePort}/`;

	const iceMode = HARNESS_FORCE_RELAY ? "relay-only" : "direct-first";
	console.log(`booting wrangler dev on :${WORKER_PORT} (${iceMode}) ...`);
	const worker = spawn("pnpm", buildWorkerArgs(), {
		cwd: API_DIR,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let workerLog = "";
	worker.stdout.on("data", (d) => (workerLog += d));
	worker.stderr.on("data", (d) => (workerLog += d));

	if (!(await waitForWorker())) {
		console.error(`wrangler dev not ready:\n${workerLog.slice(-1200)}`);
		worker.kill("SIGTERM");
		server.close();
		process.exit(1);
	}

	let activeIceServers = HARNESS_ICE_SERVERS_FROM_ENV;
	try {
		if (HARNESS_USE_WORKER_ICE_SERVERS) {
			activeIceServers = await loadIceServersFromWorker(
				signRoomToken("host", "host"),
			);
		}
		if (HARNESS_FORCE_RELAY && !hasTurnServer(activeIceServers)) {
			throw new Error(
				"Relay-only harness needs TURN URLs, but the active ICE config has no turn: or turns: server. Configure Cloudflare TURN locally or pass HARNESS_ICE_SERVERS_JSON.",
			);
		}
	} catch (error) {
		console.error(`harness setup error: ${error.message}`);
		console.error(`worker log tail:\n${workerLog.slice(-1500)}`);
		worker.kill("SIGTERM");
		server.close();
		process.exit(1);
	}

	const browser = await chromium.launch({
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	});

	let failed = 0;
	try {
		const hostCtx = await browser.newContext();
		const guestCtx = await browser.newContext();
		const hostPage = await hostCtx.newPage();
		const guestPage = await guestCtx.newPage();
		if (process.env.HARNESS_DEBUG) {
			hostPage.on("console", (m) => console.log(`[host] ${m.text()}`));
			guestPage.on("console", (m) => console.log(`[guest] ${m.text()}`));
			hostPage.on("pageerror", (e) => console.log(`[host err] ${e.message}`));
		}
		await hostPage.goto(pageUrl);
		await guestPage.goto(pageUrl);

		await startPeer(hostPage, {
			sub: "host",
			role: "host",
			sessionId: "host-sess",
			iceServers: activeIceServers,
		});
		await startPeer(guestPage, {
			sub: "guest",
			role: "viewer",
			sessionId: "guest-sess",
			iceServers: activeIceServers,
		});

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

		const firstPress = await pressToAudioMs(hostPage, guestPage, 9000);
		record(
			"push-to-talk audio reaches peer (S6)",
			firstPress !== null,
			`press1=${firstPress}ms`,
		);
		await hostPage.evaluate(() => window.AnidachiHarness.stopVoice());
		await sleep(500);
		const secondPress = await pressToAudioMs(hostPage, guestPage, 9000);
		record(
			"repeat push-to-talk also reaches peer",
			secondPress !== null,
			`press2=${secondPress}ms`,
		);
		if (firstPress !== null && secondPress !== null) {
			console.log(
				`   push-to-talk: first=${firstPress}ms repeat=${secondPress}ms`,
			);
		}

		await hostPage.evaluate(() => window.AnidachiHarness.stopVoice());

		// S5: reload the guest, restart, and confirm media recovers without
		// recreating the room.
		await guestPage.evaluate(() => window.AnidachiHarness.stop());
		await guestPage.reload();
		await guestPage.goto(pageUrl);
		await startPeer(guestPage, {
			sub: "guest",
			role: "viewer",
			sessionId: "guest-sess",
			iceServers: activeIceServers,
		});
		const guestRecovered = await waitForRemoteVideo(
			guestPage,
			RECOVERY_BUDGET_MS,
		);
		const hostStillSees = await waitForRemoteVideo(
			hostPage,
			RECOVERY_BUDGET_MS,
		);
		record(
			"guest recovers video after reload (S5)",
			guestRecovered.ttfmMs !== null,
			`ttfm=${guestRecovered.ttfmMs}ms`,
		);
		record(
			"host re-establishes video to reloaded guest (S5)",
			hostStillSees.ttfmMs !== null,
			`frames=${hostStillSees.state.remoteFramesDecoded}`,
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
			)} after=${JSON.stringify(
				restartAfterNetwork.map((entry) => entry.restartCount),
			)}`,
		);

		await hostPage.evaluate(() => window.AnidachiHarness.stop());
		await guestPage.evaluate(() => window.AnidachiHarness.stop());
		failed = results.filter((r) => !r.ok).length;
	} catch (error) {
		console.error(`harness error: ${error.message}`);
		console.error(`worker log tail:\n${workerLog.slice(-1500)}`);
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
