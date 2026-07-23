import { describe, expect, it, vi } from "vitest";
import {
	AdapterManager,
	type ActiveAdapterHooks,
} from "../../../src/source-adapters/core/adapter-manager";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import { DEFAULT_PLAYBACK_POLICY } from "../../../src/source-adapters/core/playback-policy";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";

describe("AdapterManager", () => {
	it("mounts the first ready adapter and relocates an unchanged player", () => {
		const hooks = createHooks();
		const adapter = createAdapter();
		const manager = new AdapterManager(hooks);

		expect(manager.reconcile({ status: "ready", adapter })).toBe("mounted");
		expect(manager.current).toBe(adapter);
		expect(hooks.mounted).toHaveBeenCalledWith(adapter);

		expect(manager.reconcile({ status: "ready", adapter })).toBe("relocated");
		expect(hooks.relocated).toHaveBeenCalledWith(adapter);
		expect(hooks.replaced).not.toHaveBeenCalled();
	});

	it("keeps the active adapter when detection recreates it for the same player identity", () => {
		const hooks = createHooks();
		const video = document.createElement("video");
		const container = document.createElement("div");
		const current = createAdapter({
			container,
			fingerprint: "youtube|same",
			video,
		});
		const duplicate = createAdapter({
			container,
			fingerprint: "youtube|same",
			video,
		});
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter: current });

		expect(manager.reconcile({ status: "ready", adapter: duplicate })).toBe(
			"relocated",
		);
		expect(manager.current).toBe(current);
		expect(hooks.relocated).toHaveBeenCalledWith(current);
		expect(hooks.replaced).not.toHaveBeenCalled();
	});

	it("replaces a reused video when its source fingerprint changes", () => {
		const hooks = createHooks();
		const video = document.createElement("video");
		const current = createAdapter({ fingerprint: "youtube|old", video });
		const next = createAdapter({ fingerprint: "youtube|new", video });
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter: current });

		expect(manager.reconcile({ status: "ready", adapter: next })).toBe(
			"replaced",
		);
		expect(manager.current).toBe(next);
		expect(hooks.replaced).toHaveBeenCalledWith(current, next);
	});

	it("replaces the adapter when the player creates a new video element", () => {
		const hooks = createHooks();
		const current = createAdapter({ fingerprint: "youtube|same" });
		const next = createAdapter({ fingerprint: "youtube|same" });
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter: current });

		expect(manager.reconcile({ status: "ready", adapter: next })).toBe(
			"replaced",
		);
		expect(hooks.replaced).toHaveBeenCalledWith(current, next);
	});

	it("replaces a reused video when its player container changes", () => {
		const hooks = createHooks();
		const video = document.createElement("video");
		const current = createAdapter({ video });
		const next = createAdapter({ video });
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter: current });

		expect(manager.reconcile({ status: "ready", adapter: next })).toBe(
			"replaced",
		);
		expect(hooks.replaced).toHaveBeenCalledWith(current, next);
	});

	it("suspends once while a claimed player is temporarily unavailable and replaces on resume", () => {
		const hooks = createHooks();
		const current = createAdapter();
		const next = createAdapter({ video: current.video });
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter: current });

		expect(manager.reconcile({ status: "waiting", provider: "youtube" })).toBe(
			"suspended",
		);
		expect(manager.reconcile({ status: "waiting", provider: "youtube" })).toBe(
			"idle",
		);
		expect(manager.current).toBe(current);
		expect(hooks.suspended).toHaveBeenCalledTimes(1);
		expect(hooks.detached).not.toHaveBeenCalled();

		expect(manager.reconcile({ status: "ready", adapter: next })).toBe(
			"replaced",
		);
		expect(hooks.replaced).toHaveBeenCalledWith(current, next);
	});

	it("also suspends an active generic binding when detection temporarily returns none", () => {
		const hooks = createHooks();
		const adapter = createAdapter();
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter });

		expect(manager.reconcile({ status: "none" })).toBe("suspended");
		expect(manager.current).toBe(adapter);
		expect(hooks.suspended).toHaveBeenCalledWith(adapter);
	});

	it("detaches on a blocked route and stays idle when no adapter exists", () => {
		const hooks = createHooks();
		const adapter = createAdapter();
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter });

		expect(manager.reconcile({ status: "blocked", provider: "youtube" })).toBe(
			"detached",
		);
		expect(manager.current).toBeNull();
		expect(hooks.detached).toHaveBeenCalledWith(adapter);
		expect(manager.reconcile({ status: "none" })).toBe("idle");
	});

	it("disposes once and ignores later reconciliation", () => {
		const hooks = createHooks();
		const adapter = createAdapter();
		const manager = new AdapterManager(hooks);
		manager.reconcile({ status: "ready", adapter });

		manager.dispose();
		manager.dispose();

		expect(hooks.detached).toHaveBeenCalledTimes(1);
		expect(manager.current).toBeNull();
		expect(
			manager.reconcile({ status: "ready", adapter: createAdapter() }),
		).toBe("idle");
		expect(hooks.mounted).toHaveBeenCalledTimes(1);
	});
});

function createHooks(): ActiveAdapterHooks {
	return {
		detached: vi.fn(),
		mounted: vi.fn(),
		relocated: vi.fn(),
		replaced: vi.fn(),
		suspended: vi.fn(),
	};
}

function createAdapter({
	container = document.createElement("div"),
	fingerprint = "youtube|video",
	video = document.createElement("video"),
}: {
	container?: HTMLElement;
	fingerprint?: string;
	video?: HTMLVideoElement;
} = {}): VideoAdapter {
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
