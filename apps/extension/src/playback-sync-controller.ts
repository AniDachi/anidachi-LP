import {
	type ClientEvent,
	getSyncCorrection,
	normalizeRemotePlaybackState,
	type PlaybackState,
	type ServerEvent,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import {
	isMediaSettling,
	type RemoteSeekAttempt,
	shouldDeferHostStateSeek,
	shouldSeekForHostState,
	shouldSeekForRemoteCommand,
	shouldThrottleRemoteSeekAttempt,
	waitForMediaReady,
} from "./playback-control";
import type { PlaybackSyncStatus } from "./playback-sync-status";
import type {
	AdapterPlaybackPhase,
	AdapterPlaybackSnapshot,
	EnsureSourceResult,
	PlayerEvent,
	SourceNavigationContext,
	SourceProvider,
	VideoAdapter,
} from "./source-adapters/core/types";

const HEARTBEAT_INTERVAL_MS = 1500;
const REMOTE_EVENT_SUPPRESSION_MS = 1800;
const REMOTE_COMMAND_DEDUPE_MS = 800;
const SOURCE_TRANSITION_TIMEOUT_MS = 10_000;

export interface PlaybackSyncSession {
	roomId: string | null;
	participantId: string | null;
	isHost: boolean;
	roomProvider: SourceProvider | null;
	roomGeneration: number;
	sourceGeneration: number;
	connectionGeneration: number;
}

export interface PlaybackSyncTransport {
	send(event: ClientEvent): void;
}

export interface PlaybackSyncControllerOptions {
	transport: PlaybackSyncTransport;
	ensureRemoteSource(
		source: WatchSourceDescriptor,
		context: SourceNavigationContext,
	): Promise<EnsureSourceResult>;
	onStatus(status: PlaybackSyncStatus): void;
	now?: () => number;
}

type RemotePlaybackCommand = Extract<
	ServerEvent,
	{ type: "PLAY" | "PAUSE" | "SEEK" }
>;

interface PendingLocalSeek {
	queuedAt: number;
	targetTime: number;
	timeoutId: number;
}

interface PendingRemoteSeek {
	startedAt: number;
	targetTime: number;
}

interface AsyncEpoch {
	adapter: VideoAdapter;
	generation: number;
	token: number;
}

interface PendingSourceNavigation {
	abortController: AbortController;
	latestHostState: PlaybackState;
	source: WatchSourceDescriptor;
	sourceGeneration: number;
	timeoutId: number;
	token: number;
}

const EMPTY_SESSION: PlaybackSyncSession = {
	connectionGeneration: 0,
	isHost: false,
	participantId: null,
	roomGeneration: 0,
	roomId: null,
	roomProvider: null,
	sourceGeneration: 0,
};

export class PlaybackSyncController {
	private adapter: VideoAdapter | null = null;
	private adapterActive = false;
	private asyncGeneration = 0;
	private disposed = false;
	private heartbeatIntervalId: number | null = null;
	private lastLocalSeekBroadcast: {
		sentAt: number;
		targetTime: number;
	} | null = null;
	private lastLocalSeekEventAt = 0;
	private lastConfirmedContentState: PlaybackState | null = null;
	private lastPlaybackPhase: AdapterPlaybackPhase | null = null;
	private lastRemoteCommand: { key: string; receivedAt: number } | null = null;
	private lastRemoteSeekAttempt: RemoteSeekAttempt | null = null;
	private latestHostState: PlaybackState | null = null;
	private pendingLocalSeek: PendingLocalSeek | null = null;
	private pendingPlayWait = false;
	private pendingRemoteSeek: PendingRemoteSeek | null = null;
	private pendingSourceNavigation: PendingSourceNavigation | null = null;
	private playbackBarrier: AdapterPlaybackPhase | null = null;
	private hostInterstitialHoldSent = false;
	private hostBufferingHoldSent = false;
	private hostBufferingTimeoutId: number | null = null;
	private remotePlaybackToken = 0;
	private resumeRequired = false;
	private resumeAttemptPending = false;
	private session = EMPTY_SESSION;
	private sourceNavigationToken = 0;
	private suppressLocalEventsUntil = 0;
	private unsubscribeAdapter: (() => void) | null = null;

	private readonly now: () => number;
	private readonly onStatus: (status: PlaybackSyncStatus) => void;
	private readonly ensureRemoteSource: PlaybackSyncControllerOptions["ensureRemoteSource"];
	private readonly transport: PlaybackSyncTransport;

	constructor(options: PlaybackSyncControllerOptions) {
		this.now = options.now ?? Date.now;
		this.onStatus = options.onStatus;
		this.ensureRemoteSource = options.ensureRemoteSource;
		this.transport = options.transport;
	}

	bindAdapter(adapter: VideoAdapter | null): void {
		if (this.disposed) {
			return;
		}
		if (this.adapter === adapter && this.adapterActive) {
			return;
		}

		this.invalidateAsyncWork();
		this.unsubscribeFromAdapter();
		this.clearPendingLocalSeek();
		this.adapter = adapter;
		this.adapterActive = adapter !== null;
		this.lastLocalSeekBroadcast = null;
		this.lastLocalSeekEventAt = 0;
		this.lastRemoteSeekAttempt = null;
		this.pendingRemoteSeek = null;
		this.suppressLocalEventsUntil = 0;
		this.lastConfirmedContentState = null;
		this.lastPlaybackPhase = null;
		this.playbackBarrier = null;
		this.hostInterstitialHoldSent = false;
		this.hostBufferingHoldSent = false;
		this.resumeRequired = false;
		this.resumeAttemptPending = false;
		this.clearHostBufferingTimer();

		if (adapter) {
			this.unsubscribeAdapter = adapter.subscribe((event) =>
				this.handleLocalEvent(event),
			);
			this.refreshPlaybackPhase(adapter);
		}
		this.completeSourceNavigationForAdapter(adapter);
		this.restartHeartbeatTimer();
	}

	setSession(session: PlaybackSyncSession): void {
		if (this.disposed || sessionsEqual(this.session, session)) {
			return;
		}

		this.invalidateAsyncWork();
		this.clearPendingLocalSeek();
		this.lastRemoteCommand = null;
		this.lastRemoteSeekAttempt = null;
		this.latestHostState = null;
		this.pendingRemoteSeek = null;
		this.playbackBarrier = null;
		this.hostInterstitialHoldSent = false;
		this.hostBufferingHoldSent = false;
		this.resumeRequired = false;
		this.resumeAttemptPending = false;
		this.clearHostBufferingTimer();
		this.cancelPendingSourceNavigation();
		this.suppressLocalEventsUntil = 0;
		this.session = session;
		const adapter = this.getActiveAdapter();
		if (adapter) {
			this.refreshPlaybackPhase(adapter);
		}
		this.restartHeartbeatTimer();
	}

	handleLocalEvent(event: PlayerEvent): void {
		const adapter = this.getActiveAdapter();
		if (!adapter) {
			return;
		}
		if (event.type === "phasechange") {
			this.applyPlaybackSnapshot(adapter, event.snapshot);
			return;
		}
		if (
			this.refreshPlaybackPhase(adapter) ||
			this.now() < this.suppressLocalEventsUntil
		) {
			return;
		}
		if (event.type === "timeupdate" && adapter.video.paused) {
			return;
		}
		if (!this.hasActiveRoomSession()) {
			return;
		}

		if (!this.session.isHost) {
			if (event.type !== "timeupdate") {
				this.reconcileRejectedGuestControl();
				this.onStatus({ kind: "host-controls-playback" });
			}
			return;
		}

		if (event.type === "ratechange") {
			this.sendHostState(true, {
				hostTime: event.time,
				playbackRate: event.playbackRate,
				playing: !adapter.video.paused,
				updatedAt: this.now(),
			});
			return;
		}

		const localSeekPolicy = adapter.playbackPolicy.localSeekCoalescing;
		if (localSeekPolicy && event.type === "seek") {
			this.queueLocalSeek(event.time);
			return;
		}

		if (localSeekPolicy && (event.type === "play" || event.type === "pause")) {
			const now = this.now();
			const nearSeek =
				now - this.lastLocalSeekEventAt <
				localSeekPolicy.suppressPlaybackAfterSeekMs;
			if (this.pendingLocalSeek || isMediaSettling(adapter.video) || nearSeek) {
				return;
			}
		}

		this.sendLocalControlEvent(event);
	}

	handleHostState(
		state: PlaybackState,
		source?: WatchSourceDescriptor,
	): Promise<void> {
		const adapter = this.getActiveAdapter();
		if (
			!adapter ||
			!this.hasProviderBoundRoomSession() ||
			this.session.isHost
		) {
			return Promise.resolve();
		}
		if (source) {
			if (!this.isAuthoritativeSourceValid(source, state)) {
				this.onStatus({
					kind: "source-mismatch",
					message: "The room source does not match this provider.",
				});
				return Promise.resolve();
			}
			if (state.videoFingerprint !== adapter.getFingerprint()) {
				this.queueSourceNavigation(source, state);
				return Promise.resolve();
			}
			this.clearPendingSourceNavigation();
		} else if (this.pendingSourceNavigation) {
			if (
				state.videoFingerprint ===
				this.pendingSourceNavigation.source.videoFingerprint
			) {
				this.pendingSourceNavigation.latestHostState = state;
			}
			return Promise.resolve();
		}

		const remoteState = normalizeRemotePlaybackState(state, this.now());
		this.latestHostState = remoteState;
		if (!remoteState.playing) {
			this.clearResumeRequired();
		}
		if (this.refreshPlaybackPhase(adapter)) {
			return Promise.resolve();
		}

		if (
			!this.hasActiveRoomSession() ||
			state.videoFingerprint !== adapter.getFingerprint()
		) {
			return Promise.resolve();
		}

		return this.applyHostState(state);
	}

	pinRoomProvider(provider: SourceProvider): boolean {
		if (
			this.session.roomProvider &&
			this.session.roomProvider !== provider
		) {
			return false;
		}
		if (this.session.roomProvider === provider) {
			return true;
		}
		this.setSession({ ...this.session, roomProvider: provider });
		return true;
	}

	private applyHostState(state: PlaybackState): Promise<void> {
		const adapter = this.getActiveAdapter();
		if (
			!adapter ||
			!this.hasActiveRoomSession() ||
			this.session.isHost ||
			state.videoFingerprint !== adapter.getFingerprint() ||
			this.refreshPlaybackPhase(adapter)
		) {
			return Promise.resolve();
		}

		const remoteState = normalizeRemotePlaybackState(state, this.now());
		this.applyAuthoritativePlaybackRate(adapter, remoteState.playbackRate);
		const correction = getSyncCorrection(
			adapter.getCurrentTime(),
			remoteState,
			this.now(),
		);
		const settling = isMediaSettling(adapter.video);
		this.clearPendingRemoteSeekIfSettled();

		if (this.shouldHoldHostStateForPendingSeek(remoteState)) {
			this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
			if (settling && remoteState.playing && adapter.video.paused) {
				void this.playWhenReady();
			}
			return Promise.resolve();
		}

		const shouldSeek = shouldSeekForHostState(correction.action, settling);
		const shouldDeferSeek = shouldDeferHostStateSeek(
			correction.action,
			settling,
		);
		const shouldChangePlayback =
			(remoteState.playing && adapter.video.paused) ||
			(!remoteState.playing && !adapter.video.paused);

		if (shouldSeek || shouldChangePlayback) {
			this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		}

		if (shouldDeferSeek) {
			if (
				remoteState.playing &&
				(adapter.video.paused || adapter.playbackPolicy.playBeforeMediaReady)
			) {
				void this.playWhenReady();
			}
			return Promise.resolve();
		}

		let didSeek = false;
		if (shouldSeek) {
			didSeek = this.seekFromRemote(correction.expectedTime);
		}

		if (correction.action === "catch-up" && !didSeek) {
			this.onStatus({
				kind: "out-of-sync",
				expectedTime: correction.expectedTime,
				drift: correction.drift,
			});
		} else if (!this.resumeRequired) {
			this.onStatus({ kind: "synced" });
		}

		if (remoteState.playing) {
			if (
				didSeek ||
				adapter.video.paused ||
				(settling && adapter.playbackPolicy.playBeforeMediaReady)
			) {
				void this.playWhenReady();
			}
		} else {
			this.cancelPendingRemotePlayback();
			if (!adapter.video.paused) {
				adapter.pause();
			}
		}

		return Promise.resolve();
	}

	handleRemoteCommand(event: RemotePlaybackCommand): void {
		const adapter = this.getActiveAdapter();
		if (
			!adapter ||
			!this.hasActiveRoomSession() ||
			this.session.isHost ||
			event.roomId !== this.session.roomId ||
			event.byUserId === this.session.participantId
		) {
			return;
		}
		if (this.refreshPlaybackPhase(adapter)) {
			this.updateLatestHostStateFromCommand(event);
			return;
		}

		const mediaTime = event.type === "SEEK" ? event.to : event.at;
		if (this.isDuplicateRemoteCommand(event.type, event.byUserId, mediaTime)) {
			return;
		}

		this.updateLatestHostStateFromCommand(event);
		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		this.onStatus({ kind: "synced" });

		if (event.type === "PLAY") {
			const drift = adapter.getCurrentTime() - event.at;
			if (shouldSeekForRemoteCommand(drift, isMediaSettling(adapter.video))) {
				this.seekFromRemote(event.at);
			}
			void this.playWhenReady();
			return;
		}

		this.cancelPendingRemotePlayback();
		this.clearResumeRequired();
		if (event.type === "PAUSE") {
			adapter.pause();
			const drift = adapter.getCurrentTime() - event.at;
			if (shouldSeekForRemoteCommand(drift, isMediaSettling(adapter.video))) {
				this.seekFromRemote(event.at);
			}
			return;
		}

		const drift = adapter.getCurrentTime() - event.to;
		if (!isMediaSettling(adapter.video) || Math.abs(drift) > 2) {
			this.seekFromRemote(event.to);
		}
	}

	heartbeat(): void {
		const adapter = this.getActiveAdapter();
		if (!adapter || this.refreshPlaybackPhase(adapter)) {
			return;
		}
		this.sendHostState(false);
	}

	broadcastHostState(): void {
		const adapter = this.getActiveAdapter();
		if (!adapter || this.refreshPlaybackPhase(adapter)) {
			return;
		}
		this.sendHostState(true);
	}

	suppressLocalEventsForRemoteTransition(): void {
		if (this.disposed) {
			return;
		}
		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
	}

	catchUpFromUserGesture(): void {
		const adapter = this.getActiveAdapter();
		const statusState = this.latestHostState;
		if (!adapter || !statusState || this.session.isHost) {
			return;
		}

		const correction = getSyncCorrection(
			adapter.getCurrentTime(),
			statusState,
			this.now(),
		);
		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		this.lastRemoteSeekAttempt = {
			attemptedAt: this.now(),
			targetTime: correction.expectedTime,
		};
		this.rememberPendingRemoteSeek(correction.expectedTime);
		adapter.seek(correction.expectedTime, { resumeIfPlaying: false });
		this.onStatus({ kind: "synced" });
	}

	resumeFromUserGesture(): void {
		const adapter = this.getActiveAdapter();
		const state = this.latestHostState;
		if (
			!adapter ||
			!state?.playing ||
			this.session.isHost ||
			!this.resumeRequired ||
			this.resumeAttemptPending ||
			this.refreshPlaybackPhase(adapter)
		) {
			return;
		}

		this.resumeAttemptPending = true;
		let playResult: Promise<void>;
		try {
			playResult = adapter.play();
		} catch (error) {
			this.resumeAttemptPending = false;
			this.handlePlayFailure(error);
			return;
		}
		void playResult.then(
			() => {
				this.resumeAttemptPending = false;
				this.resumeRequired = false;
				this.onStatus({ kind: "synced" });
				void this.applyHostState(state);
			},
			(error) => {
				this.resumeAttemptPending = false;
				this.handlePlayFailure(error);
			},
		);
	}

	suspend(): void {
		if (this.disposed || !this.adapterActive) {
			return;
		}

		this.adapterActive = false;
		this.invalidateAsyncWork();
		this.unsubscribeFromAdapter();
		this.clearHeartbeatTimer();
		this.clearPendingLocalSeek();
		this.clearHostBufferingTimer();
		this.pendingRemoteSeek = null;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		this.adapterActive = false;
		this.invalidateAsyncWork();
		this.unsubscribeFromAdapter();
		this.clearHeartbeatTimer();
		this.clearPendingLocalSeek();
		this.adapter = null;
		this.latestHostState = null;
		this.lastConfirmedContentState = null;
		this.lastPlaybackPhase = null;
		this.pendingRemoteSeek = null;
		this.playbackBarrier = null;
		this.hostInterstitialHoldSent = false;
		this.hostBufferingHoldSent = false;
		this.resumeRequired = false;
		this.resumeAttemptPending = false;
		this.clearHostBufferingTimer();
		this.cancelPendingSourceNavigation();
	}

	private cancelPendingSourceNavigation(): void {
		const pending = this.pendingSourceNavigation;
		if (!pending) {
			return;
		}
		pending.abortController.abort();
		window.clearTimeout(pending.timeoutId);
		this.pendingSourceNavigation = null;
		this.sourceNavigationToken += 1;
	}

	private clearPendingSourceNavigation(): void {
		this.cancelPendingSourceNavigation();
		this.restartHeartbeatTimer();
	}

	private completeSourceNavigationForAdapter(
		adapter: VideoAdapter | null,
	): void {
		const pending = this.pendingSourceNavigation;
		if (
			!adapter ||
			!pending ||
			adapter.provider !== pending.source.provider ||
			adapter.getFingerprint() !== pending.source.videoFingerprint ||
			this.session.sourceGeneration !== pending.sourceGeneration
		) {
			return;
		}

		const latestHostState = pending.latestHostState;
		this.clearPendingSourceNavigation();
		void this.applyHostState(latestHostState);
	}

	private cancelPendingRemotePlayback(): void {
		this.remotePlaybackToken += 1;
		this.pendingPlayWait = false;
	}

	private clearHeartbeatTimer(): void {
		if (this.heartbeatIntervalId === null) {
			return;
		}
		window.clearInterval(this.heartbeatIntervalId);
		this.heartbeatIntervalId = null;
	}

	private clearPendingLocalSeek(): void {
		if (!this.pendingLocalSeek) {
			return;
		}
		window.clearTimeout(this.pendingLocalSeek.timeoutId);
		this.pendingLocalSeek = null;
	}

	private clearPendingRemoteSeekIfSettled(): void {
		const adapter = this.adapter;
		const pending = this.pendingRemoteSeek;
		const guard = adapter?.playbackPolicy.pendingSeekGuard;
		if (!adapter || !pending || !guard) {
			return;
		}

		const ageMs = this.now() - pending.startedAt;
		const driftFromSeekTarget = adapter.getCurrentTime() - pending.targetTime;
		const isNearSeekTarget =
			Math.abs(driftFromSeekTarget) <= guard.localTargetToleranceSeconds;
		if (
			(!isMediaSettling(adapter.video) && isNearSeekTarget) ||
			ageMs > guard.maxAgeMs
		) {
			this.pendingRemoteSeek = null;
		}
	}

	private flushPendingLocalSeek(): boolean {
		const adapter = this.getActiveAdapter();
		const pending = this.pendingLocalSeek;
		const policy = adapter?.playbackPolicy.localSeekCoalescing;
		if (!adapter || !pending || !policy) {
			return false;
		}

		window.clearTimeout(pending.timeoutId);
		this.pendingLocalSeek = null;
		const now = this.now();
		const previous = this.lastLocalSeekBroadcast;
		if (
			previous &&
			now - previous.sentAt < policy.duplicateWindowMs &&
			Math.abs(previous.targetTime - pending.targetTime) <=
				policy.targetToleranceSeconds
		) {
			return false;
		}

		this.lastLocalSeekBroadcast = {
			sentAt: now,
			targetTime: pending.targetTime,
		};
		const currentTime = adapter.getCurrentTime();
		const hostTime =
			Number.isFinite(currentTime) &&
			Math.abs(currentTime - pending.targetTime) <=
				policy.targetToleranceSeconds
				? currentTime
				: pending.targetTime;
		return this.sendLocalControlEvent(
			{ type: "seek", time: pending.targetTime },
			{
				hostTime,
				playing: !adapter.video.paused,
				updatedAt: now,
			},
		);
	}

	private getActiveAdapter(): VideoAdapter | null {
		return this.adapterActive && !this.disposed ? this.adapter : null;
	}

	private hasActiveRoomSession(): boolean {
		if (this.pendingSourceNavigation) {
			return false;
		}
		return this.hasProviderBoundRoomSession();
	}

	private hasProviderBoundRoomSession(): boolean {
		const adapter = this.getActiveAdapter();
		return Boolean(
			this.session.roomId &&
				this.session.participantId &&
				this.session.roomProvider &&
				adapter &&
				this.session.roomProvider === adapter.provider,
		);
	}

	private isAuthoritativeSourceValid(
		source: WatchSourceDescriptor,
		state: PlaybackState,
	): boolean {
		return Boolean(
			this.session.roomProvider &&
				source.provider === this.session.roomProvider &&
				source.videoFingerprint === state.videoFingerprint,
		);
	}

	private applyPlaybackSnapshot(
		adapter: VideoAdapter,
		snapshot: AdapterPlaybackSnapshot,
	): boolean {
		if (adapter !== this.getActiveAdapter()) {
			return true;
		}

		const nextBarrier = isPlaybackBarrier(snapshot.phase)
			? snapshot.phase
			: null;
		const previousPhase = this.lastPlaybackPhase;
		this.lastPlaybackPhase = snapshot.phase;
		if (!nextBarrier) {
			this.rememberConfirmedContentState(adapter, snapshot);
		}
		const guestBufferingBlocked = this.handleBufferingPhase(
			adapter,
			snapshot,
			previousPhase,
		);
		if (nextBarrier === this.playbackBarrier) {
			return nextBarrier !== null || guestBufferingBlocked;
		}

		const previousBarrier = this.playbackBarrier;
		this.playbackBarrier = nextBarrier;
		if (nextBarrier) {
			this.clearHostBufferingTimer();
			this.hostBufferingHoldSent = false;
			this.invalidateAsyncWork();
			this.clearPendingLocalSeek();
			this.pendingRemoteSeek = null;
			if (nextBarrier === "interstitial") {
				if (this.session.isHost) {
					this.sendHostInterstitialHold(adapter);
					this.onStatus({ kind: "waiting-for-host-ad" });
				} else {
					this.onStatus({ kind: "watching-local-ad" });
				}
			} else if (nextBarrier === "unsupported") {
				this.onStatus({ kind: "unsupported-media" });
			}
			return true;
		}

		if (!this.hasActiveRoomSession()) {
			this.hostInterstitialHoldSent = false;
			return false;
		}
		if (
			this.session.isHost &&
			previousBarrier === "interstitial" &&
			this.hostInterstitialHoldSent
		) {
			this.sendConfirmedHostState(adapter, snapshot);
		} else if (
			!this.session.isHost &&
			this.latestHostState &&
			this.latestHostState.videoFingerprint === adapter.getFingerprint()
		) {
			void this.applyHostState(this.latestHostState);
		}
		this.hostInterstitialHoldSent = false;
		this.onStatus({ kind: "synced" });
		return false;
	}

	private handleBufferingPhase(
		adapter: VideoAdapter,
		snapshot: AdapterPlaybackSnapshot,
		previousPhase: AdapterPlaybackPhase | null,
	): boolean {
		if (snapshot.phase === "buffering") {
			if (
				this.session.isHost &&
				snapshot.playing &&
				this.hasActiveRoomSession() &&
				this.hostBufferingTimeoutId === null &&
				!this.hostBufferingHoldSent
			) {
				this.hostBufferingTimeoutId = window.setTimeout(() => {
					this.hostBufferingTimeoutId = null;
					const activeAdapter = this.getActiveAdapter();
					if (!activeAdapter || activeAdapter !== adapter) {
						return;
					}
					const current = activeAdapter.getPlaybackSnapshot();
					if (
						current.phase !== "buffering" ||
						!current.playing ||
						!this.hasActiveRoomSession()
					) {
						return;
					}
					const base =
						this.lastConfirmedContentState ?? activeAdapter.getState();
					this.sendAuthoritativeHostState(activeAdapter, {
						...base,
						playing: false,
						updatedAt: this.now(),
					});
					this.hostBufferingHoldSent = true;
					this.onStatus({ kind: "buffering" });
				}, adapter.playbackPolicy.hostBufferingHoldDelayMs);
			}
			return !this.session.isHost;
		}

		if (previousPhase !== "buffering") {
			return false;
		}
		this.clearHostBufferingTimer();
		if (
			this.session.isHost &&
			this.hostBufferingHoldSent &&
			snapshot.phase === "content"
		) {
			this.sendConfirmedHostState(adapter, snapshot);
			this.onStatus({ kind: "synced" });
		} else if (
			!this.session.isHost &&
			this.latestHostState &&
			snapshot.phase === "content" &&
			this.latestHostState.videoFingerprint === adapter.getFingerprint()
		) {
			void this.applyHostState(this.latestHostState);
		}
		this.hostBufferingHoldSent = false;
		return false;
	}

	private clearHostBufferingTimer(): void {
		if (this.hostBufferingTimeoutId === null) {
			return;
		}
		window.clearTimeout(this.hostBufferingTimeoutId);
		this.hostBufferingTimeoutId = null;
	}

	private refreshPlaybackPhase(adapter: VideoAdapter): boolean {
		return this.applyPlaybackSnapshot(adapter, adapter.getPlaybackSnapshot());
	}

	private rememberConfirmedContentState(
		adapter: VideoAdapter,
		snapshot: AdapterPlaybackSnapshot,
	): void {
		const state = adapter.getState();
		this.lastConfirmedContentState = {
			...state,
			hostTime: snapshot.contentTime,
			playbackRate: snapshot.playbackRate,
			playing: snapshot.playing,
			updatedAt: snapshot.capturedAt,
			videoFingerprint: adapter.getFingerprint(),
		};
	}

	private sendHostInterstitialHold(adapter: VideoAdapter): void {
		if (this.hostInterstitialHoldSent || !this.hasActiveRoomSession()) {
			return;
		}
		const base =
			this.lastConfirmedContentState ??
			({
				...adapter.getState(),
				hostTime: 0,
				playbackRate: 1,
				playing: false,
				updatedAt: this.now(),
				videoFingerprint: adapter.getFingerprint(),
			} satisfies PlaybackState);
		this.sendAuthoritativeHostState(adapter, {
			...base,
			playing: false,
			updatedAt: this.now(),
		});
		this.hostInterstitialHoldSent = true;
	}

	private sendConfirmedHostState(
		adapter: VideoAdapter,
		snapshot: AdapterPlaybackSnapshot,
	): void {
		this.sendAuthoritativeHostState(adapter, {
			...adapter.getState(),
			hostTime: snapshot.contentTime,
			playbackRate: snapshot.playbackRate,
			playing: snapshot.playing,
			updatedAt: snapshot.capturedAt,
			videoFingerprint: adapter.getFingerprint(),
		});
	}

	private sendAuthoritativeHostState(
		adapter: VideoAdapter,
		state: PlaybackState,
	): void {
		const { participantId, roomId } = this.session;
		if (
			!roomId ||
			!participantId ||
			!this.session.isHost ||
			!this.hasProviderBoundRoomSession()
		) {
			return;
		}
		this.transport.send({
			type: "HOST_STATE",
			roomId,
			state,
			source: adapter.getSourceDescriptor(),
		});
	}

	private invalidateAsyncWork(): void {
		this.asyncGeneration += 1;
		this.cancelPendingRemotePlayback();
	}

	private isAsyncEpochCurrent(epoch: AsyncEpoch): boolean {
		return Boolean(
			!this.disposed &&
				this.adapterActive &&
				this.adapter === epoch.adapter &&
				this.asyncGeneration === epoch.generation &&
				this.remotePlaybackToken === epoch.token &&
				this.hasActiveRoomSession(),
		);
	}

	private isDuplicateRemoteCommand(
		type: RemotePlaybackCommand["type"],
		byUserId: string,
		mediaTime: number,
	): boolean {
		const now = this.now();
		const key = `${type}:${byUserId}:${Math.round(mediaTime * 4) / 4}`;
		const last = this.lastRemoteCommand;
		if (last?.key === key && now - last.receivedAt < REMOTE_COMMAND_DEDUPE_MS) {
			return true;
		}
		this.lastRemoteCommand = { key, receivedAt: now };
		return false;
	}

	private async playWhenReady(): Promise<void> {
		const adapter = this.getActiveAdapter();
		if (
			!adapter ||
			this.resumeRequired ||
			this.refreshPlaybackPhase(adapter)
		) {
			return;
		}

		const settling = isMediaSettling(adapter.video);
		if (this.pendingPlayWait) {
			return;
		}

		const token = ++this.remotePlaybackToken;
		this.pendingPlayWait = true;
		const epoch: AsyncEpoch = {
			adapter,
			generation: this.asyncGeneration,
			token,
		};
		const policy = adapter.playbackPolicy;
		if (policy.playBeforeMediaReady) {
			if (!adapter.video.paused && !isMediaSettling(adapter.video)) {
				this.finishPendingPlay(token);
				return;
			}
			this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
			try {
				await adapter.play();
			} catch (error) {
				this.handlePlayFailure(error);
				this.finishPendingPlay(token);
				return;
			}
			this.finishPendingPlay(token);
			this.isAsyncEpochCurrent(epoch);
			return;
		}

		const readyReason = await waitForMediaReady(
			adapter.video,
			policy.readyTimeoutMs,
		);
		if (
			!this.isAsyncEpochCurrent(epoch) ||
			this.refreshPlaybackPhase(adapter) ||
			!adapter.video.paused ||
			(readyReason === "timeout" &&
				policy.skipPlayAfterTimeoutWhileSettling &&
				isMediaSettling(adapter.video))
		) {
			this.finishPendingPlay(token);
			return;
		}

		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		try {
			await adapter.play();
		} catch (error) {
			this.handlePlayFailure(error);
			this.finishPendingPlay(token);
			return;
		}
		this.finishPendingPlay(token);
		this.isAsyncEpochCurrent(epoch);
	}

	private finishPendingPlay(token: number): void {
		if (this.remotePlaybackToken === token) {
			this.pendingPlayWait = false;
		}
	}

	private queueLocalSeek(targetTime: number): void {
		const adapter = this.adapter;
		const policy = adapter?.playbackPolicy.localSeekCoalescing;
		if (!adapter || !policy) {
			return;
		}

		const now = this.now();
		this.lastLocalSeekEventAt = now;
		this.clearPendingLocalSeek();
		const delay = isMediaSettling(adapter.video)
			? policy.settleDelayMs
			: policy.readyDelayMs;
		const timeoutId = window.setTimeout(() => {
			this.flushPendingLocalSeek();
		}, delay);
		this.pendingLocalSeek = { queuedAt: now, targetTime, timeoutId };
	}

	private queueSourceNavigation(
		source: WatchSourceDescriptor,
		state: PlaybackState,
	): void {
		const current = this.pendingSourceNavigation;
		if (
			current &&
			current.source.provider === source.provider &&
			current.source.videoFingerprint === source.videoFingerprint &&
			current.sourceGeneration === this.session.sourceGeneration
		) {
			current.latestHostState = state;
			return;
		}

		this.cancelPendingSourceNavigation();
		this.invalidateAsyncWork();
		this.clearPendingLocalSeek();
		this.clearHostBufferingTimer();
		this.hostBufferingHoldSent = false;
		this.pendingRemoteSeek = null;
		this.clearHeartbeatTimer();

		const abortController = new AbortController();
		const token = ++this.sourceNavigationToken;
		const pending: PendingSourceNavigation = {
			abortController,
			latestHostState: state,
			source,
			sourceGeneration: this.session.sourceGeneration,
			timeoutId: 0,
			token,
		};
		pending.timeoutId = window.setTimeout(() => {
			if (this.pendingSourceNavigation !== pending) {
				return;
			}
			this.onStatus({
				kind: "source-mismatch",
				message: "The player did not reach the room source in time.",
			});
			this.cancelPendingSourceNavigation();
			this.restartHeartbeatTimer();
		}, SOURCE_TRANSITION_TIMEOUT_MS);
		this.pendingSourceNavigation = pending;

		queueMicrotask(() => {
			if (
				this.disposed ||
				this.pendingSourceNavigation !== pending ||
				abortController.signal.aborted
			) {
				return;
			}
			void this.ensureRemoteSource(source, {
				roomId: this.session.roomId,
				roomProvider: source.provider,
				signal: abortController.signal,
			}).then(
				(result) => this.handleSourceNavigationResult(pending, result),
				() =>
					this.handleSourceNavigationResult(pending, {
						status: "failed",
						reason: "navigation-failed",
					}),
			);
		});
	}

	private handleSourceNavigationResult(
		pending: PendingSourceNavigation,
		result: EnsureSourceResult,
	): void {
		if (
			this.disposed ||
			this.pendingSourceNavigation !== pending ||
			this.sourceNavigationToken !== pending.token ||
			pending.abortController.signal.aborted
		) {
			return;
		}

		if (result.status === "already-current") {
			this.completeSourceNavigationForAdapter(this.getActiveAdapter());
			if (this.pendingSourceNavigation === pending) {
				this.onStatus({
					kind: "source-mismatch",
					message: "The active player does not match the room source.",
				});
			}
			return;
		}
		if (result.status === "unsupported") {
			this.onStatus({
				kind: "source-mismatch",
				message: "This room source cannot be opened on the current provider.",
			});
			return;
		}
		if (result.status === "failed") {
			this.onStatus({
				kind: "sync-error",
				message: "The room source could not be opened.",
			});
		}
	}

	private reconcileRejectedGuestControl(): void {
		const adapter = this.getActiveAdapter();
		const state = this.latestHostState;
		if (
			!adapter ||
			!state ||
			state.videoFingerprint !== adapter.getFingerprint() ||
			this.refreshPlaybackPhase(adapter)
		) {
			return;
		}

		const correction = getSyncCorrection(
			adapter.getCurrentTime(),
			state,
			this.now(),
		);
		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		this.applyAuthoritativePlaybackRate(adapter, state.playbackRate);
		adapter.seek(correction.expectedTime, { resumeIfPlaying: false });
		if (state.playing) {
			void this.playWhenReady();
		} else {
			this.cancelPendingRemotePlayback();
			adapter.pause();
		}
	}

	private rememberPendingRemoteSeek(targetTime: number): void {
		if (this.adapter?.playbackPolicy.pendingSeekGuard) {
			this.pendingRemoteSeek = { startedAt: this.now(), targetTime };
		}
	}

	private applyAuthoritativePlaybackRate(
		adapter: VideoAdapter,
		playbackRate: number,
	): void {
		if (
			!Number.isFinite(playbackRate) ||
			playbackRate <= 0 ||
			Math.abs(adapter.video.playbackRate - playbackRate) < 0.001
		) {
			return;
		}
		this.suppressLocalEventsUntil = this.now() + REMOTE_EVENT_SUPPRESSION_MS;
		adapter.setPlaybackRate(playbackRate);
	}

	private clearResumeRequired(): void {
		this.resumeRequired = false;
		this.resumeAttemptPending = false;
	}

	private handlePlayFailure(error: unknown): void {
		const errorName =
			typeof error === "object" &&
			error !== null &&
			"name" in error &&
			typeof error.name === "string"
				? error.name
				: "";
		if (errorName === "AbortError") {
			return;
		}
		if (errorName === "NotAllowedError") {
			this.resumeRequired = true;
			this.onStatus({ kind: "resume-required" });
			return;
		}
		this.onStatus({
			kind: "sync-error",
			message: "Playback could not be resumed.",
		});
	}

	private restartHeartbeatTimer(): void {
		this.clearHeartbeatTimer();
		if (!this.hasActiveRoomSession() || !this.session.isHost) {
			return;
		}
		this.heartbeatIntervalId = window.setInterval(
			() => this.heartbeat(),
			HEARTBEAT_INTERVAL_MS,
		);
	}

	private seekFromRemote(targetTime: number): boolean {
		const adapter = this.getActiveAdapter();
		if (!adapter || this.refreshPlaybackPhase(adapter)) {
			return false;
		}

		const now = this.now();
		if (
			shouldThrottleRemoteSeekAttempt(
				adapter.playbackPolicy,
				this.lastRemoteSeekAttempt,
				targetTime,
				now,
			)
		) {
			return false;
		}

		this.lastRemoteSeekAttempt = { attemptedAt: now, targetTime };
		this.rememberPendingRemoteSeek(targetTime);
		adapter.seek(targetTime, { resumeIfPlaying: false });
		return true;
	}

	private sendHostState(
		allowController: boolean,
		stateOverride?: Partial<PlaybackState>,
	): boolean {
		const adapter = this.getActiveAdapter();
		const { participantId, roomId } = this.session;
		if (
			!adapter ||
			!roomId ||
			!participantId ||
			!this.session.isHost ||
			!this.hasActiveRoomSession()
		) {
			return false;
		}
		if (this.refreshPlaybackPhase(adapter)) {
			return false;
		}
		if (!allowController && this.now() < this.suppressLocalEventsUntil) {
			return false;
		}
		if (!allowController && isMediaSettling(adapter.video)) {
			return false;
		}

		const state = stateOverride
			? { ...adapter.getState(), ...stateOverride }
			: adapter.getState();
		this.transport.send({
			type: "HOST_STATE",
			roomId,
			state,
			source: adapter.getSourceDescriptor(),
		});
		return true;
	}

	private sendLocalControlEvent(
		event: PlayerEvent,
		stateOverride?: Partial<PlaybackState>,
	): boolean {
		const { participantId, roomId } = this.session;
		if (!roomId || !participantId || !this.session.isHost) {
			return false;
		}

		let command: ClientEvent;
		if (event.type === "play") {
			command = {
				type: "PLAY",
				roomId,
				byUserId: participantId,
				at: event.time,
			};
		} else if (event.type === "pause") {
			command = {
				type: "PAUSE",
				roomId,
				byUserId: participantId,
				at: event.time,
			};
		} else if (event.type === "seek") {
			command = {
				type: "SEEK",
				roomId,
				byUserId: participantId,
				to: event.time,
			};
		} else {
			return false;
		}

		this.transport.send(command);
		this.sendHostState(true, stateOverride);
		return true;
	}

	private shouldHoldHostStateForPendingSeek(state: PlaybackState): boolean {
		const adapter = this.adapter;
		const pending = this.pendingRemoteSeek;
		const guard = adapter?.playbackPolicy.pendingSeekGuard;
		if (!adapter || !pending || !guard) {
			return false;
		}

		const ageMs = this.now() - pending.startedAt;
		if (ageMs > guard.maxAgeMs) {
			return false;
		}
		const expectedPendingTime = state.playing
			? pending.targetTime + (ageMs / 1000) * (state.playbackRate || 1)
			: pending.targetTime;
		if (
			Math.abs(state.hostTime - expectedPendingTime) >
			guard.remoteTargetToleranceSeconds
		) {
			this.pendingRemoteSeek = null;
			return false;
		}

		const driftFromSeekTarget = adapter.getCurrentTime() - pending.targetTime;
		return (
			ageMs < 500 ||
			isMediaSettling(adapter.video) ||
			Math.abs(driftFromSeekTarget) <= guard.localTargetToleranceSeconds
		);
	}

	private unsubscribeFromAdapter(): void {
		const unsubscribe = this.unsubscribeAdapter;
		if (!unsubscribe) {
			return;
		}
		this.unsubscribeAdapter = null;
		unsubscribe();
	}

	private updateLatestHostStateFromCommand(event: RemotePlaybackCommand): void {
		const adapter = this.adapter;
		if (!adapter) {
			return;
		}

		const base =
			this.latestHostState ??
			this.lastConfirmedContentState ??
			adapter.getState();
		const mediaTime = event.type === "SEEK" ? event.to : event.at;
		this.latestHostState = {
			...base,
			hostTime: mediaTime,
			playing:
				event.type === "PLAY"
					? true
					: event.type === "PAUSE"
						? false
						: base.playing,
			updatedAt: this.now(),
		};
	}
}

function isPlaybackBarrier(phase: AdapterPlaybackPhase): boolean {
	return (
		phase === "transition" ||
		phase === "interstitial" ||
		phase === "unsupported"
	);
}

function sessionsEqual(
	left: PlaybackSyncSession,
	right: PlaybackSyncSession,
): boolean {
	return (
		left.connectionGeneration === right.connectionGeneration &&
		left.isHost === right.isHost &&
		left.participantId === right.participantId &&
		left.roomGeneration === right.roomGeneration &&
		left.roomId === right.roomId &&
		left.roomProvider === right.roomProvider &&
		left.sourceGeneration === right.sourceGeneration
	);
}
