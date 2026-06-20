import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import {
  beginStripeEventProcessing,
  getUserIdByStripeCustomerId,
  listSubscriptionsForUser,
  markStripeEventFailed,
  markStripeEventProcessed,
  updateUserPlan,
  upsertBillingCustomer,
  upsertSubscription,
} from "@/lib/anidachi-auth/db";
import {
  currentPeriodEndIso,
  effectivePlanFromSubscriptions,
  paidPlanCodeFromStripeSubscription,
  planCodeFromStripeMetadata,
} from "@/lib/anidachi-auth/stripe-plans";
import { sendSubscriptionAlertEmail } from "@/lib/send-subscription-alert-email";

function getStripeSecretKey(): string | undefined {
  return process.env.NODE_ENV === "development" && process.env.STRIPE_SECRET_KEY_TEST
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;
}

function createStripeClient(): Stripe | null {
  const secretKey = getStripeSecretKey();
  return secretKey
    ? new Stripe(secretKey, { apiVersion: "2025-08-27.basil" })
    : null;
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function stripeCustomerIdFrom(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function stripeSubscriptionIdFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

async function refreshUserPlan(userId: string): Promise<void> {
  const subscriptions = await listSubscriptionsForUser(userId);
  const effectivePlan = effectivePlanFromSubscriptions(
    subscriptions.map((subscription) => ({
      planCode: subscription.plan_code,
      status: subscription.status,
    }))
  );
  await updateUserPlan(userId, effectivePlan);
}

async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription
): Promise<void> {
  const stripeCustomerId = stripeCustomerIdFrom(subscription.customer);
  if (!stripeCustomerId) {
    console.error("[stripe/webhook] Subscription is missing customer id", subscription.id);
    return;
  }

  const metadataUserId = subscription.metadata.userId;
  const userId =
    metadataUserId || (await getUserIdByStripeCustomerId(stripeCustomerId));
  if (!userId) {
    console.error(
      "[stripe/webhook] Could not map subscription customer to user",
      stripeCustomerId
    );
    return;
  }

  await upsertBillingCustomer({ userId, stripeCustomerId });

  const paidPlanCode = paidPlanCodeFromStripeSubscription(subscription);
  const metadataPlanCode = planCodeFromStripeMetadata(subscription.metadata);
  const planCode = paidPlanCode ?? metadataPlanCode;
  const stripePriceId = subscription.items.data[0]?.price.id;
  if (!planCode || !stripePriceId) {
    console.error("[stripe/webhook] Could not resolve subscription plan", {
      subscriptionId: subscription.id,
      stripePriceId,
      metadataPlanCode,
    });
    return;
  }

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
  await refreshUserPlan(userId);
}

async function syncSubscriptionById(
  stripe: Stripe,
  subscriptionId: string | null
): Promise<void> {
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionFromStripe(subscription);
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = createStripeClient();
  if (!stripe) {
    console.error("[stripe/webhook] STRIPE_SECRET_KEY is not set");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await request.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    console.error("[stripe/webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const shouldProcess = await beginStripeEventProcessing({
    eventId: event.id,
    eventType: event.type,
  });
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription") {
        const paid =
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required";

        if (paid) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null;

          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id ?? null;

          const customerEmail =
            session.customer_email ??
            session.customer_details?.email ??
            null;

          try {
            await sendSubscriptionAlertEmail({
              sessionId: session.id,
              customerEmail,
              customerId,
              subscriptionId,
              amountTotalCents: session.amount_total,
              currency: session.currency,
            });
          } catch (e) {
            console.error("[stripe/webhook] Subscription alert email failed:", e);
          }

          await syncSubscriptionById(stripe, subscriptionId);
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeSubscriptionIdFromUnknown(
        (invoice as unknown as { subscription?: unknown }).subscription
      );
      await syncSubscriptionById(stripe, subscriptionId);
    } else if (event.type === "entitlements.active_entitlement_summary.updated") {
      // Stripe Entitlements can become the primary feature gate once configured.
      // For now, subscription events above keep the plan mirror current.
      console.info("[stripe/webhook] Entitlement summary updated");
    }

    await markStripeEventProcessed(event.id);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Stripe webhook processing error";
    console.error("[stripe/webhook] Processing failed:", message);
    try {
      await markStripeEventFailed(event.id, message);
    } catch (recordError) {
      console.error("[stripe/webhook] Failed to record processing error:", recordError);
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
