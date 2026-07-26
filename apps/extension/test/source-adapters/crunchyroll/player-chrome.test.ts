import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import {
	areCrunchyrollPlayerChromeStatesEqual,
	DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
	getCrunchyrollPlayerOverlayGeometry,
	getCrunchyrollPlayerChromeState,
	subscribeCrunchyrollPlayerOverlayGeometry,
} from "../../../src/source-adapters/crunchyroll/player-chrome";

describe("Crunchyroll player chrome", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	it("measures visible controls without treating the whole controls root as chrome", () => {
		document.body.innerHTML = `
      <div id="player-container">
        <div data-testid="player-controls-root"></div>
        <div data-testid="timeline-controls-container"></div>
        <button data-testid="settings-button"></button>
      </div>
    `;
		const container = document.querySelector(
			"#player-container",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(
			document.querySelector("[data-testid='player-controls-root']"),
			0,
			0,
			960,
			540,
		);
		mockRect(
			document.querySelector("[data-testid='timeline-controls-container']"),
			20,
			450,
			920,
			70,
		);
		mockRect(
			document.querySelector("[data-testid='settings-button']"),
			860,
			12,
			32,
			32,
		);

		expect(getCrunchyrollPlayerChromeState(container)).toEqual({
			camStackBottomPx: 108,
			containerHeightPx: 540,
			containerWidthPx: 960,
			controlsVisible: true,
			miniPanelRightPx: 10,
			miniPanelTopPx: 51,
			topBubbleRightPx: 10,
			topBubbleTopPx: 13,
		});
		expect(getCrunchyrollPlayerOverlayGeometry(container)).toEqual({
			controlsVisible: true,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 108, leftPx: 0 },
			launcher: { topPx: 13, rightPx: 10 },
			panel: { topPx: 51, rightPx: 10 },
		});
	});

	it("returns zero safe insets while controls are hidden", () => {
		const container = document.createElement("div");
		document.body.append(container);
		mockRect(container, 0, 0, 960, 540);

		expect(getCrunchyrollPlayerOverlayGeometry(container)).toEqual({
			controlsVisible: false,
			viewport: { widthPx: 960, heightPx: 540 },
			safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
			launcher: { topPx: 10, rightPx: 10 },
			panel: { topPx: 48, rightPx: 10 },
		});
	});

	it("returns the provider-neutral default geometry for an unusable player", () => {
		const container = document.createElement("div");

		expect(getCrunchyrollPlayerOverlayGeometry(container)).toEqual(
			DEFAULT_PLAYER_OVERLAY_GEOMETRY,
		);
	});

	it("does not emit the current geometry and only notifies subscribers after a change", () => {
		const { mutationObservers, resizeObservers, runAnimationFrames } =
			installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="player-container">
        <div data-testid="player-controls-root"></div>
        <div data-testid="timeline-controls-container"></div>
        <button data-testid="settings-button"></button>
      </div>
    `;
		const container = document.querySelector(
			"#player-container",
		) as HTMLElement;
		mockRect(container, 0, 0, 960, 540);
		mockRect(
			document.querySelector("[data-testid='player-controls-root']"),
			0,
			0,
			960,
			540,
		);
		mockRect(
			document.querySelector("[data-testid='timeline-controls-container']"),
			20,
			450,
			920,
			70,
		);
		mockRect(
			document.querySelector("[data-testid='settings-button']"),
			860,
			12,
			32,
			32,
		);
		const listener = vi.fn();

		const dispose = subscribeCrunchyrollPlayerOverlayGeometry(container, listener);

		expect(listener).not.toHaveBeenCalled();
		expect(mutationObservers).toHaveLength(1);
		expect(mutationObservers[0]?.observedTarget).toBe(container);
		expect(mutationObservers[0]?.options).toEqual({
			attributeFilter: ["class", "style", "aria-hidden", "hidden", "data-testid"],
			attributes: true,
			childList: true,
			subtree: true,
		});
		expect(resizeObservers).toHaveLength(1);
		expect(resizeObservers[0]?.observedTargets).toContain(container);

		mutationObservers[0]?.trigger();
		resizeObservers[0]?.trigger();
		runAnimationFrames();
		expect(listener).not.toHaveBeenCalled();

		mockRect(
			document.querySelector("[data-testid='timeline-controls-container']"),
			20,
			430,
			920,
			70,
		);
		resizeObservers[0]?.trigger();
		runAnimationFrames();
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				safeInsets: expect.objectContaining({ bottomPx: 128 }),
			}),
		);

		dispose();
		dispose();
		expect(mutationObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
		expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
	});

	it("refreshes resize observation when Crunchyroll replaces chrome controls", () => {
		const { mutationObservers, resizeObservers } = installGeometryObserverStubs();
		document.body.innerHTML = `
      <div id="player-container">
        <div data-testid="timeline-controls-container"></div>
      </div>
    `;
		const container = document.querySelector(
			"#player-container",
		) as HTMLElement;
		const obsoleteRoot = document.querySelector(
			"[data-testid='timeline-controls-container']",
		) as HTMLElement;
		const replacementRoot = document.createElement("div");
		replacementRoot.dataset.testid = "timeline-controls-container";

		const dispose = subscribeCrunchyrollPlayerOverlayGeometry(container, vi.fn());
		container.replaceChild(replacementRoot, obsoleteRoot);
		mutationObservers[0]?.trigger();

		expect(resizeObservers).toHaveLength(1);
		expect(resizeObservers[0]?.unobserve).toHaveBeenCalledWith(obsoleteRoot);
		expect(Array.from(resizeObservers[0]?.observedTargets ?? [])).not.toContain(
			obsoleteRoot,
		);
		expect(Array.from(resizeObservers[0]?.observedTargets ?? [])).toContain(
			replacementRoot,
		);
		dispose();
	});

	it("keeps the literal default state for an unusable player", () => {
		const container = document.createElement("div");

		expect(getCrunchyrollPlayerChromeState(container)).toBe(
			DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
		);
		expect(DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE).toEqual({
			camStackBottomPx: 54,
			containerHeightPx: 0,
			containerWidthPx: 0,
			controlsVisible: false,
			miniPanelRightPx: 10,
			miniPanelTopPx: 48,
			topBubbleRightPx: 10,
			topBubbleTopPx: 10,
		});
		expect(
			areCrunchyrollPlayerChromeStatesEqual(
				DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
				{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE },
			),
		).toBe(true);
	});

	it.each([
		[
			"controlsVisible",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, controlsVisible: true },
		],
		[
			"camStackBottomPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, camStackBottomPx: 55 },
		],
		[
			"containerHeightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, containerHeightPx: 1 },
		],
		[
			"containerWidthPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, containerWidthPx: 1 },
		],
		[
			"miniPanelRightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, miniPanelRightPx: 11 },
		],
		[
			"miniPanelTopPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, miniPanelTopPx: 49 },
		],
		[
			"topBubbleRightPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, topBubbleRightPx: 11 },
		],
		[
			"topBubbleTopPx",
			{ ...DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE, topBubbleTopPx: 11 },
		],
	])("returns false when %s differs", (_field, changedState) => {
		expect(
			areCrunchyrollPlayerChromeStatesEqual(
				DEFAULT_CRUNCHYROLL_PLAYER_CHROME_STATE,
				changedState,
			),
		).toBe(false);
	});
});

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
	const mutationObservers: MockMutationObserver[] = [];
	const resizeObservers: MockResizeObserver[] = [];
	const animationFrames: FrameRequestCallback[] = [];

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

		trigger(): void {
			this.callback([], this as unknown as MutationObserver);
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

		trigger(): void {
			this.callback([], this as unknown as ResizeObserver);
		}
	}

	vi.stubGlobal("MutationObserver", MockMutationObserver);
	vi.stubGlobal("ResizeObserver", MockResizeObserver);
	vi.stubGlobal(
		"requestAnimationFrame",
		(callback: FrameRequestCallback): number => {
			animationFrames.push(callback);
			return animationFrames.length;
		},
	);
	vi.stubGlobal("cancelAnimationFrame", vi.fn());

	return {
		mutationObservers,
		resizeObservers,
		runAnimationFrames: () => {
			for (const callback of animationFrames.splice(0)) {
				callback(0);
			}
		},
	};
}
