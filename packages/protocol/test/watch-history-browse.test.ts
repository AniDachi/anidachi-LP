import { describe, expect, it } from "vitest";
import * as protocol from "../src/index";

describe("watch history browse contract", () => {
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
