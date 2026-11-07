import { describe, expect, it } from "vitest";
import * as protocol from "../src/index";
import { binding, free, resetAt, serverTime } from "./fixtures/hosting-time";

describe("inactive versioned hosting time contract", () => {
	it("accepts authoritative Free20 usage and exhausted zero without inferring unlimited", () => {
		expect(protocol.HostingTimeSnapshotSchema.safeParse(free).success).toBe(
			true,
		);
		const exhausted = {
			...free,
			access: { ...free.access, usedSeconds: 1200, remainingSeconds: 0 },
		};
		expect(
			protocol.HostingTimeSnapshotSchema.safeParse(exhausted).success,
		).toBe(true);
	});
	it("rejects impossible, inconsistent, unbounded and mixed-version daily usage", () => {
		for (const access of [
			{ ...free.access, budgetSeconds: 1800 },
			{ ...free.access, usedSeconds: -1, remainingSeconds: 1201 },
			{ ...free.access, usedSeconds: 1201, remainingSeconds: 0 },
			{ ...free.access, usedSeconds: 400.5, remainingSeconds: 799.5 },
			{ ...free.access, remainingSeconds: 801 },
			{ ...free.access, remainingSeconds: Number.NaN },
			{ ...free.access, remainingSeconds: Infinity },
			{ ...free.access, activeSince: serverTime },
			{ ...free.access, metering: "true" },
		])
			expect(
				protocol.HostingTimeSnapshotSchema.safeParse({ ...free, access })
					.success,
			).toBe(false);
	});
	it("requires the current UTC day and exact next UTC midnight, including leap/year boundaries", () => {
		for (const period of [
			{ utcDay: "2026-02-30", resetAt },
			{ utcDay: "2026-10-29", resetAt },
			{ utcDay: "2026-10-31", resetAt },
			{ utcDay: "2026-10-30", resetAt: resetAt - 1 },
			{ utcDay: "2026-10-30", resetAt: resetAt + 86_400_000 },
		])
			expect(
				protocol.HostingTimeSnapshotSchema.safeParse({ ...free, period })
					.success,
			).toBe(false);
		for (const [instant, day, reset] of [
			["2028-02-29T23:59:59.999Z", "2028-02-29", "2028-03-01T00:00:00Z"],
			["2026-12-31T23:59:59.999Z", "2026-12-31", "2027-01-01T00:00:00Z"],
			["2026-10-31T00:00:00Z", "2026-10-31", "2026-11-01T00:00:00Z"],
		] as const)
			expect(
				protocol.HostingTimeSnapshotSchema.safeParse({
					...free,
					serverTime: Date.parse(instant),
					period: { utcDay: day, resetAt: Date.parse(reset) },
				}).success,
			).toBe(true);
	});
	it("distinguishes confirmed paid/trial/manual time rights from explicit unknown", () => {
		for (const source of ["paid", "trial", "manual"] as const) {
			const access = {
				kind: "confirmed_unlimited",
				source,
				validUntil: serverTime + 60_000,
			};
			expect(
				protocol.HostingTimeSnapshotSchema.safeParse({ ...free, access })
					.success,
			).toBe(true);
			for (const validUntil of [serverTime, serverTime - 1])
				expect(
					protocol.HostingTimeSnapshotSchema.safeParse({
						...free,
						access: { ...access, validUntil },
					}).success,
				).toBe(false);
		}
		expect(
			protocol.HostingTimeSnapshotSchema.safeParse({
				...free,
				access: {
					kind: "confirmed_unlimited",
					source: "manual",
					validUntil: null,
				},
			}).success,
		).toBe(true);
		for (const source of ["paid", "trial"])
			expect(
				protocol.HostingTimeSnapshotSchema.safeParse({
					...free,
					access: { kind: "confirmed_unlimited", source, validUntil: null },
				}).success,
			).toBe(false);
		expect(
			protocol.HostingTimeSnapshotSchema.parse({
				...free,
				access: { kind: "unknown" },
			}).access,
		).toEqual({ kind: "unknown" });
	});
	it("rejects malformed, missing, null and unknown-version data without granting access", () => {
		for (const value of [
			undefined,
			null,
			{},
			{ ...free, access: undefined },
			{ ...free, access: null },
			{ ...free, access: { kind: "unlimited" } },
			{ ...free, hostingTimeVersion: 2 },
			{ ...free, hostPlanCode: "pro" },
		]) {
			expect(protocol.HostingTimeSnapshotSchema.safeParse(value).success).toBe(
				false,
			);
			expect(
				protocol.acceptHostingTimeSnapshot(binding, null, value),
			).toBeNull();
		}
	});
	it("rejects nonfinite/unsafe timestamps, sequences and generations", () => {
		for (const key of [
			"serverTime",
			"snapshotSequence",
			"roomGeneration",
		] as const)
			for (const value of [
				-1,
				1.5,
				Infinity,
				Number.NaN,
				Number.MAX_SAFE_INTEGER + 1,
			])
				expect(
					protocol.HostingTimeSnapshotSchema.safeParse({
						...free,
						[key]: value,
					}).success,
				).toBe(false);
		expect(
			protocol.HostingTimeSnapshotSchema.safeParse({
				...free,
				roomGeneration: 0,
			}).success,
		).toBe(false);
		expect(
			protocol.HostingTimeSnapshotSchema.safeParse({
				...free,
				period: { ...free.period, resetAt: Number.MAX_SAFE_INTEGER },
			}).success,
		).toBe(false);
	});
});

describe("raw hosting time acceptance fence", () => {
	it("decodes only matching authenticated scope and accepts a newer snapshot", () => {
		expect(protocol.acceptHostingTimeSnapshot(binding, null, free)).toEqual(
			free,
		);
		const newer = { ...free, snapshotSequence: 5, serverTime: serverTime + 1 };
		expect(protocol.acceptHostingTimeSnapshot(binding, free, newer)).toEqual(
			newer,
		);
		for (const patch of [
			{ ownerUserId: "22222222-2222-4222-8222-222222222222" },
			{ roomId: "other" },
			{ roomGeneration: 3 },
		])
			expect(
				protocol.acceptHostingTimeSnapshot(binding, null, {
					...free,
					...patch,
				}),
			).toBeNull();
	});
	it("rejects duplicates, older sequence/time and late old-day data even with a higher sequence", () => {
		for (const incoming of [
			free,
			{ ...free, snapshotSequence: 3, serverTime: serverTime + 1 },
			{ ...free, snapshotSequence: 5, serverTime: serverTime - 1 },
		])
			expect(
				protocol.acceptHostingTimeSnapshot(binding, free, incoming),
			).toBeNull();
		const tomorrow = {
			...free,
			snapshotSequence: 5,
			serverTime: resetAt,
			period: {
				utcDay: "2026-10-31",
				resetAt: Date.parse("2026-11-01T00:00:00Z"),
			},
		};
		const tomorrowBinding = { ...binding, utcDay: "2026-10-31" };
		expect(
			protocol.acceptHostingTimeSnapshot(tomorrowBinding, free, tomorrow),
		).toEqual(tomorrow);
		expect(
			protocol.acceptHostingTimeSnapshot(tomorrowBinding, tomorrow, {
				...free,
				snapshotSequence: 6,
			}),
		).toBeNull();
		expect(
			protocol.acceptHostingTimeSnapshot(tomorrowBinding, null, free),
		).toBeNull();
	});
	it("rejects malformed bindings and untrusted previous anchors", () => {
		for (const expected of [
			{ ...binding, roomGeneration: NaN },
			{ ...binding, utcDay: "2026-02-30" },
			{ ...binding, ownerUserId: "" },
		])
			expect(
				protocol.acceptHostingTimeSnapshot(expected, null, free),
			).toBeNull();
		expect(
			protocol.acceptHostingTimeSnapshot(
				binding,
				{ ...free, snapshotSequence: NaN },
				free,
			),
		).toBeNull();
		expect(
			protocol.acceptHostingTimeSnapshot(
				binding,
				{ ...free, roomId: "other" },
				free,
			),
		).toBeNull();
	});
});

describe("legacy compatibility and independent frozen room caps", () => {
	it("retains 1800 policy/quota and does not interpret 1200 in v1 as Free20", () => {
		expect(
			protocol.PlanPolicySchema.parse(protocol.getPlanPolicy("free"))
				.dailyHostSeconds,
		).toBe(1800);
		for (const remainingSeconds of [1800, 1200]) {
			const legacy = {
				day: "2026-10-30",
				remainingSeconds,
				metering: true,
				measuredAt: serverTime,
			};
			expect(protocol.RoomQuotaSnapshotSchema.parse(legacy)).toEqual(legacy);
			expect(
				protocol.RoomQuotaStatusSchema.safeParse({
					schemaVersion: 1,
					ownerUserId: binding.ownerUserId,
					serverTime: "2026-10-30T12:00:00Z",
					quota: { remainingSeconds, resetAt: "2026-10-31T00:00:00Z" },
				}).success,
			).toBe(true);
			expect(
				protocol.acceptHostingTimeSnapshot(binding, null, legacy),
			).toBeNull();
		}
		for (const schema of [
			protocol.RoomQuotaSnapshotSchema,
			protocol.RoomQuotaStatusSchema,
			protocol.HostingAccessSchema,
		])
			expect(schema.safeParse(free).success).toBe(false);
	});
	it("represents unlimited time without changing frozen Free v3 participant/camera/seat caps", () => {
		const caps = {
			mediaProtocolVersion: 3,
			hostPlanCode: "free",
			maxParticipants: 4,
			maxCameras: 4,
			maxMediaSeats: 4,
			capabilityRevision: 1,
			capabilitiesValidUntil: "2026-10-30T12:10:00Z",
		};
		const unlimited = {
			...free,
			snapshotSequence: 5,
			access: {
				kind: "confirmed_unlimited",
				source: "paid",
				validUntil: serverTime + 60_000,
			},
		};
		expect(
			protocol.acceptHostingTimeSnapshot(binding, free, unlimited)?.access.kind,
		).toBe("confirmed_unlimited");
		expect(protocol.RoomMediaV3CapabilitiesSchema.parse(caps)).toEqual(caps);
		for (const patch of [{ maxParticipants: 6 }, { maxMediaSeats: 6 }])
			expect(
				protocol.RoomMediaV3CapabilitiesSchema.safeParse({ ...caps, ...patch })
					.success,
			).toBe(false);
		expect(
			protocol.HostingTimeSnapshotSchema.safeParse({
				...unlimited,
				capabilities: { ...caps, hostPlanCode: "plus" },
			}).success,
		).toBe(false);
	});
});
