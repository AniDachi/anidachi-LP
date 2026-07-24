import type { AdapterPlaybackPolicy } from "./types";

export const DEFAULT_PLAYBACK_POLICY: AdapterPlaybackPolicy = Object.freeze({
	playBeforeMediaReady: false,
	readyTimeoutMs: 2500,
	skipPlayAfterTimeoutWhileSettling: false,
	remoteSeekThrottleMs: 0,
	remoteSeekTargetToleranceSeconds: 0,
	pendingSeekGuard: null,
	localSeekCoalescing: null,
	hostBufferingHoldDelayMs: 500,
});

export const CRUNCHYROLL_PLAYBACK_POLICY: AdapterPlaybackPolicy = Object.freeze(
	{
		playBeforeMediaReady: true,
		readyTimeoutMs: 6500,
		skipPlayAfterTimeoutWhileSettling: false,
		remoteSeekThrottleMs: 2400,
		remoteSeekTargetToleranceSeconds: 3,
		pendingSeekGuard: Object.freeze({
			maxAgeMs: 15_000,
			localTargetToleranceSeconds: 4,
			remoteTargetToleranceSeconds: 8,
		}),
		localSeekCoalescing: Object.freeze({
			settleDelayMs: 360,
			readyDelayMs: 80,
			duplicateWindowMs: 1200,
			targetToleranceSeconds: 0.75,
			suppressPlaybackAfterSeekMs: 900,
		}),
		hostBufferingHoldDelayMs: 500,
	},
);
