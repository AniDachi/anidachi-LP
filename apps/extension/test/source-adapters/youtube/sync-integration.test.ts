import type { ClientEvent, PlaybackState } from "@anidachi/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackSyncController } from "../../../src/playback-sync-controller";
import { YouTubeVideoAdapter } from "../../../src/source-adapters/youtube/adapter";

describe("YouTube playback sync integration", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		mockLocation("https://www.youtube.com/watch?v=video-1");
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("persists one safe host hold without forwarding advertisement events", async () => {
		const harness = createHarness(true);
		harness.player.classList.add("ad-showing");
		harness.setCurrentTime(7);
		harness.video.dispatchEvent(new Event("waiting"));
		harness.video.dispatchEvent(new Event("play"));
		expect(harness.adapter.getPlaybackSnapshot().phase).toBe("interstitial");
		harness.controller.heartbeat();
		await Promise.resolve();

		expect(harness.sent).toHaveLength(1);
		expect(harness.sent[0]).toMatchObject({
			type: "HOST_STATE",
			state: { hostTime: 12, playing: false },
		});
		expect(harness.sent.some((event) => event.type === "PLAY")).toBe(false);
	});

	it("does not touch a guest advertisement and applies the latest state after it", async () => {
		const harness = createHarness(false);
		harness.player.classList.add("ad-showing");
		harness.video.dispatchEvent(new Event("waiting"));
		expect(harness.adapter.getPlaybackSnapshot().phase).toBe("interstitial");
		await Promise.resolve();
		const pause = vi.spyOn(harness.adapter, "pause");
		const seek = vi.spyOn(harness.adapter, "seek");

		await harness.controller.handleHostState(hostState(30, false));
		expect(pause).not.toHaveBeenCalled();
		expect(seek).not.toHaveBeenCalled();

		harness.player.classList.remove("ad-showing");
		harness.video.dispatchEvent(new Event("playing"));
		vi.advanceTimersByTime(501);
		await harness.controller.handleHostState(hostState(30, false));
		await Promise.resolve();

		expect(seek).toHaveBeenCalledWith(30, { resumeIfPlaying: false });
		expect(pause).toHaveBeenCalledTimes(1);
	});
});

function createHarness(isHost: boolean) {
	document.body.innerHTML = `
		<div id="movie_player" class="html5-video-player">
			<video></video>
		</div>
	`;
	const player = document.querySelector("#movie_player") as HTMLElement;
	const video = player.querySelector("video") as HTMLVideoElement;
	let currentTime = 12;
	let paused = false;
	Object.defineProperties(video, {
		currentTime: {
			configurable: true,
			get: () => currentTime,
			set: (value: number) => {
				currentTime = value;
			},
		},
		duration: { configurable: true, value: 120 },
		paused: {
			configurable: true,
			get: () => paused,
		},
		playbackRate: { configurable: true, value: 1, writable: true },
		readyState: { configurable: true, value: 4 },
	});
	vi.spyOn(video, "pause").mockImplementation(() => {
		paused = true;
	});
	vi.spyOn(video, "play").mockImplementation(async () => {
		paused = false;
	});

	const adapter = new YouTubeVideoAdapter(video, player);
	const sent: ClientEvent[] = [];
	const controller = new PlaybackSyncController({
		ensureRemoteSource: async () => ({
			status: "unsupported",
			reason: "unsupported-route",
		}),
		onStatus: () => undefined,
		transport: { send: (event) => sent.push(event) },
	});
	controller.bindAdapter(adapter);
	controller.setSession({
		connectionGeneration: 1,
		isHost,
		participantId: "participant",
		roomGeneration: 1,
		roomId: "room",
		roomProvider: "youtube",
		sourceGeneration: 1,
	});

	return {
		adapter,
		controller,
		player,
		sent,
		setCurrentTime: (value: number) => {
			currentTime = value;
		},
		video,
	};
}

function hostState(hostTime: number, playing: boolean): PlaybackState {
	return {
		hostTime,
		playbackRate: 1,
		playing,
		updatedAt: Date.now(),
		videoFingerprint: "youtube|video-1",
	};
}

function mockLocation(url: string): void {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(url),
	});
}
