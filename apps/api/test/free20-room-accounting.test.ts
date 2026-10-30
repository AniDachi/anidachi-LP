import { describe, expect, it } from "vitest";
import {
	createFree20AccountingState,
	prepareFree20Accounting,
	acknowledgeFree20Accounting,
	settleFree20Accounting,
	parseFree20AccountingState,
} from "../src/free20-room-accounting";
import { createRoomMeterState, reconcileRoomMeter } from "../src/room-metering";
import { readFree20RoomTime } from "../src/free20-room-budget";

function present<T>(value: T | null | undefined): T {
	if (value == null) throw new Error("Expected test value");
	return value;
}

const now = Date.parse("2026-10-30T12:03:00Z");
const ownerUserId = "8fb7bc8d-49ef-4f43-9de3-1b6b31716c00";
const binding = {
	ownerUserId,
	roomId: "free20-room",
	roomGeneration: 1,
	utcDay: "2026-10-30",
};
const meter = reconcileRoomMeter(
	reconcileRoomMeter(createRoomMeterState(), true, now - 180000),
	false,
	now,
);
const checkpoint = (sequence: number, seconds = 180) => ({
	...binding,
	roomBudgetVersion: 1,
	checkpointSequence: sequence,
	serverTime: now,
	resetAt: Date.parse("2026-10-31T00:00:00Z"),
	refreshBy: now + 60000,
	budgetSeconds: 1200,
	committedSeconds: 420 + seconds,
	acknowledged: [{ day: binding.utcDay, seconds }],
});

describe("durable Free20 accounting workflow", () => {
	it("replays cumulative usage after a lost reply without giving time back or charging twice", () => {
		const first = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		expect(first.pending).toMatchObject({
			checkpointSequence: 1,
			usage: [{ day: binding.utcDay, seconds: 180 }],
		});
		const restored = parseFree20AccountingState(
			JSON.parse(JSON.stringify(first)),
			meter,
		);
		const retry = prepareFree20Accounting(restored, meter, binding);
		expect(present(retry.pending).checkpointSequence).toBe(2);
		expect(present(retry.pending).usage).toEqual(present(first.pending).usage);
		const result = acknowledgeFree20Accounting(
			retry,
			meter,
			checkpoint(2),
			binding,
			now,
		);
		expect(result.state.pending).toBeNull();
		expect(result.meter.acknowledgedSeconds).toBe(180);
		expect(
			readFree20RoomTime(present(result.state.budget), result.meter, now)
				.remainingSeconds,
		).toBe(600);
		expect(() =>
			acknowledgeFree20Accounting(retry, meter, checkpoint(1), binding, now),
		).toThrow();
		expect(() =>
			acknowledgeFree20Accounting(
				result.state,
				result.meter,
				checkpoint(2),
				binding,
				now,
			),
		).toThrow();
	});
	it("a newer cumulative retry covers time accrued while the previous ACK was lost", () => {
		const first = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		const later = { ...meter, accumulatedMs: 200000 };
		const retry = prepareFree20Accounting(first, later, binding);
		const result = acknowledgeFree20Accounting(
			retry,
			later,
			checkpoint(2, 200),
			binding,
			now,
		);
		expect(result.meter.acknowledgedSeconds).toBe(200);
		expect(
			readFree20RoomTime(present(result.state.budget), result.meter, now)
				.remainingSeconds,
		).toBe(580);
	});
	it("rejects torn restore, lower cumulative retries, invalid counters and missing pending request", () => {
		const first = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		expect(() =>
			parseFree20AccountingState(first, { ...meter, accumulatedMs: 179000 }),
		).toThrow();
		expect(() =>
			prepareFree20Accounting(first, { ...meter, accumulatedMs: 0 }, binding),
		).toThrow();
		expect(() =>
			parseFree20AccountingState({ ...first, sequence: 0 }, meter),
		).toThrow();
		const accepted = acknowledgeFree20Accounting(
			first,
			meter,
			checkpoint(1),
			binding,
			now,
		);
		expect(() => parseFree20AccountingState(accepted.state, meter)).toThrow();
		expect(() =>
			prepareFree20Accounting(
				{ ...first, sequence: Number.MAX_SAFE_INTEGER },
				meter,
				binding,
			),
		).toThrow();
	});
	it("terminal settlement accepts only the entire exact pending batch, then clears the finite authority", () => {
		const first = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		for (const acks of [
			[],
			[{ day: binding.utcDay, seconds: 181 }],
			[{ day: "2026-10-29", seconds: 180 }],
		])
			expect(() => settleFree20Accounting(first, meter, acks)).toThrow();
		expect(first.pending).not.toBeNull();
		const result = settleFree20Accounting(
			first,
			meter,
			present(first.pending).usage,
		);
		expect(result.meter.acknowledgedSeconds).toBe(180);
		expect(result.state).toMatchObject({
			sequence: 1,
			pending: null,
			budget: null,
		});
	});
});
