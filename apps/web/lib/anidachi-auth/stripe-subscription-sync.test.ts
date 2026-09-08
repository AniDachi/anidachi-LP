import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
	resolveStripeSubscriptionPlan,
	StripeSubscriptionSyncError,
	syncStripeSubscriptionById,
	invoiceSubscriptionId,
} from "./stripe-subscription-sync";

function subscriptionFixture(params: {
	priceId?: string;
	planCode?: string;
}): Stripe.Subscription {
	return {
		id: "sub_test",
		customer: "cus_test",
		metadata: params.planCode ? { planCode: params.planCode } : {},
		items: {
			data: params.priceId
				? [
						{
							price: { id: params.priceId },
							current_period_end: 1_800_000_000,
						},
					]
				: [],
		},
		status: "active",
		cancel_at_period_end: false,
	} as Stripe.Subscription;
}

test("subscription plan resolution prefers configured Stripe price ids", () => {
	const oldPlus = process.env.STRIPE_PRICE_ID_PLUS_TEST;
	process.env.STRIPE_PRICE_ID_PLUS_TEST = "price_plus_test";
	try {
		assert.deepEqual(
			resolveStripeSubscriptionPlan(
				subscriptionFixture({ priceId: "price_plus_test", planCode: "pro" }),
			),
			{ planCode: "plus", stripePriceId: "price_plus_test" },
		);
	} finally {
		if (oldPlus === undefined) delete process.env.STRIPE_PRICE_ID_PLUS_TEST;
		else process.env.STRIPE_PRICE_ID_PLUS_TEST = oldPlus;
	}
});

test("subscription plan resolution falls back to paid Stripe metadata", () => {
	assert.deepEqual(
		resolveStripeSubscriptionPlan(
			subscriptionFixture({ priceId: "price_unknown", planCode: "nakama" }),
		),
		{ planCode: "plus", stripePriceId: "price_unknown" },
	);
});

test("subscription plan resolution fails when price and metadata cannot map to a paid plan", () => {
	assert.throws(
		() =>
			resolveStripeSubscriptionPlan(
				subscriptionFixture({ priceId: "price_unknown" }),
			),
		StripeSubscriptionSyncError,
	);
	assert.throws(
		() =>
			resolveStripeSubscriptionPlan(subscriptionFixture({ planCode: "plus" })),
		StripeSubscriptionSyncError,
	);
});

const lease = { fence: 1, token: "11111111-1111-4111-8111-111111111111" };
function fakeStripe(subscription: Stripe.Subscription, observe = () => {}) {
	return {
		subscriptions: {
			retrieve: async () => {
				observe();
				return subscription;
			},
		},
	} as unknown as Stripe;
}
const deps = {
	begin: async () => lease,
	release: async () => {},
	resolveUserId: async () => null as string | null,
	resolveSubscriptionOwner: async () => null as string | null,
};
test("ignores unmappable subscriptions without mirror mutation", async () => {
	assert.equal(
		await syncStripeSubscriptionById(
			fakeStripe(subscriptionFixture({})),
			"sub_test",
			deps,
		),
		null,
	);
});
test("lease precedes fresh retrieval and commit; cancellation at period end remains active", async () => {
	const order: string[] = [];
	const sub = subscriptionFixture({
		priceId: "price_unknown",
		planCode: "plus",
	});
	sub.cancel_at_period_end = true;
	const result = await syncStripeSubscriptionById(
		fakeStripe(sub, () => order.push("retrieve")),
		sub.id,
		{
			...deps,
			resolveUserId: async () => "owner",
			begin: async () => {
				order.push("begin");
				return lease;
			},
			commit: async (params, fence) => {
				order.push("commit");
				assert.equal(params.cancelAtPeriodEnd, true);
				assert.equal(params.status, "active");
				assert.deepEqual(fence, lease);
				return "plus";
			},
			release: async () => {
				order.push("release");
			},
		},
	);
	assert.deepEqual(order, ["begin", "retrieve", "commit", "release"]);
	assert.equal(result?.effectivePlan, "plus");
});
test("busy refresh never retrieves; expired/stale commit is not reported successful", async () => {
	let retrieved = false;
	const stripe = fakeStripe(
		subscriptionFixture({ priceId: "p", planCode: "pro" }),
		() => {
			retrieved = true;
		},
	);
	await assert.rejects(
		syncStripeSubscriptionById(stripe, "sub_test", {
			...deps,
			begin: async () => null,
		}),
	);
	assert.equal(retrieved, false);
	await assert.rejects(
		syncStripeSubscriptionById(stripe, "sub_test", {
			...deps,
			resolveUserId: async () => "owner",
			commit: async () => {
				throw new Error("STRIPE_REFRESH_STALE");
			},
		}),
		/STRIPE_REFRESH_STALE/,
	);
});
test("existing customer/subscription ownership rejects conflicting metadata and checkout owner", async () => {
	const sub = subscriptionFixture({ priceId: "p", planCode: "plus" });
	sub.metadata.userId = "attacker";
	for (const ownership of [
		{ resolveUserId: async () => "owner" },
		{ resolveSubscriptionOwner: async () => "owner" },
		{ expectedUserId: "owner" },
	]) {
		await assert.rejects(
			syncStripeSubscriptionById(fakeStripe(sub), sub.id, {
				...deps,
				...ownership,
			}),
			/owner mismatch/,
		);
	}
});
test("repeated or reversed deliveries refetch present state, not event timestamps", async () => {
	const current = subscriptionFixture({ priceId: "p", planCode: "pro" });
	const stripe = {
		subscriptions: { retrieve: async () => current },
	} as unknown as Stripe;
	const committed: string[] = [];
	const options = {
		...deps,
		resolveUserId: async () => "owner",
		commit: async (p: import("./db").StripeSubscriptionCommit) => {
			committed.push(p.status);
			return "free" as const;
		},
	};
	current.status = "canceled";
	await syncStripeSubscriptionById(stripe, "sub_test", options);
	await syncStripeSubscriptionById(stripe, "sub_test", options);
	assert.deepEqual(committed, ["canceled", "canceled"]);
});
test("invoice subscription uses current SDK parent shape", () => {
	assert.equal(
		invoiceSubscriptionId({
			parent: { subscription_details: { subscription: "sub_current" } },
		} as Stripe.Invoice),
		"sub_current",
	);
	assert.equal(invoiceSubscriptionId({ parent: null } as Stripe.Invoice), null);
});
