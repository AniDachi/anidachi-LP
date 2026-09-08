import { expect, it } from "vitest";
import {
	getPlanPolicy,
	PlanPolicySchema,
	WatchHistoryAccessSchema,
	isWatchHistoryAccessCurrent,
	AccountEntitlementsMetadataSchema,
} from "../src/commercial-policy";
const owner = "11111111-1111-4111-8111-111111111111";
const now = "2026-09-08T12:00:00Z";
const access = {
	accessVersion: 1,
	ownerUserId: owner,
	accountGeneration: 1,
	accessEpoch: 0,
	youtubeConsentEpoch: 0,
	state: "allowed",
	serverTime: now,
	captureNotBefore: now,
	validUntil: "2026-09-08T12:05:00Z",
	youtubeHistoryEnabled: false,
};
it("keeps guest history separate from room capacity", () => {
	expect(
		["free", "plus", "pro"].map((p) =>
			getPlanPolicy(p as "free" | "plus" | "pro"),
		),
	).toEqual([
		{
			planCode: "free",
			historyEnabled: false,
			dailyHostSeconds: 1800,
			maxParticipants: 4,
			maxCameras: 4,
			maxMicrophones: 4,
		},
		{
			planCode: "plus",
			historyEnabled: true,
			dailyHostSeconds: null,
			maxParticipants: 6,
			maxCameras: 4,
			maxMicrophones: 6,
		},
		{
			planCode: "pro",
			historyEnabled: true,
			dailyHostSeconds: null,
			maxParticipants: 15,
			maxCameras: 4,
			maxMicrophones: 8,
		},
	]);
	expect(
		PlanPolicySchema.safeParse({ ...getPlanPolicy("pro"), maxMicrophones: 6 })
			.success,
	).toBe(false);
});
it("validates strict owner-bound access and five-minute server leases", () => {
	expect(WatchHistoryAccessSchema.safeParse(access).success).toBe(true);
	for (const patch of [
		{ accessVersion: 2 },
		{ ownerUserId: "" },
		{ accountGeneration: 0 },
		{ accessEpoch: -1 },
		{ youtubeConsentEpoch: 0.5 },
		{ validUntil: "2026-09-08T12:05:01Z" },
		{ validUntil: now },
		{ captureNotBefore: "2026-09-08T12:00:01Z" },
		{ planCode: "pro" },
	])
		expect(
			WatchHistoryAccessSchema.safeParse({ ...access, ...patch }).success,
		).toBe(false);
	expect(
		WatchHistoryAccessSchema.safeParse({
			...access,
			state: "plan_required",
			youtubeHistoryEnabled: true,
		}).success,
	).toBe(true); // preference is not entitlement
	expect(
		AccountEntitlementsMetadataSchema.safeParse({
			entitlementsVersion: 1,
			ownerUserId: owner,
			serverTime: now,
		}).success,
	).toBe(true);
});
it("checks current owner, generation, epochs, consent and expiry without granting Free capture", () => {
	const parsed = WatchHistoryAccessSchema.parse(access);
	const context = {
		ownerUserId: owner,
		accountGeneration: 1,
		accessEpoch: 0,
		youtubeConsentEpoch: 0,
		now: Date.parse(now),
		provider: "crunchyroll" as const,
	};
	expect(isWatchHistoryAccessCurrent(parsed, context)).toBe(true);
	for (const patch of [
		{ ownerUserId: "22222222-2222-4222-8222-222222222222" },
		{ accountGeneration: 2 },
		{ accessEpoch: 1 },
		{ youtubeConsentEpoch: 1 },
		{ now: Date.parse(access.validUntil) },
		{ now: NaN },
		{ provider: "youtube" as const },
	])
		expect(isWatchHistoryAccessCurrent(parsed, { ...context, ...patch })).toBe(
			false,
		);
	expect(
		isWatchHistoryAccessCurrent({ ...parsed, state: "plan_required" }, context),
	).toBe(false);
});
