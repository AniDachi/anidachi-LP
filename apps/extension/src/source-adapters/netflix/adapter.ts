import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import type {
	PlayerOverlayGeometry,
	PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";
import { DEFAULT_PLAYBACK_POLICY } from "../core/playback-policy";
import type {
	AdapterPlaybackSnapshot,
	PersonalResumeTarget,
	PlayerEvent,
} from "../core/types";
import { runNetflixCommand } from "./bridge-client";
import {
	NETFLIX_VIDEO_GENERATION,
	type NetflixSnapshot,
	netflixWatchId,
} from "./contract";
import {
	getNetflixPlayerOverlayGeometry,
	subscribeNetflixPlayerOverlayGeometry,
} from "./player-chrome";

export class NetflixVideoAdapter extends Html5VideoAdapter {
	readonly id = "netflix";
	readonly provider = "netflix";
	readonly name = "Netflix";
	readonly enforcesAuthoritativeRoomSource = true;
	readonly playbackPolicy = {
		...DEFAULT_PLAYBACK_POLICY,
		remoteSeekThrottleMs: 2500,
		remoteSeekTargetToleranceSeconds: 1.25,
		pendingSeekGuard: {
			maxAgeMs: 4000,
			localTargetToleranceSeconds: 2,
			remoteTargetToleranceSeconds: 2,
		},
		localSeekCoalescing: {
			settleDelayMs: 300,
			readyDelayMs: 80,
			duplicateWindowMs: 1000,
			targetToleranceSeconds: 0.75,
			suppressPlaybackAfterSeekMs: 700,
		},
	};
	private snapshot: NetflixSnapshot | null = null;
	private receivedAt = 0;
	private listeners = new Set<(event: PlayerEvent) => void>();
	private stop: (() => void) | null = null;
	private abort: AbortController | null = null;
	private refreshing: Promise<void> | null = null;
	// Disposable detections have no subscriptions, observers, or timers.
	private readonly movieId = netflixWatchId(location.href);

	getNetflixSnapshot(): NetflixSnapshot | null {
		return this.snapshot &&
			this.video.isConnected &&
			this.video.readyState >= 2 &&
			netflixWatchId(location.href) === this.movieId &&
			Date.now() - this.receivedAt < 1500 &&
			this.video.getAttribute(NETFLIX_VIDEO_GENERATION) ===
				this.snapshot.generation
			? this.snapshot
			: null;
	}
	getTitle(): string | null {
		return this.getNetflixSnapshot()?.metadata.title ?? null;
	}
	getFingerprint(): string {
		return `netflix|watch/${this.movieId ?? "unknown"}`;
	}
	getCurrentTime(): number {
		return this.getNetflixSnapshot()?.currentTime ?? 0;
	}
	getState(): PlaybackState {
		return {
			videoFingerprint: this.getFingerprint(),
			...(this.movieId
				? { sourceUrl: `https://www.netflix.com/watch/${this.movieId}` }
				: {}),
			playing: this.getNetflixSnapshot()?.playing ?? false,
			hostTime: this.getCurrentTime(),
			updatedAt: Date.now(),
			playbackRate: this.video.playbackRate || 1,
		};
	}
	getSourceDescriptor(): WatchSourceDescriptor | undefined {
		const snapshot = this.getNetflixSnapshot();
		if (!snapshot) return undefined;
		const sourceUrl = `https://www.netflix.com/watch/${snapshot.movieId}`;
		return {
			provider: "netflix",
			sourceUrl,
			canonicalUrl: sourceUrl,
			videoFingerprint: this.getFingerprint(),
			title: snapshot.metadata.title,
			duration: snapshot.duration,
		};
	}
	getPlaybackSnapshot(): AdapterPlaybackSnapshot {
		const snapshot = this.getNetflixSnapshot();
		return {
			phase: snapshot
				? this.video.seeking
					? "buffering"
					: "content"
				: "transition",
			contentTime: snapshot?.currentTime ?? 0,
			playing: snapshot?.playing ?? false,
			playbackRate: this.video.playbackRate || 1,
			capturedAt: Date.now(),
		};
	}
	getOverlayBinding() {
		return {
			mountTarget: this.container,
			fillMountTarget: true,
			useNativePlayerDoubleClick: true,
		};
	}
	override getOverlayGeometry(): PlayerOverlayGeometry {
		return getNetflixPlayerOverlayGeometry(this.container);
	}
	override subscribeOverlayGeometry(
		listener: PlayerOverlayGeometryListener,
	): () => void {
		return subscribeNetflixPlayerOverlayGeometry(this.container, listener);
	}
	setPlaybackRate(rate: number): void {
		if (this.getNetflixSnapshot()) super.setPlaybackRate(rate);
	}
	private async command(
		action: "play" | "pause" | "seek",
		time?: number,
	): Promise<boolean> {
		const snapshot = this.getNetflixSnapshot(),
			abort = this.abort;
		if (!snapshot || !abort || abort.signal.aborted) return false;
		const result = await runNetflixCommand(
			{
				action,
				movieId: snapshot.movieId,
				generation: snapshot.generation,
				...(time !== undefined ? { time } : {}),
			},
			abort.signal,
		);
		if (
			!abort.signal.aborted &&
			result?.ok &&
			result.snapshot &&
			netflixWatchId(location.href) === this.movieId &&
			this.video.getAttribute(NETFLIX_VIDEO_GENERATION) === snapshot.generation
		) {
			this.snapshot = result.snapshot;
			this.receivedAt = Date.now();
			return true;
		}
		return false;
	}
	async play(): Promise<void> {
		if (!(await this.command("play")))
			throw new Error("Netflix playback unavailable");
	}
	pause(): void {
		void this.command("pause");
	}
	seek(time: number): void {
		if (Number.isFinite(time) && time >= 0) void this.command("seek", time);
	}
	async getPersonalResumeReadiness(target: PersonalResumeTarget) {
		if (
			target.expiresAt <= Date.now() ||
			netflixWatchId(target.sourceUrl) !== this.movieId ||
			netflixWatchId(location.href) !== this.movieId
		)
			return "cancelled" as const;
		return this.getNetflixSnapshot()
			? ("ready" as const)
			: ("waiting" as const);
	}
	async seekPersonalResume(target: PersonalResumeTarget, guard: () => boolean) {
		const ready = await this.getPersonalResumeReadiness(target);
		if (!guard()) return "cancelled" as const;
		if (ready !== "ready") return ready;
		const ok = await this.command("seek", target.currentTime);
		return !guard()
			? ("cancelled" as const)
			: ok
				? ("consumed" as const)
				: ("waiting" as const);
	}
	subscribe(callback: (event: PlayerEvent) => void): () => void {
		this.listeners.add(callback);
		if (!this.stop) {
			const abort = new AbortController();
			this.abort = abort;
			const refresh = () => {
				if (this.refreshing) return this.refreshing;
				this.refreshing = (async () => {
					const before = this.getPlaybackSnapshot().phase;
					const result = this.movieId
						? await runNetflixCommand(
								{ action: "snapshot", movieId: this.movieId },
								abort.signal,
							)
						: null;
					if (abort.signal.aborted) return;
					this.snapshot =
						result?.ok &&
						result.snapshot &&
						this.video.getAttribute(NETFLIX_VIDEO_GENERATION) ===
							result.snapshot.generation
							? result.snapshot
							: null;
					this.receivedAt = Date.now();
					const snapshot = this.getPlaybackSnapshot();
					if (snapshot.phase !== before)
						for (const listener of this.listeners)
							listener({ type: "phasechange", snapshot });
				})().finally(() => {
					this.refreshing = null;
				});
				return this.refreshing;
			};
			const native = (event: Event) => {
				void refresh().then(() => {
					if (abort.signal.aborted || !this.getNetflixSnapshot()) return;
					const type = event.type === "seeked" ? "seek" : event.type;
					if (
						type === "play" ||
						type === "pause" ||
						type === "seek" ||
						type === "timeupdate"
					) {
						for (const listener of this.listeners)
							listener({ type, time: this.getCurrentTime() });
					} else if (type === "ratechange")
						for (const listener of this.listeners)
							listener({
								type,
								time: this.getCurrentTime(),
								playbackRate: this.video.playbackRate,
							});
				});
			};
			const events = [
				"play",
				"pause",
				"seeked",
				"timeupdate",
				"ratechange",
				"seeking",
				"waiting",
				"canplay",
			];
			for (const event of events) this.video.addEventListener(event, native);
			const timer = setInterval(() => {
				void refresh();
			}, 500);
			void refresh();
			this.stop = () => {
				abort.abort();
				clearInterval(timer);
				for (const event of events)
					this.video.removeEventListener(event, native);
				this.snapshot = null;
				this.abort = null;
				this.stop = null;
			};
		}
		let unsubscribed = false;
		return () => {
			if (unsubscribed) return;
			unsubscribed = true;
			this.listeners.delete(callback);
			if (this.listeners.size === 0) this.stop?.();
		};
	}
}
