import { describe, expect, it } from "vitest";
import {
	createRoomMeterState,
	reconcileRoomMeter,
	roomUsageBuckets,
	acknowledgeRoomUsageDay,
	parseRoomMeterState,
} from "../src/room-metering";
describe("UTC cumulative meter", () => {
	it("splits midnight exactly and acknowledges cumulative totals idempotently", () => {
		let state = reconcileRoomMeter(
			createRoomMeterState(),
			true,
			Date.parse("2026-09-08T23:58:00Z"),
		);
		state = reconcileRoomMeter(
			state,
			false,
			Date.parse("2026-09-09T00:03:00Z"),
		);
		expect(roomUsageBuckets(state)).toEqual([
			{ day: "2026-09-08", seconds: 120 },
			{ day: "2026-09-09", seconds: 180 },
		]);
		state = acknowledgeRoomUsageDay(state, "2026-09-08", 120);
		state = acknowledgeRoomUsageDay(state, "2026-09-08", 120);
		expect(roomUsageBuckets(state)).toEqual([
			{ day: "2026-09-09", seconds: 180 },
		]);
		expect(parseRoomMeterState(JSON.parse(JSON.stringify(state)))).toEqual(
			state,
		);
		state = reconcileRoomMeter(
			state,
			false,
			Date.parse("2026-09-09T00:13:00Z"),
		);
		expect(roomUsageBuckets(state)).toEqual([
			{ day: "2026-09-09", seconds: 180 },
		]);
	});
	it("fails closed on too many unsettled days without losing accepted buckets", () => {
		let state = reconcileRoomMeter(createRoomMeterState(), true, 0);
		state = reconcileRoomMeter(state, true, 10 * 86400000);
		expect(state.accountingBlocked).toBe(true);
		expect(state.activeSince).toBeNull();
		expect(roomUsageBuckets(state).length).toBeLessThanOrEqual(2);
	});
});
