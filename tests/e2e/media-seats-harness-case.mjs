import { writeFile } from "node:fs/promises";
import { getP95, summarizeSelectedCandidatePairs, TTFM_P95_BUDGET_MS } from "./p2p-media-harness-support.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Drives production RoomClient and P2PMediaController against the local Worker.
// Synthetic Chromium devices prove capture/transport behavior, not real networks.
export async function runMediaSeatsCase({ browser, pageUrl, iceServers, size, startPeer, record, forceRelay, reportPath }) {
	if (![4, 6, 15].includes(size)) throw new Error("HARNESS_MEDIA_V3 must be 4,6,15");
	const seats = size === 15 ? 8 : size;
	const started = Date.now();
	const pages = [], contexts = [];
	const pageErrors = [];
	const debugPeers = new Set((process.env.HARNESS_DEBUG_PEERS ?? "").split(",").filter(Boolean).map(Number));
	const receipt = { protocol: 3, size, seats, cameras: 4, browser: browser.version(), tests: [] };
	const watchdog = setTimeout(() => { void browser.close(); }, 60_000);
	const check = (name, ok, detail) => {
		receipt.tests.push({ name, ok, detail });
		record(name, ok, JSON.stringify(detail));
		if (!ok) throw new Error(name);
	};
	const diagnostics = () => Promise.all(pages.map((page) => page.evaluate(() => window.AnidachiHarness.diagnostics())));
	const waitFor = async (predicate, label, timeout = 10_000) => {
		const deadline = Date.now() + timeout;
		let values;
		do {
			values = await diagnostics();
			if (predicate(values)) return values;
			await sleep(50);
		} while (Date.now() < deadline);
		receipt.lastDiagnostics = values;
		console.error(label, JSON.stringify(values?.map((d) => ({ status: d.status, errors: d.errors, media: d.media, captureCount: d.captureCount, camera: d.stats?.cameraEnabled, microphone: d.stats?.microphonePublishing, peers: d.stats?.peers.map((p) => ({ user: p.remoteUserId, health: p.health, video: p.stats?.videoInbound?.framesDecoded, audio: p.stats?.audioDecoded?.totalAudioEnergy })) }))));
		throw new Error(`Timed out: ${label}`);
	};
	const mediaState = (value, index) => value.media?.participants.find((p) => p.participantSessionId === `s${index}`);
	try {
		for (let index = 0; index < size; index++) {
			const context = await browser.newContext(); contexts.push(context);
			const page = await context.newPage(); pages.push(page);
			page.on("pageerror", (error) => { pageErrors.push(`p${index}: ${error.message}`); });
			if (debugPeers.has(index)) await page.addInitScript(() => {
				localStorage.setItem("anidachi:debug-console", "true");
				window.__mediaDebugTrace = [];
				const original = console.info.bind(console);
				console.info = (...args) => {
					if (args[0] === "[Anidachi Debug]") {
						if (String(args[1]).startsWith("p2p") && window.__mediaDebugTrace.length < 20000)
							window.__mediaDebugTrace.push({ at: performance.now(), scope: args[1], message: args[2], data: args[3] });
					} else original(...args);
				};
			});
			await page.goto(pageUrl);
			await startPeer(page, { sub: `p${index}`, role: index ? "viewer" : "host", sessionId: `s${index}`, iceServers, cameraEnabled: false, mediaV2: true });
		}
		let values = await waitFor((ds) => ds.every((d) => d.media?.participants.length === size), "full admitted roster");
		check("v3 seats follow admission order without starting devices", values.every((d) => d.captureCount === 0) && values[0].media.participants.every((p, i) => p.mediaSeatGranted === (i < seats)), { captures: values.map((d) => d.captureCount) });
		check("v3 first-frame clock does not start before a camera is requested", values.every(d => d.videoExpectedIds.length === 0), { expected: values.map(d => d.videoExpectedIds) });

		for (let index = 0; index < 4; index++) await pages[index].evaluate(() => window.AnidachiHarness.setCameraEnabled(true));
		for (let index = 0; index < seats; index++) await pages[index].evaluate(() => window.AnidachiHarness.startOpenMic());
		const decodesAll = (ds) => ds.every((d, receiver) => {
			const peers = d.stats?.peers ?? [];
			return Array.from({ length: 4 }, (_, i) => i).filter((i) => i !== receiver).every((i) => peers.some((p) => p.remoteUserId === `p${i}` && p.stats?.videoInbound?.framesDecoded > 0)) &&
				Array.from({ length: seats }, (_, i) => i).filter((i) => i !== receiver).every((i) => peers.some((p) => p.remoteUserId === `p${i}` && p.stats?.audioDecoded?.totalAudioEnergy > 0));
		});
		values = await waitFor(decodesAll, "all permitted incoming media");
		receipt.mediaDiagnostics = values;
		check("every member decodes four cameras and all seated microphones", true, { setupMs: Date.now() - started });
		check("listeners receive without capture or listener-to-listener connections", values.every((d, i) => d.stats.peers.length === (i < seats ? size - 1 : seats)) && values.slice(seats).every((d) => d.captureCount === 0), { peers: values.map((d) => d.stats.peers.length) });
		const endpoints = 2 * (seats * (size - seats) + seats * (seats - 1) / 2);
		values = await waitFor((ds) => summarizeSelectedCandidatePairs(ds).selectedCount === endpoints, "selected candidate pair at every endpoint", 5_000);
		const selected = summarizeSelectedCandidatePairs(values);
		check("v3 media edges have selected ICE pairs", selected.selectedCount === endpoints && (!forceRelay || selected.relayCount === endpoints), { endpoints, ...selected });
		const ttfm = values.flatMap((d) => Object.values(d.videoTtfm));
		const p95 = getP95(ttfm);
		check("complete v3 decoded-video TTFM sample stays below 6 seconds", ttfm.length === 4 * (size - 1) && p95 !== null && p95 < TTFM_P95_BUDGET_MS, { samples: ttfm.length, expected: 4 * (size - 1), p95Ms: p95 });

		if (size > 4) {
			const before = values[4].captureCount;
			const error = await pages[4].evaluate(async () => {
				try { await window.AnidachiHarness.setCameraEnabled(true); return null; }
				catch (error) { return String(error); }
			});
			const fifth = await pages[4].evaluate(() => window.AnidachiHarness.diagnostics());
			check("fifth camera is refused while its microphone and seat remain active", Boolean(error) && fifth.captureCount === before && fifth.stats.microphonePublishing && mediaState(fifth, 4).mediaSeatGranted && !mediaState(fifth, 4).cameraGranted, { error });
		}

		for (const width of [392, 320]) for (const index of [0, size - 1]) {
			await pages[index].setViewportSize({ width, height: 900 });
			await pages[index].evaluate((width) => window.AnidachiHarness.renderControls(width, false), width);
			await pages[index].screenshot({ path: `/private/tmp/media-seats-v3-${size}-${index === 0 ? "host" : "guest"}-${width}.png` });
		}

		const beforeRevoke = await pages[1].evaluate(() => window.AnidachiHarness.diagnostics());
		const revokeButton = pages[0].getByRole("button", { name: "Revoke media seat: p1 — Participant with a deliberately long display name", exact: true });
		await revokeButton.focus();
		await revokeButton.press("Enter");
		values = await waitFor((ds) => !mediaState(ds[1], 1).mediaSeatGranted && !ds[1].stats.cameraEnabled && !ds[1].stats.microphonePublishing && ds[1].stats.localTrackCount === 0, "both outgoing tracks stopped by revoke");
		check("host keyboard seat revoke is acknowledged", !mediaState(values[0], 1).mediaSeatGranted);
		const beforeFrames = values[1].stats.peers.find((p) => p.remoteUserId === "p0")?.stats?.videoInbound?.framesDecoded ?? 0;
		await waitFor((ds) => (ds[1].stats.peers.find((p) => p.remoteUserId === "p0")?.stats?.videoInbound?.framesDecoded ?? 0) > beforeFrames, "revoked participant still receives advancing video");
		check("revoke stops publication and preserves incoming playback", true, { captureCount: values[1].captureCount });
		if (size > seats) check("freeing a seat does not promote existing listeners", values[0].media.participants.slice(seats).every((p) => !p.mediaSeatGranted));

		const grantButton = pages[0].getByRole("button", { name: "Grant media seat: p1 — Participant with a deliberately long display name", exact: true });
		await grantButton.focus();
		await grantButton.press("Space");
		values = await waitFor((ds) => mediaState(ds[1], 1).mediaSeatGranted, "seat regrant");
		await sleep(150);
		const regranted = await pages[1].evaluate(() => window.AnidachiHarness.diagnostics());
		check("regrant never restarts revoked capture", regranted.captureCount === beforeRevoke.captureCount && !regranted.stats.cameraEnabled && !regranted.stats.microphonePublishing, { captureCount: regranted.captureCount });
		await pages[1].evaluate(() => window.AnidachiHarness.startOpenMic());
		values = await waitFor((ds) => ds[1].stats.microphonePublishing && ds[0].stats.peers.some((p) => p.remoteUserId === "p1" && p.stats?.audioDecoded?.totalAudioEnergy > 0), "own microphone action after regrant");
		check("own action resumes microphone after regrant", true);
		if (size > 4) {
			await pages[4].evaluate(() => window.AnidachiHarness.setCameraEnabled(true));
			await waitFor((ds) => ds[0].stats.peers.some((p) => p.remoteUserId === "p4" && p.stats?.videoInbound?.framesDecoded > 0), "freed camera slot reused by own action");
			check("freed video slot is reusable without moving a media seat", true);
		}
		values = await diagnostics();
		receipt.finalDiagnostics = values;
		const errors = values.flatMap((d, i) => d.errors.map(error => `p${i}: ${error}`));
		check("rapid media actions produce no room rate-limit or browser errors", errors.length === 0 && pageErrors.length === 0, { errors, pageErrors });
	} finally {
		clearTimeout(watchdog);
		if (debugPeers.size) receipt.debugTraces = await Promise.all(pages.map((page, index) => debugPeers.has(index)
			? page.evaluate(() => window.__mediaDebugTrace ?? []).catch(() => []) : []));
		receipt.elapsedMs = Date.now() - started;
		await writeFile(reportPath || `/private/tmp/media-seats-v3-${size}.json`, JSON.stringify(receipt, null, 2));
		await Promise.allSettled(pages.map((page) => page.evaluate(() => window.AnidachiHarness.stop())));
		await Promise.allSettled(contexts.map((context) => context.close()));
	}
}
