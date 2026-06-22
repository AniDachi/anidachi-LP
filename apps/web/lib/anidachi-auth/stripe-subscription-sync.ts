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

export type SyncStripeSubscriptionDeps = {
  /** Override the Stripe-customer -> AniDachi-user lookup (used by tests). */
  resolveUserId?: (stripeCustomerId: string) => Promise<string | null>;
};

export async function syncStripeSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  deps: SyncStripeSubscriptionDeps = {},
): Promise<StripeSubscriptionSyncResult | null> {
  const stripeCustomerId = stripeCustomerIdFrom(subscription.customer);
  if (!stripeCustomerId) {
    throw new StripeSubscriptionSyncError(
      `Subscription ${subscription.id} is missing customer id`,
    );
  }

  const resolveUserId = deps.resolveUserId ?? getUserIdByStripeCustomerId;
  const metadataUserId = subscription.metadata.userId;
  const userId = metadataUserId || (await resolveUserId(stripeCustomerId));
  if (!userId) {
    // The subscription belongs to a Stripe customer we don't track: a legacy
    // customer from before this project's database, a subscription created
    // directly in the Stripe dashboard, or an abandoned/incomplete checkout
    // that Stripe later expired (which still fires customer.subscription.*).
    // Nothing to sync on our side, so treat it as a no-op instead of throwing:
    // a thrown error returns HTTP 500 from the webhook and makes Stripe retry a
    // permanently-unmappable event for days.
    console.warn(
      `[stripe-sync] Ignoring subscription ${subscription.id}: Stripe customer ${stripeCustomerId} maps to no AniDachi user`,
    );
    return null;
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
