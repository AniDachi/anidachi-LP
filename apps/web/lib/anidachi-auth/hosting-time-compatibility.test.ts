import assert from "node:assert/strict";
import test from "node:test";
import { HostingTimeSnapshotSchema } from "@anidachi/protocol";
import { free } from "../../../../packages/protocol/test/fixtures/hosting-time";
import {
	HistoryAccessError,
	resolveAccountEntitlements,
} from "./account-entitlements";

const now = new Date("2026-10-30T12:00:00Z");
const legacy = {
	planCode: "free",
	selectedPlanExpiresAt: null,
	paidUntil: null,
	hosting: {
		hostingPolicyVersion: 2,
		hostingActivationAt: "2026-09-28T00:00:00Z",
		canHost: false,
		trialEligibility: "used",
		trialEndsAt: null,
	},
	history: {
		accessVersion: 1,
		ownerUserId: free.ownerUserId,
		accountGeneration: 3,
		accessEpoch: 4,
		youtubeConsentEpoch: 2,
		state: "plan_required",
		serverTime: now.toISOString(),
		captureNotBefore: "2026-09-08T10:00:00Z",
		validUntil: "2026-10-30T12:01:00Z",
		youtubeHistoryEnabled: true,
	},
};

test("real web resolver keeps legacy Free policy and denial with independent future metadata", async () => {
	HostingTimeSnapshotSchema.parse(free);
	const access = await resolveAccountEntitlements(
		free.ownerUserId,
		now,
		async () => ({ ...legacy, hostingTime: free }),
	);
	assert.equal(access.policy.dailyHostSeconds, 1800);
	assert.equal(access.hosting?.canHost, false);
	assert.equal(access.history.state, "plan_required");
	assert.equal("hostingTime" in access, false);
});

test("real web resolver rejects replacing strict hosting data or granting active Free hosting", async () => {
	for (const hosting of [free, { ...legacy.hosting, canHost: true }]) {
		await assert.rejects(
			resolveAccountEntitlements(free.ownerUserId, now, async () => ({
				...legacy,
				hosting,
			})),
			HistoryAccessError,
		);
	}
});
