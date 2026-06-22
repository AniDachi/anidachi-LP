import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getBillingCustomerByUserId,
  upsertBillingCustomer,
} from "@/lib/anidachi-auth/db";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  checkoutInputToPaidPlanCode,
  type LegacyCheckoutTier,
  type PaidPlanCode,
} from "@/lib/anidachi-auth/plan-entitlements";
import { stripePriceIdForPlanCode } from "@/lib/anidachi-auth/stripe-plans";
import { createStripeClient } from "@/lib/anidachi-auth/stripe-env";

function loginUrlForRequest(request: NextRequest): string {
  let next = "/";
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.origin === request.nextUrl.origin) {
        next = `${refererUrl.pathname}${refererUrl.search}`;
      }
    } catch {
      next = "/";
    }
  }
  return `/login?next=${encodeURIComponent(next)}`;
}

export type CheckoutTier = LegacyCheckoutTier;

async function getOrCreateStripeCustomer(params: {
  stripe: Stripe;
  userId: string;
  email: string;
}): Promise<string> {
  const existing = await getBillingCustomerByUserId(params.userId);
  if (existing) return existing.stripe_customer_id;

  const customer = await params.stripe.customers.create({
    email: params.email,
    metadata: {
      userId: params.userId,
    },
  });
  await upsertBillingCustomer({
    userId: params.userId,
    stripeCustomerId: customer.id,
  });
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    const authSession = await getSession();
    if (!authSession) {
      return NextResponse.json(
        {
          error: "Sign in required before starting checkout",
          loginUrl: loginUrlForRequest(request),
        },
        { status: 401 }
      );
    }

    let stripe: Stripe;
    try {
      stripe = createStripeClient();
    } catch (error) {
      // Fail closed on missing/mismatched keys (e.g. a live key in a test env).
      console.error("[create-checkout-session] Stripe is not configured:", error);
      return NextResponse.json(
        { error: "Stripe checkout is not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      tier?: CheckoutTier;
      planCode?: unknown;
    };

    const planCode = checkoutInputToPaidPlanCode(body);
    if (!planCode) {
      return NextResponse.json(
        { error: "Missing paid plan (expected planCode or tier)" },
        { status: 400 }
      );
    }

    const priceId = stripePriceIdForPlanCode(planCode);
    if (!priceId) {
      return NextResponse.json(
        { error: "This plan is not configured for checkout yet." },
        { status: 400 }
      );
    }

    const customerId = await getOrCreateStripeCustomer({
      stripe,
      userId: authSession.userId,
      email: authSession.email,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: authSession.userId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${request.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: {
        userId: authSession.userId,
        planCode,
      },
      subscription_data: {
        metadata: {
          userId: authSession.userId,
          planCode,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url, planCode });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const message =
      error instanceof Stripe.errors.StripeInvalidRequestError
        ? error.message
        : "Error creating checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
