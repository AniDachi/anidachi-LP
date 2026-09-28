import assert from "node:assert/strict";
import test from "node:test";
import type { AccountEntitlements } from "./account-entitlements";
import type { SubscriptionRow } from "./db";
import { getPricingOffer } from "./pricing-offer";
const time = "2030-01-01T00:00:00Z";
const access = {
	policy: { planCode: "free" },
	history: { serverTime: time },
	hosting: { hostingActivationAt: time, trialEligibility: "eligible" },
} as AccountEntitlements;
const deps = {
	priceId: (plan: string) => `price_${plan}`,
	readPrice: async (id: string, requireActive = false) => {
		assert.equal(requireActive, true);
		return { unitAmount: id === "price_plus" ? 799 : 1499, currency: "usd" };
	},
	access: async () => access,
	subscriptions: async () => [] as SubscriptionRow[],
	policy: async () => ({ activation_at: time }),
	now: () => Date.parse(time),
};
test("only verified eligible Free gets a trial; no registration-date split", async () => {
	assert.equal((await getPricingOffer("owner", deps)).action, "trial");
	for (const trialEligibility of [
		"used",
		"unavailable",
		"existing_account",
	] as const) {
		assert.equal(
			(
				await getPricingOffer("owner", {
					...deps,
					access: async () => ({
						...access,
						hosting: { ...access.hosting!, trialEligibility },
					}),
				})
			).action,
			"subscribe",
		);
	}
});
test("signed-out reads public policy without looking up any user's trial", async () => {
	const result = await getPricingOffer(null, {
		...deps,
		access: async () => {
			throw new Error("Unexpected private lookup");
		},
		subscriptions: async () => {
			throw new Error("Unexpected private lookup");
		},
	});
	assert.equal(result.ownerUserId, null);
	assert.equal(result.action, "sign_in");
	assert.equal(result.paidHostingActive, true);
	assert.equal(
		(
			await getPricingOffer(null, {
				...deps,
				policy: async () => ({ activation_at: null }),
			})
		).paidHostingActive,
		false,
	);
});
test("existing payment problems and paid access go to management, not a second checkout", async () => {
	for (const status of [
		"active",
		"trialing",
		"past_due",
		"unpaid",
		"incomplete",
		"paused",
	]) {
		assert.equal(
			(
				await getPricingOffer("owner", {
					...deps,
					subscriptions: async () =>
						[{ user_id: "owner", status }] as SubscriptionRow[],
				})
			).action,
			"manage",
		);
	}
	await assert.rejects(
		getPricingOffer("owner", {
			...deps,
			subscriptions: async () =>
				[{ user_id: "foreign", status: "active" }] as SubscriptionRow[],
		}),
	);
	await assert.rejects(
		getPricingOffer("owner", {
			...deps,
			access: async () => ({ ...access, hosting: undefined }),
		}),
	);
});
