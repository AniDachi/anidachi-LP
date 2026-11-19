// npm --prefix tests/e2e run harness:prime-transport
// The Chromium tab uses routed synthetic HTML. Only the loopback WebSocket
// server sees room traffic. No provider login, credentials or camera required.
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const provider = "https://www.primevideo.com";
const detail = provider + "/detail/0AAAAAAAAAAAAAAAAAAAAAAAAA";
const account = {
	id: "user1",
	displayName: "Host",
	email: "test@example.test",
	plan: "free",
};
const participant = {
	id: account.id,
	displayName: account.displayName,
	role: "host",
	mediaSeat: "joined",
	cameraEnabled: false,
	syncStatus: "synced",
	lastSeenAt: 1,
	participantSessionId: "exact-tab-session",
};
const record = {
	version: 1,
	revision: 1,
	roomId: "room1",
	ownerUserId: account.id,
	participantSessionId: participant.participantSessionId,
	cameraEnabled: false,
	voiceMode: "push-to-talk",
};
const snapshot = {
	type: "ROOM_SNAPSHOT",
	roomId: record.roomId,
	participants: [participant],
	roomGeneration: 1,
	sourceGeneration: 1,
	serverSeq: 1,
	source: {
		provider: "primevideo",
		videoFingerprint: "primevideo|detail/0AAAAAAAAAAAAAAAAAAAAAAAAA",
		title: "Fixture",
		canonicalUrl: detail,
		sourceUrl: detail,
	},
	hostState: {
		videoFingerprint: "primevideo|detail/0AAAAAAAAAAAAAAAAAAAAAAAAA",
		playing: true,
		hostTime: 22,
		updatedAt: 100,
		playbackRate: 1,
	},
};

const directory = await mkdtemp(join(tmpdir(), "prime-room-transport-"));
const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
let opened = 0,
	joined = 0,
	closed = 0,
	pauses = 0;
let context;
try {
	await once(server, "listening");
	server.on("connection", (socket) => {
		opened++;
		socket.on("close", () => {
			closed++;
		});
		socket.on("message", (data) => {
			if (data.toString() === "ping") return socket.send("pong");
			const event = JSON.parse(data.toString());
			if (event.type === "HOST_STATE" && !event.state.playing) pauses++;
			if (event.type === "JOIN") {
				joined++;
				socket.send(JSON.stringify(snapshot));
			}
		});
	});
	await writeFile(
		join(directory, "manifest.json"),
		JSON.stringify({
			name: "Local Prime room test",
			version: "1.0",
			manifest_version: 3,
			permissions: ["storage", "offscreen", "alarms"],
			host_permissions: [provider + "/*", "http://127.0.0.1/*"],
			background: { service_worker: "background.js" },
			content_scripts: [{ matches: [provider + "/*"], js: ["page.js"] }],
		}),
	);
	await writeFile(
		join(directory, "prime-room.html"),
		'<!doctype html><script src="offscreen.js"></script>',
	);
	const scripts = {
		background:
			'import {registerPrimeRoomTransport} from "./src/prime-room-background"; registerPrimeRoomTransport();',
		offscreen:
			'import {registerPrimeRoomOffscreen} from "./src/prime-room-offscreen"; registerPrimeRoomOffscreen();',
		page: `
			import {PrimeRoomClient, getLivePrimeRoomSession, retireUnattachedPrimeRoom} from "./src/prime-room-client";
			const client = new PrimeRoomClient();
			window.addEventListener("fixture", async ({detail: action}) => {
				if (action === "probe") {
					document.body.dataset.probe = JSON.stringify(await getLivePrimeRoomSession());
					return;
				}
				if (action === "leave") { client.close(); return; }
				if (action === "retire-after-drop") {
					document.body.dataset.retired = String(await retireUnattachedPrimeRoom(${JSON.stringify(record)}));
					return;
				}
				if (action === "retire") {
					const current = await getLivePrimeRoomSession();
					if (current) await retireUnattachedPrimeRoom(current);
					return;
				}
				client.connect({
					roomId: "room1", roomToken: action === "start" ? "local-test" : "",
					participant: ${JSON.stringify(participant)}, participantSessionId: "exact-tab-session",
					videoFingerprint: "primevideo|detail/0AAAAAAAAAAAAAAAAAAAAAAAAA", onEvent() {}, onStatus() {},
					onTransportReady(ready) { document.body.dataset.ready = ready.senderConnectionId; }
				});
				if (action === "cancel-pending") client.close();
			});
			document.body.dataset.fixture = "ready";
		`,
	};
	const port = server.address().port;
	for (const [name, contents] of Object.entries(scripts)) {
		await build({
			stdin: {
				contents,
				resolveDir: fileURLToPath(
					new URL("../../apps/extension/", import.meta.url),
				),
				loader: "ts",
			},
			bundle: true,
			format: "iife",
			outfile: join(directory, name + ".js"),
			define: {
				"import.meta.env": JSON.stringify({
					WXT_API_WS_BASE: "ws://127.0.0.1:" + port,
					WXT_API_HTTP_BASE: "http://127.0.0.1:" + port,
				}),
			},
		});
	}
	context = await chromium.launchPersistentContext("", {
		channel: "chromium",
		executablePath: process.env.PRIME_TEST_CHROMIUM || undefined,
		headless: true,
		args: [
			"--disable-extensions-except=" + directory,
			"--load-extension=" + directory,
			"--disable-background-networking",
			"--disable-component-update",
		],
	});
	await context.route("**/*", (route) =>
		route.fulfill({ contentType: "text/html", body: "<body>Test room</body>" }),
	);
	const page = context.pages()[0] ?? (await context.newPage());
	const worker =
		context.serviceWorkers()[0] ??
		(await context.waitForEvent("serviceworker"));
	await worker.evaluate(
		(user) =>
			chrome.storage.local.set({
				authTokens: {
					authSessionId: "fixture-login",
					accessToken: "fixture",
					refreshToken: "fixture",
					user,
				},
			}),
		account,
	);

	async function navigate(url) {
		await page.goto(url);
		await page.waitForFunction(() => document.body.dataset.fixture === "ready");
	}
	const act = (action) =>
		page.evaluate(
			(value) =>
				window.dispatchEvent(new CustomEvent("fixture", { detail: value })),
			action,
		);
	const ready = () => page.waitForFunction(() => !!document.body.dataset.ready);
	async function start() {
		await navigate(detail);
		await worker.evaluate(
			async ({ record, provider }) => {
				const [tab] = await chrome.tabs.query({ url: provider + "/*" });
				await chrome.storage.session.set({
					["anidachi:room-session:v1:tab:" + tab.id]: record,
				});
			},
			{ record, provider },
		);
		await act("start");
		await ready();
	}
	async function expectClosed(count, timeoutMs = 5000) {
		for (let i = 0; closed < count && i < timeoutMs / 50; i++) await delay(50);
		assert.equal(closed, count);
	}
	await start();
	const connectionId = await page.locator("body").getAttribute("data-ready");
	await navigate(provider + "/storefront");
	await act("probe");
	await page.waitForFunction(
		() => document.body.dataset.probe && document.body.dataset.probe !== "null",
	);
	const restored = JSON.parse(
		await page.locator("body").getAttribute("data-probe"),
	);
	assert.equal(restored.participantSessionId, record.participantSessionId);
	assert.equal(
		restored.browsingBaseline.fingerprint,
		snapshot.hostState.videoFingerprint,
	);
	assert.equal("roomToken" in restored, false);
	await act("resume");
	await ready();
	assert.equal(
		await page.locator("body").getAttribute("data-ready"),
		connectionId,
	);
	assert.deepEqual([opened, joined, closed, pauses], [1, 1, 0, 1]);

	await navigate(provider + "/settings");
	await expectClosed(1);
	await start();
	await act("leave");
	await expectClosed(2);
	await start();
	await navigate(provider + "/storefront");
	await act("cancel-pending");
	await expectClosed(3);
	await start();
	for (const socket of server.clients)
		socket.send(
			JSON.stringify({
				...snapshot,
				serverSeq: 2,
				participants: [{ ...participant, participantSessionId: "replacement" }],
			}),
		);
	await expectClosed(4);
	await start();

	const staleRetirement = await worker.evaluate(
		async ({ record, provider }) => {
			const [tab] = await chrome.tabs.query({ url: provider + "/*" });
			return chrome.runtime.sendMessage({
				type: "ANIDACHI_PRIME_ROOM_INTERNAL",
				action: "retire-unattached",
				tabId: tab.id,
				identity: record,
				documentId: "old-detached-document",
			});
		},
		{ record, provider },
	);
	assert.equal(staleRetirement, false);
	await navigate(provider + "/storefront");
	await act("retire");
	await expectClosed(5);
	await start();
	await navigate(provider + "/storefront");
	for (const socket of server.clients)
		socket.send(
			JSON.stringify({
				type: "ROOM_ENDED",
				roomId: record.roomId,
				endedAt: Date.now(),
				reason: "host_ended",
			}),
		);
	await expectClosed(6);
	await start();
	await worker.evaluate(() => chrome.storage.local.remove("authTokens"));
	await expectClosed(7);
	await worker.evaluate(
		(user) =>
			chrome.storage.local.set({
				authTokens: {
					authSessionId: "new-login",
					accessToken: "fixture",
					refreshToken: "fixture",
					user,
				},
			}),
		account,
	);
	await start();
	await navigate(provider + "/storefront");
	// A page that never mounts the UI must not preserve a detached call indefinitely.
	await expectClosed(8, 40_000);
	const confirmedRecord = () =>
		worker.evaluate(
			async ({ provider }) => {
				const [tab] = await chrome.tabs.query({ url: provider + "/*" });
				const key = "anidachi:room-session:v1:tab:" + tab.id;
				return (await chrome.storage.session.get(key))[key] ?? null;
			},
			{ provider },
		);
	for (let i = 0; (await confirmedRecord()) && i < 100; i++) await delay(50);
	assert.equal(await confirmedRecord(), null);
	await start();
	await navigate(provider + "/storefront");
	await act("resume");
	await ready();
	for (const socket of server.clients) socket.terminate();
	await expectClosed(9);
	await act("retire-after-drop");
	await page.waitForFunction(() => document.body.dataset.retired === "true");
	assert.equal(await confirmedRecord(), null);
	await start();
	await page.close();
	await expectClosed(10);
	assert.deepEqual([opened, joined, closed], [10, 10, 10]);
	console.log("Passed Prime MV3 socket continuity and teardown in Chromium.");
} finally {
	await context?.close();
	for (const socket of server.clients) socket.terminate();
	await new Promise((resolve) => server.close(resolve));
	await rm(directory, { recursive: true, force: true });
}
