import { describe, expect, it } from "vitest";
import {
	AccountHostingStatusSchema,
	Free20LiveStatusSchema,
	acceptAccountHostingStatus,
} from "../src/account-hosting-status";

const owner = "f6200000-0000-4000-8000-000000000001";
const now = Date.parse("2026-10-31T12:00:00Z");
const free = {
	accountHostingVersion: 1,
	ownerUserId: owner,
	planCode: "free",
	serverTime: now,
	validUntil: now + 60_000,
	period: { utcDay: "2026-10-31", resetAt: Date.parse("2026-11-01T00:00:00Z") },
	access: {
		kind: "daily_free",
		budgetSeconds: 1200,
		usedSeconds: 420,
		remainingSeconds: 780,
		metering: false,
	},
	activeRoom: null,
	canCreateRoom: true,
};
describe("account hosting display contract", () => {
	it("accepts idle Free20, exhausted, and a live host without granting a second room", () => {
		expect(AccountHostingStatusSchema.parse(free).canCreateRoom).toBe(true);
		expect(
			AccountHostingStatusSchema.parse({
				...free,
				access: { ...free.access, usedSeconds: 1200, remainingSeconds: 0 },
				canCreateRoom: false,
			}).canCreateRoom,
		).toBe(false);
		expect(
			AccountHostingStatusSchema.parse({
				...free,
				access: { ...free.access, metering: true },
				activeRoom: { roomId: "live-room", role: "host" },
				canCreateRoom: false,
			}).access.kind,
		).toBe("daily_free");
	});
	it("requires an explicit current unlimited source with a bounded read lifetime", () => {
		for (const source of ["paid", "trial", "manual"] as const) {
			const paid = {
				...free,
				planCode: "plus",
				access: {
					kind: "confirmed_unlimited",
					source,
					validUntil: source === "manual" ? null : now + 120_000,
				},
			};
			expect(AccountHostingStatusSchema.safeParse(paid).success).toBe(true);
		}
		for (const source of ["paid", "trial"])
			expect(
				AccountHostingStatusSchema.safeParse({
					...free,
					planCode: "pro",
					access: { kind: "confirmed_unlimited", source, validUntil: null },
				}).success,
			).toBe(false);
	});
	it("rejects invented or internally contradictory rights", () => {
		for (const bad of [
			{ access: null },
			{ access: { kind: "unknown" } },
			{ accountHostingVersion: 2 },
			{ access: { ...free.access, budgetSeconds: 1800 } },
			{ access: { ...free.access, remainingSeconds: 900 } },
			{ access: { ...free.access, metering: true } },
			{ planCode: "plus" },
			{ canCreateRoom: false },
			{ activeRoom: { roomId: "guest-room", role: "member" } },
			{ unexpected: true },
		])
			expect(
				AccountHostingStatusSchema.safeParse({ ...free, ...bad }).success,
			).toBe(false);
	});
	it("enforces UTC and expiry instead of trusting client reset or indefinite reads", () => {
		for (const bad of [
			{ validUntil: now },
			{ validUntil: now + 300_001 },
			{ period: { ...free.period, utcDay: "2026-10-30" } },
			{ period: { ...free.period, resetAt: free.period.resetAt - 3_600_000 } },
			{
				serverTime: free.period.resetAt - 10,
				validUntil: free.period.resetAt + 1,
			},
		])
			expect(
				AccountHostingStatusSchema.safeParse({ ...free, ...bad }).success,
			).toBe(false);
		expect(
			AccountHostingStatusSchema.safeParse({
				...free,
				planCode: "pro",
				access: {
					kind: "confirmed_unlimited",
					source: "paid",
					validUntil: now + 30_000,
				},
			}).success,
		).toBe(false);
	});
	it("binds consumer reads to the expected account, never the incoming owner", () => {
		expect(acceptAccountHostingStatus(owner, free)).not.toBeNull();
		expect(
			acceptAccountHostingStatus("f6200000-0000-4000-8000-000000000002", free),
		).toBeNull();
		expect(
			acceptAccountHostingStatus(owner, { code: "HOSTING_STATUS_UNAVAILABLE" }),
		).toBeNull();
	});
	it("the internal live view is finite, bounded and tied to a room and UTC day", () => {
		const live = {
			liveStatusVersion: 1,
			ownerUserId: owner,
			roomId: "live-room",
			roomGeneration: 1,
			utcDay: free.period.utcDay,
			serverTime: now,
			validUntil: now + 60_000,
			access: { ...free.access, metering: true },
		};
		expect(Free20LiveStatusSchema.safeParse(live).success).toBe(true);
		for (const bad of [
			{ roomGeneration: 0 },
			{ utcDay: "2026-10-30" },
			{ validUntil: now },
			{
				access: {
					kind: "confirmed_unlimited",
					source: "paid",
					validUntil: now + 60_000,
				},
			},
		])
			expect(
				Free20LiveStatusSchema.safeParse({ ...live, ...bad }).success,
			).toBe(false);
	});
});
