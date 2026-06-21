import assert from "node:assert/strict";
import test from "node:test";
import {
  StripeConfigError,
  getStripeSecretKey,
  resolveStripeMode,
  stripeEnvForMode,
} from "./stripe-env";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(prev)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test("resolveStripeMode is live only on Vercel production", () => {
  withEnv({ VERCEL_ENV: "production" }, () => assert.equal(resolveStripeMode(), "live"));
  withEnv({ VERCEL_ENV: "preview" }, () => assert.equal(resolveStripeMode(), "test"));
  withEnv({ VERCEL_ENV: "development" }, () => assert.equal(resolveStripeMode(), "test"));
  withEnv({ VERCEL_ENV: undefined }, () => assert.equal(resolveStripeMode(), "test"));
});

test("stripeEnvForMode prefers the suffixed var, then falls back to base", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY_TEST: "sk_test_a",
      STRIPE_SECRET_KEY_LIVE: "sk_live_b",
      STRIPE_SECRET_KEY: "sk_base",
    },
    () => {
      assert.equal(stripeEnvForMode("STRIPE_SECRET_KEY", "test"), "sk_test_a");
      assert.equal(stripeEnvForMode("STRIPE_SECRET_KEY", "live"), "sk_live_b");
    },
  );
  withEnv(
    { STRIPE_SECRET_KEY_TEST: undefined, STRIPE_SECRET_KEY_LIVE: undefined, STRIPE_SECRET_KEY: "sk_base" },
    () => assert.equal(stripeEnvForMode("STRIPE_SECRET_KEY", "test"), "sk_base"),
  );
});

test("getStripeSecretKey returns the matching-mode key", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY_TEST: "sk_test_x",
      STRIPE_SECRET_KEY_LIVE: "sk_live_y",
      STRIPE_SECRET_KEY: undefined,
    },
    () => {
      assert.equal(getStripeSecretKey("test"), "sk_test_x");
      assert.equal(getStripeSecretKey("live"), "sk_live_y");
    },
  );
});

test("getStripeSecretKey fails closed on a live key in test mode (the staging footgun)", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY_TEST: undefined,
      STRIPE_SECRET_KEY_LIVE: undefined,
      STRIPE_SECRET_KEY: "sk_live_danger",
    },
    () => assert.throws(() => getStripeSecretKey("test"), StripeConfigError),
  );
});

test("getStripeSecretKey fails closed on a test key in live mode", () => {
  withEnv(
    {
      STRIPE_SECRET_KEY_TEST: undefined,
      STRIPE_SECRET_KEY_LIVE: "sk_test_oops",
      STRIPE_SECRET_KEY: undefined,
    },
    () => assert.throws(() => getStripeSecretKey("live"), StripeConfigError),
  );
});

test("getStripeSecretKey throws when nothing is configured", () => {
  withEnv(
    { STRIPE_SECRET_KEY_TEST: undefined, STRIPE_SECRET_KEY_LIVE: undefined, STRIPE_SECRET_KEY: undefined },
    () => assert.throws(() => getStripeSecretKey("test"), StripeConfigError),
  );
});
