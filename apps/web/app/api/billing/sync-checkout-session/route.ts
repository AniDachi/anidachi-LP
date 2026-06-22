import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { sanitizeAuthReturnTo } from "@/lib/anidachi-auth/return-to";
import { getSession, setAuthCookies } from "@/lib/anidachi-auth/session";
import {
  stripeSubscriptionIdFromUnknown,
  syncStripeSubscriptionById,
} from "@/lib/anidachi-auth/stripe-subscription-sync";
import { createStripeClient } from "@/lib/anidachi-auth/stripe-env";
import { refreshTokenPair } from "@/lib/anidachi-auth/tokens";

export const dynamic = "force-dynamic";

function checkoutSessionUserId(session: Stripe.Checkout.Session): string | null {
  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

export async function POST(request: NextRequest) {
  const authSession = await getSession();
  if (!authSession) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    next?: unknown;
  } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const next = typeof body?.next === "string" ? body.next : null;
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Invalid checkout session id" }, { status: 400 });
  }

  let stripe: Stripe;
  try {
    stripe = createStripeClient();
  } catch (error) {
    console.error("[billing/sync-checkout-session] Stripe is not configured:", error);
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkoutSession.mode !== "subscription") {
      return NextResponse.json({ error: "Checkout session is not a subscription" }, { status: 400 });
    }

    const ownerUserId = checkoutSessionUserId(checkoutSession);
    if (ownerUserId !== authSession.userId) {
      return NextResponse.json({ error: "Checkout session does not belong to this account" }, { status: 403 });
    }

    const subscriptionId = stripeSubscriptionIdFromUnknown(checkoutSession.subscription);
    if (!subscriptionId) {
      return NextResponse.json({ error: "Checkout session has no subscription yet" }, { status: 409 });
    }

    const result = await syncStripeSubscriptionById(stripe, subscriptionId);
    if (!result) {
      return NextResponse.json({ error: "Subscription could not be synchronized" }, { status: 409 });
    }

    const response = NextResponse.json({
      ok: true,
      planCode: result.effectivePlan,
      subscriptionPlanCode: result.planCode,
      status: result.status,
      next: sanitizeAuthReturnTo(next) || "/account",
    });

    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      const tokens = await refreshTokenPair(refreshToken);
      if (tokens) {
        setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
      }
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Stripe.errors.StripeInvalidRequestError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Checkout session sync failed";
    console.error("[billing/sync-checkout-session] Sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
