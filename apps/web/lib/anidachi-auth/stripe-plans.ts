import type Stripe from "stripe";
import {
  FREE_PLAN_CODE,
  type PaidPlanCode,
  type PlanCode,
  isPaidPlanCode,
  isPlanCode,
  maxPlanCode,
} from "./plan-entitlements";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

export type SubscriptionPlanSnapshot = {
  planCode: PlanCode;
  status: string;
};

export function stripePriceIdForPlanCode(planCode: PaidPlanCode): string | null {
  if (planCode === "nakama") {
    return (
      process.env.STRIPE_PRICE_ID_PLUS ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS ??
      process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      null
    );
  }

  return (
    process.env.STRIPE_PRICE_ID_PRO ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO ??
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE ??
    null
  );
}

export function stripePlanCodeForPriceId(priceId: string | null | undefined): PaidPlanCode | null {
  if (!priceId) return null;
  const plusIds = [
    process.env.STRIPE_PRICE_ID_PLUS,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS,
    process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
  ].filter((id): id is string => Boolean(id));
  if (plusIds.includes(priceId)) return "nakama";

  const proIds = [
    process.env.STRIPE_PRICE_ID_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE,
  ].filter((id): id is string => Boolean(id));
  if (proIds.includes(priceId)) return "junkie";

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
  const planCode = metadata?.planCode;
  return isPlanCode(planCode) ? planCode : null;
}

export function paidPlanCodeFromStripeSubscription(
  subscription: Stripe.Subscription
): PaidPlanCode | null {
  const firstPriceId = subscription.items.data[0]?.price.id;
  const fromPrice = stripePlanCodeForPriceId(firstPriceId);
  if (fromPrice) return fromPrice;

  const fromMetadata = planCodeFromStripeMetadata(subscription.metadata);
  return isPaidPlanCode(fromMetadata) ? fromMetadata : null;
}

export function currentPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (typeof currentPeriodEnd !== "number") return null;
  return new Date(currentPeriodEnd * 1000).toISOString();
}
