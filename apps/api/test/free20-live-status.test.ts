import { describe, expect, it } from "vitest";
import { readFree20LiveStatus } from "../src/free20-live-status";
import {
	acknowledgeFree20Accounting,
	createFree20AccountingState,
	prepareFree20Accounting,
} from "../src/free20-room-accounting";
import { createRoomMeterState, reconcileRoomMeter } from "../src/room-metering";

const now = Date.parse("2026-10-31T12:00:00Z");
const binding = {
	ownerUserId: "f6200000-0000-4000-8000-000000000001",
	roomId: "live-status",
	roomGeneration: 1,
	utcDay: "2026-10-31",
};
function fixture(metering = true) {
	const meter = reconcileRoomMeter(createRoomMeterState(), metering, now);
	const pending = prepareFree20Accounting(
		createFree20AccountingState(),
		meter,
		binding,
	);
	const result = acknowledgeFree20Accounting(
		pending,
		meter,
		{
			...binding,
			roomBudgetVersion: 1,
			checkpointSequence: 1,
			serverTime: now,
			resetAt: Date.parse("2026-11-01T00:00:00Z"),
			refreshBy: now + 300_000,
			budgetSeconds: 1200,
			committedSeconds: 420,
			acknowledged: pending.pending?.usage ?? [],
		},
		binding,
		now,
	);
	return {
		binding,
		accounting: result.state,
		meter: result.meter,
		validUntil: now + 250_000,
		terminal: false,
	};
}
describe("read-only live Free20 projection", () => {
	it("combines committed and live time without changing the meter, ACK or checkpoint", () => {
		const state = fixture();
		const before = structuredClone(state);
		const result = readFree20LiveStatus(binding, state, now + 180_000);
		expect(result.access).toEqual({
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 600,
			remainingSeconds: 600,
			metering: true,
		});
		expect(result.validUntil).toBe(state.validUntil);
		expect(state).toEqual(before);
	});
	it("does not spend a solo host's time and does not infer usage from playback", () => {
		expect(
			readFree20LiveStatus(binding, fixture(false), now + 180_000).access
				.remainingSeconds,
		).toBe(780);
	});
	it("rejects wrong account/room/generation and every uncertain accounting state", () => {
		const state = fixture();
		for (const request of [
			{ ...binding, ownerUserId: "f6200000-0000-4000-8000-000000000002" },
			{ ...binding, roomId: "other" },
			{ ...binding, roomGeneration: 2 },
		])
			expect(() => readFree20LiveStatus(request, state, now)).toThrow();
		for (const context of [
			{ ...state, terminal: true },
			{ ...state, accounting: null },
			{ ...state, validUntil: now },
			{
				...state,
				accounting: {
					...state.accounting,
					pending: prepareFree20Accounting(
						state.accounting,
						state.meter,
						binding,
					).pending,
				},
			},
			{ ...state, meter: { ...state.meter, accountingBlocked: true } },
		])
			expect(() => readFree20LiveStatus(binding, context, now)).toThrow();
		expect(() =>
			readFree20LiveStatus(binding, state, Date.parse("2026-11-01T00:00:00Z")),
		).toThrow();
	});
});
