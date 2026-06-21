import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import {
  beginStripeEventProcessing,
  markStripeEventFailed,
  markStripeEventProcessed,
} from "@/lib/anidachi-auth/db";
import {
  stripeSubscriptionIdFromUnknown,
  syncStripeSubscriptionById,
  syncStripeSubscriptionFromStripe,
} from "@/lib/anidachi-auth/stripe-subscription-sync";
import { sendSubscriptionAlertEmail } from "@/lib/send-subscription-alert-email";
import { createStripeClient, getStripeWebhookSecret } from "@/lib/anidachi-auth/stripe-env";

export async function POST(request: NextRequest) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    console.error("[stripe/webhook] Stripe webhook secret is not configured for the resolved mode");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let stripe: Stripe;
  try {
    // Fail closed on missing/mismatched keys (e.g. a live key in a test env).
    stripe = createStripeClient();
  } catch (error) {
    console.error("[stripe/webhook] Stripe is not configured:", error);
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
          if (!subscriptionId) {
            throw new Error(`Paid checkout session ${session.id} is missing subscription id`);
          }

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

          await syncStripeSubscriptionById(stripe, subscriptionId);
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncStripeSubscriptionFromStripe(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeSubscriptionIdFromUnknown(
        (invoice as unknown as { subscription?: unknown }).subscription
      );
      await syncStripeSubscriptionById(stripe, subscriptionId);
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
