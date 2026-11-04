import type { BillingPromotion } from "../billing-view";
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

export async function readBillingPromotions(
	userId: string,
	rows: SubscriptionRow[],
): Promise<Record<string, BillingPromotion | undefined>> {
	const original = await readProductHuntBilling(userId, rows);
	if (resolveStripeMode() !== "test" || !rows.length) return original;
	try {
		const [account, claim] = await Promise.all([
			readUninstallAccount(userId),
			readRetentionClaim(userId),
		]);
		if (!account.grant || !account.customerId) return original;
		const stripe = createStripeClient();
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
