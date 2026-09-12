import { expect, it } from "vitest";
import { WATCH_HISTORY_PROVIDER_LIMITS, WatchHistoryCapacitySchema } from "../src/watch-history-capacity";
const capacity = {
	capacityVersion: 1, ownerUserId: "11111111-1111-4111-8111-111111111111",
	accountGeneration: 1, serverTime: "2026-09-09T00:00:00.000Z",
	providers: { youtube: { used: 101, limit: 100 }, crunchyroll: { used: 250, limit: 200 } },
};
it("preserves actual counts above each provider limit", () => {
	expect(WATCH_HISTORY_PROVIDER_LIMITS).toEqual({ youtube: 100, crunchyroll: 200 });
	expect(WatchHistoryCapacitySchema.parse(capacity)).toEqual(capacity);
});
it("rejects wrong versions, owners, generations, limits, counts, and unknown fields", () => {
	for (const invalid of [
		{ ...capacity, capacityVersion: 2 }, { ...capacity, ownerUserId: "other" },
		{ ...capacity, accountGeneration: 0 }, { ...capacity, serverTime: "today" }, { ...capacity, plan: "plus" },
		...[-1, 0.5, Infinity].map(used => ({ ...capacity, providers: { ...capacity.providers, youtube: { used, limit: 100 } } })),
		{ ...capacity, providers: { ...capacity.providers, youtube: { used: 1, limit: 200 } } },
		{ ...capacity, providers: { ...capacity.providers, youtube: { used: 1, limit: 100, full: false } } },
	]) expect(WatchHistoryCapacitySchema.safeParse(invalid).success).toBe(false);
});
