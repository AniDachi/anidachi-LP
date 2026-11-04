import type Stripe from "stripe";
import {
	hasPositiveSubscriptionInvoice,
	UNINSTALL_REQUEST as REQUEST,
	stripeObjectId,
	UNINSTALL_FIRST_CAMPAIGN,
	type UninstallCatalog,
	verifyUninstallCoupon,
	verifyUninstallCustomer,
} from "./uninstall-stripe";

export type UninstallBinding = {
	id: string;
	user_id: string;
	stripe_customer_id: string;
	coupon_id: string;
	created_at: string;
};
export type UninstallPromotionDeps = {
	stripe: Stripe;
	catalog: UninstallCatalog;
	now?: () => number;
	accountHistory: (
		userId: string,
	) => Promise<{ customerIds: string[]; hasPaid: boolean }>;
	claim: (
		userId: string,
		customerId: string,
		couponId: string,
	) => Promise<UninstallBinding>;
};
/** Frozen reservation terms, not current campaign opt-in, govern recovery.
 * No public code; max_redemptions=1 and durable account identity prevent reissue. */
export async function ensureUninstallPromotion(
	input: { userId: string; customerId: string; couponId: string },
	deps: UninstallPromotionDeps,
): Promise<string> {
	const { stripe } = deps;
	const [coupon, rawCustomer, history, invoices, codes] = await Promise.all([
		stripe.coupons.retrieve(
			input.couponId,
			{ expand: ["applies_to"] },
			REQUEST,
		),
		stripe.customers.retrieve(input.customerId, {}, REQUEST),
		deps.accountHistory(input.userId),
		stripe.invoices.list(
			{ customer: input.customerId, status: "paid", limit: 100 },
			REQUEST,
		),
		stripe.promotionCodes.list(
			{ customer: input.customerId, limit: 100 },
			REQUEST,
		),
	]);
	verifyUninstallCoupon(
		coupon,
		input.couponId,
		UNINSTALL_FIRST_CAMPAIGN,
		deps.catalog,
	);
	const customer = verifyUninstallCustomer(
		rawCustomer,
		input.customerId,
		input.userId,
	);
	if (
		codes.has_more ||
		customer.discount ||
		history.customerIds.some((c) => c !== input.customerId) ||
		history.hasPaid ||
		hasPositiveSubscriptionInvoice(invoices, input.customerId)
	)
		throw new Error("First purchase offer is no longer available.");
	const binding = await deps.claim(
		input.userId,
		input.customerId,
		input.couponId,
	);
	if (
		!binding.id ||
		binding.user_id !== input.userId ||
		binding.stripe_customer_id !== input.customerId ||
		binding.coupon_id !== input.couponId
	)
		throw new Error("First purchase binding mismatch.");
	const owned = codes.data.filter(
		(c) => c.metadata?.anidachiCampaign === UNINSTALL_FIRST_CAMPAIGN,
	);
	if (owned.length > 1)
		throw new Error("First purchase promotion is ambiguous.");
	function verify(code: Stripe.PromotionCode) {
		if (
			stripeObjectId(code.customer) !== input.customerId ||
			code.livemode ||
			code.coupon.id !== input.couponId ||
			code.max_redemptions !== 1 ||
			code.expires_at !== null ||
			code.restrictions.first_time_transaction ||
			code.restrictions.minimum_amount ||
			code.metadata?.userId !== input.userId ||
			code.metadata?.campaignBindingId !== binding.id ||
			code.metadata?.anidachiCampaign !== UNINSTALL_FIRST_CAMPAIGN ||
			code.times_redeemed !== 0 ||
			!code.active
		)
			throw new Error("First purchase promotion unavailable.");
		return code.id;
	}
	if (owned.length) return verify(owned[0]);
	const age = (deps.now ?? Date.now)() - Date.parse(binding.created_at);
	if (!Number.isFinite(age) || age < -300_000 || age >= 23 * 3600_000)
		throw new Error("First purchase promotion needs reconciliation.");
	const created = await stripe.promotionCodes.create(
		{
			coupon: input.couponId,
			customer: input.customerId,
			max_redemptions: 1,
			metadata: {
				userId: input.userId,
				anidachiCampaign: UNINSTALL_FIRST_CAMPAIGN,
				campaignBindingId: binding.id,
			},
		},
		{ ...REQUEST, idempotencyKey: "uninstall-first-promo:" + binding.id },
	);
	return verify(created);
}
