import { describe, expect, it } from "vitest";
import {
	isWatchSpecialSeasonLabel,
	WatchHistoryGridQuerySchema,
	WatchHistoryGridResponseSchema,
} from "../src/watch-history-grid";

const empty = {
	meta: {
		schemaVersion: 3,
		ownerUserId: "00000000-0000-4000-8000-000000000001",
		accountGeneration: 1,
		serverTime: "2026-09-06T00:00:00.000Z",
	},
	provider: "crunchyroll",
	titleKey: "crunchyroll:series:S",
	state: "unavailable",
	revision: null,
	seasonKey: null,
	seasons: [],
	episodes: [],
	mainAggregate: null,
	specialsAggregate: null,
	nextCursor: null,
};

describe("episode grid contract", () => {
	it("admits opted-in observed Prime episodes without inventing catalog totals", () => {
		const id = "0INEYNSINLQC82ZUIFLK7VNV09";
		const episode = "0GZG3MEMW58HH47GE4QV0Z1OOR";
		expect(WatchHistoryGridQuerySchema.safeParse({provider:"primevideo",titleKey:`primevideo:series:${id}`,includePartial:true}).success).toBe(true);
		const observed = {...empty,provider:"primevideo",titleKey:`primevideo:series:${id}`,state:"partial",revision:"observed-1",seasonKey:`primevideo:season:${id}`,
			seasons:[{seasonKey:`primevideo:season:${id}`,seasonTitle:"Season 1",seasonNumber:1,order:0,kind:"season",aggregate:null,nextEpisode:null}],
			episodes:[{episodeKey:`primevideo:episode:${episode}`,episodeTitle:"Episode 1",episodeNumber:1,seasonKey:`primevideo:season:${id}`,order:0,releasedAt:null,available:true,sourceUrl:`https://www.primevideo.com/detail/${episode}`,history:null}]};
		expect(WatchHistoryGridResponseSchema.safeParse(observed).success).toBe(true);
		for(const patch of [{revision:null},{state:"unavailable"},{state:"complete"},{mainAggregate:{completedEpisodes:0,availableEpisodes:1,progress:0}},
			{seasons:[{...observed.seasons[0],aggregate:{completedEpisodes:0,availableEpisodes:1,progress:0}}]}])
			expect(WatchHistoryGridResponseSchema.safeParse({...observed,...patch}).success).toBe(false);
	});
	it("requires bounded owner-free catalog queries", () => {
		const input = { provider: "crunchyroll", titleKey: "series" };
		expect(WatchHistoryGridQuerySchema.parse(input).limit).toBe(50);
		for (const patch of [
			{ limit: 51 },
			{ limit: 0 },
			{ userId: "other" },
			{ mode: "shared" },
			{ cursor: "x".repeat(2049) },
		]) {
			expect(
				WatchHistoryGridQuerySchema.safeParse({ ...input, ...patch }).success,
			).toBe(false);
		}
	});
	it("classifies explicit source labels only", () => {
		for (const label of [
			"Specials",
			"Special episode",
			"OVA",
			"OADs",
			"Спецвыпуски",
		])
			expect(isWatchSpecialSeasonLabel(label)).toBe(true);
		for (const label of [
			"Season 0",
			"Season 1",
			"E0",
			"12.5",
			"My Special Academy",
		])
			expect(isWatchSpecialSeasonLabel(label)).toBe(false);
	});
	it("rejects exact data on incomplete catalogs and inconsistent completed counts", () => {
		expect(WatchHistoryGridResponseSchema.safeParse(empty).success).toBe(true);
		expect(
			WatchHistoryGridResponseSchema.safeParse({
				...empty,
				mainAggregate: {
					completedEpisodes: 0,
					availableEpisodes: 12,
					progress: 0,
				},
			}).success,
		).toBe(false);
		for (const mainAggregate of [
			{ completedEpisodes: 2, availableEpisodes: 1, progress: 1 },
			{ completedEpisodes: 1, availableEpisodes: 2, progress: 0.9 },
			{ completedEpisodes: 0, availableEpisodes: null, progress: null },
		])
			expect(
				WatchHistoryGridResponseSchema.safeParse({
					...empty,
					state: "complete",
					revision: "one",
					mainAggregate,
				}).success,
			).toBe(false);
	});
});
