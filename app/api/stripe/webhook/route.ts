import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { sendSubscriptionAlertEmail } from "@/lib/send-subscription-alert-email";

const secretKey =
  process.env.NODE_ENV === "development" && process.env.STRIPE_SECRET_KEY_TEST
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(secretKey!, {
  apiVersion: "2025-06-30.basil",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode !== "subscription") {
      return NextResponse.json({ received: true });
    }

    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";
    if (!paid) {
      return NextResponse.json({ received: true });
    }

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
  }

  return NextResponse.json({ received: true });
}
