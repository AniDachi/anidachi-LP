import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccountEntitlements } from "./account-entitlements";
import { createAccountAccessHandlers } from "./watch-history-access";
import { NextRequest } from "next/server";

const owner = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-27T12:00:00Z");
const hosting = {
	hostingPolicyVersion: 1,
	hostingActivationAt: now.toISOString(),
	canHost: false,
	trialEligibility: "eligible",
	trialEndsAt: null,
};
function authority(planCode = "free") {
	return {
		planCode,
		paidUntil: null,
		selectedPlanExpiresAt: null,
		history: {
			accessVersion: 1,
			ownerUserId: owner,
			accountGeneration: 1,
			accessEpoch: 0,
			youtubeConsentEpoch: 0,
			state: planCode === "free" ? "plan_required" : "allowed",
			serverTime: now.toISOString(),
			captureNotBefore: now.toISOString(),
			validUntil: "2026-09-27T12:05:00Z",
			youtubeHistoryEnabled: false,
		},
	};
}
test("new authority preserves hosting denial independently of legacy Free room limits", async () => {
	const result = await resolveAccountEntitlements(owner, now, async () => ({
		...authority(),
		hosting,
	}));
	assert.deepEqual(result.hosting, hosting);
	assert.equal(result.policy.dailyHostSeconds, 1800);
	assert.equal(result.history.state, "plan_required");
});
test("legacy authority remains readable without inventing eligibility or paid hosting metadata", async () => {
	const result = await resolveAccountEntitlements(owner, now, async () =>
		authority(),
	);
	assert.equal(result.hosting, undefined);
});
test("malformed or contradictory hosting authority is unavailable, never a paywall", async () => {
	for (const patch of [
		{ canHost: true },
		{ hostingPolicyVersion: 0 },
		{ trialEndsAt: "invalid" },
		{ hostingActivationAt: null },
		{ trialEligibility: "yes" },
	]) {
		await assert.rejects(
			resolveAccountEntitlements(owner, now, async () => ({
				...authority(),
				hosting: { ...hosting, ...patch },
			})),
			{ code: "HISTORY_ACCESS_UNAVAILABLE", status: 503 },
		);
	}
	await assert.rejects(
		resolveAccountEntitlements(owner, now, async () => ({
			...authority("plus"),
			hosting,
		})),
		{ code: "HISTORY_ACCESS_UNAVAILABLE", status: 503 },
	);
});
test("entitlements endpoint exposes additive hosting metadata without changing history payload", async () => {
	const handlers = createAccountAccessHandlers({
		getSession: async () => ({
			userId: owner,
			email: "owner@example.test",
			plan: "free",
			source: "extension",
		}),
		resolve: (id, date) =>
			resolveAccountEntitlements(id, date, async () => ({
				...authority(),
				hosting,
			})),
	});
	const request = new NextRequest("https://anidachi.test/api/me/entitlements");
	const response = await handlers.getEntitlements(request);
	assert.equal(response.status, 200);
	const body = await response.json();
	assert.deepEqual(body.hosting, hosting);
	assert.equal(body.planCode, "free");
	assert.equal(body.entitlementsVersion, 1);
	assert.equal(
		"hosting" in (await (await handlers.getAccess(request)).json()),
		false,
	);
});
