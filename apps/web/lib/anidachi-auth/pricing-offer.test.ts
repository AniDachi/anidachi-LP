import assert from "node:assert/strict";
import test from "node:test";
import type { AccountEntitlements } from "./account-entitlements";
import type { SubscriptionRow } from "./db";
import { getPlanPolicy } from "@anidachi/protocol";
import { getPricingOffer } from "./pricing-offer";
import type { BillingPeriod } from "../billing-view";
const time = "2030-01-01T00:00:00Z";
const access = {
	policy: { planCode: "free" },
	history: { serverTime: time },
	hosting: {
		hostingActivationAt: time,
		hostingPolicyVersion: 1,
		trialEligibility: "eligible",
	},
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
	pendingActivation: async () => null,
	policy: async () => ({
		activation_at: time,
		trials_enabled: true,
		revision: 1,
	}),
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
				policy: async () => ({ activation_at: null, trials_enabled: false }),
			})
		).paidHostingActive,
		false,
	);
});
test("guest trial availability requires active hosting and enabled trials", async () => {
	for (const [activation_at, trials_enabled, expected] of [
		[null, false, false],
		[null, true, false],
		["2030-01-02T00:00:00Z", true, false],
		[time, false, false],
		[time, true, true],
	] as const) {
		const result = await getPricingOffer(null, {
			...deps,
			policy: async () => ({ activation_at, trials_enabled }),
		});
		assert.equal(result.trialAvailable, expected);
		assert.equal(result.action, "sign_in");
	}
});

test("existing paid subscribers keep management even when new trials are available", async () => {
	for (const planCode of ["plus", "pro"] as const) {
		const subscription = Object.freeze({
			user_id: "owner",
			status: "active",
			stripe_subscription_id: "sub_existing",
			stripe_price_id: "price_original_monthly",
			plan_code: planCode,
			current_period_end: "2030-02-01T00:00:00Z",
			cancel_at_period_end: false,
		});
		const before = JSON.stringify(subscription);
		const result = await getPricingOffer("owner", {
			...deps,
			access: async () => ({ ...access, policy: getPlanPolicy(planCode) }),
			subscriptions: async () => [subscription] as unknown as SubscriptionRow[],
		});
		assert.equal(result.action, "manage");
		assert.equal(result.trialAvailable, false);
		assert.equal(JSON.stringify(subscription), before);
	}
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

test("cardless mode and revision require every launch flag while keeping the existing action enum", async () => {
	for (const user of [null, "owner"]) {
		const offer = await getPricingOffer(user, {
			...deps,
			access: async () => ({
				...access,
				hosting: { ...access.hosting!, hostingPolicyVersion: 7 },
			}),
			policy: async () => ({
				activation_at: time,
				trials_enabled: true,
				cardless_trials_enabled: true,
				revision: 7,
			}),
		});
		assert.equal(offer.trialMode, "cardless");
		assert.equal(offer.trialOfferRevision, "7");
		assert.equal(offer.action, user ? "trial" : "sign_in");
	}
	for (const override of [
		{ cardless_trials_enabled: false },
		{ trials_enabled: false },
		{ activation_at: null },
	]) {
		const offer = await getPricingOffer(null, {
			...deps,
			policy: async () => ({
				activation_at: time,
				trials_enabled: true,
				cardless_trials_enabled: true,
				revision: 7,
				...override,
			}),
		});
		assert.equal(offer.trialMode, "card_required");
	}
});

test("durable pending activation leads to recovery even after flag off", async () => {
	const pending = {
		id: "activation-a",
		planCode: "pro" as const,
		billingPeriod: "yearly" as const,
	};
	const result = await getPricingOffer("owner", {
		...deps,
		policy: async () => ({
			activation_at: time,
			trials_enabled: false,
			revision: 2,
		}),
		pendingActivation: async (owner: string) => {
			assert.equal(owner, "owner");
			return pending;
		},
	});
	assert.equal(result.trialMode, "card_required");
	assert.equal(result.action, "manage");
	assert.equal(result.trialAvailable, false);
	assert.deepEqual(result.pendingTrialActivation, pending);
});

test("current retirement policy overrides an old eligible account read", async () => {
	const result = await getPricingOffer("owner", {
		...deps,
		policy: async () => ({
			activation_at: time,
			trials_enabled: false,
			revision: 2,
		}),
	});
	assert.equal(result.action, "subscribe");
	assert.equal(result.trialAvailable, false);
});

test("mixed, missing or inactive policy authority never advertises a new trial", async () => {
	for (const override of [
		{ revision: 2 },
		{ revision: undefined },
		{ revision: 0 },
		{ activation_at: "2029-12-31T00:00:00Z" },
		{ activation_at: null },
		{ activation_at: "2030-01-02T00:00:00Z" },
		{ activation_at: "invalid" },
	]) {
		const result = await getPricingOffer("owner", {
			...deps,
			policy: async () => ({
				activation_at: time,
				trials_enabled: true,
				revision: 1,
				...override,
			}),
		});
		assert.equal(result.action, "subscribe", JSON.stringify(override));
		assert.equal(result.trialAvailable, false, JSON.stringify(override));
		assert.equal(
			result.validForMs,
			0,
			"Mixed authority requires a fresh check before purchase",
		);
	}
	const result = await getPricingOffer("owner", {
		...deps,
		access: async () => ({
			...access,
			hosting: {
				...access.hosting!,
				hostingPolicyVersion: undefined as unknown as number,
			},
		}),
	});
	assert.equal(result.action, "subscribe");
	assert.equal(result.trialAvailable, false);
});

test("retirement and mixed authority preserve accepted recovery and existing management", async () => {
	const policy = async () => ({
		activation_at: time,
		trials_enabled: false,
		revision: 2,
	});
	const pending = {
		id: "accepted",
		planCode: "pro" as const,
		billingPeriod: "yearly" as const,
	};
	const recovery = await getPricingOffer("owner", {
		...deps,
		policy,
		pendingActivation: async () => pending,
	});
	assert.equal(recovery.action, "manage");
	assert.deepEqual(recovery.pendingTrialActivation, pending);
	assert.equal(recovery.trialAvailable, false);
	for (const status of ["active", "trialing", "past_due", "incomplete"]) {
		const offer = await getPricingOffer("owner", {
			...deps,
			policy,
			subscriptions: async () =>
				[{ user_id: "owner", status }] as SubscriptionRow[],
		});
		assert.equal(offer.action, "manage");
		assert.equal(offer.trialAvailable, false);
	}
});

test("coherent inactive policy keeps ordinary paid offers usable without new trials", async () => {
	for (const activation_at of [null, "2030-01-02T00:00:00Z"]) {
		const offer = await getPricingOffer("owner", {
			...deps,
			policy: async () => ({
				activation_at,
				trials_enabled: false,
				revision: 1,
			}),
			access: async () => ({
				...access,
				hosting: {
					...access.hosting!,
					hostingActivationAt: activation_at,
					trialEligibility: "unavailable",
				},
			}),
		});
		assert.equal(offer.action, "subscribe");
		assert.equal(offer.trialAvailable, false);
		assert.equal(offer.paidHostingActive, false);
		assert.equal(
			offer.validForMs,
			60_000,
			"Coherent paid offer remains available before hosting cutover",
		);
	}
});
