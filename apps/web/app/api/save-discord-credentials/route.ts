import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

function sanitizeDiscordHandle(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  try {
    const stripe = createStripeClient();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      sessionId?: string;
      discord?: string;
    };

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const discord = typeof body.discord === "string" ? sanitizeDiscordHandle(body.discord) : "";

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!discord) {
      return NextResponse.json({ error: "Missing Discord contact" }, { status: 400 });
    }
    if (discord.length > 64) {
      return NextResponse.json(
        { error: "Discord contact is too long" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    if (!customerId) {
      return NextResponse.json(
        { error: "Checkout session has no customer" },
        { status: 400 }
      );
    }

    await stripe.customers.update(customerId, {
      metadata: {
        anidachi_discord_contact: discord,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving Discord contact:", error);
    const message =
      error instanceof Stripe.errors.StripeInvalidRequestError
        ? error.message
        : "Error saving Discord contact";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
