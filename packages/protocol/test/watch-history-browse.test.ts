import { describe, expect, it } from "vitest";
import * as protocol from "../src/index";

describe("watch history browse contract", () => {
	it("accepts optional bounded episode previews without adding a UI filter", () => {
		const timestamp = "2026-09-05T00:00:00Z";
		const preview = {
			detail: {
				meta: {
					serverTime: timestamp,
					schemaVersion: 3,
					ownerUserId: "11111111-1111-4111-8111-111111111111",
					accountGeneration: 1,
				},
				generatedAt: timestamp,
				provider: "crunchyroll",
				titleKey: "title",
				observedEpisodeCount: 9,
				completedEpisodeCount: 0,
				episodes: Array.from({ length: 8 }, (_, index) => ({
					episodeKey: `episode${index}`,
					episodeTitle: "Episode",
					seasonKey: null,
					seasonTitle: null,
					seasonNumber: null,
					episodeNumber: null,
					sourceUrl: "https://www.crunchyroll.com/watch/example",
					currentTime: 5,
					duration: 10,
					progress: 0.5,
					completedAt: null,
					lastWatchedAt: timestamp,
					sessions: [],
				})),
				catalog: {
					state: "unavailable",
					title: null,
					aggregate: null,
					seasons: [],
				},
				complete: true,
				nextCursor: null,
			},
			matches: [],
			groups: [],
		};
		expect(
			protocol.WatchHistoryBrowseResponseSchema.shape.episodePreviews?.safeParse(
				[],
			).success,
		).toBe(true);
		expect(
			protocol.WatchHistoryBrowseResponseSchema.shape.episodePreviews.safeParse(
				Array(51).fill(preview),
			).success,
		).toBe(false);
		expect(
			protocol.WatchHistoryBrowseResponseSchema.shape.episodePreviews.safeParse(
				Array(50).fill(preview),
			).success,
		).toBe(true);
		preview.detail.episodes.push(
			...preview.detail.episodes
				.slice(0, 1)
				.map((episode) => ({ ...episode, episodeKey: "ninth" })),
		);
		expect(
			protocol.WatchHistoryBrowseResponseSchema.shape.episodePreviews.safeParse(
				[preview],
			).success,
		).toBe(false);
		expect(
			protocol.WatchHistoryBrowseQuerySchema.safeParse({
				mode: "solo",
				includeEpisodePreviews: true,
			}).success,
		).toBe(false);
	});
	it("exports a validated browse boundary", () => {
		expect(protocol).toHaveProperty("WatchHistoryBrowseQuerySchema");
	});
	it("rejects solo social filters, reversed dates and unknown ownership fields", () => {
		const schema = protocol.WatchHistoryBrowseQuerySchema;
		expect(schema).toBeDefined();
		for (const query of [
			{ mode: "solo", groupId: "11111111-1111-4111-8111-111111111111" },
			{
				mode: "solo",
				participantUserId: "11111111-1111-4111-8111-111111111111",
			},
			{
				mode: "shared",
				from: "2026-09-05T00:00:00Z",
				until: "2026-09-04T00:00:00Z",
			},
			{
				mode: "shared",
				from: "2026-09-05T00:00:00Z",
				until: "2026-09-05T00:00:00Z",
			},
			{ mode: "shared", userId: "11111111-1111-4111-8111-111111111111" },
			{ mode: "shared", limit: 51 },
			{ mode: "shared", cursor: "bad cursor" },
		])
			expect(schema.safeParse(query).success).toBe(false);
	});
	it("normalizes search and supplies a bounded page default", () => {
		const schema = protocol.WatchHistoryBrowseQuerySchema;
		expect(schema).toBeDefined();
		expect(schema.parse({ mode: "shared", search: "  Naruto  " })).toEqual({
			mode: "shared",
			search: "Naruto",
			limit: 20,
		});
	});
});
