import type Stripe from "stripe";

export const PRODUCT_HUNT_CAMPAIGN = "product_hunt_2026";
export const PRODUCT_HUNT_CODE = "ANIHUNT40";
export const PRODUCT_HUNT_EXPIRES_AT =
	Date.parse("2026-11-01T17:00:00Z") / 1000;
export const CHECKOUT_PROMOTION_POLICY = "monthly_purchase_v1";
const REQUEST = { timeout: 15_000, maxNetworkRetries: 0 } as const;
const REPLAY_WINDOW_MS = 23 * 3600_000;

export type CampaignBinding = {
	id: string;
	user_id: string;
	stripe_customer_id: string;
	coupon_id: string;
	created_at: string;
};
export type ProductHuntPromoDeps = {
	stripe: Stripe;
	couponId: string | undefined;
	livemode: boolean;
	monthlyPriceIds: readonly string[];
	now?: () => number;
	accountHistory: (
		userId: string,
	) => Promise<{ customerIds: string[]; hasPaid: boolean }>;
	claim: (
		userId: string,
		customerId: string,
		couponId: string,
	) => Promise<CampaignBinding>;
};
const id = (value: string | { id: string } | null | undefined) =>
	typeof value === "string" ? value : value?.id;
function unavailable(): never {
	throw new Error(
		"Promotion verification unavailable; reconciliation required.",
	);
}

/** Called only for an owner-verified, direct monthly purchase after the existing
 * Checkout reservation has retired incompatible sessions. Never starts a trial,
 * attaches a discount, changes a subscription, or accepts a browser coupon ID. */
export async function ensureProductHuntPromotion(
	input: { userId: string; customerId: string },
	deps: ProductHuntPromoDeps,
): Promise<boolean> {
	if (!deps.couponId) return false;
	const { stripe, couponId } = deps;
	const now = (deps.now ?? Date.now)();
	const [coupon, customer, history, prices, codes, invoices] =
		await Promise.all([
			stripe.coupons.retrieve(couponId, { expand: ["applies_to"] }, REQUEST),
			stripe.customers.retrieve(input.customerId, {}, REQUEST),
			deps.accountHistory(input.userId),
			Promise.all(
				deps.monthlyPriceIds.map((priceId) =>
					stripe.prices.retrieve(priceId, {}, REQUEST),
				),
			),
			stripe.promotionCodes.list(
				{ customer: input.customerId, code: PRODUCT_HUNT_CODE, limit: 100 },
				REQUEST,
			),
			stripe.invoices.list(
				{ customer: input.customerId, status: "paid", limit: 100 },
				REQUEST,
			),
		]);
	if (
		customer.deleted ||
		customer.id !== input.customerId ||
		customer.livemode !== deps.livemode ||
		(customer.metadata.userId && customer.metadata.userId !== input.userId) ||
		history.customerIds.some((customerId) => customerId !== input.customerId) ||
		codes.has_more ||
		invoices.has_more
	)
		unavailable();
	const products = prices.map((price) => id(price.product));
	const scoped = coupon.applies_to?.products ?? [];
	if (
		prices.length !== 2 ||
		new Set(deps.monthlyPriceIds).size !== 2 ||
		products.some((product) => !product) ||
		new Set(products).size !== 2 ||
		prices.some(
			(price, index) =>
				price.id !== deps.monthlyPriceIds[index] ||
				!price.active ||
				price.livemode !== deps.livemode ||
				price.type !== "recurring" ||
				price.currency !== "usd" ||
				price.billing_scheme !== "per_unit" ||
				price.transform_quantity ||
				price.recurring?.interval !== "month" ||
				price.recurring.interval_count !== 1 ||
				price.recurring.usage_type !== "licensed",
		) ||
		coupon.id !== couponId ||
		coupon.livemode !== deps.livemode ||
		coupon.percent_off !== 40 ||
		coupon.amount_off !== null ||
		coupon.duration !== "repeating" ||
		coupon.duration_in_months !== 3 ||
		coupon.metadata?.anidachiCampaign !== PRODUCT_HUNT_CAMPAIGN ||
		coupon.redeem_by !== PRODUCT_HUNT_EXPIRES_AT ||
		scoped.length !== 2 ||
		!products.every((product) => scoped.includes(product!))
	)
		unavailable();

	for (const invoice of invoices.data) {
		if (
			id(invoice.customer) !== input.customerId ||
			invoice.livemode !== deps.livemode ||
			invoice.status !== "paid" ||
			!Number.isSafeInteger(invoice.total)
		)
			unavailable();
	}
	// A refunded invoice remains evidence of a prior paid subscription. Zero-dollar
	// trial invoices don't count; positive invoices settled by credit do count.
	const hasPaid =
		history.hasPaid ||
		invoices.data.some(
			(invoice) =>
				invoice.total > 0 &&
				!!invoice.parent?.subscription_details?.subscription,
		);
	const ownedCodes = codes.data.filter(
		(code) => code.code.toUpperCase() === PRODUCT_HUNT_CODE,
	);
	if (ownedCodes.length !== codes.data.length || ownedCodes.length > 1)
		unavailable();
	for (const code of ownedCodes) {
		if (
			id(code.customer) !== input.customerId ||
			code.livemode !== deps.livemode ||
			code.coupon.id !== couponId ||
			code.max_redemptions !== 1 ||
			code.expires_at !== coupon.redeem_by ||
			code.metadata?.userId !== input.userId ||
			code.metadata.anidachiCampaign !== PRODUCT_HUNT_CAMPAIGN ||
			code.restrictions.first_time_transaction ||
			!Number.isSafeInteger(code.times_redeemed)
		)
			unavailable();
	}
	if (hasPaid || customer.discount) {
		for (const code of ownedCodes) {
			if (code.active && code.times_redeemed === 0)
				await stripe.promotionCodes.update(code.id, { active: false }, REQUEST);
		}
		return false;
	}
	if (!coupon.valid || now >= coupon.redeem_by * 1000) return false;
	const binding = await deps.claim(input.userId, input.customerId, couponId);
	if (
		!binding.id ||
		binding.user_id !== input.userId ||
		binding.stripe_customer_id !== input.customerId ||
		binding.coupon_id !== couponId ||
		!Number.isFinite(Date.parse(binding.created_at))
	)
		unavailable();
	if (ownedCodes.length) {
		const code = ownedCodes[0];
		if (code.metadata?.campaignBindingId !== binding.id) unavailable();
		return code.active && code.times_redeemed === 0;
	}
	const age = now - Date.parse(binding.created_at);
	if (age < -300_000 || age >= REPLAY_WINDOW_MS) unavailable();
	// Stable account binding plus Stripe idempotency protects concurrent requests
	// and lost responses. An old, missing outcome requires operator reconciliation;
	// it must never become a new code with a fresh redemption allowance.
	const created = await stripe.promotionCodes.create(
		{
			coupon: couponId,
			code: PRODUCT_HUNT_CODE,
			customer: input.customerId,
			max_redemptions: 1,
			expires_at: coupon.redeem_by,
			restrictions: { first_time_transaction: false },
			metadata: {
				anidachiCampaign: PRODUCT_HUNT_CAMPAIGN,
				userId: input.userId,
				campaignBindingId: binding.id,
			},
		},
		{ ...REQUEST, idempotencyKey: "product-hunt-promo:" + binding.id },
	);
	if (
		created.customer !== input.customerId ||
		created.coupon.id !== couponId ||
		created.livemode !== deps.livemode ||
		created.metadata?.campaignBindingId !== binding.id ||
		created.code.toUpperCase() !== PRODUCT_HUNT_CODE ||
		created.max_redemptions !== 1 ||
		created.expires_at !== coupon.redeem_by ||
		created.times_redeemed !== 0 ||
		!created.active
	)
		unavailable();
	return true;
}
