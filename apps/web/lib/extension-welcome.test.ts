import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveExtensionWelcome } from "./extension-welcome";
import type { BillingOverview, BillingSubscription } from "./billing-view";

const subscription: BillingSubscription = {
  id: "sub", planCode: "plus", status: "active", currentPeriodEnd: "2030-01-04T00:00:00Z",
  cancelAtPeriodEnd: false, canCancel: true,
};
const overview: BillingOverview = {
  ownerUserId: "owner", planCode: "plus", serverTime: "2030-01-01T00:00:00Z",
  subscriptions: [subscription], selectedPlanExpiresAt: "2030-01-04T00:00:00Z",
};
test("only a verified live subscription produces the welcome confirmation", () => {
	assert.equal(resolveExtensionWelcome(overview).kind, "paid");
	for (const status of ["incomplete", "canceled", "unpaid", "past_due"]) {
		assert.equal(
			resolveExtensionWelcome({
				...overview,
				subscriptions: [{ ...subscription, status }],
			}).kind,
			"inactive",
		);
	}
	assert.equal(
		resolveExtensionWelcome({ ...overview, planCode: "free" }).kind,
		"inactive",
	);
	assert.equal(
		resolveExtensionWelcome({ ...overview, subscriptions: [] }).kind,
		"inactive",
	);
});
test("trial success is limited to its original expiry and never inferred from paid access", () => {
	const trial = {
		mode: "cardless" as const,
		stage: "trial" as const,
		endsAt: "2030-01-04T00:00:00Z",
		pendingUntil: "2030-01-04T02:00:00Z",
		renewalState: "not_enabled" as const,
	};
	const active = { ...overview, subscriptions: [{ ...subscription, trial }] };
	const state = resolveExtensionWelcome(active);
	assert.equal(state.kind, "trial");
	if (state.kind !== "trial") throw Error("Expected trial");
	assert.equal(state.cardlessWithoutRenewal, true);
	assert.equal(state.endsAt, trial.endsAt);
	assert.equal(
		resolveExtensionWelcome({ ...active, serverTime: trial.endsAt }).kind,
		"inactive",
	);
	assert.equal(
		resolveExtensionWelcome(
			{ ...active, serverTime: "2030-01-03T23:59:59Z" },
			1001,
		).kind,
		"inactive",
	);
	for (const stage of ["ended", "processing", "payment_required"] as const) {
		assert.equal(
			resolveExtensionWelcome({
				...active,
				subscriptions: [{ ...subscription, trial: { ...trial, stage } }],
			}).kind,
			"inactive",
		);
	}
	const renewing = resolveExtensionWelcome({
		...active,
		subscriptions: [
			{ ...subscription, trial: { ...trial, renewalEnabled: true } },
		],
	});
	assert.equal(
		renewing.kind === "trial" && renewing.cardlessWithoutRenewal,
		false,
	);
});
test("welcome describes the effective plan and does not label manual access as a purchase", () => {
	assert.equal(
		resolveExtensionWelcome({ ...overview, planCode: "pro" }).kind,
		"inactive",
	);
	assert.equal(
		resolveExtensionWelcome({
			...overview,
			selectedPlanExpiresAt: overview.serverTime,
		}).kind,
		"inactive",
	);
});

test("current Free20 and manual status enable install without claiming a purchase", async () => {
	const { resolveHostingWelcome } = await import("./extension-welcome");
	const owner = "f6250000-0000-4000-8000-000000000001",
		now = Date.parse("2030-01-01T12:00:00Z");
	const status = {
		accountHostingVersion: 1,
		ownerUserId: owner,
		planCode: "free",
		serverTime: now,
		validUntil: now + 60_000,
		period: { utcDay: "2030-01-01", resetAt: now + 43_200_000 },
		activeRoom: null,
		canCreateRoom: true,
		access: {
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 0,
			remainingSeconds: 1200,
			metering: false,
		},
	};
	for (const value of [
		status,
		{
			...status,
			canCreateRoom: false,
			access: { ...status.access, usedSeconds: 1200, remainingSeconds: 0 },
		},
		{
			...status,
			canCreateRoom: false,
			activeRoom: { roomId: "existing", role: "member" },
		},
	])
		assert.equal(resolveHostingWelcome(owner, value).kind, "free20");
	assert.equal(resolveHostingWelcome("foreign", status).kind, "error");
	assert.equal(resolveHostingWelcome(owner, status, 60_000).kind, "error");
	assert.equal(
		resolveHostingWelcome(owner, { ...status, access: null }).kind,
		"error",
	);
	assert.equal(
		resolveHostingWelcome(owner, {
			...status,
			planCode: "plus",
			access: {
				kind: "confirmed_unlimited",
				source: "manual",
				validUntil: null,
			},
		}).kind,
		"manual",
	);
});
