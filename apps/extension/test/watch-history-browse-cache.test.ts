import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createWatchHistoryBrowseCache,
	WATCH_BROWSE_MAX_AGE_MS,
	watchBrowseCacheKey,
} from "../src/watch-history-browse-cache";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
describe("bounded persistent browse cache", () => {
	it("does not let a late older revision replace a newer saved read", async () => {
		const cache = createWatchHistoryBrowseCache({
			read: async () => [],
			write: async () => undefined,
		});
		const key = await watchBrowseCacheKey(["one-query"]);
		await cache.write(key, { title: "Newer" }, 4);
		await cache.write(key, { title: "Older" }, 3);
		expect((await cache.read(key))?.data).toEqual({ title: "Newer" });
	});
	it("keeps saved reads after a browser restart without relying on session storage", async () => {
		const local: Record<string, unknown> = {};
		let session: Record<string, unknown> = {};
		vi.stubGlobal("chrome", {
			storage: {
				local: {
					get: async (key: string) => ({ [key]: local[key] }),
					set: async (value: object) => {
						Object.assign(local, value);
					},
				},
				session: {
					get: async (key: string) => ({ [key]: session[key] }),
					set: async (value: object) => {
						Object.assign(session, value);
					},
				},
			},
		});
		const key = await watchBrowseCacheKey(["owner", "solo"]);
		await createWatchHistoryBrowseCache().write(key, {
			episodes: ["Known episode"],
		});
		session = {};
		vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60 * 60_000);
		expect((await createWatchHistoryBrowseCache().read(key))?.data).toEqual({
			episodes: ["Known episode"],
		});
	});
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
