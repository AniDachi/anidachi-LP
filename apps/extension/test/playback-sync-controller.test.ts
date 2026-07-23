import type {
	ClientEvent,
	PlaybackState,
	WatchSourceDescriptor,
} from "@anidachi/protocol";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockedFunction,
	vi,
} from "vitest";
import {
	PlaybackSyncController,
	type PlaybackSyncSession,
} from "../src/playback-sync-controller";
import type { PlaybackSyncStatus } from "../src/playback-sync-status";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../src/source-adapters/core/overlay-geometry";
import {
	CRUNCHYROLL_PLAYBACK_POLICY,
	DEFAULT_PLAYBACK_POLICY,
} from "../src/source-adapters/core/playback-policy";
import type {
	AdapterPlaybackPhase,
	EnsureSourceResult,
	PlayerEvent,
	SourceNavigationContext,
	VideoAdapter,
} from "../src/source-adapters/core/types";

describe("PlaybackSyncController", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("broadcasts host play pause and seek once", () => {
		const harness = createHarness({ isHost: true });

		harness.adapter.emit({ type: "play", time: 10 });
		harness.adapter.emit({ type: "pause", time: 12 });
		harness.adapter.emit({ type: "seek", time: 30 });

		expect(harness.sent.map((event) => event.type)).toEqual([
			"PLAY",
			"HOST_STATE",
			"PAUSE",
			"HOST_STATE",
			"SEEK",
			"HOST_STATE",
		]);
		expect(harness.sent.filter((event) => event.type === "PLAY")).toHaveLength(
			1,
		);
		expect(harness.sent.filter((event) => event.type === "PAUSE")).toHaveLength(
			1,
		);
		expect(harness.sent.filter((event) => event.type === "SEEK")).toHaveLength(
			1,
		);
	});

	it("rejects local guest control as authoritative state", () => {
		const harness = createHarness({ isHost: false });

		harness.adapter.emit({ type: "play", time: 10 });
		harness.adapter.emit({ type: "pause", time: 12 });
		harness.adapter.emit({ type: "seek", time: 30 });

		expect(harness.sent).toEqual([]);
		expect(harness.statuses.at(-1)).toEqual({ kind: "host-controls-playback" });
	});

	it("reconciles a guest control immediately without sending transport events", async () => {
		const harness = createHarness({ isHost: false });
		harness.adapter.setCurrentTime(40);
		harness.adapter.setPaused(true);
		await harness.controller.handleHostState(
			playbackState({ hostTime: 40, playing: false }),
		);
		harness.adapter.pause.mockClear();
		harness.adapter.seek.mockClear();
		harness.adapter.setCurrentTime(55);
		harness.adapter.setPaused(false);

		harness.adapter.emit({ type: "play", time: 55 });

		expect(harness.sent).toEqual([]);
		expect(harness.adapter.pause).toHaveBeenCalledTimes(1);
		expect(harness.adapter.seek).toHaveBeenCalledWith(40, {
			resumeIfPlaying: false,
		});
		expect(harness.statuses.at(-1)).toEqual({ kind: "host-controls-playback" });
	});

	it("sends host heartbeat every caller tick without duplicating local commands", () => {
		const harness = createHarness({ isHost: true });

		harness.adapter.emit({ type: "play", time: 10 });
		harness.sent.length = 0;
		harness.controller.heartbeat();
		harness.controller.heartbeat();

		expect(harness.sent.map((event) => event.type)).toEqual([
			"HOST_STATE",
			"HOST_STATE",
		]);
	});

	it("broadcasts an explicit host state even during remote-event suppression", () => {
		const harness = createHarness({ isHost: true });

		harness.controller.suppressLocalEventsForRemoteTransition();
		harness.controller.broadcastHostState();

		expect(harness.sent.map((event) => event.type)).toEqual(["HOST_STATE"]);
	});

	it("holds the room once at the last confirmed content time during a host ad", () => {
		const harness = createHarness({ isHost: true });
		harness.adapter.setCurrentTime(42);
		harness.adapter.setPaused(false);
		harness.adapter.emit({ type: "timeupdate", time: 42 });
		harness.sent.length = 0;

		harness.adapter.setPhase("interstitial");
		harness.adapter.setCurrentTime(7);
		harness.adapter.emitPhase();
		harness.adapter.emitPhase();
		harness.controller.heartbeat();

		expect(harness.sent).toHaveLength(1);
		expect(harness.sent[0]).toMatchObject({
			type: "HOST_STATE",
			state: { hostTime: 42, playing: false },
		});
		expect(harness.adapter.pause).not.toHaveBeenCalled();
		expect(harness.adapter.seek).not.toHaveBeenCalled();
		expect(harness.statuses.at(-1)).toEqual({
			kind: "waiting-for-host-ad",
		});
	});

	it("uses a zero content hold for a host pre-roll", () => {
		const harness = createHarness({ isHost: true });
		harness.adapter.setPhase("interstitial");

		harness.adapter.emitPhase();

		expect(harness.sent).toHaveLength(1);
		expect(harness.sent[0]).toMatchObject({
			type: "HOST_STATE",
			state: { hostTime: 0, playing: false },
		});
	});

	it("publishes fresh content state once after the host ad ends", () => {
		const harness = createHarness({ isHost: true });
		harness.adapter.setCurrentTime(20);
		harness.adapter.setPaused(false);
		harness.adapter.emit({ type: "timeupdate", time: 20 });
		harness.sent.length = 0;
		harness.adapter.setPhase("interstitial");
		harness.adapter.emitPhase();
		harness.adapter.setCurrentTime(24);
		harness.adapter.setPhase("content");

		harness.adapter.emitPhase();
		harness.adapter.emitPhase();

		expect(harness.sent).toHaveLength(2);
		expect(harness.sent[1]).toMatchObject({
			type: "HOST_STATE",
			state: { hostTime: 24, playing: true },
		});
	});

	it("queues only the latest host state while a guest watches an ad", async () => {
		const harness = createHarness({ isHost: false });
		harness.adapter.setPhase("interstitial");
		harness.adapter.emitPhase();

		await harness.controller.handleHostState(
			playbackState({ hostTime: 10, playing: true }),
		);
		await harness.controller.handleHostState(
			playbackState({ hostTime: 30, playing: false }),
		);
		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "remote-host",
			to: 35,
		});

		expect(harness.adapter.pause).not.toHaveBeenCalled();
		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.seek).not.toHaveBeenCalled();

		harness.adapter.setPaused(false);
		harness.adapter.setPhase("content");
		harness.adapter.emitPhase();
		await Promise.resolve();

		expect(harness.adapter.seek).toHaveBeenLastCalledWith(35, {
			resumeIfPlaying: false,
		});
		expect(harness.adapter.pause).toHaveBeenCalledTimes(1);
	});

	it("cancels pending remote play when a transition begins", async () => {
		const harness = createHarness({ isHost: false, provider: "youtube" });
		harness.adapter.setPaused(true);
		harness.adapter.setMediaReady(false);
		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});

		harness.adapter.setPhase("transition");
		harness.adapter.emitPhase();
		harness.adapter.setMediaReady(true);
		harness.adapter.video.dispatchEvent(new Event("canplay"));
		await Promise.resolve();
		await Promise.resolve();

		expect(harness.adapter.play).not.toHaveBeenCalled();
	});

	it("blocks unsupported media without touching playback", () => {
		const harness = createHarness({ isHost: false });
		harness.adapter.setPhase("unsupported");
		harness.adapter.emitPhase();
		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 15,
		});

		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.seek).not.toHaveBeenCalled();
		expect(harness.statuses.at(-1)).toEqual({ kind: "unsupported-media" });
	});

	it("suppresses events caused by a remote command", () => {
		const harness = createHarness({ isHost: false });

		harness.controller.handleRemoteCommand({
			type: "PAUSE",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 20,
		});
		harness.adapter.emit({ type: "pause", time: 20 });

		expect(harness.sent).toEqual([]);
		expect(harness.adapter.pause).toHaveBeenCalledTimes(1);
		expect(harness.statuses).toEqual([{ kind: "synced" }]);
	});

	it("ignores a repeated remote command inside the dedupe window", () => {
		const harness = createHarness({ isHost: false });
		const event = {
			type: "SEEK" as const,
			roomId: "room-1",
			byUserId: "remote-host",
			to: 25,
		};

		harness.controller.handleRemoteCommand(event);
		harness.controller.handleRemoteCommand(event);

		expect(harness.adapter.seek).toHaveBeenCalledTimes(1);
	});

	it("keeps host playback authoritative when a foreign command is received", () => {
		const harness = createHarness({ isHost: true });

		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "guest-1",
			to: 25,
		});

		expect(harness.adapter.seek).not.toHaveBeenCalled();
		expect(harness.statuses).toEqual([]);
	});

	it("seeks medium and large host drift using existing thresholds", async () => {
		const harness = createHarness({ isHost: false });

		await harness.controller.handleHostState(playbackState({ hostTime: 3 }));
		expect(harness.adapter.seek).toHaveBeenLastCalledWith(3, {
			resumeIfPlaying: false,
		});

		vi.advanceTimersByTime(2500);
		harness.adapter.setCurrentTime(0);
		await harness.controller.handleHostState(playbackState({ hostTime: 10 }));
		expect(harness.adapter.seek).toHaveBeenLastCalledWith(10, {
			resumeIfPlaying: false,
		});
		expect(harness.adapter.seek).toHaveBeenCalledTimes(2);
	});

	it("waits for non-Crunchyroll media readiness before remote play", async () => {
		const harness = createHarness({ isHost: false, provider: "youtube" });
		harness.adapter.setPaused(true);
		harness.adapter.setMediaReady(false);

		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		await Promise.resolve();
		expect(harness.adapter.play).not.toHaveBeenCalled();

		harness.adapter.setMediaReady(true);
		harness.adapter.video.dispatchEvent(new Event("canplay"));
		await Promise.resolve();
		await Promise.resolve();

		expect(harness.adapter.play).toHaveBeenCalledTimes(1);
	});

	it("cancels pending play when pause arrives", async () => {
		const harness = createHarness({ isHost: false, provider: "youtube" });
		harness.adapter.setPaused(true);
		harness.adapter.setMediaReady(false);

		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		harness.controller.handleRemoteCommand({
			type: "PAUSE",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		harness.adapter.setMediaReady(true);
		harness.adapter.video.dispatchEvent(new Event("canplay"));
		await Promise.resolve();
		await Promise.resolve();

		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.pause).toHaveBeenCalledTimes(1);
	});

	it("does not apply remote state while the adapter is suspended", async () => {
		const harness = createHarness({ isHost: false });
		harness.controller.suspend();

		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "remote-host",
			to: 25,
		});
		await harness.controller.handleHostState(
			playbackState({ hostTime: 30, playing: true }),
		);

		expect(harness.adapter.seek).not.toHaveBeenCalled();
		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.pause).not.toHaveBeenCalled();
	});

	it("disposes timers and adapter subscriptions exactly once", () => {
		const clearIntervalSpy = vi.spyOn(window, "clearInterval");
		const harness = createHarness({ isHost: true });

		harness.controller.dispose();
		harness.controller.dispose();
		vi.advanceTimersByTime(3000);

		expect(harness.adapter.unsubscribe).toHaveBeenCalledTimes(1);
		expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
		expect(harness.sent).toEqual([]);
	});

	it("does not heartbeat before a reconnecting room provider is restored", () => {
		const harness = createHarness({ isHost: true, roomProvider: null });

		vi.advanceTimersByTime(3000);
		expect(harness.sent).toEqual([]);

		harness.controller.setSession(
			session({
				isHost: true,
				connectionGeneration: 2,
				roomProvider: "youtube",
			}),
		);
		vi.advanceTimersByTime(1500);
		expect(harness.sent.map((event) => event.type)).toEqual(["HOST_STATE"]);
	});

	it("does not synchronize through an adapter for another room provider", async () => {
		const harness = createHarness({
			isHost: false,
			provider: "crunchyroll",
			roomProvider: "youtube",
		});

		harness.adapter.emit({ type: "play", time: 10 });
		harness.controller.broadcastHostState();
		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "remote-host",
			to: 25,
		});
		await harness.controller.handleHostState(
			playbackState({
				hostTime: 25,
				videoFingerprint: "crunchyroll|video",
			}),
		);

		expect(harness.sent).toEqual([]);
		expect(harness.adapter.seek).not.toHaveBeenCalled();
	});

	it("holds remote playback and applies the newest state after the target adapter binds", async () => {
		const navigation = deferred<EnsureSourceResult>();
		const ensureRemoteSource = vi.fn(() => navigation.promise);
		const harness = createHarness({ isHost: false, ensureRemoteSource });
		const targetSource = watchSource("youtube", "next-video");

		const first = harness.controller.handleHostState(
			playbackState({
				hostTime: 20,
				videoFingerprint: targetSource.videoFingerprint,
			}),
			targetSource,
		);
		await Promise.resolve();
		const second = harness.controller.handleHostState(
			playbackState({
				hostTime: 35,
				videoFingerprint: targetSource.videoFingerprint,
			}),
			targetSource,
		);
		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "remote-host",
			to: 50,
		});

		expect(ensureRemoteSource).toHaveBeenCalledTimes(1);
		expect(harness.adapter.seek).not.toHaveBeenCalled();

		const replacement = createFakeAdapter({
			fingerprint: targetSource.videoFingerprint,
			provider: "youtube",
		});
		harness.controller.bindAdapter(replacement);
		await first;
		await second;

		expect(replacement.seek).toHaveBeenLastCalledWith(35, {
			resumeIfPlaying: false,
		});
	});

	it("cancels an older source navigation when a newer source arrives", async () => {
		const navigations: Array<{
			context: SourceNavigationContext;
			deferred: ReturnType<typeof deferred<EnsureSourceResult>>;
		}> = [];
		const ensureRemoteSource = vi.fn(
			(_source: WatchSourceDescriptor, context: SourceNavigationContext) => {
				const operation = deferred<EnsureSourceResult>();
				navigations.push({ context, deferred: operation });
				return operation.promise;
			},
		);
		const harness = createHarness({ isHost: false, ensureRemoteSource });

		void harness.controller.handleHostState(
			playbackState({ videoFingerprint: "youtube|video-b" }),
			watchSource("youtube", "video-b"),
		);
		await Promise.resolve();
		void harness.controller.handleHostState(
			playbackState({ videoFingerprint: "youtube|video-c" }),
			watchSource("youtube", "video-c"),
		);
		await Promise.resolve();

		expect(ensureRemoteSource).toHaveBeenCalledTimes(2);
		expect(navigations[0]?.context.signal.aborted).toBe(true);
		expect(navigations[1]?.context.signal.aborted).toBe(false);

		navigations[0]?.deferred.resolve({
			status: "navigation-started",
			targetUrl: "https://www.youtube.com/watch?v=video-b",
		});
		navigations[1]?.deferred.resolve({
			status: "navigation-started",
			targetUrl: "https://www.youtube.com/watch?v=video-c",
		});
		await Promise.resolve();
	});

	it("does not apply direct playback commands while source navigation is pending", async () => {
		const navigation = deferred<EnsureSourceResult>();
		const harness = createHarness({
			isHost: false,
			ensureRemoteSource: () => navigation.promise,
		});

		void harness.controller.handleHostState(
			playbackState({ videoFingerprint: "youtube|next-video" }),
			watchSource("youtube", "next-video"),
		);
		await Promise.resolve();
		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 42,
		});
		harness.controller.handleRemoteCommand({
			type: "SEEK",
			roomId: "room-1",
			byUserId: "remote-host",
			to: 42,
		});

		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.seek).not.toHaveBeenCalled();
	});

	it("times out a source transition without touching the wrong media", async () => {
		const navigation = deferred<EnsureSourceResult>();
		const contexts: SourceNavigationContext[] = [];
		const harness = createHarness({
			isHost: false,
			ensureRemoteSource: (_source, nextContext) => {
				contexts.push(nextContext);
				return navigation.promise;
			},
		});

		void harness.controller.handleHostState(
			playbackState({ videoFingerprint: "youtube|next-video" }),
			watchSource("youtube", "next-video"),
		);
		await Promise.resolve();
		vi.advanceTimersByTime(10_000);

		expect(contexts[0]?.signal.aborted).toBe(true);
		expect(harness.adapter.play).not.toHaveBeenCalled();
		expect(harness.adapter.pause).not.toHaveBeenCalled();
		expect(harness.adapter.seek).not.toHaveBeenCalled();
		expect(harness.statuses.at(-1)).toEqual({
			kind: "source-mismatch",
			message: "The player did not reach the room source in time.",
		});
	});

	it("ignores a late play completion after adapter replacement", async () => {
		const deferredPlay = deferred<void>();
		const harness = createHarness({
			isHost: false,
			playImplementation: () => deferredPlay.promise,
		});
		harness.adapter.setPaused(true);

		await harness.controller.handleHostState(
			playbackState({ hostTime: 0, playing: true }),
		);
		expect(harness.adapter.play).toHaveBeenCalledTimes(1);

		const replacement = createFakeAdapter({ provider: "youtube" });
		harness.controller.bindAdapter(replacement);
		harness.controller.setSession(
			session({ isHost: true, connectionGeneration: 2 }),
		);
		deferredPlay.resolve();
		await Promise.resolve();
		vi.advanceTimersByTime(1800);
		harness.sent.length = 0;
		replacement.emit({ type: "play", time: 4 });

		expect(harness.sent.map((event) => event.type)).toEqual([
			"PLAY",
			"HOST_STATE",
		]);
	});

	it("ignores a late readiness completion after reconnect or source change", async () => {
		const harness = createHarness({ isHost: false, provider: "youtube" });
		harness.adapter.setPaused(true);
		harness.adapter.setMediaReady(false);

		harness.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		harness.controller.setSession(
			session({
				isHost: false,
				connectionGeneration: 2,
				sourceGeneration: 2,
			}),
		);
		harness.adapter.setMediaReady(true);
		harness.adapter.video.dispatchEvent(new Event("canplay"));
		await Promise.resolve();
		await Promise.resolve();

		expect(harness.adapter.play).not.toHaveBeenCalled();
	});

	it("ignores every async completion after sign-out or dispose", async () => {
		const signedOut = createHarness({ isHost: false, provider: "youtube" });
		signedOut.adapter.setPaused(true);
		signedOut.adapter.setMediaReady(false);
		signedOut.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		signedOut.controller.setSession(
			session({
				isHost: false,
				participantId: null,
				roomId: null,
				roomProvider: null,
			}),
		);
		signedOut.adapter.setMediaReady(true);
		signedOut.adapter.video.dispatchEvent(new Event("canplay"));

		const disposed = createHarness({ isHost: false, provider: "youtube" });
		disposed.adapter.setPaused(true);
		disposed.adapter.setMediaReady(false);
		disposed.controller.handleRemoteCommand({
			type: "PLAY",
			roomId: "room-1",
			byUserId: "remote-host",
			at: 0,
		});
		disposed.controller.dispose();
		disposed.adapter.setMediaReady(true);
		disposed.adapter.video.dispatchEvent(new Event("canplay"));
		await Promise.resolve();
		await Promise.resolve();

		expect(signedOut.adapter.play).not.toHaveBeenCalled();
		expect(disposed.adapter.play).not.toHaveBeenCalled();
	});

	it("routes manual catch-up through the coordinator", async () => {
		const harness = createHarness({ isHost: false, provider: "crunchyroll" });

		await harness.controller.handleHostState(
			playbackState({ hostTime: 20, videoFingerprint: "crunchyroll|video" }),
		);
		harness.adapter.seek.mockClear();
		harness.adapter.setCurrentTime(0);
		vi.advanceTimersByTime(600);
		await harness.controller.handleHostState(
			playbackState({ hostTime: 20, videoFingerprint: "crunchyroll|video" }),
		);
		expect(harness.statuses.at(-1)).toEqual({
			kind: "out-of-sync",
			expectedTime: 20,
			drift: -20,
		});

		harness.controller.catchUpFromUserGesture();

		expect(harness.adapter.seek).toHaveBeenCalledWith(20, {
			resumeIfPlaying: false,
		});
		expect(harness.statuses.at(-1)).toEqual({ kind: "synced" });
	});
});

interface HarnessOptions {
	ensureRemoteSource?: (
		source: WatchSourceDescriptor,
		context: SourceNavigationContext,
	) => Promise<EnsureSourceResult>;
	fingerprint?: string;
	isHost: boolean;
	playImplementation?: () => Promise<void>;
	provider?: "crunchyroll" | "youtube" | "generic";
	roomProvider?: "crunchyroll" | "youtube" | "generic" | null;
}

function createHarness(options: HarnessOptions) {
	const sent: ClientEvent[] = [];
	const statuses: PlaybackSyncStatus[] = [];
	const adapter = createFakeAdapter(options);
	const controller = new PlaybackSyncController({
		ensureRemoteSource:
			options.ensureRemoteSource ??
			(async () => ({
				status: "unsupported" as const,
				reason: "unsupported-route" as const,
			})),
		onStatus: (status) => statuses.push(status),
		transport: {
			send: (event) => sent.push(event),
		},
	});
	controller.bindAdapter(adapter);
	controller.setSession(
		session({
			isHost: options.isHost,
			roomProvider:
				options.roomProvider === undefined
					? (options.provider ?? "youtube")
					: options.roomProvider,
		}),
	);

	return { adapter, controller, sent, statuses };
}

function session(
	overrides: Partial<PlaybackSyncSession> = {},
): PlaybackSyncSession {
	return {
		connectionGeneration: 1,
		isHost: false,
		participantId: "participant-1",
		roomGeneration: 1,
		roomId: "room-1",
		roomProvider: "youtube",
		sourceGeneration: 1,
		...overrides,
	};
}

function playbackState(overrides: Partial<PlaybackState> = {}): PlaybackState {
	return {
		hostTime: 0,
		playbackRate: 1,
		playing: false,
		updatedAt: Date.now(),
		videoFingerprint: "youtube|video",
		...overrides,
	};
}

interface FakeAdapter extends VideoAdapter {
	emit(event: PlayerEvent): void;
	emitPhase(): void;
	pause: MockedFunction<VideoAdapter["pause"]>;
	play: MockedFunction<VideoAdapter["play"]>;
	seek: MockedFunction<VideoAdapter["seek"]>;
	setCurrentTime(time: number): void;
	setMediaReady(ready: boolean): void;
	setPaused(paused: boolean): void;
	setPhase(phase: AdapterPlaybackPhase): void;
	unsubscribe: ReturnType<typeof vi.fn>;
}

function createFakeAdapter({
	fingerprint,
	playImplementation,
	provider = "youtube",
}: Pick<
	HarnessOptions,
	"fingerprint" | "playImplementation" | "provider"
> = {}): FakeAdapter {
	const video = document.createElement("video");
	let currentTime = 0;
	let mediaReady = true;
	let paused = true;
	let phase: AdapterPlaybackPhase = "content";
	let confirmedContentTime = 0;
	let subscriber: ((event: PlayerEvent) => void) | null = null;
	const unsubscribe = vi.fn(() => {
		subscriber = null;
	});
	const pause = vi.fn(() => {
		paused = true;
	});
	const play = vi.fn(async () => {
		if (playImplementation) {
			await playImplementation();
		}
		paused = false;
	});
	const seek = vi.fn((time: number) => {
		currentTime = time;
	});

	Object.defineProperties(video, {
		currentTime: {
			configurable: true,
			get: () => currentTime,
			set: (value: number) => {
				currentTime = value;
			},
		},
		paused: { configurable: true, get: () => paused },
		readyState: { configurable: true, get: () => (mediaReady ? 3 : 1) },
		seeking: { configurable: true, get: () => !mediaReady },
	});

	return {
		container: document.createElement("div"),
		duckVolume: () => () => undefined,
		emit: (event) => {
			if (phase === "content" || phase === "buffering") {
				confirmedContentTime = currentTime;
			}
			subscriber?.(event);
		},
		emitPhase: () =>
			subscriber?.({
				type: "phasechange",
				snapshot: {
					capturedAt: Date.now(),
					contentTime: confirmedContentTime,
					phase,
					playbackRate: video.playbackRate || 1,
					playing: !paused,
				},
			}),
		enterFullscreen: async () => undefined,
		exitFullscreen: async () => undefined,
		getCurrentTime: () => currentTime,
		getFingerprint: () => fingerprint ?? `${provider}|video`,
		getOverlayBinding: () => ({
			fillMountTarget: true,
			mountTarget: document.body,
			useNativePlayerDoubleClick: true,
		}),
		getOverlayGeometry: () => DEFAULT_PLAYER_OVERLAY_GEOMETRY,
		getPlaybackSnapshot: () => ({
			capturedAt: Date.now(),
			contentTime: confirmedContentTime,
			phase,
			playbackRate: video.playbackRate || 1,
			playing: !paused,
		}),
		getSourceDescriptor: () => ({
			canonicalUrl: `https://example.com/watch/${provider}`,
			provider,
			sourceUrl: `https://example.com/watch/${provider}`,
			title: "Test video",
			videoFingerprint: fingerprint ?? `${provider}|video`,
		}),
		getState: () =>
			playbackState({
				hostTime: currentTime,
				playing: !paused,
				videoFingerprint: fingerprint ?? `${provider}|video`,
			}),
		getTitle: () => "Test video",
		id: provider,
		isFullscreen: () => false,
		name: provider,
		pause,
		playbackPolicy:
			provider === "crunchyroll"
				? CRUNCHYROLL_PLAYBACK_POLICY
				: DEFAULT_PLAYBACK_POLICY,
		play,
		provider,
		seek,
		setPlaybackRate: (rate) => {
			video.playbackRate = rate;
		},
		setCurrentTime: (time) => {
			currentTime = time;
		},
		setMediaReady: (ready) => {
			mediaReady = ready;
		},
		setPaused: (value) => {
			paused = value;
		},
		setPhase: (value) => {
			if (phase === "content" || phase === "buffering") {
				confirmedContentTime = currentTime;
			}
			phase = value;
			if (phase === "content" || phase === "buffering") {
				confirmedContentTime = currentTime;
			}
		},
		subscribe: (callback) => {
			subscriber = callback;
			return unsubscribe;
		},
		subscribeOverlayGeometry: () => () => undefined,
		unsubscribe,
		video,
	};
}

function watchSource(
	provider: WatchSourceDescriptor["provider"],
	key: string,
): WatchSourceDescriptor {
	return {
		canonicalUrl: `https://www.youtube.com/watch?v=${key}`,
		provider,
		sourceUrl: `https://www.youtube.com/watch?v=${key}`,
		title: "Test video",
		videoFingerprint: `${provider}|${key}`,
	};
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, reject, resolve };
}
