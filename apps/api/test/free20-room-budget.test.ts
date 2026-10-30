import type { Free20RoomBudgetCheckpoint } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
	readFree20RoomTime,
	reconcileFree20RoomBudget,
} from "../src/free20-room-budget";
import {
	createRoomMeterState,
	parseRoomMeterState,
	reconcileRoomMeter,
	roomUsageBuckets,
} from "../src/room-metering";

const start = Date.parse("2026-10-30T12:00:00Z");
const binding = {
	ownerUserId: "11111111-1111-4111-8111-111111111111",
	roomId: "free20-room",
	roomGeneration: 1,
	utcDay: "2026-10-30",
};
function checkpoint(
	committedSeconds = 420,
	seconds?: number,
): Free20RoomBudgetCheckpoint {
	return {
		...binding,
		roomBudgetVersion: 1,
		checkpointSequence: 1,
		serverTime: start,
		resetAt: Date.parse("2026-10-31T00:00:00Z"),
		refreshBy: start + 300_000,
		budgetSeconds: 1200,
		committedSeconds,
		acknowledged:
			seconds === undefined ? [] : [{ day: binding.utcDay, seconds }],
	};
}
function apply(
	body = checkpoint(),
	meter = reconcileRoomMeter(createRoomMeterState(), true, start),
	previous:
		| ReturnType<typeof reconcileFree20RoomBudget>["budget"]
		| null = null,
	now = start,
) {
	return reconcileFree20RoomBudget(body, {
		binding,
		meter,
		previous,
		now,
		request: {
			roomId: binding.roomId,
			roomGeneration: 1,
			checkpointSequence: body.checkpointSequence,
			usage: roomUsageBuckets(meter),
		},
	});
}

describe("inactive Free20 reconciliation on the existing durable meter", () => {
	it("keeps 7 committed + 3 live minutes at 10 remaining before and after saving", () => {
		const initial = apply();
		const later = start + 180_000;
		expect(
			readFree20RoomTime(initial.budget, initial.meter, later).remainingSeconds,
		).toBe(600);
		const stopped = reconcileRoomMeter(initial.meter, false, later);
		const meter = reconcileRoomMeter(stopped, true, later);
		const body = {
			...checkpoint(600, 180),
			checkpointSequence: 2,
			serverTime: later,
			refreshBy: later + 300_000,
		};
		const saved = apply(body, meter, initial.budget, later);
		expect(saved.budget.allowedSeconds).toBe(780);
		expect(saved.meter.acknowledgedSeconds).toBe(180);
		expect(readFree20RoomTime(saved.budget, saved.meter, later)).toEqual({
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 600,
			remainingSeconds: 600,
			metering: true,
		});
		expect(roomUsageBuckets(saved.meter)).toEqual([]);
	});
	it("retries a lost response after restart without charging or returning saved seconds", () => {
		const initial = apply();
		const later = start + 180_000;
		const durable = reconcileRoomMeter(
			reconcileRoomMeter(initial.meter, false, later),
			true,
			later,
		);
		// The server saved 180; the DO lost the response and recovers its pre-I/O checkpoint.
		const restored = parseRoomMeterState(JSON.parse(JSON.stringify(durable)));
		if (!restored) throw new Error("Expected a valid durable meter");
		const body = {
			...checkpoint(600, 180),
			checkpointSequence: 3,
			serverTime: later,
			refreshBy: later + 300_000,
		};
		const saved = apply(
			body,
			restored,
			JSON.parse(JSON.stringify(initial.budget)),
			later,
		);
		expect(
			readFree20RoomTime(saved.budget, saved.meter, later).remainingSeconds,
		).toBe(600);
		expect(() => apply(body, saved.meter, saved.budget, later)).toThrow();
		expect(
			readFree20RoomTime(saved.budget, saved.meter, later + 10_000)
				.remainingSeconds,
		).toBe(590);
	});
	it("stops while alone and resumes the same budget on guest reconnect", () => {
		const { budget, meter } = apply();
		const alone = reconcileRoomMeter(meter, false, start + 60_000);
		expect(readFree20RoomTime(budget, alone, start + 180_000)).toMatchObject({
			remainingSeconds: 720,
			metering: false,
		});
		const rejoined = reconcileRoomMeter(alone, true, start + 180_000);
		expect(readFree20RoomTime(budget, rejoined, start + 240_000)).toMatchObject(
			{ remainingSeconds: 660, metering: true },
		);
		expect(reconcileRoomMeter(rejoined, true, start + 200_000)).toBe(rejoined);
	});
	it("never refunds a same-day allowance when a later ledger read decreases", () => {
		const initial = apply();
		const next = apply(
			{ ...checkpoint(0), checkpointSequence: 2 },
			initial.meter,
			initial.budget,
		);
		expect(next.budget.allowedSeconds).toBe(780);
	});
	it("clamps account overshoot without manufacturing a new allowance", () => {
		const meter = {
			...createRoomMeterState(),
			day: binding.utcDay,
			accumulatedMs: 180_000,
		};
		const saved = apply(checkpoint(1500, 180), meter);
		expect(saved.budget.allowedSeconds).toBe(0);
		expect(
			readFree20RoomTime(saved.budget, saved.meter, start).remainingSeconds,
		).toBe(0);
	});
	it("rejects a torn restore that keeps the budget but loses its acknowledged meter", () => {
		const saved = apply(checkpoint(600, 180), {
			...createRoomMeterState(),
			day: binding.utcDay,
			accumulatedMs: 180_000,
		});
		const lost = { ...createRoomMeterState(), day: binding.utcDay };
		expect(() => readFree20RoomTime(saved.budget, lost, start)).toThrow();
		expect(() =>
			apply({ ...checkpoint(600), checkpointSequence: 2 }, lost, saved.budget),
		).toThrow();
	});
	it("requires the whole same-request ACK before making any local changes", () => {
		const meter = {
			...createRoomMeterState(),
			day: binding.utcDay,
			accumulatedMs: 180_000,
			pending: [{ day: "2026-10-29", seconds: 120 }],
		};
		const original = structuredClone(meter);
		for (const acknowledged of [
			[],
			[{ day: binding.utcDay, seconds: 179 }],
			[{ day: binding.utcDay, seconds: 181 }, ...meter.pending],
			[{ day: binding.utcDay, seconds: 180 }],
			[
				{ day: binding.utcDay, seconds: 180 },
				{ day: "2026-10-28", seconds: 120 },
			],
		])
			expect(() =>
				apply({ ...checkpoint(600), acknowledged }, meter),
			).toThrow();
		expect(meter).toEqual(original);
		const saved = apply(
			{ ...checkpoint(600), acknowledged: roomUsageBuckets(meter) },
			meter,
		);
		expect(saved.meter.pending).toEqual([]);
		expect(saved.budget.allowedSeconds).toBe(780);
	});
	it("rejects account totals below the room ACK and corrupt or blocked meters", () => {
		const meter = {
			...createRoomMeterState(),
			day: binding.utcDay,
			accumulatedMs: 180_000,
		};
		expect(() => apply(checkpoint(100, 180), meter)).toThrow();
		for (const change of [
			{ accountingBlocked: true },
			{ acknowledgedSeconds: 181 },
			{ activeSince: start + 1 },
			{ accumulatedMs: NaN },
		]) {
			expect(() =>
				apply(checkpoint(600, 180), { ...meter, ...change }),
			).toThrow();
		}
	});
	it("fences owner, room, generation, day, request and response ordering", () => {
		const initial = apply();
		for (const change of [
			{ ownerUserId: "22222222-2222-4222-8222-222222222222" },
			{ roomId: "another-room" },
			{ roomGeneration: 2 },
			{ utcDay: "2026-10-29" },
			{ checkpointSequence: 0 },
			{ serverTime: start - 1 },
		])
			expect(() =>
				apply(
					{ ...checkpoint(), checkpointSequence: 2, ...change },
					initial.meter,
					initial.budget,
				),
			).toThrow();
		for (const expected of [null, { ...binding, roomGeneration: 2 }]) {
			expect(() =>
				reconcileFree20RoomBudget(checkpoint(), {
					binding: expected,
					meter: initial.meter,
					previous: null,
					now: start,
					request: {
						roomId: binding.roomId,
						roomGeneration: 1,
						checkpointSequence: 7,
						usage: [],
					},
				}),
			).toThrow();
		}
	});
	it("does not reuse stale authority or silently give a new day budget", () => {
		const initial = apply();
		expect(() =>
			readFree20RoomTime(initial.budget, initial.meter, start + 300_000),
		).toThrow();
		expect(() =>
			apply(checkpoint(), initial.meter, null, start + 300_000),
		).toThrow();
		expect(() =>
			readFree20RoomTime(
				initial.budget,
				initial.meter,
				initial.budget.checkpoint.resetAt,
			),
		).toThrow();
	});
	it("settles yesterday separately and counts only the current day after midnight", () => {
		const midnight = Date.parse("2026-10-30T00:00:00Z");
		const meter = reconcileRoomMeter(
			reconcileRoomMeter(createRoomMeterState(), true, midnight - 120_000),
			false,
			midnight + 180_000,
		);
		expect(roomUsageBuckets(meter)).toEqual([
			{ day: "2026-10-29", seconds: 120 },
			{ day: binding.utcDay, seconds: 180 },
		]);
		const body = {
			...checkpoint(180),
			acknowledged: roomUsageBuckets(meter),
			serverTime: midnight + 180_000,
			refreshBy: midnight + 480_000,
		};
		const saved = apply(body, meter, null, midnight + 180_000);
		expect(saved.budget.allowedSeconds).toBe(1200);
		expect(
			readFree20RoomTime(saved.budget, saved.meter, midnight + 180_000)
				.remainingSeconds,
		).toBe(1020);
	});
});
