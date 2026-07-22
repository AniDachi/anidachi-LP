import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import { getYouTubePlayerOverlayGeometry } from "../../../src/source-adapters/youtube/player-chrome";

describe("YouTube player chrome", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("returns the provider-neutral defaults for an unusable player", () => {
		const container = document.createElement("div");

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual(
			DEFAULT_PLAYER_OVERLAY_GEOMETRY,
		);
	});

	it("reserves visible bottom chrome and reports controls as visible", () => {
		document.body.innerHTML = `
      <div id="movie_player">
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		mockRect(container, 100, 50, 960, 540);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 100, 500, 960, 90);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: true,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 108, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 50, rightPx: 10 },
		});
	});

	it("keeps bottom reservation stable when cumulative opacity hides the controls", () => {
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="fading-chrome" style="opacity: 0.2">
          <div class="ytp-chrome-bottom" style="opacity: 0.1"></div>
        </div>
      </div>
    `;
		const container = getPlayer();
		mockRect(container, 100, 50, 960, 540);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 100, 500, 960, 90);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: false,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 108, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 50, rightPx: 10 },
		});
	});

	it.each([
		["display", "none"],
		["visibility", "hidden"],
		["visibility", "collapse"],
	])("does not reserve chrome hidden by ancestor %s: %s", (property, value) => {
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="hidden-chrome">
          <div class="ytp-chrome-bottom"></div>
        </div>
      </div>
    `;
		const container = getPlayer();
		const hiddenChrome = document.querySelector(
			"#hidden-chrome",
		) as HTMLElement;
		hiddenChrome.style.setProperty(property, value);
		mockRect(container, 0, 0, 960, 540);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 0, 450, 960, 90);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: false,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 50, rightPx: 10 },
		});
	});

	it("places the launcher immediately left of known top-right actions", () => {
		document.body.innerHTML = `
      <div id="movie_player">
        <button class="ytp-watch-later-button"></button>
        <button class="ytp-share-button"></button>
      </div>
    `;
		const container = getPlayer();
		mockRect(container, 100, 50, 960, 540);
		mockRect(
			document.querySelector(".ytp-watch-later-button"),
			950,
			62,
			40,
			32,
		);
		mockRect(document.querySelector(".ytp-share-button"), 1000, 62, 40, 32);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: false,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 12, rightPx: 118 },
			panel: { topPx: 52, rightPx: 10 },
		});
	});

	it("falls back to visible button geometry when known selectors are absent", () => {
		document.body.innerHTML = `
      <div id="movie_player">
        <button id="top-action"></button>
        <button id="bottom-control"></button>
      </div>
    `;
		const container = getPlayer();
		mockRect(container, 200, 100, 800, 450);
		mockRect(document.querySelector("#top-action"), 930, 115, 40, 32);
		mockRect(document.querySelector("#bottom-control"), 220, 500, 40, 32);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: true,
			viewport: { widthPx: 800, heightPx: 450 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 68, leftPx: 0 },
			launcher: { topPx: 15, rightPx: 78 },
			panel: { topPx: 55, rightPx: 10 },
		});
	});

	it("bounds small-player geometry instead of producing negative coordinates", () => {
		document.body.innerHTML = `
      <div id="movie_player">
        <div class="ytp-chrome-bottom"></div>
        <button class="ytp-share-button"></button>
      </div>
    `;
		const container = getPlayer();
		mockRect(container, 0, 0, 100, 60);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 0, 45, 100, 15);
		mockRect(document.querySelector(".ytp-share-button"), 60, 4, 32, 20);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: true,
			viewport: { widthPx: 100, heightPx: 60 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 18, rightPx: 10 },
			panel: { topPx: 58, rightPx: 10 },
		});
	});

	it.each([
		["normal", 120, 80, 640, 360],
		["theater", 40, 24, 1280, 720],
		["fullscreen", 0, 0, 1920, 1080],
	])("normalizes %s player rectangles to container-relative geometry", (_mode, left, top, width, height) => {
		document.body.innerHTML = `
        <div id="movie_player">
          <div class="ytp-progress-bar-container"></div>
        </div>
      `;
		const container = getPlayer();
		mockRect(container, left, top, width, height);
		mockRect(
			document.querySelector(".ytp-progress-bar-container"),
			left + 12,
			top + height - 64,
			width - 24,
			8,
		);

		expect(getYouTubePlayerOverlayGeometry(container)).toEqual({
			controlsVisible: true,
			viewport: { widthPx: width, heightPx: height },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 82, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 50, rightPx: 10 },
		});
	});
});

function getPlayer(): HTMLElement {
	const player = document.querySelector("#movie_player");
	if (!(player instanceof HTMLElement)) {
		throw new Error("Expected YouTube player container");
	}

	return player;
}

function mockRect(
	element: Element | null,
	left: number,
	top: number,
	width: number,
	height: number,
): void {
	if (!element) {
		throw new Error("Expected element");
	}

	Object.defineProperty(element, "getBoundingClientRect", {
		configurable: true,
		value: () =>
			({
				bottom: top + height,
				height,
				left,
				right: left + width,
				top,
				width,
			}) as DOMRect,
	});
}
