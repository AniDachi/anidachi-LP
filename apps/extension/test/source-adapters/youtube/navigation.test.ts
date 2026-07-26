import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { describe, expect, it, vi } from "vitest";
import { createYouTubeSourceNavigator } from "../../../src/source-adapters/youtube/navigation";

const VIDEO_ID = "dQw4w9WgXcQ";
const OTHER_VIDEO_ID = "aqz-KE-bpKQ";

describe("YouTube source navigation", () => {
	it("returns already-current for the same canonical YouTube video", async () => {
		const assign = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await expect(
			ensureSource(source(VIDEO_ID), context()),
		).resolves.toEqual({ status: "already-current" });
		expect(assign).not.toHaveBeenCalled();
	});

	it("assigns a canonical watch URL for a different valid YouTube video", async () => {
		const assign = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await expect(
			ensureSource(source(OTHER_VIDEO_ID), context()),
		).resolves.toEqual({
			status: "navigation-started",
			targetUrl: `https://www.youtube.com/watch?v=${OTHER_VIDEO_ID}`,
		});
		expect(assign).toHaveBeenCalledOnce();
		expect(assign).toHaveBeenCalledWith(
			`https://www.youtube.com/watch?v=${OTHER_VIDEO_ID}`,
		);
	});

	it("preserves only the active room id in the target hash", async () => {
		const assign = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		const result = await ensureSource(
			source(
				OTHER_VIDEO_ID,
				`https://www.youtube.com/watch?v=${OTHER_VIDEO_ID}#foreign=value`,
			),
			context("room-123"),
		);

		expect(result).toEqual({
			status: "navigation-started",
			targetUrl: `https://www.youtube.com/watch?v=${OTHER_VIDEO_ID}#anidachiRoom=room-123`,
		});
		expect(assign).toHaveBeenCalledWith(
			`https://www.youtube.com/watch?v=${OTHER_VIDEO_ID}#anidachiRoom=room-123`,
		);
	});

	it.each([
		"javascript:alert(1)",
		`https://example.com/watch?v=${OTHER_VIDEO_ID}`,
	])("rejects javascript and foreign-host URLs: %s", async (sourceUrl) => {
		const assign = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await expect(
			ensureSource(source(OTHER_VIDEO_ID, sourceUrl), context()),
		).resolves.toMatchObject({ status: "unsupported" });
		expect(assign).not.toHaveBeenCalled();
	});

	it.each([
		`https://www.youtube.com/shorts/${OTHER_VIDEO_ID}`,
		`https://www.youtube.com/embed/${OTHER_VIDEO_ID}`,
		"https://www.youtube.com/watch?v=bad!",
	])("rejects malformed and unsupported YouTube routes: %s", async (sourceUrl) => {
		const assign = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await expect(
			ensureSource(source(OTHER_VIDEO_ID, sourceUrl), context()),
		).resolves.toMatchObject({ status: "unsupported" });
		expect(assign).not.toHaveBeenCalled();
	});

	it("does not call undocumented YouTube navigation methods", async () => {
		const assign = vi.fn();
		const loadVideoById = vi.fn();
		const cueVideoById = vi.fn();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await ensureSource(source(OTHER_VIDEO_ID), context());

		expect(assign).toHaveBeenCalledOnce();
		expect(loadVideoById).not.toHaveBeenCalled();
		expect(cueVideoById).not.toHaveBeenCalled();
	});

	it("honors an aborted navigation operation", async () => {
		const assign = vi.fn();
		const controller = new AbortController();
		controller.abort();
		const ensureSource = createYouTubeSourceNavigator({
			assign,
			currentHref: () => `https://www.youtube.com/watch?v=${VIDEO_ID}`,
		});

		await expect(
			ensureSource(source(OTHER_VIDEO_ID), {
				...context(),
				signal: controller.signal,
			}),
		).resolves.toEqual({
			status: "failed",
			reason: "navigation-failed",
		});
		expect(assign).not.toHaveBeenCalled();
	});
});

function source(
	videoId: string,
	sourceUrl = `https://www.youtube.com/watch?v=${videoId}`,
): WatchSourceDescriptor {
	return {
		canonicalUrl: sourceUrl,
		provider: "youtube",
		sourceUrl,
		title: "Test video",
		videoFingerprint: `youtube|${videoId}`,
	};
}

function context(roomId: string | null = null) {
	return {
		roomId,
		roomProvider: "youtube" as const,
		signal: new AbortController().signal,
	};
}
