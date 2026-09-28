import type Stripe from "stripe";
import type { SubscriptionAlertPayload } from "../send-subscription-alert-email";
import {
	invoiceSubscriptionId,
	stripeSubscriptionIdFromUnknown,
} from "./stripe-subscription-sync";
export async function processSubscriptionWebhookEvent(
	event: Stripe.Event,
	deps: {
		sync: (subscriptionId: string) => Promise<void>;
		alert: (payload: SubscriptionAlertPayload) => Promise<void>;
	},
): Promise<void> {
	if (event.type === "checkout.session.completed") {
		const session = event.data.object;
		if (
			session.mode !== "subscription" ||
			!["paid", "no_payment_required"].includes(session.payment_status)
		)
			return;
		const subscriptionId = stripeSubscriptionIdFromUnknown(
			session.subscription,
		);
		if (!subscriptionId)
			throw new Error(
				"Completed subscription checkout is missing subscription.",
			);
		await deps.sync(subscriptionId);
		// Test fixtures and a zero-dollar trial start must never announce a purchase.
		if (
			!event.livemode ||
			session.payment_status !== "paid" ||
			!session.amount_total ||
			session.amount_total <= 0
		)
			return;
		try {
			await deps.alert({
				sessionId: session.id,
				subscriptionId,
				customerId:
					typeof session.customer === "string"
						? session.customer
						: (session.customer?.id ?? null),
				customerEmail:
					session.customer_email ?? session.customer_details?.email ?? null,
				amountTotalCents: session.amount_total,
				currency: session.currency,
			});
		} catch (error) {
			console.error("[stripe/webhook] Subscription alert email failed:", error);
		}
	} else if (
		[
			"customer.subscription.created",
			"customer.subscription.updated",
			"customer.subscription.deleted",
		].includes(event.type)
	) {
		await deps.sync((event.data.object as Stripe.Subscription).id);
	} else if (
		[
			"invoice.paid",
			"invoice.payment_failed",
			"invoice.payment_action_required",
		].includes(event.type)
	) {
		const subscriptionId = invoiceSubscriptionId(
			event.data.object as Stripe.Invoice,
		);
		if (subscriptionId) await deps.sync(subscriptionId);
	}
}
