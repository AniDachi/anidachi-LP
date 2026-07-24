import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveAdapterPlayback } from "../src/active-adapter-playback";
import type { PlaybackSyncController } from "../src/playback-sync-controller";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../src/source-adapters/core/overlay-geometry";
import { DEFAULT_PLAYBACK_POLICY } from "../src/source-adapters/core/playback-policy";
import type { VideoAdapter } from "../src/source-adapters/core/types";

describe("useActiveAdapterPlayback", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("hands adapter activation and suspension to the playback coordinator", () => {
		const adapter = createAdapter();
		const controller = {
			bindAdapter: vi.fn(),
			suspend: vi.fn(),
		};

		renderHarness({
			active: true,
			adapter,
			controller,
		});
		expect(controller.bindAdapter).toHaveBeenCalledWith(adapter);
		expect(controller.suspend).not.toHaveBeenCalled();

		renderHarness({
			active: false,
			adapter,
			controller,
		});
		expect(controller.suspend).toHaveBeenCalledTimes(1);

		renderHarness({
			active: true,
			adapter,
			controller,
		});
		expect(controller.bindAdapter).toHaveBeenCalledTimes(2);
	});

	function renderHarness(props: HarnessProps): void {
		act(() => root.render(<Harness {...props} />));
	}
});

interface HarnessProps {
	active: boolean;
	adapter: VideoAdapter;
	controller: Pick<PlaybackSyncController, "bindAdapter" | "suspend">;
}

function Harness(props: HarnessProps) {
	useActiveAdapterPlayback(props);
	return null;
}

function createAdapter(): VideoAdapter {
	const video = document.createElement("video");
	return {
		container: document.createElement("div"),
		duckVolume: () => () => undefined,
		enterFullscreen: async () => undefined,
		exitFullscreen: async () => undefined,
		getCurrentTime: () => 0,
		getFingerprint: () => "youtube|video",
		getOverlayBinding: () => ({
			fillMountTarget: true,
			mountTarget: document.body,
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
			videoFingerprint: "youtube|video",
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
