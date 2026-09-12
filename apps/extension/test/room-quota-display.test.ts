import { describe, expect, it } from "vitest";
import {
	applyRoomUsageSnapshot,
	roomQuotaRemainingSeconds,
} from "../src/room-quota-display";

describe("room quota countdown", () => {
	it("subtracts authoritative room usage before local display time", () => {
		expect(
			roomQuotaRemainingSeconds({
				serverRemainingSeconds: 900,
				resetAt: "2026-07-13T00:00:00.000Z",
				roomUsage: { day: "2026-07-12", seconds: 125 },
				localMeteredMs: 2_500,
			}),
		).toBe(772);
	});

	it("clamps malformed or exhausted values to zero", () => {
		expect(
			roomQuotaRemainingSeconds({
				serverRemainingSeconds: 30,
				resetAt: "2026-07-13T00:00:00.000Z",
				roomUsage: { day: "2026-07-12", seconds: 40 },
				localMeteredMs: -1,
			}),
		).toBe(0);
	});

	it("does not subtract a previous UTC day's room usage from fresh quota", () => {
		expect(
			roomQuotaRemainingSeconds({
				serverRemainingSeconds: 1_800,
				resetAt: "2026-07-14T00:00:00.000Z",
				roomUsage: { day: "2026-07-12", seconds: 1_200 },
				localMeteredMs: 0,
			}),
		).toBe(1_800);
	});

	it("keeps counting fresh local usage when the room anchor is from a previous day", () => {
		expect(
			roomQuotaRemainingSeconds({
				serverRemainingSeconds: 1_800,
				resetAt: "2026-07-14T00:00:00.000Z",
				roomUsage: { day: "2026-07-12", seconds: 1_200 },
				localMeteredMs: 300_000,
			}),
		).toBe(1_500);
	});

	it("replaces authoritative usage and local elapsed as one anchor", () => {
		const current = {
			roomUsage: { day: "2026-07-12", seconds: 100 },
			localMeteredMs: 25_000,
		};
		const next = applyRoomUsageSnapshot(current, {
			day: "2026-07-12",
			seconds: 125,
		});

		expect(next).toEqual({
			roomUsage: { day: "2026-07-12", seconds: 125 },
			localMeteredMs: 0,
		});
		expect(applyRoomUsageSnapshot(next, undefined)).toBe(next);
		expect(
			applyRoomUsageSnapshot(next, {
				day: "2026-07-12",
				seconds: 120,
			}),
		).toBe(next);
	});
});

describe("v2 Worker quota display", () => {
	it("never subtracts HTTP committed usage or the cumulative room usage again", async () => {
		const { authoritativeQuotaRemainingSeconds } = await import(
			"../src/room-quota-display"
		);
		expect(
			authoritativeQuotaRemainingSeconds(
				{
					day: "2026-09-08",
					remainingSeconds: 1200,
					metering: true,
					measuredAt: 1,
				},
				0,
			),
		).toBe(1200);
		expect(
			authoritativeQuotaRemainingSeconds(
				{
					day: "2026-09-08",
					remainingSeconds: 1,
					metering: false,
					measuredAt: 1,
				},
				10000,
			),
		).toBe(1);
		expect(authoritativeQuotaRemainingSeconds(null, 0)).toBeNull();
	});
	it("reanchors equal-usage metering changes and a fresh day but rejects sequence, day and time rewind", async () => {
		const { acceptAuthoritativeQuota } = await import(
			"../src/room-quota-display"
		);
		const quota = {
			day: "2026-09-08",
			remainingSeconds: 1200,
			metering: true,
			measuredAt: 100,
		};
		const first = acceptAuthoritativeQuota(null, quota, 10)!;
		expect(acceptAuthoritativeQuota(first, quota, 10)).toBe(first);
		expect(
			acceptAuthoritativeQuota(first, { ...quota, measuredAt: 101 }, 9),
		).toBe(first);
		expect(
			acceptAuthoritativeQuota(first, { ...quota, measuredAt: 99 }, 11),
		).toBe(first);
		expect(
			acceptAuthoritativeQuota(
				first,
				{ ...quota, day: "2026-09-07", measuredAt: 101 },
				11,
			),
		).toBe(first);
		expect(
			acceptAuthoritativeQuota(first, { ...quota, metering: false }, 11)?.quota
				.metering,
		).toBe(false);
		expect(
			acceptAuthoritativeQuota(
				first,
				{
					...quota,
					day: "2026-09-09",
					remainingSeconds: 1800,
					measuredAt: 102,
				},
				11,
			)?.quota.remainingSeconds,
		).toBe(1800);
	});
});
