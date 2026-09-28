import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import {
	beginStripeEventProcessing,
	markStripeEventFailed,
	markStripeEventProcessed,
} from "@/lib/anidachi-auth/db";
import { syncStripeSubscriptionById } from "@/lib/anidachi-auth/stripe-subscription-sync";
import { processSubscriptionWebhookEvent } from "@/lib/anidachi-auth/stripe-webhook-events";
import { sendSubscriptionAlertEmail } from "@/lib/send-subscription-alert-email";
import {
	createStripeClient,
	getStripeWebhookSecret,
} from "@/lib/anidachi-auth/stripe-env";

export async function POST(request: NextRequest) {
	const webhookSecret = getStripeWebhookSecret();
	if (!webhookSecret) {
		console.error(
			"[stripe/webhook] Stripe webhook secret is not configured for the resolved mode",
		);
		return NextResponse.json(
			{ error: "Webhook not configured" },
			{ status: 500 },
		);
	}

	let stripe: Stripe;
	try {
		// Fail closed on missing/mismatched keys (e.g. a live key in a test env).
		stripe = createStripeClient();
	} catch (error) {
		console.error("[stripe/webhook] Stripe is not configured:", error);
		return NextResponse.json(
			{ error: "Stripe not configured" },
			{ status: 500 },
		);
	}

	const signature = request.headers.get("stripe-signature");
	if (!signature) {
		return NextResponse.json(
			{ error: "Missing stripe-signature" },
			{ status: 400 },
		);
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
		await processSubscriptionWebhookEvent(event, {
			sync: async (subscriptionId) => {
				await syncStripeSubscriptionById(stripe, subscriptionId);
			},
			alert: sendSubscriptionAlertEmail,
		});

		await markStripeEventProcessed(event.id);
	} catch (err) {
		const message =
			err instanceof Error
				? err.message
				: "Unknown Stripe webhook processing error";
		console.error("[stripe/webhook] Processing failed:", message);
		try {
			await markStripeEventFailed(event.id, message);
		} catch (recordError) {
			console.error(
				"[stripe/webhook] Failed to record processing error:",
				recordError,
			);
		}
		return NextResponse.json(
			{ error: "Webhook processing failed" },
			{ status: 500 },
		);
	}

	return NextResponse.json({ received: true });
}
