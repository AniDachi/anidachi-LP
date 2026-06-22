import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  resolveStripeSubscriptionPlan,
  StripeSubscriptionSyncError,
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
    () => resolveStripeSubscriptionPlan(subscriptionFixture({ priceId: "price_unknown" })),
    StripeSubscriptionSyncError,
  );
  assert.throws(
    () => resolveStripeSubscriptionPlan(subscriptionFixture({ planCode: "plus" })),
    StripeSubscriptionSyncError,
  );
});
