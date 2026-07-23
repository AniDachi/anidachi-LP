import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type MountedOverlay,
	mountOverlay,
	type OverlayRenderer,
	startContentLifecycle,
} from "../../entrypoints/content";
import { clearDebugLog, getDebugEntries } from "../../src/debug-log";
import { usePlayerOverlayGeometry } from "../../src/overlay-app";
import {
	DEFAULT_PLAYER_OVERLAY_GEOMETRY,
	type PlayerOverlayGeometry,
} from "../../src/source-adapters/core/overlay-geometry";
import { DEFAULT_PLAYBACK_POLICY } from "../../src/source-adapters/core/playback-policy";
import type {
	AdapterDetectionResult,
	VideoAdapter,
} from "../../src/source-adapters/core/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("usePlayerOverlayGeometry", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		clearDebugLog();
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		clearDebugLog();
		vi.restoreAllMocks();
	});

	it("normalizes provider geometry and logs only distinct callback changes", () => {
		const initialGeometry = createGeometry({
			controlsVisible: false,
			viewport: { widthPx: 960.4, heightPx: 540.4 },
			safeInsets: { topPx: -4, rightPx: 12.4, bottomPx: 96.4, leftPx: 0 },
		});
		const binding = createGeometryAdapter("youtube", initialGeometry);

		renderGeometryHarness(root, binding.adapter, true);

		expect(readRenderedGeometry(container)).toEqual(
			createGeometry({
				controlsVisible: false,
				viewport: { widthPx: 960, heightPx: 540 },
				safeInsets: { topPx: 0, rightPx: 12, bottomPx: 96, leftPx: 0 },
			}),
		);
		expect(binding.subscribe).toHaveBeenCalledTimes(1);
		expect(getGeometryDebugEntries()).toHaveLength(0);

		act(() =>
			binding.emit({
				...initialGeometry,
				viewport: { widthPx: 960.1, heightPx: 540.1 },
			}),
		);
		expect(getGeometryDebugEntries()).toHaveLength(0);

		act(() =>
			binding.emit(
				createGeometry({
					controlsVisible: true,
					viewport: { widthPx: 1279.6, heightPx: 719.6 },
					safeInsets: { topPx: 44.2, rightPx: 18.2, bottomPx: 87.6, leftPx: 7.6 },
					launcher: { topPx: 53.6, rightPx: 21.6 },
					panel: { topPx: 91.6, rightPx: 21.6 },
				}),
			),
		);

		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 1280, heightPx: 720 });
		expect(getGeometryDebugEntries()).toEqual([
			expect.objectContaining({
				scope: "overlay.geometry",
				message: "changed",
				data: {
					adapterId: "youtube",
					controlsVisible: true,
					viewport: { widthPx: 1280, heightPx: 720 },
					safeInsets: { topPx: 44, rightPx: 18, bottomPx: 88, leftPx: 8 },
					launcher: { topPx: 54, rightPx: 22 },
					panel: { topPx: 92, rightPx: 22 },
				},
			}),
		]);
	});

	it("does not log an initial measurement refresh before subscribing", () => {
		const firstMeasurement = createGeometry({
			viewport: { widthPx: 960, heightPx: 540 },
		});
		const refreshedMeasurement = createGeometry({
			controlsVisible: true,
			viewport: { widthPx: 1280, heightPx: 720 },
		});
		const binding = createGeometryAdapter("youtube", firstMeasurement);
		binding.adapter.getOverlayGeometry = vi
			.fn()
			.mockReturnValueOnce(firstMeasurement)
			.mockReturnValue(refreshedMeasurement);

		renderGeometryHarness(root, binding.adapter, true);

		expect(readRenderedGeometry(container)).toEqual(refreshedMeasurement);
		expect(binding.subscribe).toHaveBeenCalledTimes(1);
		expect(getGeometryDebugEntries()).toHaveLength(0);
	});

	it("disposes the old subscription before replacement and ignores its late callbacks", () => {
		const events: string[] = [];
		const first = createGeometryAdapter(
			"youtube",
			createGeometry({ viewport: { widthPx: 960, heightPx: 540 } }),
			events,
		);
		const replacement = createGeometryAdapter(
			"youtube",
			createGeometry({ viewport: { widthPx: 1280, heightPx: 720 } }),
			events,
		);
		first.onUnsubscribe = () => {
			first.emit(createGeometry({ viewport: { widthPx: 320, heightPx: 180 } }));
		};

		renderGeometryHarness(root, first.adapter, true);
		renderGeometryHarness(root, replacement.adapter, true);

		expect(events.indexOf("youtube:unsubscribe")).toBeLessThan(
			events.lastIndexOf("youtube:subscribe"),
		);
		expect(first.unsubscribe).toHaveBeenCalledTimes(1);
		expect(replacement.subscribe).toHaveBeenCalledTimes(1);
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 1280, heightPx: 720 });
		expect(getGeometryDebugEntries()).toHaveLength(1);

		act(() => first.emit(createGeometry({ viewport: { widthPx: 640, heightPx: 360 } })));
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 1280, heightPx: 720 });
		expect(getGeometryDebugEntries()).toHaveLength(1);

		act(() => root.unmount());
		expect(first.unsubscribe).toHaveBeenCalledTimes(1);
		expect(replacement.unsubscribe).toHaveBeenCalledTimes(1);
		root = createRoot(container);
	});

	it("unsubscribes while inactive and creates exactly one subscription when reactivated", () => {
		const binding = createGeometryAdapter(
			"youtube",
			createGeometry({ viewport: { widthPx: 960, heightPx: 540 } }),
		);

		renderGeometryHarness(root, binding.adapter, true);
		expect(binding.subscribe).toHaveBeenCalledTimes(1);

		renderGeometryHarness(root, binding.adapter, false);
		expect(binding.unsubscribe).toHaveBeenCalledTimes(1);
		expect(binding.subscribe).toHaveBeenCalledTimes(1);

		act(() => binding.emit(createGeometry({ viewport: { widthPx: 320, heightPx: 180 } })));
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 960, heightPx: 540 });
		expect(getGeometryDebugEntries()).toHaveLength(0);

		renderGeometryHarness(root, binding.adapter, true);
		expect(binding.subscribe).toHaveBeenCalledTimes(2);

		act(() =>
			binding.emitSubscription(
				0,
				createGeometry({ viewport: { widthPx: 640, heightPx: 360 } }),
			),
		);
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 960, heightPx: 540 });
		expect(getGeometryDebugEntries()).toHaveLength(0);

		act(() => binding.emit(createGeometry({ viewport: { widthPx: 1280, heightPx: 720 } })));
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 1280, heightPx: 720 });
		expect(getGeometryDebugEntries()).toHaveLength(1);
	});

	it("survives StrictMode effect replay without stale updates or duplicate logs", () => {
		const binding = createGeometryAdapter(
			"youtube",
			createGeometry({ viewport: { widthPx: 960, heightPx: 540 } }),
		);

		act(() =>
			root.render(
				<StrictMode>
					<GeometryHarness adapter={binding.adapter} active />
				</StrictMode>,
			),
		);

		expect(binding.subscribe).toHaveBeenCalledTimes(2);
		expect(binding.unsubscribe).toHaveBeenCalledTimes(1);
		expect(getGeometryDebugEntries()).toHaveLength(0);

		act(() =>
			binding.emitSubscription(
				0,
				createGeometry({ viewport: { widthPx: 640, heightPx: 360 } }),
			),
		);
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 960, heightPx: 540 });
		expect(getGeometryDebugEntries()).toHaveLength(0);

		act(() => binding.emit(createGeometry({ viewport: { widthPx: 1280, heightPx: 720 } })));
		expect(readRenderedGeometry(container).viewport).toEqual({ widthPx: 1280, heightPx: 720 });
		expect(getGeometryDebugEntries()).toHaveLength(1);
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
		getOverlayBinding: () => ({
			fillMountTarget: true,
			mountTarget: container,
			useNativePlayerDoubleClick: true,
		}),
		getOverlayGeometry: () => DEFAULT_PLAYER_OVERLAY_GEOMETRY,
		getPlaybackSnapshot: () => ({
			capturedAt: 0,
			contentTime: 0,
			phase: "content",
			playbackRate: 1,
			playing: false,
		}),
		getSourceDescriptor: () => undefined,
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
		playbackPolicy: DEFAULT_PLAYBACK_POLICY,
		play: async () => undefined,
		provider: "youtube",
		seek: () => undefined,
		setPlaybackRate: () => undefined,
		subscribe: () => () => undefined,
		subscribeOverlayGeometry: () => () => undefined,
		video,
	};
}

interface GeometryAdapterBinding {
	adapter: VideoAdapter;
	emit(geometry: PlayerOverlayGeometry): void;
	emitSubscription(index: number, geometry: PlayerOverlayGeometry): void;
	onUnsubscribe?: () => void;
	subscribe: ReturnType<typeof vi.fn>;
	unsubscribe: ReturnType<typeof vi.fn>;
}

function createGeometryAdapter(
	id: string,
	initialGeometry: PlayerOverlayGeometry,
	events: string[] = [],
): GeometryAdapterBinding {
	const listeners: Array<(geometry: PlayerOverlayGeometry) => void> = [];
	const unsubscribe = vi.fn(() => {
		events.push(`${id}:unsubscribe`);
		binding.onUnsubscribe?.();
	});
	const subscribe = vi.fn((nextListener: (geometry: PlayerOverlayGeometry) => void) => {
		events.push(`${id}:subscribe`);
		listeners.push(nextListener);
		return unsubscribe;
	});
	const adapter = createAdapter();
	adapter.id = id;
	adapter.getOverlayGeometry = vi.fn(() => initialGeometry);
	adapter.subscribeOverlayGeometry = subscribe;
	const binding: GeometryAdapterBinding = {
		adapter,
		emit(geometry) {
			listeners.at(-1)?.(geometry);
		},
		emitSubscription(index, geometry) {
			listeners[index]?.(geometry);
		},
		subscribe,
		unsubscribe,
	};
	return binding;
}

function createGeometry(
	overrides: Partial<PlayerOverlayGeometry> = {},
): PlayerOverlayGeometry {
	return {
		controlsVisible: overrides.controlsVisible ?? false,
		viewport: overrides.viewport ?? { widthPx: 960, heightPx: 540 },
		safeInsets: overrides.safeInsets ?? { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
		launcher: overrides.launcher ?? { topPx: 10, rightPx: 10 },
		panel: overrides.panel ?? { topPx: 48, rightPx: 10 },
	};
}

function renderGeometryHarness(root: Root, adapter: VideoAdapter, active: boolean): void {
	act(() => root.render(<GeometryHarness adapter={adapter} active={active} />));
}

function GeometryHarness({ adapter, active }: { adapter: VideoAdapter; active: boolean }) {
	const geometry = usePlayerOverlayGeometry(adapter, active);
	return <output data-testid="geometry">{JSON.stringify(geometry)}</output>;
}

function readRenderedGeometry(container: HTMLElement): PlayerOverlayGeometry {
	const output = container.querySelector('[data-testid="geometry"]');
	if (!output?.textContent) {
		throw new Error("Expected rendered player overlay geometry");
	}
	return JSON.parse(output.textContent) as PlayerOverlayGeometry;
}

function getGeometryDebugEntries() {
	return getDebugEntries().filter((entry) => entry.scope === "overlay.geometry");
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
