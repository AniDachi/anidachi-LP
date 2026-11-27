import { afterEach, describe, expect, it, vi } from "vitest";
import { fixture, ids, bridgeTransport } from "./fixture";
import { inspectPrimeSdk } from "../../../src/source-adapters/primevideo/sdk";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { runPrimeCommand } from "../../../src/source-adapters/primevideo/bridge-client";
import {
	PRIME_BINDING_CHANGED,
	PRIME_BINDING,
	readPrimeBinding,
} from "../../../src/source-adapters/primevideo/contract";
import { PrimeVideoAdapter } from "../../../src/source-adapters/primevideo/adapter";
import { detectSourceAdapter } from "../../../src/source-adapters/registry";
import { primeHistoryPolicy } from "../../../src/source-adapters/primevideo/progress";
import { HISTORY_OBSERVATION_SUSPENDED } from "../../../src/source-adapters/core/history-policy";
const stops: (() => void)[] = [];
afterEach(() => {
	stops.splice(0).forEach((stop) => stop());
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = "";
});
function setup() {
	const f = fixture();
	bridgeTransport();
	stops.push(startPrimeBridge());
	return f;
}
async function tick(ms = 60) {
	await vi.advanceTimersByTimeAsync(ms);
}
describe("Prime observed SDK and real MAIN/client boundary", () => {
	it("permits only explicit play for the bound local interstitial", async () => {
		vi.useFakeTimers();
		const f=setup(); f.setAd(true); f.video.dispatchEvent(new Event("timeupdate"));
		const binding=readPrimeBinding(f.video)!;
		const pending=runPrimeCommand({action:"resume-interstitial",...binding});
		await tick();
		expect((await pending)?.ok).toBe(true);
		expect(f.context.playback.play).toHaveBeenCalledTimes(1);
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		expect(f.context.playback.pause).not.toHaveBeenCalled();
		f.setAd(false); f.video.dispatchEvent(new Event("timeupdate"));
		const content=runPrimeCommand({action:"resume-interstitial",...readPrimeBinding(f.video)!});
		await tick(); expect((await content)?.ok).toBe(false);
		expect(f.context.playback.play).toHaveBeenCalledTimes(1);
	});
	it.each(["cancel", "replacement"])("fences interstitial play after %s", async kind => {
		vi.useFakeTimers(); const f=setup(); f.setAd(true); f.video.dispatchEvent(new Event("timeupdate"));
		const abort=new AbortController();
		const pending=runPrimeCommand({action:"resume-interstitial",...readPrimeBinding(f.video)!},abort.signal);
		await tick(1);
		if(kind==="cancel")abort.abort(); else f.attach({...f.context});
		await tick();
		expect((await pending)?.ok).not.toBe(true);
		expect(f.context.playback.play).not.toHaveBeenCalled();
	});
	it("reports a real autoplay rejection without exposing provider error details", async () => {
		vi.useFakeTimers(); const f=setup(); f.setAd(true); f.video.dispatchEvent(new Event("timeupdate"));
		f.context.playback.play.mockRejectedValueOnce(Object.assign(new Error("provider private detail"),{name:"NotAllowedError"}));
		const pending=runPrimeCommand({action:"resume-interstitial",...readPrimeBinding(f.video)!});
		await tick(2100);
		expect(await pending).toMatchObject({ok:false,error:"autoplay-blocked"});
		expect(JSON.stringify(await pending)).not.toContain("provider private detail");
	});
	it("reads actual hydration mapping and content milliseconds, not misleading native clock", async () => {
		const f = setup();
		f.video.currentTime = 999;
		const result = await runPrimeCommand({
			action: "snapshot",
			contentId: ids.first,
		});
		expect(result?.snapshot).toMatchObject({
			contentId: ids.first,
			currentTime: 1309.433,
			duration: 3823,
			phase: "content",
			metadata: {
				identity: {
					kind: "episode",
					seriesAnchorSeasonId: ids.anchor,
					providerSeasonIdentifier: ids.season,
					providerEpisodeIdentifier: ids.first,
				},
			},
		});
		const catalog = await runPrimeCommand({
			action: "catalog",
			contentId: ids.first,
			generation: result!.snapshot!.generation,
		});
		expect(catalog?.catalog?.completeness).toBe("partial");
		expect(catalog?.catalog?.seasons[0]?.episodes).toHaveLength(2);
		expect(JSON.stringify(result)).not.toContain("preparations");
	});
	it("never selects preview, closed/preloaded or ambiguous primary videos", () => {
		const f = setup();
		expect(detectSourceAdapter()?.video).toBe(f.video);
		f.context.webPlayer.isPlayerOpen = false;
		f.video.dispatchEvent(new Event("timeupdate"));
		expect(detectSourceAdapter()).toBeNull();
		f.context.webPlayer.isPlayerOpen = true;
		f.context.webPlayer.hasPlaybackInitiated = false;
		expect(inspectPrimeSdk()).toBeNull();
		f.context.webPlayer.hasPlaybackInitiated = true;
		f.root.append(document.createElement("video"));
		expect(inspectPrimeSdk()).toBeNull();
	});
	it("keeps source identity without season1 but suspends detailed history", async () => {
		vi.useFakeTimers();
		const f = setup();
		f.data.init.preparations.body.atf.state.seasons[
			Object.keys(f.data.init.preparations.body.atf.state.seasons)[0]!
		]!.splice(0, 1);
		f.write();
		const adapter = detectSourceAdapter() as PrimeVideoAdapter;
		stops.push(adapter.subscribe(() => {}));
		await tick();
		expect(adapter.getSourceDescriptor()?.sourceUrl).toContain(ids.first);
		expect(adapter.getSourceDescriptor()?.episodeSeriesId).toBeUndefined();
		expect(adapter.getPrimeSnapshot()?.metadata.identity).toBeNull();
		expect(primeHistoryPolicy.observe({ adapter, preferences: null })).toBe(
			HISTORY_OBSERVATION_SUSPENDED,
		);
	});
	it("confirms SDK pause/play/seek without native setters or persistent speed changes", async () => {
		vi.useFakeTimers();
		const f = setup(),
			generation = readPrimeBinding(f.video)!.generation;
		for (const action of ["play", "pause", "seek"] as const) {
			const promise = runPrimeCommand({
				action,
				contentId: ids.first,
				generation,
				...(action === "seek" ? { time: 1305 } : {}),
			});
			await tick();
			expect((await promise)?.ok).toBe(true);
		}
		expect(f.context.playback.seek).toHaveBeenCalledWith(1305000);
		expect(f.video.currentTime).toBe(0);
		const adapter = new PrimeVideoAdapter(f.video, f.root);
		adapter.setPlaybackRate(1.05);
		expect(f.context.playback.setPlaybackRate).not.toHaveBeenCalled();
		expect(f.video.playbackRate).toBe(1);
	});
	it("fences a queued command across same-video same-URL native episode change", async () => {
		vi.useFakeTimers();
		const f = setup();
		const listener = vi.fn();
		document.addEventListener(PRIME_BINDING_CHANGED, listener);
		stops.push(() =>
			document.removeEventListener(PRIME_BINDING_CHANGED, listener),
		);
		const old = readPrimeBinding(f.video)!,
			promise = runPrimeCommand({
				action: "seek",
				contentId: ids.first,
				generation: old.generation,
				time: 50,
			});
		await tick(1);
		f.next();
		f.video.dispatchEvent(new Event("timeupdate"));
		await tick();
		expect((await promise)?.ok).toBe(false);
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		expect(readPrimeBinding(f.video)?.contentId).toBe(ids.second);
		expect(listener).toHaveBeenCalled();
		expect(detectSourceAdapter()?.getFingerprint()).toContain(ids.second);
	});
	it("fences ads, unknown phases, recap and context replacement while freezing safe content time", async () => {
		vi.useFakeTimers();
		const f = setup();
		const generation = readPrimeBinding(f.video)!.generation;
		const pending = runPrimeCommand({
			action: "seek",
			contentId: ids.first,
			generation,
			time: 50,
		});
		await tick(1);
		f.setAd(true);
		f.video.currentTime = 1500;
		f.video.dispatchEvent(new Event("timeupdate"));
		await tick();
		expect((await pending)?.ok).toBe(false);
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		expect(inspectPrimeSdk()?.snapshot).toMatchObject({
			phase: "interstitial",
			currentTime: 1309.433,
		});
		f.setAd(false);
		f.recap.isRecapPlaying = true;
		expect(inspectPrimeSdk()?.snapshot.phase).toBe("interstitial");
		f.recap.isRecapPlaying = false;
		f.context.title.videoMaterialType = "Trailer";
		expect(inspectPrimeSdk()?.snapshot.phase).toBe("unsupported");
		f.context.title.videoMaterialType = "Feature";
		f.setContentState("Loading");
		expect(inspectPrimeSdk()?.snapshot.phase).toBe("buffering");
		f.setContentState("Ready");
		f.video.dispatchEvent(new Event("timeupdate"));
		const old = readPrimeBinding(f.video)!;
		const replacement = runPrimeCommand({
			action: "play",
			contentId: ids.first,
			generation: old.generation,
		});
		await tick(1);
		f.attach({ ...f.context });
		await tick();
		expect((await replacement)?.ok).toBe(false);
		expect(f.context.playback.play).not.toHaveBeenCalled();
	});
	it("treats the observed Auxiliary intro as an interstitial, fencing remote controls until content returns", async () => {
		vi.useFakeTimers();
		const f = setup();
		Object.defineProperty(f.context.timeline.playhead.item.contentInfo, "contentType", { configurable: true, value: "Auxiliary" });
		f.context.playback.position = 0;
		f.video.dispatchEvent(new Event("timeupdate"));
		expect(inspectPrimeSdk()?.snapshot.phase).toBe("interstitial");
		const intro = readPrimeBinding(f.video)!;
		for (const action of ["play", "pause", "seek", "rate"] as const) {
			const pending = runPrimeCommand({ action, contentId: ids.first, generation: intro.generation, ...(action === "seek" ? {time: 50} : action === "rate" ? {rate: 1.05} : {}) });
			await tick();
			expect((await pending)?.ok).toBe(false);
		}
		expect(f.context.playback.pause).not.toHaveBeenCalled();
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		Object.defineProperty(f.context.timeline.playhead.item.contentInfo, "contentType", { configurable: true, value: "Feature" });
		f.video.dispatchEvent(new Event("timeupdate"));
		expect(inspectPrimeSdk()?.snapshot.phase).toBe("content");
		expect(readPrimeBinding(f.video)?.generation).not.toBe(intro.generation);
	});

	it("honors cancellation, pause/seek policy, disposal and inert detection", async () => {
		vi.useFakeTimers();
		const f = setup(),
			generation = readPrimeBinding(f.video)!.generation;
		const abort = new AbortController();
		const pending = runPrimeCommand(
			{ action: "seek", contentId: ids.first, generation, time: 100 },
			abort.signal,
		);
		await tick(1);
		abort.abort();
		await tick();
		expect(await pending).toBeNull();
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		f.controls.seekBackwardEnabled = false;
		const denied = runPrimeCommand({
			action: "seek",
			contentId: ids.first,
			generation,
			time: 100,
		});
		await tick();
		expect((await denied)?.ok).toBe(false);
		const before = vi.getTimerCount();
		for (let i = 0; i < 10; i++) detectSourceAdapter();
		expect(vi.getTimerCount()).toBe(before);
		stops[0]!();
		stops[0]!();
		expect(f.video.hasAttribute(PRIME_BINDING)).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe("Prime transient rate and hostile bridge inputs", () => {
	it("applies authoritative non1x rate through provider facade and reports it, with SDK ad1x behavior", async () => {
		vi.useFakeTimers();
		const f = setup();
		const adapter = detectSourceAdapter() as PrimeVideoAdapter;
		const events: unknown[] = [];
		stops.push(adapter.subscribe((event) => events.push(event)));
		await tick();
		expect(adapter.getSourceDescriptor()?.episodeSeriesId).toBe(ids.anchor);
		adapter.setPlaybackRate(1.5);
		await tick();
		expect(f.context.playback.player.setPlaybackRate).toHaveBeenCalledWith(1.5);
		expect(f.context.playback.setPlaybackRate).not.toHaveBeenCalled();
		expect(f.video.playbackRate).toBe(1);
		expect(adapter.getState().playbackRate).toBe(1.5);
		f.video.dispatchEvent(new Event("ratechange"));
		await tick();
		expect(events).toContainEqual({
			type: "ratechange",
			time: 1309.433,
			playbackRate: 1.5,
		});
		f.setAd(true);
		f.video.dispatchEvent(new Event("timeupdate"));
		await tick();
		expect(adapter.getState().playbackRate).toBe(1);
		adapter.setPlaybackRate(2);
		await tick();
		expect(f.context.playback.player.setPlaybackRate).toHaveBeenCalledTimes(1);
		f.setAd(false);
		f.video.dispatchEvent(new Event("timeupdate"));
		await tick();
		expect(adapter.getState().playbackRate).toBe(1.5);
	});
	it("rejects invalid rates and cancels a queued rate on replacement", async () => {
		vi.useFakeTimers();
		const f = setup(),
			generation = readPrimeBinding(f.video)!.generation;
		for (const rate of [0, -1, 0.49, 2.01, Infinity, NaN])
			expect(
				await runPrimeCommand({
					action: "rate",
					contentId: ids.first,
					generation,
					rate,
				}),
			).toBeNull();
		const command = runPrimeCommand({
			action: "rate",
			contentId: ids.first,
			generation,
			rate: 1.5,
		});
		await tick(1);
		f.next();
		await tick();
		expect((await command)?.ok).toBe(false);
		expect(f.context.playback.player.setPlaybackRate).not.toHaveBeenCalled();
	});
	it("rejects unknown fields, unbounded messages, wrong origin and replayed commands", async () => {
		vi.useFakeTimers();
		const f = setup(),
			generation = readPrimeBinding(f.video)!.generation;
		const data = {
			source: "anidachi-primevideo-request-v1",
			id: "replay",
			action: "seek",
			contentId: ids.first,
			generation,
			time: 12,
		};
		const emit = (value: unknown, origin = location.origin) =>
			window.dispatchEvent(
				new MessageEvent("message", { data: value, origin, source: window }),
			);
		emit(data, "https://evil.example");
		emit({ ...data, secret: "bad" });
		emit({ ...data, time: 1e10 });
		emit({ ...data, id: "x".repeat(10000) });
		await tick();
		expect(f.context.playback.seek).not.toHaveBeenCalled();
		emit(data);
		await tick();
		emit(data);
		await tick();
		expect(f.context.playback.seek).toHaveBeenCalledTimes(1);
	});
	it("rejects forged cross-source client responses and times out with cancellation", async () => {
		vi.useFakeTimers();
		const f = setup();
		stops[0]!();
		const pending = runPrimeCommand({
			action: "snapshot",
			contentId: ids.first,
		});
		await tick(1);
		const request = vi
			.mocked(window.postMessage)
			.mock.calls.find(
				(call) => (call[0] as { action?: string }).action === "snapshot",
			)![0] as { id: string };
		const sdk = inspectPrimeSdk()!;
		window.dispatchEvent(
			new MessageEvent("message", {
				origin: location.origin,
				source: window,
				data: {
					source: "anidachi-primevideo-result-v1",
					id: request.id,
					ok: true,
					snapshot: {
						...sdk.snapshot,
						contentId: ids.second,
						generation: "fake",
					},
				},
			}),
		);
		await tick(3500);
		expect(await pending).toBeNull();
		expect(
			vi
				.mocked(window.postMessage)
				.mock.calls.some(
					(call) => (call[0] as { action?: string }).action === "cancel",
				),
		).toBe(true);
	});
});

it("personal resume uses confirmed exact source and fences expired, revoked and replaced targets", async () => {
	vi.useFakeTimers();
	const f = setup(),
		adapter = detectSourceAdapter() as PrimeVideoAdapter;
	stops.push(adapter.subscribe(() => {}));
	await tick();
	const target = {
		sourceUrl: `https://www.primevideo.com/detail/${ids.first}`,
		currentTime: 100,
		expiresAt: Date.now() + 5000,
		intentId: "resume",
	};
	expect(
		await adapter.getPersonalResumeReadiness({
			...target,
			sourceUrl: `https://www.primevideo.com/detail/${ids.second}`,
		}),
	).toBe("cancelled");
	let allowed = true;
	const pending = adapter.seekPersonalResume(target, () => allowed);
	await tick(1);
	allowed = false;
	await tick();
	expect(await pending).toBe("cancelled");
	expect(f.context.playback.seek).not.toHaveBeenCalled();
	const expiring = adapter.seekPersonalResume(
		{ ...target, expiresAt: Date.now() + 20 },
		() => true,
	);
	await tick();
	expect(await expiring).toBe("cancelled");
	expect(f.context.playback.seek).not.toHaveBeenCalled();
	const resume = adapter.seekPersonalResume(target, () => true);
	await tick();
	expect(await resume).toBe("consumed");
	expect(f.context.playback.seek).toHaveBeenCalledWith(100000);
});
