import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const secretKey =
  process.env.NODE_ENV === "development" && process.env.STRIPE_SECRET_KEY_TEST
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(secretKey!, {
  apiVersion: "2025-06-30.basil",
});

export async function POST(request: NextRequest) {
  try {
    const { priceId } = await request.json();

    const allowedPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CRUNCHYROLL_SUBSCRIBER,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANIME_JUNKIE,
    ].filter(Boolean);

    if (allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
      return NextResponse.json(
        { error: "Invalid price" },
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
    return NextResponse.json(
      { error: "Error creating checkout session" },
      { status: 500 }
    );
  }
}
