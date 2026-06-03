import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const secretKey =
  process.env.NODE_ENV === "development" && process.env.STRIPE_SECRET_KEY_TEST
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(secretKey!, {
  apiVersion: "2025-06-30.basil",
});

/** Known live defaults; test/dev should override via STRIPE_* or NEXT_PUBLIC_* env. */
const LEGACY_LIVE_CRUNCHYROLL_PRICE_ID = "price_1RlnY7AGc1Bd58Cjo5BJckhN";
const LEGACY_LIVE_ANIME_JUNKIE_PRICE_ID = "price_1TUg5cAGc1Bd58Cj9nk3fAUJ";

export type CheckoutTier = "crunchyroll_subscriber" | "anime_junkie";

function resolvePriceIdForTier(tier: CheckoutTier): string | null {
  if (tier === "crunchyroll_subscriber") {
    return (
      process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER ??
      LEGACY_LIVE_CRUNCHYROLL_PRICE_ID
    );
  }
  return (
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE ??
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE ??
    LEGACY_LIVE_ANIME_JUNKIE_PRICE_ID
  );
}

function legacyAllowedPriceIds(): string[] {
  return [
    process.env.STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
    LEGACY_LIVE_CRUNCHYROLL_PRICE_ID,
    process.env.STRIPE_PRICE_ID_ANIME_JUNKIE,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE,
    LEGACY_LIVE_ANIME_JUNKIE_PRICE_ID,
  ].filter((id): id is string => Boolean(id));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      tier?: CheckoutTier;
      priceId?: string;
    };

    let priceId: string | undefined;

    if (body.tier === "crunchyroll_subscriber" || body.tier === "anime_junkie") {
      const resolved = resolvePriceIdForTier(body.tier);
      if (!resolved) {
        return NextResponse.json(
          { error: "This plan is not configured for checkout yet." },
          { status: 400 }
        );
      }
      priceId = resolved;
    } else if (typeof body.priceId === "string" && body.priceId.length > 0) {
      priceId = body.priceId;
      const allowed = legacyAllowedPriceIds();
      if (allowed.length > 0 && !allowed.includes(priceId)) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: "Missing plan (expected tier)" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
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
      subscription_data: {},
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    const message =
      error instanceof Stripe.errors.StripeInvalidRequestError
        ? error.message
        : "Error creating checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
