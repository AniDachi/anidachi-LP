import { describe, expect, it } from "vitest";
import {
	Free20WarningRequestSchema,
	Free20WarningResponseSchema,
	Free20WarningContextSchema,
} from "./free20-warning";
const at = Date.parse("2026-11-01T12:00:00Z");
const request = {
	hostingWarningVersion: 1,
	roomId: "warning-room",
	roomGeneration: 1,
	utcDay: "2026-11-01",
};
const reply = {
	...request,
	ownerUserId: "f6260000-0000-4000-8000-000000000001",
	decision: "show",
	serverTime: at,
	validUntil: at + 10000,
	thresholdSeconds: 300,
	claimId: "f6260000-0000-4000-8000-000000000002",
};
describe("Free20 warning independent display authorization", () => {
	it("accepts exact bounded request and rejects browser authority", () => {
		expect(Free20WarningRequestSchema.parse(request)).toEqual(request);
		for (const bad of [
			{ ...request, remainingSeconds: 300 },
			{ ...request, ownerUserId: reply.ownerUserId },
			{ ...request, utcDay: "2026-02-30" },
			{ ...request, roomGeneration: 0 },
			{ ...request, hostingWarningVersion: 2 },
		])
			expect(Free20WarningRequestSchema.safeParse(bad).success).toBe(false);
	});
	it("show alone has SQL claim and immutable threshold", () => {
		expect(Free20WarningResponseSchema.parse(reply)).toEqual(reply);
		for (const bad of [
			{ ...reply, claimId: undefined },
			{ ...reply, thresholdSeconds: 301 },
			{ ...reply, claimId: "bad" },
			{ ...reply, decision: "already_claimed" },
			{ ...reply, decision: "not_eligible" },
			{ ...reply, validUntil: at },
			{ ...reply, validUntil: at + 10001 },
			{ ...reply, utcDay: "2026-10-31" },
		])
			expect(Free20WarningResponseSchema.safeParse(bad).success).toBe(false);
		const { claimId, thresholdSeconds, ...base } = reply;
		for (const decision of ["already_claimed", "not_eligible"])
			expect(
				Free20WarningResponseSchema.safeParse({ ...base, decision }).success,
			).toBe(true);
	});
	it("never crosses UTC reset", () => {
		const midnight = Date.parse("2026-11-02T00:00:00Z");
		expect(
			Free20WarningResponseSchema.safeParse({
				...reply,
				serverTime: midnight - 1,
				validUntil: midnight,
			}).success,
		).toBe(true);
		expect(
			Free20WarningResponseSchema.safeParse({
				...reply,
				serverTime: midnight - 1,
				validUntil: midnight + 1,
			}).success,
		).toBe(false);
	});
	it("internal context is normalized milliseconds with all canonical fences", () => {
		const value = {
			ownerUserId: reply.ownerUserId,
			accountGeneration: 1,
			accessEpoch: 1,
			planCode: "free",
			grant: null,
			utcDay: request.utcDay,
			serverTime: at,
			refreshBy: at + 300000,
			resetAt: Date.parse("2026-11-02T00:00:00Z"),
			assignment: {
				roomId: request.roomId,
				roomGeneration: 1,
				role: "host",
				sessionId: "tab-1",
				hostingTimeMode: "daily_free20",
				status: "live",
				hostUserId: reply.ownerUserId,
			},
		};
		expect(Free20WarningContextSchema.safeParse(value).success).toBe(true);
		for (const bad of [
			{ ...value, serverTime: new Date(at).toISOString() },
			{ ...value, committedSeconds: 900 },
			{ ...value, assignment: { ...value.assignment, sessionId: undefined } },
			{ ...value, grant: {} },
			{ ...value, resetAt: at + 10000 },
		])
			expect(Free20WarningContextSchema.safeParse(bad).success).toBe(false);
	});
});
it("accepts accessEpoch zero for an account that never enabled history", () => {
	const context = {
		ownerUserId: reply.ownerUserId,
		accountGeneration: 1,
		accessEpoch: 0,
		planCode: "free",
		grant: null,
		utcDay: request.utcDay,
		serverTime: at,
		refreshBy: at + 300000,
		resetAt: Date.parse("2026-11-02T00:00:00Z"),
		assignment: {
			roomId: request.roomId,
			roomGeneration: 1,
			role: "host",
			sessionId: "tab-1",
			hostingTimeMode: "daily_free20",
			status: "live",
			hostUserId: reply.ownerUserId,
		},
	};
	expect(Free20WarningContextSchema.safeParse(context).success).toBe(true);
});
