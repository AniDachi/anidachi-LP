import Stripe from "stripe";

/**
 * Centralised, fail-closed Stripe environment resolution.
 *
 * Live Stripe is used ONLY on the Vercel production deployment; every other
 * context — preview/staging, local dev, CI — uses test Stripe. Selection is
 * driven by `VERCEL_ENV` (not `NODE_ENV`, which is "production" on every Vercel
 * deployment including staging), and the secret key's prefix is validated
 * against the resolved mode so a misconfigured env can never charge a live card
 * from staging: on a mismatch we throw and the caller fails closed.
 */
export type StripeMode = "test" | "live";

const STRIPE_API_VERSION = "2025-08-27.basil";

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

export function resolveStripeMode(): StripeMode {
  return process.env.VERCEL_ENV === "production" ? "live" : "test";
}

/**
 * Reads `${base}_TEST` / `${base}_LIVE` for the current mode, falling back to
 * the unsuffixed `${base}` (kept during the migration off the single-value
 * vars). Returns undefined when nothing is set.
 */
export function stripeEnvForMode(
  base: string,
  mode: StripeMode = resolveStripeMode(),
): string | undefined {
  const suffix = mode === "live" ? "_LIVE" : "_TEST";
  return process.env[`${base}${suffix}`] ?? process.env[base] ?? undefined;
}

export function getStripeSecretKey(mode: StripeMode = resolveStripeMode()): string {
  const key = stripeEnvForMode("STRIPE_SECRET_KEY", mode);
  if (!key) {
    throw new StripeConfigError(`Stripe secret key is not configured for ${mode} mode`);
  }

  const expectedPrefix = mode === "live" ? "sk_live" : "sk_test";
  if (!key.startsWith(expectedPrefix)) {
    // Fail closed: never let a live key run in a test context (or vice versa).
    throw new StripeConfigError(
      `Stripe secret key mode mismatch: ${mode} mode requires a "${expectedPrefix}…" key`,
    );
  }

  return key;
}

export function getStripeWebhookSecret(
  mode: StripeMode = resolveStripeMode(),
): string | undefined {
  return stripeEnvForMode("STRIPE_WEBHOOK_SECRET", mode);
}

/** Creates a Stripe client for the resolved mode; throws (fail closed) on misconfig. */
export function createStripeClient(mode: StripeMode = resolveStripeMode()): Stripe {
  return new Stripe(getStripeSecretKey(mode), { apiVersion: STRIPE_API_VERSION });
}
