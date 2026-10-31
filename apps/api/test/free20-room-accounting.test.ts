import { describe, expect, it } from "vitest";
import {
	acknowledgeFree20Accounting,
	createFree20AccountingState,
	parseFree20AccountingState,
	prepareFree20Accounting,
	settleFree20Accounting,
} from "../src/free20-room-accounting";
import { readFree20RoomTime } from "../src/free20-room-budget";
import { createRoomMeterState, reconcileRoomMeter } from "../src/room-metering";

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

const unlimited = (sequence: number) => ({
	...binding,
	roomTimeVersion: 1,
	kind: "confirmed_unlimited",
	authority: "account_entitlements_v1",
	planCode: "plus",
	checkpointSequence: sequence,
	serverTime: now,
	resetAt: Date.parse("2026-10-31T00:00:00Z"),
	refreshBy: now + 60000,
	acknowledged: [{ day: binding.utcDay, seconds: 180 }],
});

describe("confirmed unlimited Free20 accounting", () => {
	it("migrates a prior finite schema1 row without dropping its pending request", () => {
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		const { unlimited: _right, ...finite } = pending;
		const restored = parseFree20AccountingState(
			{ ...finite, schemaVersion: 1 },
			meter,
		);
		expect(restored.schemaVersion).toBe(2);
		expect(restored.unlimited).toBeNull();
		expect(restored.pending?.usage).toEqual([
			{ day: binding.utcDay, seconds: 180 },
		]);
	});
	it("atomically acknowledges the request and freezes the I/O tail for later settlement", () => {
		const active = reconcileRoomMeter(meter, true, now);
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			active,
			binding,
		);
		const accepted = acknowledgeFree20Accounting(
			pending,
			active,
			unlimited(1),
			binding,
			now + 2000,
		);
		expect(accepted.meter).toMatchObject({
			activeSince: null,
			accumulatedMs: 182000,
			acknowledgedSeconds: 180,
		});
		expect(accepted.state).toMatchObject({
			schemaVersion: 2,
			pending: null,
			budget: null,
			unlimited: unlimited(1),
		});
		const restored = parseFree20AccountingState(
			JSON.parse(JSON.stringify(accepted.state)),
			accepted.meter,
		);
		const retry = prepareFree20Accounting(restored, accepted.meter, binding);
		expect(retry.pending?.usage).toEqual([
			{ day: binding.utcDay, seconds: 182 },
		]);
		const renewed = acknowledgeFree20Accounting(
			retry,
			accepted.meter,
			{
				...unlimited(2),
				acknowledged: [{ day: binding.utcDay, seconds: 182 }],
			},
			binding,
			now + 10000,
		);
		expect(renewed.meter).toMatchObject({
			activeSince: null,
			accumulatedMs: 182000,
			acknowledgedSeconds: 182,
		});
		expect(
			prepareFree20Accounting(renewed.state, renewed.meter, binding).pending
				?.usage,
		).toEqual([]);
	});
	it("rejects foreign, stale, incomplete or expired time rights without changing pending usage", () => {
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		for (const change of [
			{ ownerUserId: "11111111-1111-4111-8111-111111111111" },
			{ roomGeneration: 2 },
			{ checkpointSequence: 0 },
			{ refreshBy: now },
			{ serverTime: now + 1 },
			{ authority: "checkout_return" },
			{ planCode: "free" },
			{ acknowledged: [] },
			{ acknowledged: [{ day: binding.utcDay, seconds: 181 }] },
		])
			expect(() =>
				acknowledgeFree20Accounting(
					pending,
					meter,
					{ ...unlimited(1), ...change },
					binding,
					now,
				),
			).toThrow();
		expect(pending.pending?.usage).toEqual([
			{ day: binding.utcDay, seconds: 180 },
		]);
	});
	it("resumes only the saved daily remainder when authority returns Free, without charging the unlimited interval", () => {
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		const accepted = acknowledgeFree20Accounting(
			pending,
			meter,
			unlimited(1),
			binding,
			now,
		);
		const next = prepareFree20Accounting(
			accepted.state,
			accepted.meter,
			binding,
		);
		const finite = acknowledgeFree20Accounting(
			next,
			accepted.meter,
			{
				...checkpoint(2),
				serverTime: now + 60000,
				refreshBy: now + 120000,
				acknowledged: [],
			},
			binding,
			now + 60000,
		);
		expect(finite.state.unlimited).toBeNull();
		expect(finite.meter.accumulatedMs).toBe(180000);
		expect(
			readFree20RoomTime(
				present(finite.state.budget),
				finite.meter,
				now + 60000,
			).remainingSeconds,
		).toBe(600);
	});
	it("rejects a torn unlimited restore with a running meter or lost ACK", () => {
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		const accepted = acknowledgeFree20Accounting(
			pending,
			meter,
			unlimited(1),
			binding,
			now,
		);
		expect(() =>
			parseFree20AccountingState(accepted.state, {
				...accepted.meter,
				activeSince: now,
			}),
		).toThrow();
		expect(() => parseFree20AccountingState(accepted.state, meter)).toThrow();
		expect(() =>
			parseFree20AccountingState(
				{ ...accepted.state, schemaVersion: 1 },
				accepted.meter,
			),
		).toThrow();
	});
	it("cannot rebind a previously unlimited room when returning to daily Free", () => {
		const pending = prepareFree20Accounting(
			createFree20AccountingState(),
			meter,
			binding,
		);
		const accepted = acknowledgeFree20Accounting(
			pending,
			meter,
			unlimited(1),
			binding,
			now,
		);
		const retry = prepareFree20Accounting(
			accepted.state,
			accepted.meter,
			binding,
		);
		const other = {
			...binding,
			ownerUserId: "11111111-1111-4111-8111-111111111111",
		};
		expect(() =>
			acknowledgeFree20Accounting(
				retry,
				accepted.meter,
				{
					...checkpoint(2),
					...other,
					acknowledged: [],
				},
				other,
				now,
			),
		).toThrow();
	});
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
