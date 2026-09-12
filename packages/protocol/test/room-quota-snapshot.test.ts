import { describe, it, expect } from "vitest";
import { RoomQuotaSnapshotSchema, ServerEventSchema } from "../src/index";
describe("authoritative Free v2 room quota snapshot", () => {
	const quota = {
		day: "2026-09-08",
		remainingSeconds: 1200,
		metering: true,
		measuredAt: 1788825600000,
	};
	it("keeps legacy snapshots compatible and preserves the additive budget", () => {
		const legacy = {
			type: "ROOM_SNAPSHOT",
			roomId: "room",
			roomGeneration: 1,
			sourceGeneration: 1,
			serverSeq: 1,
			participants: [],
		};
		expect(ServerEventSchema.parse(legacy)).toEqual(legacy);
		expect(ServerEventSchema.parse({ ...legacy, quota })).toEqual({
			...legacy,
			quota,
		});
	});
	it("rejects invalid UTC days, excess Free budget and unbounded/extra values", () => {
		for (const value of [
			{ ...quota, day: "2026-02-30" },
			{ ...quota, remainingSeconds: 1801 },
			{ ...quota, remainingSeconds: -1 },
			{ ...quota, remainingSeconds: 1.1 },
			{ ...quota, measuredAt: -1 },
			{ ...quota, metering: "true" },
			{ ...quota, authority: "client" },
		])
			expect(RoomQuotaSnapshotSchema.safeParse(value).success).toBe(false);
	});
});
