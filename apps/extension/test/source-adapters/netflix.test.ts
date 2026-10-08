import { runNetflixCommand } from "../../src/source-adapters/netflix/bridge-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	netflixWatchId,
	NetflixRequestSchema,
	NETFLIX_REQUEST,
	NETFLIX_RESULT,
	NETFLIX_VIDEO_GENERATION,
} from "../../src/source-adapters/netflix/contract";
import {
	netflixId,
	readNetflixMetadata,
	readNetflixCatalog,
	netflixContext,
} from "../../src/source-adapters/netflix/metadata";
import { startNetflixBridge } from "../../src/source-adapters/netflix/main-bridge";
import { NetflixVideoAdapter } from "../../src/source-adapters/netflix/adapter";
import { netflixDefinition } from "../../src/source-adapters/netflix/definition";
import { netflixHistoryPolicy } from "../../src/source-adapters/netflix/progress";
import { isOverlayAllowedOnPage } from "../../src/overlay-mount";
import { HISTORY_OBSERVATION_SUSPENDED } from "../../src/source-adapters/core/history-policy";
const context = netflixContext("CA", "en-US")!;
const show = () => ({
	id: 70143836,
	type: "show",
	title: "Breaking Bad",
	currentEpisode: 70196260,
	artwork: [{ h: 720, w: 1280, url: "https://a.nflxso.net/landscape.jpg" }],
	boxart: [{ h: 607, w: 426, url: "https://a.nflxso.net/portrait.jpg" }],
	seasons: [
		{
			id: 70114191,
			seq: 2,
			title: "Season 2",
			episodes: [
				{
					id: 70196259,
					episodeId: 70196259,
					seq: 1,
					title: "Seven Thirty-Seven",
					runtime: 2800,
					autoplayable: true,
				},
				{
					id: 70196260,
					episodeId: 70196260,
					seq: 2,
					title: "Grilled",
					runtime: 2800,
					autoplayable: true,
				},
			],
		},
	],
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = "";
	Reflect.deleteProperty(window, "netflix");
});
function route(path = "/watch/70196260") {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(`https://www.netflix.com${path}`),
	});
}
beforeEach(() => route());
describe("Netflix identity and bounded metadata", () => {
	it("accepts only canonical supported HTTPS watch identities", () => {
		expect(
			netflixWatchId("https://www.netflix.com/watch/70196260?track=1#room"),
		).toBe("70196260");
		for (const url of [
			"http://www.netflix.com/watch/1",
			"https://netflix.com/watch/1",
			"https://www.netflix.com.evil/watch/1",
			"https://u@www.netflix.com/watch/1",
			"https://www.netflix.com/browse",
			"https://www.netflix.com/watch/0",
		])
			expect(netflixWatchId(url)).toBeNull();
		expect(netflixId(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
		expect(netflixId("9007199254740993")).toBe("9007199254740993");
		expect(isOverlayAllowedOnPage("https://www.netflix.com/browse")).toBe(
			false,
		);
	});
	it("uses stable IDs and portrait art, never locale suffix as country", () => {
		const data = readNetflixMetadata(show(), "70196260", context)!;
		expect(data.identity).toEqual({
			kind: "episode",
			providerSeriesId: "70143836",
			providerSeasonIdentifier: "70114191",
			providerEpisodeIdentifier: "70196260",
		});
		expect(data.artworkUrl).toBe("https://a.nflxso.net/portrait.jpg");
		expect(data.context?.region).toBe("CA");
		expect(netflixContext(null, "en-US")?.region).toBeNull();
	});
	it("rejects recap, conflicting current ID, duplicates and oversized series", () => {
		expect(
			readNetflixMetadata(
				{ id: 70196260, type: "supplemental", title: "Recap" },
				"70196260",
				context,
			),
		).toBeNull();
		const data = show();
		data.currentEpisode = 70196259;
		expect(readNetflixMetadata(data, "70196260", context)).toBeNull();
		data.currentEpisode = 70196260;
		data.seasons[0].episodes.push(data.seasons[0].episodes[0]);
		expect(readNetflixMetadata(data, "70196260", context)).toBeNull();
		expect(
			readNetflixMetadata(
				{ ...show(), seasons: Array(101).fill(show().seasons[0]) },
				"70196260",
				context,
			),
		).toBeNull();
	});
	it("keeps movie identity independent and rejects unsafe artwork", () => {
		const data = readNetflixMetadata(
			{
				id: 81078819,
				type: "movie",
				title: "El Camino",
				boxart: [{ url: "https://a.nflxso.net.evil/x" }],
			},
			"81078819",
			context,
		)!;
		expect(data.identity).toEqual({
			kind: "movie",
			providerMovieId: "81078819",
		});
		expect(data.seasonNumber).toBeNull();
		expect(data.artworkUrl).toBeNull();
	});
	it("marks catalogs partial for unknown availability/context, without inventing episodes", () => {
		expect(readNetflixCatalog(show(), "70196260", context)?.completeness).toBe(
			"complete",
		);
		const data = show();
		Reflect.deleteProperty(data.seasons[0].episodes[0], "autoplayable");
		const catalog = readNetflixCatalog(data, "70196260", context)!;
		expect(catalog.completeness).toBe("partial");
		expect(catalog.seasons[0].episodes).toHaveLength(1);
		expect(
			readNetflixCatalog(show(), "70196260", netflixContext(null, "en-US"))
				?.completeness,
		).toBe("partial");
		expect(readNetflixCatalog(show(), "70196260", null)).toBeNull();
	});
	it("requires generation and bounded seek values for commands", () => {
		expect(
			NetflixRequestSchema.safeParse({
				source: NETFLIX_REQUEST,
				id: "x",
				action: "seek",
				movieId: "1",
				time: 10,
			}).success,
		).toBe(false);
		expect(
			NetflixRequestSchema.safeParse({
				source: NETFLIX_REQUEST,
				id: "x",
				action: "seek",
				movieId: "1",
				generation: "x",
				time: Infinity,
			}).success,
		).toBe(false);
	});
});
function fixture() {
	document.body.innerHTML = '<div data-uia="watch-video"><video></video></div>';
	const video = document.querySelector("video")!;
	Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
	let time = 12000,
		paused = true;
	const ad = { adPresenting: { _value: false as unknown } };
	const player = {
		getMovieId: vi.fn(() => 70196260),
		getCurrentTime: () => time,
		getDuration: () => 2800000,
		isReady: () => true,
		isPaused: () => paused,
		getElement: () => video.parentElement,
		getAdManager: () => ad,
		seek: vi.fn((ms: number) => {
			time = ms;
		}),
		play: vi.fn(() => {
			paused = false;
		}),
		pause: vi.fn(() => {
			paused = true;
		}),
	};
	const api = {
		videoPlayer: {
			getAllPlayerSessionIds: () => ["session"],
			getVideoPlayerBySessionId: () => player,
		},
		getVideoMetadataByVideoId: () => ({ _metadataObject: { video: show() } }),
	};
	Reflect.set(window, "netflix", {
		appContext: { state: { playerApp: { getAPI: () => api } } },
		reactContext: {
			models: {
				geo: {
					data: { requestCountry: { id: "CA" }, locale: { id: "en-US" } },
				},
			},
		},
	});
	const posts = vi.spyOn(window, "postMessage").mockImplementation(() => {});
	const stop = startNetflixBridge();
	const request = (input: Record<string, unknown>) => {
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: location.origin,
				data: {
					source: NETFLIX_REQUEST,
					id: crypto.randomUUID(),
					movieId: "70196260",
					...input,
				},
			}),
		);
		return posts.mock.calls.at(-1)?.[0] as {
			source: string;
			ok: boolean;
			snapshot?: { generation: string; currentTime: number };
			catalog?: unknown;
		};
	};
	return { video, player, ad, stop, request, posts };
}
describe("Netflix page bridge", () => {
	it("publishes small snapshots and seeks through the API in milliseconds with observed completion", async () => {
		vi.useFakeTimers();
		const f = fixture();
		const snapshot = f.request({ action: "snapshot" });
		expect(snapshot.source).toBe(NETFLIX_RESULT);
		expect(snapshot.snapshot?.currentTime).toBe(12);
		expect(snapshot.catalog).toBeUndefined();
		expect(JSON.stringify(snapshot)).not.toContain("Seven Thirty-Seven");
		f.request({
			action: "seek",
			generation: snapshot.snapshot!.generation,
			time: 42,
		});
		expect(f.player.seek).toHaveBeenCalledWith(42000);
		await vi.advanceTimersByTimeAsync(100);
		expect(f.posts.mock.calls.at(-1)?.[0].ok).toBe(true);
		expect(f.video.currentTime).toBe(0);
		f.stop();
		expect(vi.getTimerCount()).toBe(0);
	});
	it("suspends unknown/active ads, supplemental mismatches and stale generations", () => {
		const f = fixture();
		const first = f.request({ action: "snapshot" });
		f.ad.adPresenting._value = undefined;
		expect(f.request({ action: "snapshot" }).ok).toBe(false);
		f.ad.adPresenting._value = true;
		expect(f.request({ action: "snapshot" }).ok).toBe(false);
		f.ad.adPresenting._value = false;
		f.request({ action: "seek", generation: "stale", time: 100 });
		expect(f.player.seek).not.toHaveBeenCalled();
		f.player.getMovieId.mockReturnValue(81169895);
		expect(f.request({ action: "snapshot" }).ok).toBe(false);
		expect(f.video.hasAttribute(NETFLIX_VIDEO_GENERATION)).toBe(false);
		f.player.getMovieId.mockReturnValue(70196260);
		expect(f.request({ action: "snapshot" }).snapshot?.generation).not.toBe(
			first.snapshot?.generation,
		);
		f.stop();
		f.stop();
	});
	it("times out a no-op seek and cancels pending work on teardown", async () => {
		vi.useFakeTimers();
		const f = fixture();
		const first = f.request({ action: "snapshot" });
		f.player.seek.mockImplementation(() => {});
		f.request({
			action: "seek",
			generation: first.snapshot!.generation,
			time: 100,
		});
		await vi.advanceTimersByTimeAsync(2700);
		expect(f.posts.mock.calls.at(-1)?.[0].ok).toBe(false);
		f.request({
			action: "seek",
			generation: first.snapshot!.generation,
			time: 200,
		});
		f.stop();
		expect(vi.getTimerCount()).toBe(0);
	});
	it("does not allocate adapter timers before subscribing and never controls raw video", () => {
		vi.useFakeTimers();
		const f = fixture();
		const adapter = new NetflixVideoAdapter(f.video, f.video.parentElement!);
		expect(vi.getTimerCount()).toBe(0);
		adapter.seek(40);
		expect(f.video.currentTime).toBe(0);
		expect(netflixHistoryPolicy.observe({ adapter, preferences: null })).toBe(
			HISTORY_OBSERVATION_SUSPENDED,
		);
		route("/browse");
		expect(netflixDefinition.detect(f.video)).toBeNull();
		f.stop();
	});
});

describe("Netflix subscribed adapter", () => {
	it("captures validated personal history, cancels on replacement and releases every listener/timer", async () => {
		const f = fixture();
		f.posts.mockImplementation((data) => {
			queueMicrotask(() =>
				window.dispatchEvent(
					new MessageEvent("message", {
						source: window,
						origin: location.origin,
						data,
					}),
				),
			);
		});
		const adapter = new NetflixVideoAdapter(f.video, f.video.parentElement!);
		const events: string[] = [];
		const unsubscribe = adapter.subscribe((event) => events.push(event.type));
		await vi.waitFor(() =>
			expect(adapter.getPlaybackSnapshot().phase).toBe("content"),
		);
		expect(adapter.getSourceDescriptor()).toMatchObject({
			provider: "netflix",
			videoFingerprint: "netflix|watch/70196260",
			sourceUrl: "https://www.netflix.com/watch/70196260",
		});
		expect(
			netflixHistoryPolicy.observe({ adapter, preferences: null }),
		).toMatchObject({
			provider: "netflix",
			titleKey: "netflix:series:70143836",
			seasonKey: "netflix:season:70114191",
			episodeKey: "netflix:episode:70196260",
			currentTime: 12,
			duration: 2800,
		});
		expect(events).toContain("phasechange");
		f.player.play();
		f.video.dispatchEvent(new Event("play"));
		await vi.waitFor(() => expect(events).toContain("play"));
		f.ad.adPresenting._value = true;
		f.video.dispatchEvent(new Event("waiting"));
		await vi.waitFor(() =>
			expect(adapter.getPlaybackSnapshot().phase).toBe("transition"),
		);
		expect(netflixHistoryPolicy.observe({ adapter, preferences: null })).toBe(
			HISTORY_OBSERVATION_SUSPENDED,
		);
		f.ad.adPresenting._value = false;
		route("/watch/70196259");
		await expect(
			adapter.getPersonalResumeReadiness({
				sourceUrl: "https://www.netflix.com/watch/70196260",
				currentTime: 30,
				expiresAt: Date.now() + 1000,
				intentId: "test",
			}),
		).resolves.toBe("cancelled");
		unsubscribe();
		unsubscribe();
		f.stop();
		expect(adapter.getNetflixSnapshot()).toBeNull();
	});
});

it("aborts client and MAIN timers together on adapter lifecycle cancellation", async () => {
	vi.useFakeTimers();
	const f = fixture();
	const first = f.request({ action: "snapshot" });
	f.player.seek.mockImplementation(() => {});
	f.posts.mockImplementation((data) =>
		window.dispatchEvent(
			new MessageEvent("message", {
				source: window,
				origin: location.origin,
				data,
			}),
		),
	);
	const abort = new AbortController();
	const result = runNetflixCommand(
		{
			action: "seek",
			movieId: "70196260",
			generation: first.snapshot!.generation,
			time: 100,
		},
		abort.signal,
	);
	expect(vi.getTimerCount()).toBe(2);
	abort.abort();
	await expect(result).resolves.toBeNull();
	expect(vi.getTimerCount()).toBe(0);
	f.stop();
});


it("retains verified main-content identity at the natural end for history completion", () => {
  const f = fixture();
  Object.defineProperty(f.video, "ended", { configurable: true, value: true });
  expect(f.request({ action: "snapshot" }).ok).toBe(true);
  f.stop();
});
