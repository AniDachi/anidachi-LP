import { describe, expect, it } from "vitest";
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
		expect(adapter?.container.id).toBe("player-container");
		expect(adapter?.getFingerprint()).toBe("crunchyroll|watch/G8WUNM123");
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
