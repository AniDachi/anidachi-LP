import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import { NetflixVideoAdapter } from "../../../src/source-adapters/netflix/adapter";
import { NETFLIX_COMPOSER_CHROME_STYLES } from "../../../src/source-adapters/netflix/composer-chrome";

afterEach(() => {
	document.body.innerHTML = "";
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Netflix player chrome geometry", () => {
	it("keeps the launcher, panel and content clear of Netflix controls", () => {
		const { adapter } = fixture();
		const geometry = adapter.getOverlayGeometry();
		expect(geometry.controlsVisible).toBe(true);
		expect(geometry.safeInsets).toEqual({
			topPx: 82,
			rightPx: 0,
			bottomPx: 153,
			leftPx: 0,
		});
		// Measured Netflix report button: x=1388..1432, y=30..74.
		expect(1470 - geometry.launcher.rightPx).toBeLessThan(1388);
		expect(geometry.launcher.topPx).toBe(36);
		expect(geometry.panel.topPx).toBeGreaterThan(74);
	});

	it("does not reserve absent controls or include a whole-player surface", () => {
		const { adapter, chrome } = fixture();
		chrome.remove();
		expect(adapter.getOverlayGeometry()).toEqual({
			...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
			viewport: { widthPx: 1470, heightPx: 779 },
		});
	});

	it.each([
		["display", "none"],
		["visibility", "hidden"],
		["visibility", "collapse"],
		["opacity", "0"],
	])("releases space when a parent hides controls using %s", (property, value) => {
		const { adapter, chrome } = fixture();
		chrome.style.setProperty(property, value);
		expect(adapter.getOverlayGeometry().controlsVisible).toBe(false);
		expect(adapter.getOverlayGeometry().safeInsets).toEqual({
			topPx: 0,
			rightPx: 0,
			bottomPx: 0,
			leftPx: 0,
		});
	});

	it("ignores cumulatively transparent controls and off-player elements", () => {
		const { adapter, chrome, bottom, flag, back } = fixture();
		chrome.style.opacity = "0.2";
		bottom.style.opacity = "0.1";
		mockRect(flag, 1600, 30, 44, 44);
		mockRect(back, -100, 30, 44, 44);
		expect(adapter.getOverlayGeometry().controlsVisible).toBe(false);
	});

	it("uses container-relative coordinates for an inset player", () => {
		const { adapter, container, bottom, flag, back } = fixture();
		mockRect(container, 80, 40, 960, 540);
		mockRect(bottom, 80, 480, 960, 100);
		mockRect(flag, 980, 60, 40, 40);
		mockRect(back, 100, 60, 40, 40);
		const geometry = adapter.getOverlayGeometry();
		expect(geometry.viewport).toEqual({ widthPx: 960, heightPx: 540 });
		expect(geometry.safeInsets).toEqual({
			topPx: 68,
			rightPx: 0,
			bottomPx: 118,
			leftPx: 0,
		});
		expect(geometry.launcher).toEqual({ topPx: 24, rightPx: 68 });
	});

	it("moves below the top row when the launcher cannot fit between native buttons", () => {
		const { adapter, container, bottom, flag, back } = fixture();
		mockRect(container, 0, 0, 220, 300);
		mockRect(bottom, 0, 220, 220, 80);
		mockRect(back, 20, 20, 44, 44);
		mockRect(flag, 156, 20, 44, 44);
		expect(adapter.getOverlayGeometry().launcher).toEqual({
			topPx: 72,
			rightPx: 10,
		});
	});

	it.each([
		false,
		true,
	])("respects the real composer visibility CSS (open=%s)", (open) => {
		const { adapter, container } = fixture();
		const style = document.createElement("style");
		style.textContent = NETFLIX_COMPOSER_CHROME_STYLES;
		document.body.append(style);
		if (open) container.dataset.anidachiComposerOpen = "true";
		expect(adapter.getOverlayGeometry().safeInsets.bottomPx).toBe(
			open ? 0 : 153,
		);
	});

	it("falls back safely for a zero-sized player", () => {
		const { adapter, container } = fixture();
		mockRect(container, 0, 0, 0, 0);
		expect(adapter.getOverlayGeometry()).toEqual(
			DEFAULT_PLAYER_OVERLAY_GEOMETRY,
		);
	});

	it("updates when Netflix mounts, hides and replaces controls", () => {
		const observers = installObservers();
		const { adapter, container, chrome } = fixture();
		chrome.remove();
		const listener = vi.fn();
		const stop = adapter.subscribeOverlayGeometry(listener);
		observers.flush();
		container.append(chrome);
		observers.mutate({
			type: "childList",
			target: container,
			addedNodes: [chrome],
			removedNodes: [],
		});
		observers.flush();
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				controlsVisible: true,
				safeInsets: expect.objectContaining({ bottomPx: 153 }),
			}),
		);
		chrome.style.opacity = "0";
		observers.mutate({
			type: "attributes",
			target: chrome,
			attributeName: "style",
		});
		observers.flush();
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({ controlsVisible: false }),
		);
		chrome.style.opacity = "1";
		observers.mutate({
			type: "attributes",
			target: chrome,
			attributeName: "style",
		});
		observers.flush();
		chrome.remove();
		observers.mutate({
			type: "childList",
			target: container,
			addedNodes: [],
			removedNodes: [chrome],
		});
		observers.flush();
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({ controlsVisible: false }),
		);
		expect(listener).toHaveBeenCalledTimes(4);
		stop();
	});

	it("updates on fullscreen/resize and stops after adapter disposal", () => {
		const observers = installObservers();
		const { adapter, container, chrome, bottom } = fixture();
		const listener = vi.fn();
		const stop = adapter.subscribeOverlayGeometry(listener);
		observers.flush();
		mockRect(container, 0, 0, 1470, 900);
		mockRect(bottom, 0, 780, 1470, 120);
		document.dispatchEvent(new Event("fullscreenchange"));
		observers.flush();
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				viewport: { widthPx: 1470, heightPx: 900 },
				safeInsets: expect.objectContaining({ bottomPx: 138 }),
			}),
		);
		mockRect(bottom, 0, 740, 1470, 160);
		observers.resize();
		observers.flush();
		expect(listener).toHaveBeenLastCalledWith(
			expect.objectContaining({
				safeInsets: expect.objectContaining({ bottomPx: 178 }),
			}),
		);
		chrome.style.display = "none";
		container.dispatchEvent(new Event("pointermove"));
		stop();
		stop();
		observers.flush();
		observers.mutate({
			type: "attributes",
			target: chrome,
			attributeName: "style",
		});
		observers.resize();
		document.dispatchEvent(new Event("fullscreenchange"));
		observers.flush();
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("ignores subtitle/timeline churn and its own overlay mutations", () => {
		const observers = installObservers();
		const { adapter, container, bottom } = fixture();
		const subtitle = document.createElement("span");
		const overlay = document.createElement("anidachi-overlay");
		container.append(subtitle, overlay);
		const listener = vi.fn();
		const stop = adapter.subscribeOverlayGeometry(listener);
		observers.flush();
		const measure = vi.spyOn(container, "getBoundingClientRect");
		observers.mutate({
			type: "childList",
			target: subtitle,
			addedNodes: [document.createTextNode("caption")],
			removedNodes: [],
		});
		observers.mutate({
			type: "attributes",
			target: overlay,
			attributeName: "style",
		});
		const timeline = document.createElement("div");
		timeline.dataset.uia = "timeline-bar";
		bottom.append(timeline);
		observers.mutate({
			type: "attributes",
			target: timeline,
			attributeName: "style",
		});
		observers.flush();
		expect(measure).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
		stop();
	});
});

function fixture() {
	document.body.innerHTML = `<div data-uia="watch-video" data-anidachi-adapter="netflix"><div data-uia="player"><video></video><div id="chrome"><button data-uia="control-nav-back"></button><button data-uia="control-flag"></button><div data-uia="controls-standard"></div></div></div></div>`;
	const container = fixtureElement('[data-uia="watch-video"]');
	const chrome = fixtureElement("#chrome");
	const bottom = fixtureElement('[data-uia="controls-standard"]');
	const flag = fixtureElement('[data-uia="control-flag"]');
	const back = fixtureElement('[data-uia="control-nav-back"]');
	mockRect(container, 0, 0, 1470, 779);
	mockRect(bottom, 0, 644.5, 1470, 134.5);
	mockRect(flag, 1388, 30, 44, 44);
	mockRect(back, 30, 30, 44, 44);
	return {
		container,
		chrome,
		bottom,
		flag,
		back,
		adapter: new NetflixVideoAdapter(
			fixtureElement<HTMLVideoElement>("video"),
			container,
		),
	};
}

function fixtureElement<T extends HTMLElement = HTMLElement>(
	selector: string,
): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`Missing fixture element: ${selector}`);
	return element;
}

function mockRect(
	element: Element,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	Object.defineProperty(element, "getBoundingClientRect", {
		configurable: true,
		value: () => new DOMRect(x, y, width, height),
	});
}

function installObservers() {
	const frames = new Map<number, FrameRequestCallback>();
	let id = 0;
	let onMutation: MutationCallback = () => {};
	let onResize: ResizeObserverCallback = () => {};
	vi.stubGlobal(
		"MutationObserver",
		class {
			constructor(callback: MutationCallback) {
				onMutation = callback;
			}
			observe() {}
			disconnect() {}
		},
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(callback: ResizeObserverCallback) {
				onResize = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		frames.set(++id, callback);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
	return {
		mutate(record: Record<string, unknown>) {
			onMutation([record as unknown as MutationRecord], {} as MutationObserver);
		},
		resize() {
			onResize([], {} as ResizeObserver);
		},
		flush() {
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback(0);
		},
	};
}
