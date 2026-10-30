import { describe, expect, it } from "vitest";
import {
	Free20RoomBudgetCheckpointSchema,
	Free20RoomBudgetRequestSchema,
} from "../src/free20-room-budget";

const at = Date.parse("2026-10-30T12:00:00Z");
const request = {
	roomId: "free20-room",
	roomGeneration: 1,
	checkpointSequence: 1,
	usage: [{ day: "2026-10-30", seconds: 180 }],
};
const checkpoint = {
	roomBudgetVersion: 1,
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	roomId: request.roomId,
	roomGeneration: 1,
	checkpointSequence: 1,
	utcDay: "2026-10-30",
	serverTime: at,
	resetAt: Date.parse("2026-10-31T00:00:00Z"),
	refreshBy: at + 300_000,
	budgetSeconds: 1200,
	committedSeconds: 600,
	acknowledged: request.usage,
};

describe("inactive Free20 room accounting contract", () => {
	it("keeps a raw post-commit account total and cumulative room ACK together", () => {
		expect(Free20RoomBudgetRequestSchema.parse(request)).toEqual(request);
		expect(Free20RoomBudgetCheckpointSchema.parse(checkpoint)).toEqual(
			checkpoint,
		);
		expect(
			Free20RoomBudgetCheckpointSchema.parse({
				...checkpoint,
				committedSeconds: 1500,
			}).committedSeconds,
		).toBe(1500);
	});
	it("rejects ambiguous, duplicate, impossible or unbounded usage days", () => {
		for (const usage of [
			[...request.usage, ...request.usage],
			[{ day: "2026-02-30", seconds: 1 }],
			[{ day: "2026-10-30", seconds: 86_401 }],
			[28, 29, 30].map((day) => ({ day: `2026-10-${day}`, seconds: 1 })),
		])
			expect(
				Free20RoomBudgetRequestSchema.safeParse({ ...request, usage }).success,
			).toBe(false);
		expect(
			Free20RoomBudgetCheckpointSchema.safeParse({
				...checkpoint,
				acknowledged: [...request.usage, ...request.usage],
			}).success,
		).toBe(false);
	});
	it("accepts old-day settlement but never future-day ACK or a mismatched UTC period", () => {
		expect(
			Free20RoomBudgetCheckpointSchema.safeParse({
				...checkpoint,
				acknowledged: [{ day: "2026-10-29", seconds: 120 }],
			}).success,
		).toBe(true);
		for (const change of [
			{ acknowledged: [{ day: "2026-10-31", seconds: 1 }] },
			{ utcDay: "2026-10-29" },
			{ resetAt: checkpoint.resetAt + 1 },
			{ refreshBy: at },
			{ refreshBy: checkpoint.resetAt + 1 },
		])
			expect(
				Free20RoomBudgetCheckpointSchema.safeParse({ ...checkpoint, ...change })
					.success,
			).toBe(false);
	});
	it("does not accept legacy quota, unlimited, unknown versions or unsafe counters", () => {
		for (const change of [
			{ roomBudgetVersion: 2 },
			{ budgetSeconds: 1800 },
			{ committedSeconds: -1 },
			{ committedSeconds: 1.5 },
			{ committedSeconds: Number.MAX_SAFE_INTEGER + 1 },
			{ checkpointSequence: -1 },
			{ roomGeneration: 0 },
			{ ownerUserId: "guest" },
			{ quota: null },
			{ kind: "unlimited" },
		])
			expect(
				Free20RoomBudgetCheckpointSchema.safeParse({ ...checkpoint, ...change })
					.success,
			).toBe(false);
	});
});
