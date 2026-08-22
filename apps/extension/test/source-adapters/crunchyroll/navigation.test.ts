import {
	canonicalizeRoomSourceUrl,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { describe, expect, it, vi } from "vitest";
import { createCrunchyrollSourceNavigator } from "../../../src/source-adapters/crunchyroll/navigation";

describe("Crunchyroll source navigation", () => {
	it("keeps every currently accepted watch navigation identity canonicalizable", () => {
		for (const input of [
			"https://www.crunchyroll.com/watch/GOLD22222/episode-two",
			"https://crunchyroll.com/watch/GOLD22222",
		]) {
			expect(canonicalizeRoomSourceUrl(input)).toMatchObject({
				ok: true,
				source: {
					canonicalUrl: "https://www.crunchyroll.com/watch/GOLD22222",
					provider: "crunchyroll",
					videoFingerprint: "crunchyroll|watch/GOLD22222",
				},
			});
		}
	});

	it("uses the MAIN-world navigation command for a different episode", async () => {
		const assign = vi.fn();
		const navigate = vi.fn().mockResolvedValue({ ok: true });
		const ensureSource = createCrunchyrollSourceNavigator({
			assign,
			currentHref: () =>
				"https://www.crunchyroll.com/watch/GOLD11111/episode-one",
			navigate,
		});

		const result = await ensureSource(source(), context());

		expect(result).toEqual({
			status: "navigation-started",
			targetUrl:
				"https://www.crunchyroll.com/watch/GOLD22222/episode-two#anidachiRoom=room-123",
		});
		expect(navigate).toHaveBeenCalledWith(
			"https://www.crunchyroll.com/watch/GOLD22222/episode-two#anidachiRoom=room-123",
		);
		expect(assign).not.toHaveBeenCalled();
	});

	it("falls back to location.assign when the MAIN-world command fails", async () => {
		const assign = vi.fn();
		const navigate = vi.fn().mockResolvedValue({
			error: "MAIN_BRIDGE_TIMEOUT",
			ok: false,
		});
		const ensureSource = createCrunchyrollSourceNavigator({
			assign,
			currentHref: () =>
				"https://www.crunchyroll.com/watch/GOLD11111/episode-one",
			navigate,
		});

		const result = await ensureSource(source(), context());

		expect(result.status).toBe("navigation-started");
		expect(assign).toHaveBeenCalledWith(
			"https://www.crunchyroll.com/watch/GOLD22222/episode-two#anidachiRoom=room-123",
		);
	});

	it("rejects a descriptor outside Crunchyroll", async () => {
		const assign = vi.fn();
		const navigate = vi.fn();
		const ensureSource = createCrunchyrollSourceNavigator({
			assign,
			currentHref: () =>
				"https://www.crunchyroll.com/watch/GOLD11111/episode-one",
			navigate,
		});

		const result = await ensureSource(
			{
				...source(),
				canonicalUrl: "https://example.com/watch/GOLD22222",
				sourceUrl: "https://example.com/watch/GOLD22222",
			},
			context(),
		);

		expect(result).toEqual({
			status: "unsupported",
			reason: "provider-mismatch",
		});
		expect(navigate).not.toHaveBeenCalled();
		expect(assign).not.toHaveBeenCalled();
	});
});

function source(): WatchSourceDescriptor {
	return {
		canonicalUrl:
			"https://www.crunchyroll.com/watch/GOLD22222/episode-two#ignored=value",
		provider: "crunchyroll",
		sourceUrl:
			"https://www.crunchyroll.com/watch/GOLD22222/episode-two#ignored=value",
		title: "Episode two",
		videoFingerprint: "crunchyroll|watch/GOLD22222",
	};
}

function context() {
	return {
		roomId: "room-123",
		roomProvider: "crunchyroll" as const,
		signal: new AbortController().signal,
	};
}
