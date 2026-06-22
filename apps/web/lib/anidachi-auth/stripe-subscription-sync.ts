import type Stripe from "stripe";

import {
  getUserIdByStripeCustomerId,
  listSubscriptionsForUser,
  updateUserPlan,
  upsertBillingCustomer,
  upsertSubscription,
} from "./db";
import type { PaidPlanCode, PlanCode } from "./plan-entitlements";
import {
  currentPeriodEndIso,
  effectivePlanFromSubscriptions,
  paidPlanCodeFromStripeSubscription,
} from "./stripe-plans";

export class StripeSubscriptionSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSubscriptionSyncError";
  }
}

export type StripeSubscriptionPlanResolution = {
  planCode: PaidPlanCode;
  stripePriceId: string;
};

export type StripeSubscriptionSyncResult = StripeSubscriptionPlanResolution & {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  effectivePlan: PlanCode;
};

function stripeCustomerIdFrom(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function stripeSubscriptionIdFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export function resolveStripeSubscriptionPlan(
  subscription: Stripe.Subscription,
): StripeSubscriptionPlanResolution {
  const stripePriceId = subscription.items.data[0]?.price.id;
  const planCode = paidPlanCodeFromStripeSubscription(subscription);
  if (!planCode || !stripePriceId) {
    throw new StripeSubscriptionSyncError(
      `Could not resolve subscription plan for ${subscription.id}`,
    );
  }

  return { planCode, stripePriceId };
}

export async function refreshUserPlanFromSubscriptions(
  userId: string,
): Promise<PlanCode> {
  const subscriptions = await listSubscriptionsForUser(userId);
  const effectivePlan = effectivePlanFromSubscriptions(
    subscriptions.map((subscription) => ({
      planCode: subscription.plan_code,
      status: subscription.status,
    })),
  );
  await updateUserPlan(userId, effectivePlan);
  return effectivePlan;
}

export async function syncStripeSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<StripeSubscriptionSyncResult> {
  const stripeCustomerId = stripeCustomerIdFrom(subscription.customer);
  if (!stripeCustomerId) {
    throw new StripeSubscriptionSyncError(
      `Subscription ${subscription.id} is missing customer id`,
    );
  }

  const metadataUserId = subscription.metadata.userId;
  const userId =
    metadataUserId || (await getUserIdByStripeCustomerId(stripeCustomerId));
  if (!userId) {
    throw new StripeSubscriptionSyncError(
      `Could not map subscription customer ${stripeCustomerId} to an AniDachi user`,
    );
  }

  await upsertBillingCustomer({ userId, stripeCustomerId });

  const { planCode, stripePriceId } = resolveStripeSubscriptionPlan(subscription);
  await upsertSubscription({
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    planCode,
    status: subscription.status,
    currentPeriodEnd: currentPeriodEndIso(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });

  const effectivePlan = await refreshUserPlanFromSubscriptions(userId);
  return {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId,
    planCode,
    status: subscription.status,
    effectivePlan,
  };
}

export async function syncStripeSubscriptionById(
  stripe: Stripe,
  subscriptionId: string | null,
): Promise<StripeSubscriptionSyncResult | null> {
  if (!subscriptionId) return null;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncStripeSubscriptionFromStripe(subscription);
}
