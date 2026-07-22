import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	mountOverlay,
	startContentLifecycle,
	type MountedOverlay,
	type OverlayRenderer,
} from "../../entrypoints/content";
import type {
	AdapterDetectionResult,
	VideoAdapter,
} from "../../src/source-adapters/core/types";

describe("content adapter lifecycle", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it("keeps the mounted room shell while suspending and replacing the player", () => {
		const first = createAdapter();
		const replacement = createAdapter();
		let detection: AdapterDetectionResult = { status: "ready", adapter: first };
		const mounted = createMountedOverlayStub(first);
		const runtime = startContentLifecycle({
			detect: () => detection,
			ensureStyles: () => undefined,
			installKeyboardGuard: () => vi.fn(),
			mount: () => mounted,
			startProviderStudy: () => vi.fn(),
		});

		detection = { status: "waiting", provider: "youtube" };
		expect(runtime.reconcile()).toBe("suspended");
		expect(mounted.suspend).toHaveBeenCalledTimes(1);
		expect(mounted.dispose).not.toHaveBeenCalled();

		detection = { status: "ready", adapter: replacement };
		expect(runtime.reconcile()).toBe("replaced");
		expect(mounted.replaceAdapter).toHaveBeenCalledWith(replacement);
		expect(mounted.dispose).not.toHaveBeenCalled();

		runtime.dispose();
	});

	it("cleans up the content lifecycle exactly once on pagehide", () => {
		const adapter = createAdapter();
		const mounted = createMountedOverlayStub(adapter);
		const stopKeyboardGuard = vi.fn();
		const stopProviderStudy = vi.fn();
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		const runtime = startContentLifecycle({
			detect: () => ({ status: "ready", adapter }),
			ensureStyles: () => undefined,
			installKeyboardGuard: () => stopKeyboardGuard,
			mount: () => mounted,
			startProviderStudy: () => stopProviderStudy,
		});

		window.dispatchEvent(new Event("pagehide"));
		runtime.dispose();

		expect(mounted.dispose).toHaveBeenCalledTimes(1);
		expect(stopKeyboardGuard).toHaveBeenCalledTimes(1);
		expect(stopProviderStudy).toHaveBeenCalledTimes(1);
		expect(clearTimeoutSpy).toHaveBeenCalled();
	});
});

describe("mounted overlay adapter binding", () => {
	beforeEach(() => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 1;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
			() => undefined,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it("removes old bindings before observing and listening to a replacement video", () => {
		const first = createAdapter();
		const replacement = createAdapter();
		document.body.append(first.container, replacement.container);
		first.container.append(first.video);
		replacement.container.append(replacement.video);
		const firstAdd = vi.spyOn(first.video, "addEventListener");
		const firstRemove = vi.spyOn(first.video, "removeEventListener");
		const replacementAdd = vi.spyOn(replacement.video, "addEventListener");
		const observer = createResizeObserverStub();
		const renderer = createRenderer();

		const mounted = mountOverlay(first, {
			createResizeObserver: () => observer,
			renderer,
		});
		mounted.replaceAdapter(replacement);

		expect(firstRemove).toHaveBeenCalledWith(
			"loadedmetadata",
			expect.any(Function),
		);
		expect(firstRemove).toHaveBeenCalledWith(
			"loadeddata",
			expect.any(Function),
		);
		expect(firstRemove).toHaveBeenCalledWith(
			"dblclick",
			expect.any(Function),
			true,
		);
		expect(observer.disconnect).toHaveBeenCalled();
		expect(replacementAdd).toHaveBeenCalledWith(
			"loadedmetadata",
			expect.any(Function),
		);
		expect(replacementAdd).toHaveBeenCalledWith(
			"loadeddata",
			expect.any(Function),
		);
		expect(replacementAdd).toHaveBeenCalledWith(
			"dblclick",
			expect.any(Function),
			true,
		);
		expect(observer.observe).toHaveBeenCalledWith(replacement.video);
		expect(renderer.render).toHaveBeenNthCalledWith(2, first, false);
		expect(renderer.render).toHaveBeenLastCalledWith(replacement, true);
		expect(renderer.unmount).not.toHaveBeenCalled();
		expect(firstAdd).toHaveBeenCalledTimes(3);

		mounted.dispose();
	});

	it("suspends without unmounting the room shell and disposes idempotently", () => {
		const adapter = createAdapter();
		adapter.container.style.position = "static";
		document.body.append(adapter.container);
		adapter.container.append(adapter.video);
		const observer = createResizeObserverStub();
		const renderer = createRenderer();
		const mounted = mountOverlay(adapter, {
			createResizeObserver: () => observer,
			renderer,
		});
		expect(adapter.container.style.position).toBe("relative");

		mounted.suspend();
		mounted.suspend();

		expect(renderer.render).toHaveBeenLastCalledWith(adapter, false);
		expect(renderer.unmount).not.toHaveBeenCalled();
		expect(adapter.video.dataset.anidachiVideo).toBeUndefined();
		expect(adapter.container.style.position).toBe("static");
		expect(observer.disconnect).toHaveBeenCalledTimes(1);

		mounted.dispose();
		mounted.dispose();

		expect(renderer.unmount).toHaveBeenCalledTimes(1);
	});

	it("does not complete a fullscreen reroute for a replaced adapter", async () => {
		const first = createAdapter();
		const replacement = createAdapter();
		document.body.append(first.container, replacement.container);
		first.container.append(first.video);
		replacement.container.append(replacement.video);
		const enterFullscreen = vi.fn(async () => undefined);
		first.enterFullscreen = enterFullscreen;
		let resolveExitFullscreen!: () => void;
		const exitFullscreen = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveExitFullscreen = resolve;
				}),
		);
		Object.defineProperty(document, "fullscreenElement", {
			configurable: true,
			value: first.video,
		});
		Object.defineProperty(document, "exitFullscreen", {
			configurable: true,
			value: exitFullscreen,
		});

		const mounted = mountOverlay(first, {
			createResizeObserver: () => createResizeObserverStub(),
			renderer: createRenderer(),
		});
		expect(exitFullscreen).toHaveBeenCalledTimes(1);

		mounted.replaceAdapter(replacement);
		resolveExitFullscreen();
		await Promise.resolve();
		await Promise.resolve();

		expect(enterFullscreen).not.toHaveBeenCalled();
		mounted.dispose();
		Reflect.deleteProperty(document, "fullscreenElement");
		Reflect.deleteProperty(document, "exitFullscreen");
	});
});

function createMountedOverlayStub(adapter: VideoAdapter): MountedOverlay {
	return {
		get adapter() {
			return adapter;
		},
		dispose: vi.fn(),
		relocate: vi.fn(),
		replaceAdapter: vi.fn(),
		suspend: vi.fn(),
	};
}

function createRenderer(): OverlayRenderer {
	return {
		render: vi.fn(),
		unmount: vi.fn(),
	};
}

function createResizeObserverStub() {
	return {
		disconnect: vi.fn(),
		observe: vi.fn(),
	};
}

function createAdapter(): VideoAdapter {
	const video = document.createElement("video");
	const container = document.createElement("div");
	const fingerprint = `youtube|${Math.random()}`;
	mockRect(video, 640, 360);
	mockRect(container, 960, 540);

	return {
		container,
		duckVolume: () => () => undefined,
		enterFullscreen: async () => undefined,
		exitFullscreen: async () => undefined,
		getCurrentTime: () => 0,
		getFingerprint: () => fingerprint,
		getState: () => ({
			hostTime: 0,
			playbackRate: 1,
			playing: false,
			updatedAt: 0,
			videoFingerprint: fingerprint,
		}),
		getTitle: () => null,
		id: "youtube",
		isFullscreen: () => false,
		name: "YouTube",
		pause: () => undefined,
		play: async () => undefined,
		seek: () => undefined,
		subscribe: () => () => undefined,
		video,
	};
}

function mockRect(element: Element, width: number, height: number): void {
	element.getBoundingClientRect = () =>
		({
			bottom: height,
			height,
			left: 0,
			right: width,
			top: 0,
			width,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect;
}
