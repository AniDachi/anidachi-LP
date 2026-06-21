import assert from "node:assert/strict";
import test from "node:test";
import {
  effectivePlanForSubscription,
  effectivePlanFromSubscriptions,
  planCodeFromStripeMetadata,
  stripePlanCodeForPriceId,
  stripePriceIdForPlanCode,
  subscriptionStatusGrantsPaidAccess,
} from "./stripe-plans";

test("Stripe price ids resolve from new env names first", () => {
  const oldPlus = process.env.STRIPE_PRICE_ID_PLUS;
  const oldPro = process.env.STRIPE_PRICE_ID_PRO;
  process.env.STRIPE_PRICE_ID_PLUS = "price_plus_test";
  process.env.STRIPE_PRICE_ID_PRO = "price_pro_test";
  try {
    assert.equal(stripePriceIdForPlanCode("plus"), "price_plus_test");
    assert.equal(stripePriceIdForPlanCode("pro"), "price_pro_test");
    assert.equal(stripePlanCodeForPriceId("price_plus_test"), "plus");
    assert.equal(stripePlanCodeForPriceId("price_pro_test"), "pro");
  } finally {
    if (oldPlus === undefined) delete process.env.STRIPE_PRICE_ID_PLUS;
    else process.env.STRIPE_PRICE_ID_PLUS = oldPlus;
    if (oldPro === undefined) delete process.env.STRIPE_PRICE_ID_PRO;
    else process.env.STRIPE_PRICE_ID_PRO = oldPro;
  }
});

test("Stripe price ids require explicit env configuration", () => {
  const keys = [
    "STRIPE_PRICE_ID_PLUS",
    "NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS",
    "STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER",
    "NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER",
    "STRIPE_PRICE_ID_PRO",
    "NEXT_PUBLIC_STRIPE_PRICE_ID_PRO",
    "STRIPE_PRICE_ID_ANIME_JUNKIE",
    "NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE",
  ];
  const oldValues = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    assert.equal(stripePriceIdForPlanCode("plus"), null);
    assert.equal(stripePriceIdForPlanCode("pro"), null);
  } finally {
    for (const [key, value] of oldValues) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("active and trialing subscription statuses grant paid access", () => {
  assert.equal(subscriptionStatusGrantsPaidAccess("active"), true);
  assert.equal(subscriptionStatusGrantsPaidAccess("trialing"), true);
  assert.equal(subscriptionStatusGrantsPaidAccess("past_due"), false);
  assert.equal(subscriptionStatusGrantsPaidAccess("unpaid"), false);
  assert.equal(subscriptionStatusGrantsPaidAccess("canceled"), false);
});

test("subscription status maps paid plans to Free when not active", () => {
  assert.equal(
    effectivePlanForSubscription({ planCode: "plus", status: "active" }),
    "plus"
  );
  assert.equal(
    effectivePlanForSubscription({ planCode: "pro", status: "trialing" }),
    "pro"
  );
  assert.equal(
    effectivePlanForSubscription({ planCode: "pro", status: "unpaid" }),
    "free"
  );
});

test("effective plan chooses the highest paid active subscription", () => {
  assert.equal(
    effectivePlanFromSubscriptions([
      { planCode: "plus", status: "active" },
      { planCode: "pro", status: "canceled" },
    ]),
    "plus"
  );
  assert.equal(
    effectivePlanFromSubscriptions([
      { planCode: "plus", status: "active" },
      { planCode: "pro", status: "trialing" },
    ]),
    "pro"
  );
  assert.equal(
    effectivePlanFromSubscriptions([{ planCode: "pro", status: "past_due" }]),
    "free"
  );
});

test("Stripe metadata plan codes normalize legacy values", () => {
  assert.equal(planCodeFromStripeMetadata({ planCode: "plus" }), "plus");
  assert.equal(planCodeFromStripeMetadata({ planCode: "pro" }), "pro");
  assert.equal(planCodeFromStripeMetadata({ planCode: "nakama" }), "plus");
  assert.equal(planCodeFromStripeMetadata({ planCode: "junkie" }), "pro");
  assert.equal(planCodeFromStripeMetadata({ planCode: "watcher" }), "free");
});
