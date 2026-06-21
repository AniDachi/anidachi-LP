import type Stripe from "stripe";
import {
  FREE_PLAN_CODE,
  type PaidPlanCode,
  type PlanCode,
  maxPlanCode,
  normalizePaidPlanCode,
  normalizePlanCode,
} from "./plan-entitlements";
import { stripeEnvForMode } from "./stripe-env";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

export type SubscriptionPlanSnapshot = {
  planCode: PlanCode;
  status: string;
};

export function stripePriceIdForPlanCode(planCode: PaidPlanCode): string | null {
  // Mode-aware: on staging/preview `stripeEnvForMode` resolves the *_TEST price,
  // on production the *_LIVE price, with the unsuffixed var as transition
  // fallback. Legacy CRUNCHYROLL_SUBSCRIBER/ANIME_JUNKIE vars remain a fallback.
  if (planCode === "plus") {
    return (
      stripeEnvForMode("STRIPE_PRICE_ID_PLUS") ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS ??
      process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      null
    );
  }

  return (
    stripeEnvForMode("STRIPE_PRICE_ID_PRO") ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO ??
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE ??
    null
  );
}

export function stripePlanCodeForPriceId(priceId: string | null | undefined): PaidPlanCode | null {
  if (!priceId) return null;
  // Match against every known plus/pro price id (both modes + legacy) so the
  // webhook resolves the plan regardless of which env mode produced the event.
  const plusIds = [
    process.env.STRIPE_PRICE_ID_PLUS_TEST,
    process.env.STRIPE_PRICE_ID_PLUS_LIVE,
    process.env.STRIPE_PRICE_ID_PLUS,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS,
    process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
  ].filter((id): id is string => Boolean(id));
  if (plusIds.includes(priceId)) return "plus";

  const proIds = [
    process.env.STRIPE_PRICE_ID_PRO_TEST,
    process.env.STRIPE_PRICE_ID_PRO_LIVE,
    process.env.STRIPE_PRICE_ID_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE,
  ].filter((id): id is string => Boolean(id));
  if (proIds.includes(priceId)) return "pro";

  return null;
}

export function subscriptionStatusGrantsPaidAccess(status: string): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export function effectivePlanForSubscription(snapshot: SubscriptionPlanSnapshot): PlanCode {
  if (!subscriptionStatusGrantsPaidAccess(snapshot.status)) return FREE_PLAN_CODE;
  return snapshot.planCode;
}

export function effectivePlanFromSubscriptions(
  subscriptions: SubscriptionPlanSnapshot[]
): PlanCode {
  return maxPlanCode(subscriptions.map(effectivePlanForSubscription));
}

export function planCodeFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): PlanCode | null {
  if (!metadata?.planCode) return null;
  return normalizePlanCode(metadata.planCode);
}

export function paidPlanCodeFromStripeSubscription(
  subscription: Stripe.Subscription
): PaidPlanCode | null {
  const firstPriceId = subscription.items.data[0]?.price.id;
  const fromPrice = stripePlanCodeForPriceId(firstPriceId);
  if (fromPrice) return fromPrice;

  return normalizePaidPlanCode(subscription.metadata.planCode);
}

export function currentPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (typeof currentPeriodEnd !== "number") return null;
  return new Date(currentPeriodEnd * 1000).toISOString();
}
