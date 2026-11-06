import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";
import { verifyCancellationCatalog } from "./cancellation-retention-catalog";
import {
	cancellationRetentionStore,
	type CancellationOffer,
	type CancellationStore,
} from "./cancellation-retention-store";
import {
	cancellationCouponParams,
	CANCELLATION_REQUEST as REQUEST,
	isMissingCancellationCoupon,
	verifyCancellationCoupon,
} from "./cancellation-retention-stripe";
import { resolveStripeMode } from "./stripe-env";
import { stripeObjectId, verifyUninstallCustomer } from "./uninstall-stripe";

type Catalog = Awaited<ReturnType<typeof verifyCancellationCatalog>>;
export type CancellationRetentionDeps = {
	stripe: Stripe;
	store: CancellationStore;
	now?: () => number;
	isTest?: () => boolean;
	enabled?: () => boolean;
	catalog?: () => Promise<Catalog>;
};
export function createCancellationRetentionService(
	deps: CancellationRetentionDeps,
) {
	const now = deps.now ?? Date.now;
	const isTest = deps.isTest ?? (() => resolveStripeMode() === "test");
	const enabled =
		deps.enabled ??
		(() =>
			process.env[
				`STRIPE_CANCELLATION_RETENTION_ENABLED_${isTest() ? "TEST" : "LIVE"}`
			] === "1");
	const catalog =
		deps.catalog ?? (() => verifyCancellationCatalog(deps.stripe));
	async function readCoupon(offer: CancellationOffer) {
		try {
			const coupon = await deps.stripe.coupons.retrieve(
				offer.coupon_id,
				{ expand: ["applies_to"] },
				REQUEST,
			);
			verifyCancellationCoupon(coupon, offer, !isTest());
			return coupon;
		} catch (error) {
			if (isMissingCancellationCoupon(error)) return null;
			throw error;
		}
	}
	async function reconcile(userId: string): Promise<void> {
		const offer = await deps.store.pending(userId);
		if (!offer) return;
		if (offer.user_id !== userId || offer.state !== "pending")
			throw new Error("Cancellation reservation owner changed.");
		// Timestamp before the provider read: a slow pre-deadline read cannot release
		// a hold after another tab redeems it while that request is in flight.
		const observedAt = Math.floor(now() / 1000);
		const customer = verifyUninstallCustomer(
			await deps.stripe.customers.retrieve(
				offer.stripe_customer_id,
				{},
				REQUEST,
			),
			offer.stripe_customer_id,
			userId,
			!isTest(),
		);
		// Stripe TEST clocks can keep an old portal redeemable after real-time
		// coupon expiry. Establish monotonic provider clock expiry BEFORE the final
		// zero-redemption read. Clock uncertainty blocks release, never acceptance.
		const clockId = stripeObjectId(customer.test_clock);
		if (customer.test_clock != null && (!clockId || !isTest()))
			throw new Error("Cancellation clock ownership unavailable.");
		let clockAllowsExpiry = !clockId;
		if (clockId) {
			try {
				const clock = await deps.stripe.testHelpers.testClocks.retrieve(
					clockId,
					{},
					REQUEST,
				);
				clockAllowsExpiry =
					clock.id === clockId &&
					clock.livemode === false &&
					clock.status === "ready" &&
					Number.isSafeInteger(clock.frozen_time) &&
					clock.frozen_time > offer.redeem_by;
			} catch {
				clockAllowsExpiry = false;
			}
		}
		const coupon = await readCoupon(offer);
		const expiryAuthoritative =
			clockAllowsExpiry &&
			observedAt > offer.redeem_by &&
			(!coupon || coupon.valid === false);
		if (coupon?.times_redeemed === 1 || expiryAuthoritative)
			await deps.store.reconcile(offer, {
				observedAt,
				timesRedeemed: coupon?.times_redeemed === 1 ? 1 : 0,
				missing: !coupon,
				couponValid: coupon?.valid ?? null,
				expiryAuthoritative,
			});
	}
	async function prepare(
		userId: string,
		customerId: string,
		subscriptionId: string,
	): Promise<string | null> {
		await reconcile(userId); // Rollback disables issuance, never accepted-grant reconciliation.
		if (!enabled()) return null;
		const account = await deps.store.account(userId);
		if (
			account.customerId !== customerId ||
			!account.subscriptionIds.includes(subscriptionId)
		)
			throw new Error("Cancellation subscription mapping changed.");
		if (account.hasGrant || account.legacyBusy) return null;
		const [rawCustomer, sub, subs, invoices, scope] = await Promise.all([
			deps.stripe.customers.retrieve(customerId, {}, REQUEST),
			deps.stripe.subscriptions.retrieve(subscriptionId, {}, REQUEST),
			deps.stripe.subscriptions.list(
				{ customer: customerId, status: "all", limit: 100 },
				REQUEST,
			),
			deps.stripe.invoices.list(
				{ customer: customerId, subscription: subscriptionId, limit: 100 },
				REQUEST,
			),
			catalog(),
		]);
		const customer = verifyUninstallCustomer(
			rawCustomer,
			customerId,
			userId,
			!isTest(),
		);
		if (
			sub.id !== subscriptionId ||
			sub.livemode !== !isTest() ||
			stripeObjectId(sub.customer) !== customerId ||
			sub.metadata.userId !== userId ||
			subs.has_more ||
			subs.data.some(
				(s) =>
					s.livemode !== !isTest() ||
					stripeObjectId(s.customer) !== customerId ||
					s.metadata.userId !== userId,
			)
		)
			throw new Error("Cancellation subscription ownership unavailable.");
		const active = subs.data.filter(
			(s) => !["canceled", "incomplete_expired"].includes(s.status),
		);
		if (active.length !== 1 || active[0].id !== sub.id) return null;
		const item = sub.items.data[0];
		if (
			sub.status !== "active" ||
			sub.cancel_at_period_end ||
			sub.cancel_at ||
			sub.schedule ||
			sub.pending_update ||
			sub.pause_collection ||
			sub.pending_invoice_item_interval ||
			sub.billing_thresholds ||
			sub.discounts.length ||
			customer.discount ||
			sub.items.has_more ||
			sub.items.data.length !== 1 ||
			item.quantity !== 1 ||
			item.discounts.length ||
			item.billing_thresholds ||
			!scope.monthlyPriceIds.includes(item.price.id) ||
			!scope.productIds.includes(stripeObjectId(item.price.product) ?? "") ||
			item.price.recurring?.interval !== "month" ||
			item.price.recurring.interval_count !== 1 ||
			!Number.isSafeInteger(item.current_period_start) ||
			!Number.isSafeInteger(item.current_period_end) ||
			item.current_period_start >= item.current_period_end ||
			item.current_period_end * 1000 <= now() + 3600_000 ||
			(sub.trial_end && sub.trial_end * 1000 > now())
		)
			return null;
		verifiedBillingPrice(item.price, item.price.id, !isTest(), true, "monthly");
		if (
			invoices.has_more ||
			invoices.data.some(
				(i) =>
					i.livemode !== !isTest() ||
					stripeObjectId(i.customer) !== customerId ||
					stripeObjectId(i.parent?.subscription_details?.subscription) !==
						subscriptionId ||
					i.lines.has_more,
			)
		)
			throw new Error("Cancellation invoice history unavailable.");
		const paidMonthly = invoices.data.some(
			(i) =>
				i.status === "paid" &&
				i.total > 0 &&
				i.lines.data.some(
					(line) =>
						line.amount > 0 &&
						line.pricing?.type === "price_details" &&
						scope.monthlyPriceIds.includes(
							line.pricing.price_details?.price ?? "",
						) &&
						scope.productIds.includes(
							line.pricing.price_details?.product ?? "",
						),
				),
		);
		if (
			!paidMonthly ||
			invoices.data.some((i) =>
				i.lines.data.some(
					(line) => line.period.start === item.current_period_end,
				),
			)
		)
			return null;
		const offer = await deps.store.reserve({
			user_id: userId,
			stripe_customer_id: customerId,
			stripe_subscription_id: subscriptionId,
			price_id: item.price.id,
			product_ids: scope.productIds,
			target_period_start: item.current_period_end,
		});
		if (
			offer.user_id !== userId ||
			offer.stripe_customer_id !== customerId ||
			offer.stripe_subscription_id !== subscriptionId ||
			offer.price_id !== item.price.id ||
			offer.target_period_start !== item.current_period_end ||
			offer.state !== "pending" ||
			offer.product_ids.length !== 2 ||
			!scope.productIds.every((id) => offer.product_ids.includes(id))
		)
			throw new Error("Cancellation reservation changed.");
		if (Math.floor(now() / 1000) >= offer.redeem_by) return null;
		let coupon = await readCoupon(offer);
		if (!coupon) {
			if (Math.floor(now() / 1000) >= offer.redeem_by) return null;
			// Durable identity prevents replacement after ambiguous creates and across
			// Stripe's idempotency-key retention window. Retrieve + validate on retry.
			coupon = await deps.stripe.coupons.create(
				cancellationCouponParams(offer),
				{ ...REQUEST, idempotencyKey: `cancellation-retention-v1:${offer.id}` },
			);
			verifyCancellationCoupon(coupon, offer, !isTest());
		}
		if (
			coupon.times_redeemed !== 0 ||
			!coupon.valid ||
			Math.floor(now() / 1000) >= offer.redeem_by
		)
			return null;
		return coupon.id;
	}
	return { prepare, reconcile };
}
export async function prepareCancellationRetention(
	userId: string,
	customerId: string,
	subscriptionId: string,
	stripe: Stripe,
): Promise<string | null> {
	return createCancellationRetentionService({
		stripe,
		store: cancellationRetentionStore,
	}).prepare(userId, customerId, subscriptionId);
}
export async function reconcileCancellationRetention(
	userId: string,
	stripe: Stripe,
): Promise<void> {
	return createCancellationRetentionService({
		stripe,
		store: cancellationRetentionStore,
	}).reconcile(userId);
}
