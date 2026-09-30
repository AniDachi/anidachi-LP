import assert from "node:assert/strict";
import test from "node:test";
import type { AccountEntitlements } from "./account-entitlements";
import type { SubscriptionRow } from "./db";
import { getPricingOffer } from "./pricing-offer";
import type { BillingPeriod } from "../billing-view";
const time = "2030-01-01T00:00:00Z";
const access = {
	policy: { planCode: "free" },
	history: { serverTime: time },
	hosting: { hostingActivationAt: time, trialEligibility: "eligible" },
} as AccountEntitlements;
const deps = {
	priceId: (plan: string, period: BillingPeriod = "monthly") =>
		period === "monthly" ? `price_${plan}` : null,
	readPrice: async (
		id: string,
		requireActive = false,
		billingPeriod: BillingPeriod = "monthly",
	) => {
		assert.equal(requireActive, true);
		return {
			unitAmount: id === "price_plus" ? 799 : 1499,
			currency: "usd",
			billingPeriod,
		};
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

test("annual catalog outage does not remove monthly offers or invent annual prices", async () => {
	const result = await getPricingOffer("owner", deps);
	assert.equal(result.yearlyPrices, null);
	assert.equal(result.prices.plus.unitAmount, 799);
	const result2 = await getPricingOffer("owner", {
		...deps,
		priceId: (plan, period = "monthly") => `price_${plan}_${period}`,
		readPrice: async (id, active, period = "monthly") => {
			if (period === "yearly") throw Error("unavailable");
			return deps.readPrice(id, active, period);
		},
	});
	assert.equal(result2.action, "trial");
	assert.equal(result2.yearlyPrices, null);
});
test("verified yearly prices share the same account trial eligibility as monthly", async () => {
	const result = await getPricingOffer("owner", {
		...deps,
		priceId: (plan, period = "monthly") => `price_${plan}_${period}`,
		readPrice: async (id, active, period = "monthly") => ({
			unitAmount:
				period === "yearly"
					? id.includes("plus")
						? 7670
						: 14390
					: id.includes("plus")
						? 799
						: 1499,
			currency: "usd",
			billingPeriod: period,
		}),
	});
	assert.equal(result.action, "trial");
	assert.equal(result.yearlyPrices?.plus.unitAmount, 7670);
	assert.equal(result.yearlyPrices?.pro.unitAmount, 14390);
});
