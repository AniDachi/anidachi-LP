import type { BillingPromotion } from "../billing-view";
import { cancellationBillingSnapshot } from "./cancellation-retention-billing";
import { readCancellationRetentionOffer } from "./cancellation-retention-store";
import type { SubscriptionRow } from "./db";
import { readProductHuntBilling } from "./product-hunt-billing-server";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { retentionBillingSnapshot } from "./uninstall-billing";
import { readRetentionClaim, readUninstallAccount } from "./uninstall-store";
import {
	stripeObjectId,
	UNINSTALL_FIRST_CAMPAIGN,
	UNINSTALL_REQUEST,
	verifyUninstallCustomer,
} from "./uninstall-stripe";

const defaultDeps = {
	readProductHuntBilling,
	mode: resolveStripeMode,
	readAccount: readUninstallAccount,
	readClaim: readRetentionClaim,
	createStripe: createStripeClient,
	readCancellationOffer: readCancellationRetentionOffer,
};

export async function readBillingPromotions(
	userId: string,
	rows: SubscriptionRow[],
	deps = defaultDeps,
): Promise<Record<string, BillingPromotion | undefined>> {
	const original = await deps.readProductHuntBilling(userId, rows);
	if (deps.mode() !== "test" || !rows.length) return original;
	try {
		const [account, claim] = await Promise.all([
			deps.readAccount(userId, { presentationOnly: true }),
			deps.readClaim(userId),
		]);
		if (!account.customerId) return original;
		const nativeOffers = new Map(
			await Promise.all(
				rows
					.filter((row) =>
						["active", "past_due", "unpaid", "incomplete"].includes(row.status),
					)
					.map(
						async (row) =>
							[
								row.id,
								await deps.readCancellationOffer(
									userId,
									row.stripe_subscription_id,
								),
							] as const,
					),
			),
		);
		if (!account.grant && ![...nativeOffers.values()].some(Boolean))
			return original;
		const stripe = deps.createStripe();
		const customer = verifyUninstallCustomer(
			await stripe.customers.retrieve(
				account.customerId,
				{},
				UNINSTALL_REQUEST,
			),
			account.customerId,
			userId,
		);
		for (const row of rows.filter((r) =>
			["active", "past_due", "unpaid", "incomplete"].includes(r.status),
		)) {
			if (row.stripe_customer_id !== customer.id || row.user_id !== userId)
				throw new Error("Billing offer owner mismatch.");
			const sub = await stripe.subscriptions.retrieve(
				row.stripe_subscription_id,
				{ expand: ["discounts", "items.data.discounts"] },
				UNINSTALL_REQUEST,
			);
			const native = nativeOffers.get(row.id);
			if (native) {
				const attached = [
					...sub.discounts,
					...sub.items.data.flatMap((item) => item.discounts ?? []),
				].find(
					(d) => typeof d !== "string" && d.coupon?.id === native.coupon_id,
				);
				// Stripe may omit optional coupon scope in embedded discount objects.
				const coupon =
					attached &&
					typeof attached !== "string" &&
					!attached.coupon.applies_to
						? await stripe.coupons.retrieve(
								native.coupon_id,
								{ expand: ["applies_to"] },
								UNINSTALL_REQUEST,
							)
						: undefined;
				const snapshot = cancellationBillingSnapshot(
					sub,
					native,
					Date.now(),
					coupon,
				);
				if (snapshot?.nextPrice && customer.discount)
					throw new Error(
						"Cancellation billing discount stacking unavailable.",
					);
				if (snapshot) original[row.id] = snapshot;
			}
			if (claim?.stripe_subscription_id === sub.id) {
				if (customer.discount && claim.state === "accepted")
					original[row.id] = { state: "unavailable" };
				else {
					const snapshot = retentionBillingSnapshot(sub, claim, Date.now());
					if (snapshot) original[row.id] = snapshot;
				}
			} else if (account.grant === "first") {
				const item = sub.items.data[0];
				const discounts = [...sub.discounts, ...(item?.discounts ?? [])];
				const first = discounts.find(
					(d) =>
						typeof d !== "string" &&
						d.coupon.metadata?.anidachiCampaign === UNINSTALL_FIRST_CAMPAIGN,
				);
				if (!first) continue;
				if (
					typeof first === "string" ||
					discounts.length !== 1 ||
					first.coupon.percent_off !== 40 ||
					first.coupon.duration !== "once" ||
					sub.livemode ||
					sub.metadata.userId !== userId ||
					stripeObjectId(sub.customer) !== customer.id ||
					sub.items.has_more ||
					sub.items.data.length !== 1 ||
					item.quantity !== 1 ||
					item.price.currency !== "usd" ||
					item.price.recurring?.interval !== "month" ||
					typeof item.price.unit_amount !== "number" ||
					!Number.isSafeInteger(item.price.unit_amount)
				)
					throw new Error("First month billing terms unavailable.");
				original[row.id] = {
					state: "active",
					campaign: "uninstall_first",
					percentOff: 40,
					endsAt: new Date(item.current_period_end * 1000).toISOString(),
					nextPrice: {
						unitAmount: item.price.unit_amount,
						currency: "usd",
						billingPeriod: "monthly",
					},
				};
			}
		}
		return original;
	} catch {
		return {
			...original,
			...Object.fromEntries(
				rows
					.filter((r) => r.status === "active")
					.map((r) => [r.id, { state: "unavailable" as const }]),
			),
		};
	}
}
