import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createWatchHistoryBrowseCache,
	watchBrowseCacheKey,
	WATCH_BROWSE_MAX_AGE_MS,
} from "../src/watch-history-browse-cache";

afterEach(() => vi.restoreAllMocks());
describe("disposable browse cache", () => {
	it("survives a worker recreation, bounds its size and expires instead of becoming another history store", async () => {
		let saved: unknown = [];
		const adapter = {
			read: async () => structuredClone(saved),
			write: async (value: unknown) => {
				saved = structuredClone(value);
			},
		};
		const first = createWatchHistoryBrowseCache(adapter);
		const key = await watchBrowseCacheKey(["owner", "refresh-secret", "query"]);
		await first.write(key, { items: ["visible"] });
		expect(JSON.stringify(saved)).not.toContain("refresh-secret");
		const second = createWatchHistoryBrowseCache(adapter);
		expect((await second.read(key))?.data).toEqual({ items: ["visible"] });
		vi.spyOn(Date, "now").mockReturnValue(Date.now() + WATCH_BROWSE_MAX_AGE_MS);
		expect(await second.read(key)).toBeNull();
		for (let index = 0; index < 40; index++)
			await second.write(
				await watchBrowseCacheKey([index]),
				"x".repeat(60_000),
			);
		expect(
			new TextEncoder().encode(JSON.stringify(saved)).byteLength,
		).toBeLessThanOrEqual(1_000_000);
		expect((saved as unknown[]).length).toBeLessThanOrEqual(32);
	});

	it("falls back to memory when browser cache storage fails", async () => {
		const cache = createWatchHistoryBrowseCache({
			read: async () => {
				throw Error("unavailable");
			},
			write: async () => {
				throw Error("quota");
			},
		});
		const key = await watchBrowseCacheKey([1]);
		await expect(cache.write(key, { ok: true })).resolves.toBeUndefined();
		expect((await cache.read(key))?.data).toEqual({ ok: true });
	});
});
