import {
	controlsDebugSnapshot,
	logDebug,
	videoDebugSnapshot,
} from "../../debug-log";
import { Html5VideoAdapter } from "../core/html5-video-adapter";
import type {
	PlayerOverlayGeometry,
	PlayerOverlayGeometryListener,
} from "../core/overlay-geometry";
import { normalizeVideoFingerprint } from "../core/source-url";
import type { PlayerEvent, SeekOptions } from "../core/types";
import { runCrunchyrollMainCommand } from "./bridge-client";
import {
	getCrunchyrollPlayerOverlayGeometry,
	subscribeCrunchyrollPlayerOverlayGeometry,
} from "./player-chrome";

export class CrunchyrollVideoAdapter extends Html5VideoAdapter {
	override readonly id = "crunchyroll";
	override readonly name = "Crunchyroll";

	override getTitle(): string | null {
		const title =
			document.querySelector<HTMLHeadingElement>("h1")?.innerText ??
			document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
				?.content ??
			super.getTitle();
		return title?.trim() || null;
	}

	override getFingerprint(): string {
		return normalizeVideoFingerprint(`crunchyroll|${getCrunchyrollVideoKey()}`);
	}

	override getOverlayGeometry(): PlayerOverlayGeometry {
		return getCrunchyrollPlayerOverlayGeometry(this.container);
	}

	override subscribeOverlayGeometry(
		listener: PlayerOverlayGeometryListener,
	): () => void {
		return subscribeCrunchyrollPlayerOverlayGeometry(this.container, listener);
	}

	override async play(): Promise<void> {
		logDebug("adapter.crunchyroll", "play start", {
			video: videoDebugSnapshot(this.video),
			controls: controlsDebugSnapshot(this.container),
		});

		const result = await runCrunchyrollMainCommand("play");
		logDebug("adapter.crunchyroll", "main play result", {
			result,
			video: videoDebugSnapshot(this.video),
		});
		if (result.ok) {
			return;
		}

		await this.playDirectFallback(result.error);
	}

	override pause(): void {
		logDebug("adapter.crunchyroll", "pause start", {
			video: videoDebugSnapshot(this.video),
			controls: controlsDebugSnapshot(this.container),
		});

		void runCrunchyrollMainCommand("pause").then((result) => {
			logDebug("adapter.crunchyroll", "main pause result", {
				result,
				video: videoDebugSnapshot(this.video),
			});
			if (!result.ok) {
				this.video.pause();
			}
		});
	}

	override seek(time: number, options: SeekOptions = {}): void {
		const target = clampMediaTime(time, this.video.duration);
		const wasPlaying = !this.video.paused;
		const shouldResume = options.resumeIfPlaying ?? false;
		logDebug("adapter.crunchyroll", "seek start", {
			requested: time,
			target,
			wasPlaying,
			shouldResume,
			video: videoDebugSnapshot(this.video),
			controls: controlsDebugSnapshot(this.container),
		});

		void runCrunchyrollMainCommand("seek", { time: target }).then((result) => {
			logDebug("adapter.crunchyroll", "main seek result", {
				method: result.method,
				result,
				target,
				timeline: result.timeline,
				video: videoDebugSnapshot(this.video),
			});
			const resultTime = result.video?.currentTime;
			const resultApplied =
				resultTime === undefined || isNearMediaTime(resultTime, target, 1.25);
			if (!result.ok || !resultApplied) {
				logDebug(
					"adapter.crunchyroll",
					"seek not applied; direct currentTime fallback disabled",
					{
						target,
						error: result.error ?? "MAIN_SEEK_DID_NOT_APPLY",
						result,
						video: videoDebugSnapshot(this.video),
					},
				);
			}
			this.logSeekAfter(result.method ?? "main-media-api", target);
		});
	}

	override subscribe(callback: (event: PlayerEvent) => void): () => void {
		let lastTimeUpdate = 0;
		let lastSeekTime = -1;
		const onPlay = () =>
			callback({ type: "play", time: this.getCurrentTime() });
		const onPause = () =>
			callback({ type: "pause", time: this.getCurrentTime() });
		const onSeek = () => {
			const time = this.getCurrentTime();
			if (Math.abs(time - lastSeekTime) < 0.15) {
				return;
			}

			lastSeekTime = time;
			callback({ type: "seek", time });
		};
		const onTimeUpdate = () => {
			const now = Date.now();
			if (now - lastTimeUpdate > 1000) {
				lastTimeUpdate = now;
				callback({ type: "timeupdate", time: this.getCurrentTime() });
			}
		};

		this.video.addEventListener("play", onPlay);
		this.video.addEventListener("pause", onPause);
		this.video.addEventListener("seeking", onSeek);
		this.video.addEventListener("seeked", onSeek);
		this.video.addEventListener("timeupdate", onTimeUpdate);

		return () => {
			this.video.removeEventListener("play", onPlay);
			this.video.removeEventListener("pause", onPause);
			this.video.removeEventListener("seeking", onSeek);
			this.video.removeEventListener("seeked", onSeek);
			this.video.removeEventListener("timeupdate", onTimeUpdate);
		};
	}

	override isFullscreen(): boolean {
		const fullscreenElement = document.fullscreenElement;
		return (
			fullscreenElement === this.container ||
			(fullscreenElement instanceof HTMLElement &&
				(fullscreenElement.contains(this.container) ||
					this.container.contains(fullscreenElement)))
		);
	}

	override async enterFullscreen(): Promise<void> {
		const button = findCrunchyrollFullscreenButton(this.container);
		if (button) {
			button.click();
			return;
		}

		await super.enterFullscreen();
	}

	private async playDirectFallback(reason: string | undefined): Promise<void> {
		logDebug("adapter.crunchyroll", "direct play fallback", {
			reason,
			video: videoDebugSnapshot(this.video),
		});

		try {
			const playPromise = this.video.play();
			playPromise.catch((error) => {
				logDebug("adapter.crunchyroll", "direct play fallback rejected", {
					reason,
					error: error instanceof Error ? error.message : String(error),
					video: videoDebugSnapshot(this.video),
				});
			});
		} catch (error) {
			logDebug("adapter.crunchyroll", "direct play fallback rejected", {
				reason,
				error: error instanceof Error ? error.message : String(error),
				video: videoDebugSnapshot(this.video),
			});
		}
	}

	private logSeekAfter(method: string, target: number): void {
		for (const delay of [300, 1000, 3000]) {
			window.setTimeout(() => {
				logDebug("adapter.crunchyroll", `seek after ${delay}ms`, {
					method,
					target,
					video: videoDebugSnapshot(this.video),
				});
			}, delay);
		}
	}
}

function clampMediaTime(time: number, duration: number): number {
	if (!Number.isFinite(time)) {
		return 0;
	}

	if (!Number.isFinite(duration) || duration <= 0) {
		return Math.max(0, time);
	}

	return Math.max(0, Math.min(time, Math.max(0, duration - 0.25)));
}

function isNearMediaTime(
	actual: number,
	target: number,
	toleranceSeconds: number,
): boolean {
	return (
		Number.isFinite(actual) && Math.abs(actual - target) <= toleranceSeconds
	);
}

function getCrunchyrollVideoKey(): string {
	const watchMatch = location.pathname.match(/\/watch\/([^/?#]+)/);
	if (watchMatch?.[1]) {
		return `watch/${watchMatch[1]}`;
	}

	return location.pathname.replace(/\/$/, "") || "/";
}

function findCrunchyrollFullscreenButton(
	container: HTMLElement,
): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(
		[
			"[data-testid='fullscreen-button']",
			"[data-testid='vilos-fullscreen_button']",
			"[data-testid*='fullscreen' i]",
			"[aria-label*='Full screen' i]",
			"[aria-label*='Fullscreen' i]",
			"[aria-label*='полноэкран' i]",
			"button[class*='fullscreen' i]",
		].join(", "),
	);
}
