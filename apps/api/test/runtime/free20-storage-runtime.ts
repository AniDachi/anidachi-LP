import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import {
	readStoredRoomMeter,
	writeStoredFree20Accounting,
	readStoredFree20Accounting,
} from "../../src/room-persistence";
import {
	createRoomMeterState,
	type RoomMeterState,
	reconcileRoomMeter,
} from "../../src/room-metering";
import {
	createFree20AccountingState,
	type Free20AccountingState,
	prepareFree20Accounting,
	acknowledgeFree20Accounting,
} from "../../src/free20-room-accounting";
const now = Date.parse("2026-10-30T12:00:00Z");
afterEach(async () => {
	vi.restoreAllMocks();
	await reset();
});
it("rolls back meter and Free20 ACK/budget together, including a failed identical retry", async () => {
	const ns = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
	await runInDurableObject(
		ns.get(ns.idFromName(`free20-storage-${crypto.randomUUID()}`)),
		(_i, ctx) => {
			const runtime = _i as unknown as {
				roomMeter: RoomMeterState;
				free20Accounting: Free20AccountingState;
				persistFree20Accounting(
					meter: RoomMeterState,
					accounting: Free20AccountingState,
					at: number,
				): void;
			};
			const meter = reconcileRoomMeter(
				reconcileRoomMeter(createRoomMeterState(), true, now - 180000),
				false,
				now,
			);
			const binding = {
				ownerUserId: "11111111-1111-4111-8111-111111111111",
				roomId: "room",
				roomGeneration: 1,
				utcDay: "2026-10-30",
			};
			const pending = prepareFree20Accounting(
				createFree20AccountingState(),
				meter,
				binding,
			);
			runtime.persistFree20Accounting(meter, pending, now);
			const next = acknowledgeFree20Accounting(
				pending,
				meter,
				{
					...binding,
					roomBudgetVersion: 1,
					checkpointSequence: 1,
					serverTime: now,
					refreshBy: now + 300000,
					resetAt: Date.parse("2026-10-31T00:00:00Z"),
					budgetSeconds: 1200,
					committedSeconds: 600,
					acknowledged: pending.pending?.usage ?? [],
				},
				binding,
				now,
			);
			const exec = ctx.storage.sql.exec.bind(ctx.storage.sql);
			const fail = vi
				.spyOn(ctx.storage.sql, "exec")
				.mockImplementation((query, ...args) => {
					if (
						/INSERT INTO room_meta/.test(query) &&
						args[0] === "room_free20_accounting_v1"
					)
						throw new Error("injected ACK storage failure");
					return exec(query, ...args);
				});
			expect(() =>
				runtime.persistFree20Accounting(next.meter, next.state, now),
			).toThrow("injected ACK storage failure");
			fail.mockRestore();
			expect(runtime.roomMeter).toEqual(meter);
			expect(runtime.free20Accounting).toEqual(pending);
			expect(readStoredRoomMeter(ctx.storage)).toEqual(meter);
			expect(readStoredFree20Accounting(ctx.storage, meter)).toEqual(pending);
			writeStoredFree20Accounting(ctx.storage, next.meter, next.state, now);
			expect(readStoredRoomMeter(ctx.storage)).toEqual(next.meter);
			expect(readStoredFree20Accounting(ctx.storage, next.meter)).toEqual(
				next.state,
			);
			expect(() => readStoredFree20Accounting(ctx.storage, meter)).toThrow();
		},
	);
});
