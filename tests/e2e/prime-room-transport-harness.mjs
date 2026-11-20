// npm --prefix tests/e2e run harness:prime-transport
// The Chromium tab uses routed synthetic HTML. Only the loopback WebSocket
// server sees room traffic. Chromium supplies the virtual camera.
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const netflix = process.argv.includes("--netflix");
const service = netflix ? "netflix" : "primevideo";
const provider = netflix ? "https://www.netflix.com" : "https://www.primevideo.com";
const path = netflix ? "/watch/123" : "/detail/0AAAAAAAAAAAAAAAAAAAAAAAAA";
const detail = provider + path;
const catalog = provider + (netflix ? "/browse" : "/storefront");
const fingerprint = service + "|" + path.slice(1);
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
		provider: service,
		videoFingerprint: fingerprint,
		title: "Fixture",
		canonicalUrl: detail,
		sourceUrl: detail,
	},
	hostState: {
		videoFingerprint: fingerprint,
		playing: true,
		hostTime: 22,
		updatedAt: 100,
		playbackRate: 1,
	},
};

const directory = await mkdtemp(join(tmpdir(), "prime-room-transport-"));
const http = createServer((req, res) => {
	if (req.url !== "/rooms/room1/ice-servers") return res.writeHead(404).end();
	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ iceServers: [{ urls: "stun:127.0.0.1:9" }] }));
});
const server = new WebSocketServer({ server: http });
let opened = 0,
	joined = 0,
	closed = 0,
	pauses = 0;
let context;
try {
	http.listen(0, "127.0.0.1");
	await once(http, "listening");
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
			web_accessible_resources: [{ resources: ["prime-media-tile.html", "prime-media-permission.html"], matches: [provider + "/*"] }],
		}),
	);
	await writeFile(
		join(directory, "prime-room.html"),
		'<!doctype html><script src="offscreen.js"></script>',
	);
	await writeFile(join(directory, "prime-media-tile.html"),
		'<video autoplay muted playsinline></video><script src="tile.js"></script>');
	await writeFile(join(directory, "prime-media-permission.html"), '<script src="permission.js"></script>');
	const scripts = {
		permission: 'import "./entrypoints/prime-media-permission/main";',
		background:
			'import {registerPrimeRoomTransport} from "./src/prime-room-background"; import {installPrimeMediaBackground} from "./src/prime-media-background"; registerPrimeRoomTransport(); installPrimeMediaBackground();',
		tile: 'import "./entrypoints/prime-media-tile/main";',
		offscreen:
			'import {registerPrimeRoomOffscreen} from "./src/prime-room-offscreen"; registerPrimeRoomOffscreen();',
		page: `
			import {PrimeRoomClient, getLivePrimeRoomSession, retireUnattachedPrimeRoom} from "./src/prime-room-client";
			import {createElement} from "react";
			import {createRoot} from "react-dom/client";
			import {PrimeCameraTile, PrimeDevicePermissionPrompt} from "./src/prime-media-session";
			import {mediaAccessChannel} from "./src/prime-media-access";
			import {overlayStyles} from "./src/styles";
			const client = new PrimeRoomClient();
			const promptRoot = createRoot(document.body.appendChild(document.createElement("div")));
			client.subscribeMedia(state => {
				if (state.type !== "prime-media-state") return;
				promptRoot.render(state.permissionRequests.map(request => createElement(PrimeDevicePermissionPrompt, {...request, key:request.ticket})));
				if (state.permissionRequests.length) document.body.dataset.requestedDevice = state.permissionRequests[0].device;
				document.body.dataset.media = JSON.stringify({videos: state.videos.length, status: state.voiceMessage, microphone: state.microphoneStatus});
			});
			window.addEventListener("message", event => {
				if (event.origin === chrome.runtime.getURL("").slice(0,-1) && event.data?.channel === mediaAccessChannel && event.data.action === "request")
					document.body.dataset.cameraRequested = "true";
			});
			window.addEventListener("fixture", async ({detail: action}) => {
				if (action === "mount-camera") {
					const tile = document.createElement("div");
					tile.style.cssText = "position:relative;width:48px;height:48px";
					const style = document.createElement("style");
					style.textContent = overlayStyles;
					document.head.append(style);
					document.body.append(tile);
					createRoot(tile).render(createElement(PrimeCameraTile, {participantId: "user1", fallback: "H"}));
					return;
				}
				if (action === "enable-microphone") {
					client.sendMediaCommand({type:"gesture", device:"microphone"});
					client.sendMediaCommand({type:"microphone", enabled:true, mode:"open-mic", release:"immediate"});
					return;
				}
				if (action === "disable-camera") {
					client.sendMediaCommand({type:"camera", enabled:false});
					return;
				}
				if (action === "enable-camera") {
					client.sendMediaCommand({type:"gesture", device:"camera"});
					client.sendMediaCommand({type:"outputs", preferences:{}});
					client.sendMediaCommand({type:"camera", enabled:true});
					return;
				}
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
					videoFingerprint: ${JSON.stringify(fingerprint)}, onEvent() {}, onStatus() {},
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
			jsx: "automatic",
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
			"--use-fake-device-for-media-stream",
			"--deny-permission-prompts",
		],
	});
	await context.route(provider + "/**", route =>
		route.fulfill({ contentType: "text/html", body: "<body>Test room</body>" }));
	const page = context.pages()[0] ?? (await context.newPage());
	const worker =
		context.serviceWorkers()[0] ??
		(await context.waitForEvent("serviceworker"));
	let extraPages = 0;
	context.on("page", () => extraPages++);
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
	async function expectMovingCamera() {
		const frame = page.locator("iframe.prime-camera-frame");
		await page.waitForFunction(() => {
			const frame = document.querySelector("iframe[data-prime-camera-playing]");
			return frame && getComputedStyle(frame).opacity === "1";
		}, undefined, { timeout: 10_000 }).catch(async error => {
			throw new Error("Missing camera frames: " + await page.locator("body").getAttribute("data-media"), { cause: error });
		});
		const camera = frame.contentFrame().locator("video");
		const first = await camera.evaluate(video => video.getVideoPlaybackQuality().totalVideoFrames);
		const tileDocument = page.frames().find(frame => frame.url().endsWith("/prime-media-tile.html"));
		assert.ok(tileDocument);
		await tileDocument.waitForFunction(previous => {
			const video = document.querySelector("video");
			return video.videoWidth > 0 && video.getVideoPlaybackQuality().totalVideoFrames > previous;
		}, first, { timeout: 5000 });
	}
	await start();
	const connectionId = await page.locator("body").getAttribute("data-ready");
	await act("mount-camera");
	await page.waitForFunction(() => document.body.dataset.cameraRequested === "true");
	assert.equal(await page.locator("iframe.prime-camera-frame").evaluate(frame => getComputedStyle(frame).opacity), "0");
	assert.equal(await page.locator(".prime-camera-fallback").textContent(), "H");
	await delay(400);
	await act("enable-camera");
	await page.waitForFunction(() => JSON.parse(document.body.dataset.media).status?.includes("blocked"),
		undefined, {timeout: 10_000});
	assert.equal(await page.locator("body").getAttribute("data-requested-device"), "camera");
	assert.equal(await page.locator("iframe[title='AniDachi camera permission']").count(), 0);
	assert.equal(closed, 0);
	await act("disable-camera");
	// Set a saved grant for this extension only, then exercise the normal retry.
	const session = await context.newCDPSession(page);
	const extensionOrigin = worker.url().slice(0, worker.url().lastIndexOf("/"));
	await session.send("Browser.setPermission", {permission: {name: "camera"}, setting: "granted", origin: extensionOrigin});
	await act("enable-camera");
	await expectMovingCamera();
	assert.equal(extraPages, 0);
	assert.equal(page.url(), detail);
	await act("enable-microphone");
	await page.waitForFunction(() => document.body.dataset.requestedDevice === "microphone" &&
		JSON.parse(document.body.dataset.media).status?.toLowerCase().includes("microphone"));
	await expectMovingCamera();
	assert.equal(extraPages, 0);
	assert.equal(closed, 0);
	await navigate(provider + (netflix ? "/browse/my-list" : "/region/na/mystuff/watchlist"));
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
	await act("mount-camera");
	await expectMovingCamera();
	assert.equal(
		await page.locator("body").getAttribute("data-ready"),
		connectionId,
	);
	assert.deepEqual([opened, joined, closed, pauses], [1, 1, 0, 1]);

	for (const url of [catalog, catalog, provider + (netflix ? "/watch/456" : "/detail/0BBBBBBBBBBBBBBBBBBBBBBBBB")]) {
		await navigate(url);
		await act("resume");
		await ready();
		await act("mount-camera");
		await expectMovingCamera();
		assert.equal(await page.locator("body").getAttribute("data-ready"), connectionId);
	}
	assert.deepEqual([opened, joined, closed], [1, 1, 0]);

	await navigate(provider + "/settings");
	await expectClosed(1);
	await start();
	await act("leave");
	await expectClosed(2);
	await start();
	await navigate(catalog);
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
	await navigate(catalog);
	await act("retire");
	await expectClosed(5);
	await start();
	await navigate(catalog);
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
	await navigate(catalog);
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
	await navigate(catalog);
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
	console.log("Passed", service, "camera rendering, socket continuity and teardown in Chromium.");
} finally {
	await context?.close();
	for (const socket of server.clients) socket.terminate();
	await new Promise((resolve) => server.close(resolve));
	await new Promise((resolve) => http.close(resolve));
	await rm(directory, { recursive: true, force: true });
}
