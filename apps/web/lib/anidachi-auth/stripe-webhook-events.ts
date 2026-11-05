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
		completeSetup?: (sessionId: string) => Promise<void>;
		retentionInvoice?: (invoice: Stripe.Invoice) => Promise<void>;
		reconcileCancellation?: (subscriptionId: string) => Promise<void>;
	},
): Promise<void> {
	const reconcile = async (subscriptionId: string) => {
		if (!event.livemode) await deps.reconcileCancellation?.(subscriptionId);
	};
	const sync = async (subscriptionId: string) => {
		await deps.sync(subscriptionId);
		await reconcile(subscriptionId);
	};
	if (event.type === "invoice.created") {
		if (event.livemode) return;
		if (!deps.retentionInvoice)
			throw new Error("Retention invoice handler unavailable; retry delivery.");
		const subscriptionId = invoiceSubscriptionId(event.data.object);
		if (subscriptionId) await reconcile(subscriptionId);
		await deps.retentionInvoice(event.data.object);
	} else if (event.type === "checkout.session.completed") {
		const session = event.data.object;
		if (session.mode === "setup" && session.metadata?.trialRenewalId) {
			if (!deps.completeSetup)
				throw new Error("Trial setup finalizer unavailable; retry delivery.");
			await deps.completeSetup(session.id);
			return;
		}
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
		await sync(subscriptionId);
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
		await sync((event.data.object as Stripe.Subscription).id);
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
		if (subscriptionId) await sync(subscriptionId);
	}
}
