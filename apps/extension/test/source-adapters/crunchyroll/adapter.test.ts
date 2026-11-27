import { describe, expect, it, vi } from "vitest";
import * as bridge from "../../../src/source-adapters/crunchyroll/bridge-client";
import { crunchyrollDefinition } from "../../../src/source-adapters/crunchyroll/definition";

describe("Crunchyroll adapter definition", () => {
	it("keeps the Crunchyroll watch fingerprint and player-container selection", () => {
		mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/example-episode");
		document.body.innerHTML = `
      <div class="video-player-wrapper">
        <div id="player-container" class="player-container">
          <div class="bitmovinplayer-container"><video></video></div>
        </div>
      </div>
    `;
		const video = document.querySelector("video") as HTMLVideoElement;

		const adapter = crunchyrollDefinition.detect(video);

		expect(adapter?.id).toBe("crunchyroll");
		expect(adapter?.provider).toBe("crunchyroll");
		expect(adapter?.enforcesAuthoritativeRoomSource).not.toBe(true);
		expect(adapter?.container.id).toBe("player-container");
		expect(adapter?.getOverlayBinding()).toEqual({
			fillMountTarget: true,
			mountTarget: adapter?.container,
			useNativePlayerDoubleClick: true,
		});
		expect(adapter?.getFingerprint()).toBe("crunchyroll|watch/G8WUNM123");
		expect(adapter?.getSourceDescriptor()).toMatchObject({
			provider: "crunchyroll",
			videoFingerprint: "crunchyroll|watch/G8WUNM123",
		});
		expect(adapter?.playbackPolicy).toEqual({
			playBeforeMediaReady: true,
			readyTimeoutMs: 6500,
			skipPlayAfterTimeoutWhileSettling: false,
			remoteSeekThrottleMs: 2400,
			remoteSeekTargetToleranceSeconds: 3,
			pendingSeekGuard: {
				maxAgeMs: 15_000,
				localTargetToleranceSeconds: 4,
				remoteTargetToleranceSeconds: 8,
			},
			localSeekCoalescing: {
				settleDelayMs: 360,
				readyDelayMs: 80,
				duplicateWindowMs: 1200,
				targetToleranceSeconds: 0.75,
				suppressPlaybackAfterSeekMs: 900,
			},
			hostBufferingHoldDelayMs: 500,
		});
	});

	it("allows one delayed retry for an unavailable series lookup", async () => {
		vi.useFakeTimers();
		mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/first");
		document.body.innerHTML = '<div id="player-container"><video></video></div>';
		const adapter = crunchyrollDefinition.detect(document.querySelector("video")!)!;
		const lookup = vi.spyOn(bridge, "runCrunchyrollMainCommand").mockResolvedValue({
			action: "episodeSeries", source: "anidachi-crunchyroll-control-result", id: "1", ok: false, error: "HISTORY_UNAVAILABLE",
		});
		try {
			for (const delay of [0, 100, 10_000, 20_000]) {
				vi.advanceTimersByTime(delay);
				expect(adapter.getSourceDescriptor(true)?.episodeSeriesId).toBeUndefined();
				await Promise.resolve();
			}
			expect(lookup).toHaveBeenCalledTimes(2);
		} finally { lookup.mockRestore(); vi.useRealTimers(); }
	});

	it("looks up the exact room episode once and discards a late series from a previous episode", async () => {
		mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/first");
		document.body.innerHTML = '<div id="player-container"><video></video></div>';
		const adapter = crunchyrollDefinition.detect(document.querySelector("video")!)!;
		const lookup = vi.spyOn(bridge, "runCrunchyrollMainCommand");
		try {
			lookup.mockResolvedValue({ action: "episodeSeries", source: "anidachi-crunchyroll-control-result", id: "1", ok: true, episodeSeriesId: "SHOW1" });
			adapter.getSourceDescriptor();
			expect(lookup).not.toHaveBeenCalled();
			expect(adapter.getSourceDescriptor(true)?.episodeSeriesId).toBeUndefined();
			mockLocation("https://www.crunchyroll.com/watch/G8WUNM124/second");
			lookup.mockResolvedValue({ action: "episodeSeries", source: "anidachi-crunchyroll-control-result", id: "2", ok: true, episodeSeriesId: "SHOW2" });
			expect(adapter.getSourceDescriptor(true)?.episodeSeriesId).toBeUndefined();
			await Promise.resolve();
			expect(adapter.getSourceDescriptor(true)?.episodeSeriesId).toBe("SHOW2");
			expect(lookup).toHaveBeenCalledTimes(2);
		} finally { lookup.mockRestore(); }
	});

	it("does not claim a non-Crunchyroll player", () => {
		mockLocation("https://example.com/watch/G8WUNM123/example-episode");
		document.body.innerHTML =
			'<div id="player-container"><video></video></div>';

		expect(
			crunchyrollDefinition.detect(
				document.querySelector("video") as HTMLVideoElement,
			),
		).toBeNull();
	});
});

function mockLocation(url: string): void {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: new URL(url),
	});
}
