import {
	primeVideoFingerprint,
	primeVideoSourceUrl,
	type PlaybackState,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import type {
	AdapterPlaybackSnapshot,
	PersonalResumeTarget,
	PlayerEvent,
} from "../core/types";
import { DEFAULT_PLAYBACK_POLICY } from "../core/playback-policy";
import { runPrimeCommand } from "./bridge-client";
import {
	PRIME_BINDING_CHANGED,
	primeVideoId,
	readPrimeBinding,
	type PrimeSnapshot,
} from "./contract";
import { getPrimeGeometry, subscribePrimeGeometry } from "./player-chrome";
import type { PlayerOverlayGeometryListener } from "../core/overlay-geometry";
import { subscribePrimePlayerClose } from "./player-close";
export class PrimeVideoAdapter extends Html5VideoAdapter {
	readonly id = "primevideo";
	readonly provider = "primevideo";
	readonly name = "Prime Video";
	readonly enforcesAuthoritativeRoomSource = true;
	readonly playbackPolicy = {
		...DEFAULT_PLAYBACK_POLICY,
		remoteSeekThrottleMs: 2500,
		remoteSeekTargetToleranceSeconds: 1.25,
	};
	private readonly contentId = readPrimeBinding(this.video)?.contentId ?? null;
	private snapshot: PrimeSnapshot | null = null;
	private receivedAt = 0;
	private abort: AbortController | null = null;
	private bindingAbort: AbortController | null = null;
	private stop: (() => void) | null = null;
	private listeners = new Set<(event: PlayerEvent) => void>();
	getPrimeSnapshot(): PrimeSnapshot | null {
		const binding = readPrimeBinding(this.video),
			snapshot = this.snapshot;
		return snapshot &&
			this.video.isConnected &&
			binding?.contentId === this.contentId &&
			binding.generation === snapshot.generation &&
			Date.now() - this.receivedAt < 1500
			? snapshot
			: null;
	}
	getTitle() {
		return this.getPrimeSnapshot()?.metadata.title ?? null;
	}
	getFingerprint() {
		return this.contentId
			? primeVideoFingerprint(this.contentId)
			: "primevideo|unknown";
	}
	getCurrentTime() {
		return this.getPrimeSnapshot()?.currentTime ?? 0;
	}
	getState(): PlaybackState {
		const snapshot = this.getPrimeSnapshot();
		return {
			videoFingerprint: this.getFingerprint(),
			...(this.contentId
				? { sourceUrl: primeVideoSourceUrl(this.contentId) }
				: {}),
			hostTime: snapshot?.currentTime ?? 0,
			playing: snapshot?.phase === "content" && snapshot.playing,
			playbackRate: snapshot?.playbackRate ?? 1,
			updatedAt: Date.now(),
		};
	}
	getSourceDescriptor(): WatchSourceDescriptor | undefined {
		const snapshot = this.getPrimeSnapshot();
		if (!snapshot || !this.contentId) return undefined;
		const sourceUrl = primeVideoSourceUrl(this.contentId);
		return {
			provider: "primevideo",
			sourceUrl,
			canonicalUrl: sourceUrl,
			videoFingerprint: this.getFingerprint(),
			title: snapshot.metadata.title,
   ...(snapshot.metadata.primeNavigation ? {primeNavigation:snapshot.metadata.primeNavigation} : {}),
			duration: snapshot.duration,
		};
	}
	getPlaybackSnapshot(): AdapterPlaybackSnapshot {
		const snapshot = this.getPrimeSnapshot();
		return {
			phase: snapshot?.phase ?? "transition",
			contentTime: snapshot?.currentTime ?? 0,
			playing: snapshot?.phase === "content" && snapshot.playing,
			playbackRate: snapshot?.playbackRate ?? 1,
			capturedAt: Date.now(),
		};
	}
	getOverlayBinding() {
		const fullscreen = document.fullscreenElement;
		return {
			mountTarget:
				fullscreen instanceof HTMLElement && fullscreen.contains(this.video)
					? fullscreen
					: this.container,
			fillMountTarget: true,
			useNativePlayerDoubleClick: true,
		};
	}
	getOverlayGeometry() {
		return getPrimeGeometry(this.getOverlayBinding().mountTarget);
	}
	subscribeOverlayGeometry(listener: PlayerOverlayGeometryListener) {
		return subscribePrimeGeometry(this.container, listener);
	}
	subscribePlayerClose(listener: (event: Event) => void) {
		return subscribePrimePlayerClose(this.container, this.video, listener);
	}
	// Use only the non-persisting provider facade through the generation-fenced bridge.
	setPlaybackRate(rate: number): void {
		if (Number.isFinite(rate) && rate >= 0.5 && rate <= 2)
			void this.command("rate", rate);
	}
	private async command(
		action: "play" | "resume-interstitial" | "pause" | "seek" | "rate",
		time?: number,
		options?: { signal: AbortSignal; expiresAt?: number },
	): Promise<boolean> {
		const snapshot = this.getPrimeSnapshot(),
			abort = this.abort,
			bindingAbort = this.bindingAbort;
		if (
			!snapshot ||
			snapshot.phase !== (action === "resume-interstitial" ? "interstitial" : "content") ||
			!abort ||
			abort.signal.aborted ||
			!bindingAbort ||
			bindingAbort.signal.aborted
		)
			return false;
		const requestAbort = new AbortController();
		const cancel = () => requestAbort.abort();
		abort.signal.addEventListener("abort", cancel, { once: true });
		bindingAbort.signal.addEventListener("abort", cancel, { once: true });
		options?.signal.addEventListener("abort", cancel, { once: true });
		if (options?.signal.aborted) requestAbort.abort();
		let result;
		try {
			result = await runPrimeCommand(
				{
					action,
					contentId: snapshot.contentId,
					generation: snapshot.generation,
					...(time !== undefined
						? action === "rate"
							? { rate: time }
							: { time }
						: {}),
					...(options?.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
				},
				requestAbort.signal,
			);
		} finally {
			abort.signal.removeEventListener("abort", cancel);
			bindingAbort.signal.removeEventListener("abort", cancel);
			options?.signal.removeEventListener("abort", cancel);
		}
		if (
			!requestAbort.signal.aborted &&
			!abort.signal.aborted &&
			result?.ok &&
			result.snapshot &&
			readPrimeBinding(this.video)?.generation === result.snapshot.generation &&
			result.snapshot.contentId === this.contentId
		) {
			this.snapshot = result.snapshot;
			this.receivedAt = Date.now();
			return true;
		}
		if (!requestAbort.signal.aborted && result?.error === "autoplay-blocked")
			throw new DOMException("Prime Video requires a playback gesture", "NotAllowedError");
		return false;
	}
	async resumeInterstitial(signal: AbortSignal) {
		if (!(await this.command("resume-interstitial", undefined, {signal})))
			throw new DOMException("Prime Video interstitial could not continue", signal.aborted ? "AbortError" : "Error");
	}
	async play() {
		if (!(await this.command("play")))
			throw new Error("Prime Video playback unavailable");
	}
	pause() {
		void this.command("pause");
	}
	seek(time: number) {
		if (Number.isFinite(time) && time >= 0) void this.command("seek", time);
	}
	async getPersonalResumeReadiness(target: PersonalResumeTarget) {
		if (
			target.expiresAt <= Date.now() ||
			primeVideoId(target.sourceUrl) !== this.contentId ||
			readPrimeBinding(this.video)?.contentId !== this.contentId
		)
			return "cancelled" as const;
		return this.getPrimeSnapshot()?.phase === "content"
			? ("ready" as const)
			: ("waiting" as const);
	}
	async seekPersonalResume(target: PersonalResumeTarget, guard: () => boolean) {
		const ready = await this.getPersonalResumeReadiness(target);
		if (!guard()) return "cancelled" as const;
		if (ready !== "ready") return ready;
		const abort = new AbortController();
		const timer = setInterval(() => {
			if (!guard() || target.expiresAt <= Date.now()) abort.abort();
		}, 10);
		try {
			const ok = await this.command("seek", target.currentTime, {
				signal: abort.signal,
				expiresAt: target.expiresAt,
			});
			return !guard() || abort.signal.aborted || target.expiresAt <= Date.now()
				? ("cancelled" as const)
				: ok
					? ("consumed" as const)
					: ("waiting" as const);
		} finally {
			clearInterval(timer);
			abort.abort();
		}
	}
	subscribe(callback: (event: PlayerEvent) => void): () => void {
		this.listeners.add(callback);
		if (!this.stop) {
			const abort = new AbortController();
			this.abort = abort;
			let bindingAbort = new AbortController();
			this.bindingAbort = bindingAbort;
			let generation = readPrimeBinding(this.video)?.generation;
			let refreshing: Promise<void> | null = null;
			const refresh = (): Promise<void> => {
				if (refreshing) return refreshing;
				const before = this.getPlaybackSnapshot().phase;
				const requestOwner = bindingAbort,
					binding = readPrimeBinding(this.video);
				if (
					abort.signal.aborted ||
					requestOwner.signal.aborted ||
					binding?.contentId !== this.contentId
				)
					return Promise.resolve();
				const job = (async () => {
					const result = await runPrimeCommand(
						{
							action: "snapshot",
							contentId: binding.contentId,
							generation: binding.generation,
						},
						requestOwner.signal,
					);
					if (
						abort.signal.aborted ||
						requestOwner.signal.aborted ||
						requestOwner !== bindingAbort
					)
						return;
					this.snapshot =
						result?.ok &&
						result.snapshot &&
						readPrimeBinding(this.video)?.generation ===
							result.snapshot.generation
							? result.snapshot
							: null;
					this.receivedAt = Date.now();
					const snapshot = this.getPlaybackSnapshot();
					if (snapshot.phase !== before)
						for (const listener of this.listeners)
							listener({ type: "phasechange", snapshot });
				})().finally(() => {
					if (refreshing === job) refreshing = null;
				});
				refreshing = job;
				return job;
			};
			const native = (event: Event) => {
				const eventGeneration = readPrimeBinding(this.video)?.generation;
				void refresh().then(() => {
					if (
						eventGeneration !== readPrimeBinding(this.video)?.generation ||
						abort.signal.aborted ||
						this.getPrimeSnapshot()?.phase !== "content"
					)
						return;
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
								playbackRate: this.getPrimeSnapshot()!.playbackRate,
							});
				});
			};
			const changed = () => {
				const binding = readPrimeBinding(this.video);
				if (binding?.generation !== generation) {
					// Binding requests are disposable; the subscription remains reusable when
					// the same video/source returns before content lifecycle reconciliation.
					bindingAbort.abort();
					bindingAbort = new AbortController();
					this.bindingAbort = bindingAbort;
					generation = binding?.generation;
					refreshing = null;
					this.snapshot = null;
				}
				if (binding?.contentId !== this.contentId) {
					for (const listener of this.listeners)
						listener({
							type: "phasechange",
							snapshot: this.getPlaybackSnapshot(),
						});
				} else void refresh();
			};
			const events = [
				"play",
				"pause",
				"seeked",
				"timeupdate",
				"ratechange",
				"waiting",
				"canplay",
			];
			for (const name of events) this.video.addEventListener(name, native);
			document.addEventListener(PRIME_BINDING_CHANGED, changed);
			const timer = setInterval(() => {
				void refresh();
			}, 500);
			void refresh();
			this.stop = () => {
				abort.abort();
				bindingAbort.abort();
				clearInterval(timer);
				document.removeEventListener(PRIME_BINDING_CHANGED, changed);
				for (const name of events) this.video.removeEventListener(name, native);
				this.snapshot = null;
				this.abort = null;
				this.bindingAbort = null;
				this.stop = null;
			};
		}
		let removed = false;
		return () => {
			if (removed) return;
			removed = true;
			this.listeners.delete(callback);
			if (!this.listeners.size) this.stop?.();
		};
	}
}
