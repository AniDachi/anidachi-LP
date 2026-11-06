import type Stripe from "stripe";
import type { BillingPromotion } from "../billing-view";
import {
	cancellationBillingSnapshot,
	isCancellationBillingProviderUnavailable,
} from "./cancellation-retention-billing";
import { verifyCancellationCoupon } from "./cancellation-retention-stripe";
import { readCancellationRetentionOffer } from "./cancellation-retention-store";
import type { SubscriptionRow } from "./db";
import { PRODUCT_HUNT_CAMPAIGN } from "./product-hunt-promo";
import { readProductHuntBilling } from "./product-hunt-billing-server";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { retentionBillingSnapshot } from "./uninstall-billing";
import { readRetentionClaim, readUninstallAccount } from "./uninstall-store";
import {
	stripeObjectId,
	UNINSTALL_FIRST_CAMPAIGN,
	UNINSTALL_RENEWAL_CAMPAIGN,
	UNINSTALL_REQUEST,
	verifyUninstallCustomer,
} from "./uninstall-stripe";

function isLegacyDiscount(
	discount: string | Stripe.Discount | null | undefined,
) {
	return (
		discount &&
		typeof discount !== "string" &&
		[
			PRODUCT_HUNT_CAMPAIGN,
			UNINSTALL_FIRST_CAMPAIGN,
			UNINSTALL_RENEWAL_CAMPAIGN,
		].includes(discount.coupon?.metadata?.anidachiCampaign ?? "")
	);
}

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
	if (!rows.length) return original;
	const expectedLive = deps.mode() === "live";
	const knownNativeRows = new Set<string>();
	const unavailable = (preserveNative: boolean) => ({
		...original,
		...Object.fromEntries(
			rows
				.filter((row) => row.status === "active")
				.map((row) => [
					row.id,
					{
						state: "unavailable" as const,
						...(preserveNative && knownNativeRows.has(row.id)
							? { campaign: "cancellation_retention" as const }
							: {}),
					},
				]),
		),
	});
	try {
		const [account, claim] = await Promise.all([
			deps.readAccount(userId, { presentationOnly: true }),
			deps.readClaim(userId),
		]);
		if (!account.customerId) return original;
		const current = rows.filter((row) =>
			["active", "past_due", "unpaid", "incomplete"].includes(row.status),
		);
		if (
			current.some(
				(row) =>
					row.user_id !== userId ||
					row.stripe_customer_id !== account.customerId ||
					!account.subscriptionIds.includes(row.stripe_subscription_id),
			)
		)
			throw new Error("Billing offer owner mismatch.");

		const nativeOffers = new Map(
			await Promise.all(
				current.map(
					async (row) =>
						[
							row.id,
							account.pendingCancellation?.stripe_subscription_id ===
							row.stripe_subscription_id
								? account.pendingCancellation
								: await deps.readCancellationOffer(
										userId,
										row.stripe_subscription_id,
									),
						] as const,
				),
			),
		);
		// Establish classification from complete local evidence before entering any
		// provider reads. It may preserve an action, never a discounted amount.
		for (const row of current) {
			const native = nativeOffers.get(row.id);
			if (!native) continue;
			if (
				native.user_id !== userId ||
				native.stripe_customer_id !== account.customerId ||
				native.stripe_subscription_id !== row.stripe_subscription_id
			)
				throw new Error("Cancellation billing ownership unavailable.");
			if (
				!claim &&
				!Object.values(original).some(Boolean) &&
				((native.state === "pending" &&
					!account.grant &&
					native.price_id === row.stripe_price_id) ||
					(native.state === "accepted" && account.grant === "cancellation"))
			)
				knownNativeRows.add(row.id);
		}
		if (account.pendingCancellation) {
			if (!knownNativeRows.size)
				throw new Error("Pending cancellation campaign uncertain.");
			return unavailable(true);
		}
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
			expectedLive,
		);
		if (knownNativeRows.size && isLegacyDiscount(customer.discount))
			throw new Error("Billing legacy campaign conflict.");
		for (const row of current) {
			if (row.stripe_customer_id !== customer.id || row.user_id !== userId)
				throw new Error("Billing offer owner mismatch.");
			const sub = await stripe.subscriptions.retrieve(
				row.stripe_subscription_id,
				{ expand: ["discounts", "items.data.discounts"] },
				UNINSTALL_REQUEST,
			);
			// Validate an observed owner before a later coupon read can fail.
			if (
				sub.id !== row.stripe_subscription_id ||
				sub.livemode !== expectedLive ||
				stripeObjectId(sub.customer) !== customer.id ||
				sub.metadata.userId !== userId
			)
				throw new Error("Cancellation billing ownership unavailable.");
			const native = nativeOffers.get(row.id);
			if (native) {
				const discounts = [
					...sub.discounts,
					...sub.items.data.flatMap((item) => item.discounts ?? []),
				];
				if (knownNativeRows.has(row.id) && discounts.some(isLegacyDiscount))
					throw new Error("Billing legacy campaign conflict.");
				const attached = discounts.find(
					(d) => typeof d !== "string" && d.coupon?.id === native.coupon_id,
				);
				if (attached && typeof attached !== "string") {
					if (
						discounts.length !== 1 ||
						sub.items.has_more ||
						sub.items.data.length !== 1 ||
						sub.items.data[0].quantity !== 1
					)
						throw new Error("Cancellation billing terms unavailable.");
					// Reject explicit immutable-term changes before an optional scope
					// reread. The durable scope is used here only to check other fields;
					// actual scope must still be retrieved before showing a price.
					verifyCancellationCoupon(
						{
							...attached.coupon,
							applies_to: attached.coupon.applies_to ?? {
								products: native.product_ids,
							},
						},
						native,
						expectedLive,
					);
				}
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
					expectedLive,
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
					const snapshot = retentionBillingSnapshot(
						sub,
						claim,
						Date.now(),
						expectedLive,
					);
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
					sub.livemode !== expectedLive ||
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
	} catch (error) {
		return unavailable(isCancellationBillingProviderUnavailable(error));
	}
}
