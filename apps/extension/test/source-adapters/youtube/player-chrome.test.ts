import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import {
	getYouTubePlayerOverlayGeometry,
	subscribeYouTubePlayerOverlayGeometry,
} from "../../../src/source-adapters/youtube/player-chrome";

describe("YouTube player chrome", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
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

	it("releases bottom reservation when cumulative opacity hides the controls", () => {
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
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 50, rightPx: 10 },
		});
	});

	it("moves bottom-safe layout as YouTube controls hide and reappear", () => {
		const { mutationObservers, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="fading-chrome">
          <div class="ytp-chrome-bottom"></div>
        </div>
      </div>
    `;
		const container = getPlayer();
		const fadingChrome = document.querySelector(
			"#fading-chrome",
		) as HTMLElement;
		mockRect(container, 100, 50, 960, 540);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 100, 500, 960, 90);
		const listener = vi.fn();
		const dispose = subscribeYouTubePlayerOverlayGeometry(container, listener);
		runAnimationFrames();

		fadingChrome.style.opacity = "0";
		mutationObservers[0]?.trigger([
			{
				attributeName: "style",
				target: fadingChrome,
				type: "attributes",
			} as unknown as MutationRecord,
		]);
		runAnimationFrames();

		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				controlsVisible: false,
				safeInsets: expect.objectContaining({ bottomPx: 0 }),
			}),
		);

		fadingChrome.style.opacity = "1";
		mutationObservers[0]?.trigger([
			{
				attributeName: "style",
				target: fadingChrome,
				type: "attributes",
			} as unknown as MutationRecord,
		]);
		runAnimationFrames();

		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				controlsVisible: true,
				safeInsets: expect.objectContaining({ bottomPx: 108 }),
			}),
		);
		expect(listener).toHaveBeenCalledTimes(2);

		dispose();
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

	it("coalesces initial and resize measurements and scopes DOM observation", () => {
		const {
			mutationObservers,
			pendingAnimationFrames,
			resizeObservers,
			runAnimationFrames,
		} = installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div class="ytp-chrome-top-buttons"><button></button></div>
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		const topChrome = document.querySelector(
			".ytp-chrome-top-buttons",
		) as HTMLElement;
		const bottomChrome = document.querySelector(
			".ytp-chrome-bottom",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(topChrome, 760, 10, 190, 40);
		mockRect(topChrome.querySelector("button"), 900, 14, 40, 32);
		mockRect(bottomChrome, 0, 450, 960, 90);
		const listener = vi.fn();

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, listener);

		expect(pendingAnimationFrames()).toBe(1);
		expect(mutationObservers).toHaveLength(1);
		expect(mutationObservers[0]?.observedTarget).toBe(container);
		expect(mutationObservers[0]?.options).toEqual({
			attributeFilter: [
				"class",
				"style",
				"aria-hidden",
				"hidden",
				"role",
				"type",
			],
			attributes: true,
			childList: true,
			subtree: true,
		});
		expect(resizeObservers).toHaveLength(1);
		expect(resizeObservers[0]?.observedTargets).toEqual(
			new Set([
				container,
				topChrome,
				topChrome.querySelector("button"),
				bottomChrome,
			]),
		);

		resizeObservers[0]?.trigger();
		expect(pendingAnimationFrames()).toBe(1);
		runAnimationFrames();
		expect(listener).not.toHaveBeenCalled();

		mockRect(container, 0, 0, 961, 540);
		resizeObservers[0]?.trigger();
		runAnimationFrames();
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({ viewport: { widthPx: 961, heightPx: 540 } }),
		);

		dispose();
	});

	it("ignores unrelated playback mutations without scheduling visibility measurement", () => {
		const { mutationObservers, pendingAnimationFrames, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="playback-surface"><div id="playback-progress"></div></div>
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		const playbackSurface = document.querySelector(
			"#playback-surface",
		) as HTMLElement;
		const playbackProgress = document.querySelector(
			"#playback-progress",
		) as HTMLElement;
		const unrelatedChild = document.createElement("span");
		mockRect(container, 0, 0, 960, 540);
		mockRect(document.querySelector(".ytp-chrome-bottom"), 0, 450, 960, 90);
		const containerRectRead = vi.spyOn(container, "getBoundingClientRect");
		const bottomChromeRectRead = vi.spyOn(
			document.querySelector(".ytp-chrome-bottom") as HTMLElement,
			"getBoundingClientRect",
		);

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, vi.fn());
		runAnimationFrames();
		containerRectRead.mockClear();
		bottomChromeRectRead.mockClear();
		playbackProgress.className = "playing";
		playbackSurface.append(unrelatedChild);
		mutationObservers[0]?.trigger([
			{
				attributeName: "class",
				target: playbackProgress,
				type: "attributes",
			} as unknown as MutationRecord,
			{
				addedNodes: [unrelatedChild] as unknown as NodeList,
				removedNodes: [] as unknown as NodeList,
				target: playbackSurface,
				type: "childList",
			} as unknown as MutationRecord,
		]);
		const scheduledAnimationFrames = pendingAnimationFrames();
		const scheduledTimers = vi.getTimerCount();
		dispose();

		expect(scheduledAnimationFrames).toBe(0);
		expect(scheduledTimers).toBe(0);
		expect(containerRectRead).not.toHaveBeenCalled();
		expect(bottomChromeRectRead).not.toHaveBeenCalled();
	});

	it.each([
		"class",
		"style",
		"aria-hidden",
		"hidden",
	])("schedules visibility measurement for known chrome %s mutations", (attributeName) => {
		const { mutationObservers, pendingAnimationFrames, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
        <div id="movie_player">
          <div class="ytp-chrome-bottom"></div>
        </div>
      `;
		const container = getPlayer();
		const bottomChrome = document.querySelector(
			".ytp-chrome-bottom",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(bottomChrome, 0, 450, 960, 90);

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, vi.fn());
		runAnimationFrames();
		mutationObservers[0]?.trigger([
			{
				attributeName,
				target: bottomChrome,
				type: "attributes",
			} as unknown as MutationRecord,
		]);
		const scheduledAnimationFrames = pendingAnimationFrames();
		const scheduledTimers = vi.getTimerCount();
		dispose();

		expect(scheduledAnimationFrames).toBe(1);
		expect(scheduledTimers).toBe(1);
	});

	it.each([
		{ attributeName: "role", tagName: "div", value: "button" },
		{ attributeName: "type", tagName: "input", value: "range" },
	])("starts observing a fallback control after dynamic $attributeName assignment", ({
		attributeName,
		tagName,
		value,
	}) => {
		const {
			mutationObservers,
			pendingAnimationFrames,
			resizeObservers,
			runAnimationFrames,
		} = installGeometryObserverStubs();
		document.body.innerHTML = `
        <div id="movie_player">
          <${tagName} id="dynamic-control"></${tagName}>
        </div>
		`;
		const container = getPlayer();
		const dynamicControl = document.querySelector(
			"#dynamic-control",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(dynamicControl, 20, 500, 80, 32);

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, vi.fn());
		runAnimationFrames();
		dynamicControl.setAttribute(attributeName, value);
		mutationObservers[0]?.trigger([
			{
				attributeName,
				target: dynamicControl,
				type: "attributes",
			} as unknown as MutationRecord,
		]);

		expect(mutationObservers[0]?.options?.attributeFilter).toEqual(
			expect.arrayContaining(["role", "type"]),
		);
		expect(resizeObservers[0]?.observedTargets).toContain(dynamicControl);
		expect(pendingAnimationFrames()).toBe(1);
		expect(vi.getTimerCount()).toBe(1);
		vi.runOnlyPendingTimers();
		runAnimationFrames();
		dispose();
	});

	it("observes active fallback controls and updates geometry when they resize", () => {
		const { resizeObservers, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <button id="top-action"></button>
        <button id="bottom-control"></button>
        <button id="center-control"></button>
        <div id="overlay-root" role="button"></div>
      </div>
    `;
		const container = getPlayer();
		const topAction = document.querySelector("#top-action") as HTMLElement;
		const bottomControl = document.querySelector(
			"#bottom-control",
		) as HTMLElement;
		const centerControl = document.querySelector(
			"#center-control",
		) as HTMLElement;
		const overlayRoot = document.querySelector("#overlay-root") as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(topAction, 900, 14, 40, 32);
		mockRect(bottomControl, 20, 500, 40, 32);
		mockRect(centerControl, 460, 260, 40, 32);
		mockRect(overlayRoot, 0, 0, 960, 540);
		const listener = vi.fn();

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, listener);
		const observedTargets = new Set(resizeObservers[0]?.observedTargets);
		runAnimationFrames();
		mockRect(bottomControl, 20, 460, 40, 32);
		resizeObservers[0]?.trigger(bottomControl);
		runAnimationFrames();
		dispose();

		expect(observedTargets).toEqual(
			new Set([container, topAction, bottomControl]),
		);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				safeInsets: expect.objectContaining({ bottomPx: 98 }),
			}),
		);
		expect(observedTargets).not.toContain(centerControl);
		expect(observedTargets).not.toContain(overlayRoot);
	});

	it("responds to visibility events and replaces the delayed fade measurement", () => {
		const { mutationObservers, pendingAnimationFrames, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="event-target"></div>
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		const eventTarget = document.querySelector("#event-target") as HTMLElement;
		const bottomChrome = document.querySelector(
			".ytp-chrome-bottom",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(bottomChrome, 0, 450, 960, 90);
		const listener = vi.fn();
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, listener);
		runAnimationFrames();

		const dispatchAndMeasure = (dispatch: () => void, widthPx: number) => {
			mockRect(container, 0, 0, widthPx, 540);
			dispatch();
			expect(pendingAnimationFrames()).toBe(1);
			expect(vi.getTimerCount()).toBe(1);
			runAnimationFrames();
		};

		container.classList.add("ytp-fullscreen");
		dispatchAndMeasure(
			() =>
				mutationObservers[0]?.trigger([
					{
						attributeName: "class",
						target: container,
						type: "attributes",
					} as unknown as MutationRecord,
				]),
			961,
		);
		dispatchAndMeasure(
			() =>
				eventTarget.dispatchEvent(new Event("pointermove", { bubbles: true })),
			962,
		);
		dispatchAndMeasure(
			() =>
				eventTarget.dispatchEvent(new Event("pointerleave", { bubbles: true })),
			963,
		);
		dispatchAndMeasure(
			() =>
				eventTarget.dispatchEvent(
					new Event("transitionend", { bubbles: true }),
				),
			964,
		);
		dispatchAndMeasure(
			() => document.dispatchEvent(new Event("fullscreenchange")),
			965,
		);

		expect(listener).toHaveBeenCalledTimes(5);
		expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);

		vi.advanceTimersByTime(220);
		expect(pendingAnimationFrames()).toBe(1);
		runAnimationFrames();
		expect(listener).toHaveBeenCalledTimes(5);

		dispose();
	});

	it("refreshes resize observation when YouTube replaces chrome roots", () => {
		const { mutationObservers, resizeObservers } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div class="ytp-chrome-top-buttons"><button></button></div>
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		const obsoleteTop = document.querySelector(
			".ytp-chrome-top-buttons",
		) as HTMLElement;
		const obsoleteTopAction = obsoleteTop.querySelector(
			"button",
		) as HTMLButtonElement;
		const obsoleteBottom = document.querySelector(
			".ytp-chrome-bottom",
		) as HTMLElement;
		const replacementTop = document.createElement("div");
		const replacementTopAction = document.createElement("button");
		const replacementBottom = document.createElement("div");
		replacementTop.className = "ytp-chrome-top-buttons";
		replacementTop.append(replacementTopAction);
		replacementBottom.className = "ytp-chrome-bottom";

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, vi.fn());
		obsoleteTop.replaceWith(replacementTop);
		obsoleteBottom.replaceWith(replacementBottom);
		mutationObservers[0]?.trigger([
			{
				addedNodes: [replacementTop, replacementBottom] as unknown as NodeList,
				removedNodes: [obsoleteTop, obsoleteBottom] as unknown as NodeList,
				target: container,
				type: "childList",
			} as unknown as MutationRecord,
		]);
		expect(vi.getTimerCount()).toBe(1);

		expect(resizeObservers[0]?.unobserve).toHaveBeenCalledWith(obsoleteTop);
		expect(resizeObservers[0]?.unobserve).toHaveBeenCalledWith(
			obsoleteTopAction,
		);
		expect(resizeObservers[0]?.unobserve).toHaveBeenCalledWith(obsoleteBottom);
		expect(resizeObservers[0]?.observedTargets).toEqual(
			new Set([
				container,
				replacementTop,
				replacementTopAction,
				replacementBottom,
			]),
		);

		dispose();
	});

	it("suppresses duplicate normalized geometry and disposes exactly once", () => {
		const {
			cancelAnimationFrame,
			mutationObservers,
			pendingAnimationFrames,
			resizeObservers,
			runAnimationFrames,
		} = installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="movie_player">
        <div id="event-target"></div>
        <div class="ytp-chrome-bottom"></div>
      </div>
    `;
		const container = getPlayer();
		const eventTarget = document.querySelector("#event-target") as HTMLElement;
		const bottomChrome = document.querySelector(
			".ytp-chrome-bottom",
		) as HTMLElement;
		mockRect(container, 0, 0, 959, 540);
		mockRect(bottomChrome, 0, 450, 959, 90);
		const addContainerListener = vi.spyOn(container, "addEventListener");
		const removeContainerListener = vi.spyOn(container, "removeEventListener");
		const addDocumentListener = vi.spyOn(document, "addEventListener");
		const removeDocumentListener = vi.spyOn(document, "removeEventListener");
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		const listener = vi.fn();

		const dispose = subscribeYouTubePlayerOverlayGeometry(container, listener);
		runAnimationFrames();
		mockRect(container, 0, 0, 960.1, 540);
		eventTarget.dispatchEvent(new Event("pointermove", { bubbles: true }));
		runAnimationFrames();
		mockRect(container, 0, 0, 960.4, 540);
		document.dispatchEvent(new Event("fullscreenchange"));
		runAnimationFrames();

		expect(listener).toHaveBeenCalledTimes(1);
		for (const type of ["pointermove", "pointerleave", "transitionend"]) {
			expect(addContainerListener).toHaveBeenCalledWith(
				type,
				expect.any(Function),
				true,
			);
		}
		expect(addDocumentListener).toHaveBeenCalledWith(
			"fullscreenchange",
			expect.any(Function),
		);

		eventTarget.dispatchEvent(new Event("pointerleave", { bubbles: true }));
		expect(pendingAnimationFrames()).toBe(1);
		dispose();
		dispose();

		expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
		expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
		expect(mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
		expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
		for (const type of ["pointermove", "pointerleave", "transitionend"]) {
			const addedListener = addContainerListener.mock.calls.find(
				([eventType]) => eventType === type,
			)?.[1];
			expect(removeContainerListener).toHaveBeenCalledWith(
				type,
				addedListener,
				true,
			);
		}
		const fullscreenListener = addDocumentListener.mock.calls.find(
			([eventType]) => eventType === "fullscreenchange",
		)?.[1];
		expect(removeDocumentListener).toHaveBeenCalledWith(
			"fullscreenchange",
			fullscreenListener,
		);
		const replacementBottom = document.createElement("div");
		replacementBottom.className = "ytp-chrome-bottom";
		bottomChrome.replaceWith(replacementBottom);
		mutationObservers[0]?.trigger();
		expect(resizeObservers[0]?.unobserve).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);

		vi.advanceTimersByTime(220);
		runAnimationFrames();
		expect(listener).toHaveBeenCalledTimes(1);
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

function installGeometryObserverStubs() {
	vi.useFakeTimers();
	const mutationObservers: MockMutationObserver[] = [];
	const resizeObservers: MockResizeObserver[] = [];
	const animationFrames = new Map<number, FrameRequestCallback>();
	let nextAnimationFrameId = 1;

	class MockMutationObserver {
		readonly disconnect = vi.fn();
		observedTarget: Node | null = null;
		options: MutationObserverInit | null = null;

		constructor(private readonly callback: MutationCallback) {
			mutationObservers.push(this);
		}

		observe(target: Node, options?: MutationObserverInit): void {
			this.observedTarget = target;
			this.options = options ?? null;
		}

		takeRecords(): MutationRecord[] {
			return [];
		}

		trigger(records: MutationRecord[] = []): void {
			this.callback(records, this as unknown as MutationObserver);
		}
	}

	class MockResizeObserver {
		readonly disconnect = vi.fn();
		readonly observedTargets = new Set<Element>();
		readonly unobserve = vi.fn((target: Element) => {
			this.observedTargets.delete(target);
		});

		constructor(private readonly callback: ResizeObserverCallback) {
			resizeObservers.push(this);
		}

		observe(target: Element): void {
			this.observedTargets.add(target);
		}

		trigger(target?: Element): void {
			if (target && !this.observedTargets.has(target)) {
				return;
			}
			this.callback([], this as unknown as ResizeObserver);
		}
	}

	const cancelAnimationFrame = vi.fn((animationFrameId: number) => {
		animationFrames.delete(animationFrameId);
	});

	vi.stubGlobal("MutationObserver", MockMutationObserver);
	vi.stubGlobal("ResizeObserver", MockResizeObserver);
	vi.stubGlobal(
		"requestAnimationFrame",
		(callback: FrameRequestCallback): number => {
			const animationFrameId = nextAnimationFrameId;
			nextAnimationFrameId += 1;
			animationFrames.set(animationFrameId, callback);
			return animationFrameId;
		},
	);
	vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

	return {
		cancelAnimationFrame,
		mutationObservers,
		pendingAnimationFrames: () => animationFrames.size,
		resizeObservers,
		runAnimationFrames: () => {
			const pendingFrames = Array.from(animationFrames.values());
			animationFrames.clear();
			for (const callback of pendingFrames) {
				callback(0);
			}
		},
	};
}
