import { describe, expect, it, vi } from "vitest";
import { readCurrentResourceDisplay } from "../src/current-resource-display";
import type { VideoAdapter } from "../src/source-adapters/core/types";

describe("ephemeral current resource", () => {
	it("reads the live player for Free without invoking history, and hides ad time", () => {
		const observe = vi.fn();
		let phase = "content";
		const adapter = {
			name: "YouTube",
			provider: "youtube",
			video: { duration: 100 },
			getPlaybackSnapshot: () => ({ phase, contentTime: 42 }),
			getSourceDescriptor: () => ({ provider: "youtube", title: "Video" }),
			historyPolicy: { observe },
		} as unknown as VideoAdapter;
		expect(readCurrentResourceDisplay(adapter)).toMatchObject({
			title: "Video",
			currentTime: 42,
			progress: 0.42,
		});
		phase = "interstitial";
		expect(readCurrentResourceDisplay(adapter)).toBeNull();
		expect(observe).not.toHaveBeenCalled();
	});
});
