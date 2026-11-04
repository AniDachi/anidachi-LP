import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";
import type { RetentionClaim } from "./retention-invoice";
import type { CheckoutInput, CheckoutResult } from "./subscription-trial";
import {
	UNINSTALL_OFFER_VALID_FOR_MS,
	type UninstallCheckoutInput,
	type UninstallClaimInput,
	UninstallError,
	type UninstallOffer,
	uninstallPrice,
} from "./uninstall-offer";
import { uninstallRevisions } from "./uninstall-revision";
import type { readUninstallAccount, reserveRetention } from "./uninstall-store";
import {
	hasPositiveSubscriptionInvoice,
	UNINSTALL_REQUEST as REQUEST,
	renewalIneligibility,
	stripeObjectId,
	UNINSTALL_CHECKOUT_POLICY,
	UNINSTALL_FIRST_CAMPAIGN,
	UNINSTALL_RENEWAL_CAMPAIGN,
	type UninstallCatalog,
	verifyUninstallCoupon,
	verifyUninstallCustomer,
} from "./uninstall-stripe";

const manageUrl = "/account/billing?manage=1";
export function claimedUninstallOffer(
	c: RetentionClaim,
	now = Date.now(),
): UninstallOffer {
	const missed = c.state === "accepted" && c.target_period_start * 1000 <= now;
	return {
		ownerUserId: c.user_id,
		validForMs:
			c.state === "accepted" && !missed
				? Math.min(
						UNINSTALL_OFFER_VALID_FOR_MS,
						c.target_period_start * 1000 - now,
					)
				: UNINSTALL_OFFER_VALID_FOR_MS,
		kind: "claimed",
		price: uninstallPrice(c.plan_code, c.unit_amount),
		renewsAt: new Date(c.target_period_start * 1000).toISOString(),
		state: missed ? "reconciliation" : c.state,
		reason: missed
			? "Your renewal outcome is being reconciled. Contact support if this persists."
			: c.reason,
		manageUrl,
	};
}
export type UninstallServiceDeps = {
	stripe: Stripe;
	now?: () => number;
	secret: Uint8Array;
	config: () => { firstCoupon: string | null; renewalCoupon: string | null };
	catalog: () => Promise<UninstallCatalog>;
	account: typeof readUninstallAccount;
	readClaim: (userId: string) => Promise<RetentionClaim | null>;
	reserve: typeof reserveRetention;
	checkout: (input: CheckoutInput) => Promise<CheckoutResult>;
};
export function createUninstallService(deps: UninstallServiceDeps) {
	const now = deps.now ?? Date.now;
	const revisions = uninstallRevisions(deps.secret, now);
	/** Presentation only: never revoke an accepted obligation or release its
	 * lifetime allowance. Issuance gates/catalog changes cannot hide a promise. */
	async function restoredClaim(claim: RetentionClaim): Promise<UninstallOffer> {
		if (claim.state !== "accepted" || claim.target_period_start * 1000 <= now())
			return claimedUninstallOffer(claim, now());
		try {
			const [sub, rawCustomer] = await Promise.all([
				deps.stripe.subscriptions.retrieve(
					claim.stripe_subscription_id,
					{},
					REQUEST,
				),
				deps.stripe.customers.retrieve(claim.stripe_customer_id, {}, REQUEST),
			]);
			const customer = verifyUninstallCustomer(
				rawCustomer,
				claim.stripe_customer_id,
				claim.user_id,
			);
			if (
				sub.id !== claim.stripe_subscription_id ||
				sub.livemode ||
				stripeObjectId(sub.customer) !== customer.id ||
				sub.metadata.userId !== claim.user_id
			)
				throw new Error("Reserved subscription ownership unavailable.");
			const item = sub.items.data[0];
			const changed =
				sub.status !== "active" ||
				sub.cancel_at_period_end ||
				sub.cancel_at ||
				sub.schedule ||
				sub.pending_update ||
				sub.pause_collection ||
				sub.pending_invoice_item_interval ||
				sub.billing_thresholds ||
				sub.items.has_more ||
				sub.items.data.length !== 1 ||
				item.price.id !== claim.price_id ||
				item.quantity !== 1 ||
				item.billing_thresholds ||
				item.current_period_end !== claim.target_period_start ||
				!Number.isSafeInteger(item.current_period_start) ||
				item.current_period_start <= 0 ||
				item.current_period_start >= claim.target_period_start ||
				item.price.unit_amount !== claim.unit_amount ||
				!claim.product_ids.includes(stripeObjectId(item.price.product) ?? "") ||
				item.price.recurring?.interval !== "month" ||
				item.price.recurring.interval_count !== 1 ||
				sub.discounts.length ||
				item.discounts.length ||
				customer.discount;
			if (changed)
				return claimedUninstallOffer(
					{
						...claim,
						state: "ineligible",
						reason:
							"Your subscription changed. The reserved discount is not currently eligible; manage your subscription or contact support.",
					},
					now(),
				);
			verifiedBillingPrice(item.price, claim.price_id, false, false, "monthly");
			return claimedUninstallOffer(claim, now());
		} catch {
			return claimedUninstallOffer(
				{
					...claim,
					state: "reconciliation",
					reason:
						"We could not verify your reserved renewal. Your offer remains saved; please retry.",
				},
				now(),
			);
		}
	}
	async function snapshot(userId: string) {
		const base = {
			ownerUserId: userId,
			validForMs: UNINSTALL_OFFER_VALID_FOR_MS,
		};
		const [account, claim] = await Promise.all([
			deps.account(userId),
			deps.readClaim(userId),
		]);
		if (claim) {
			if (
				claim.user_id !== userId ||
				claim.stripe_customer_id !== account.customerId ||
				account.grant !== "renewal"
			)
				throw new Error("Offer ownership changed.");
			return { offer: await restoredClaim(claim), claim };
		}
		const config = deps.config();
		if (!config.firstCoupon && !config.renewalCoupon)
			return {
				offer: {
					...base,
					kind: "disabled",
					reason: "No uninstall offer is currently available.",
				} as UninstallOffer,
			};
		const catalog = await deps.catalog();
		let customer: Stripe.Customer | null = null;
		let active: Stripe.Subscription[] = [];
		let paid = account.hasPaid;
		let paidInvoices: Stripe.Invoice[] = [];
		if (account.customerId) {
			const [raw, subs, invoices] = await Promise.all([
				deps.stripe.customers.retrieve(account.customerId, {}, REQUEST),
				deps.stripe.subscriptions.list(
					{ customer: account.customerId, status: "all", limit: 100 },
					REQUEST,
				),
				deps.stripe.invoices.list(
					{ customer: account.customerId, status: "paid", limit: 100 },
					REQUEST,
				),
			]);
			customer = verifyUninstallCustomer(raw, account.customerId, userId);
			if (
				subs.has_more ||
				subs.data.some(
					(s) =>
						s.livemode ||
						stripeObjectId(s.customer) !== account.customerId ||
						s.metadata.userId !== userId,
				)
			)
				throw new Error("Offer subscription history unavailable.");
			paid =
				hasPositiveSubscriptionInvoice(invoices, account.customerId) || paid;
			paidInvoices = invoices.data;
			active = subs.data.filter(
				(s) => !["canceled", "incomplete_expired"].includes(s.status),
			);
		}
		if (active.length > 1)
			throw new Error("Offer subscription mapping is ambiguous.");
		const sub = active[0];
		const manage = (reason: string) => ({
			offer: { ...base, kind: "manage", reason, manageUrl } as UninstallOffer,
		});
		if (sub && customer) {
			if (account.grant)
				return manage(
					"An uninstall offer was already used or reserved for this account. Contact support if a previous checkout needs reconciliation.",
				);
			const reason = renewalIneligibility(sub, catalog, customer, userId);
			if (reason) return manage(reason);
			if (!config.renewalCoupon)
				return manage("No renewal offer is currently available.");
			if (
				!paidInvoices.some(
					(i) =>
						i.total > 0 &&
						stripeObjectId(i.parent?.subscription_details?.subscription) ===
							sub.id,
				)
			)
				return manage(
					"This offer requires a previously paid invoice for the current subscription.",
				);
			if (!account.subscriptionIds.includes(sub.id))
				throw new Error("Subscription reconciliation required.");
			const item = sub.items.data[0];
			if (item.current_period_end * 1000 <= now() + 3600_000)
				return manage(
					"Your next invoice is too close to confirm this offer safely.",
				);
			const coupon = await deps.stripe.coupons.retrieve(
				config.renewalCoupon,
				{ expand: ["applies_to"] },
				REQUEST,
			);
			verifyUninstallCoupon(
				coupon,
				config.renewalCoupon,
				UNINSTALL_RENEWAL_CAMPAIGN,
				catalog,
			);
			// Refuse an already issued target invoice, including draft/open invoices.
			const upcoming = await deps.stripe.invoices.list(
				{ customer: customer.id, subscription: sub.id, limit: 100 },
				REQUEST,
			);
			if (upcoming.has_more)
				throw new Error("Renewal invoice history incomplete.");
			if (
				upcoming.data.some(
					(i) =>
						stripeObjectId(i.customer) !== account.customerId ||
						stripeObjectId(i.parent?.subscription_details?.subscription) !==
							sub.id ||
						i.livemode ||
						i.lines.has_more,
				)
			)
				throw new Error("Renewal invoice history unavailable.");
			if (
				upcoming.data.some((i) =>
					i.lines.data.some((l) => l.period.start === item.current_period_end),
				)
			)
				return manage("Your next invoice has already been issued.");
			const planCode = catalog.plus.id === item.price.id ? "plus" : "pro";
			const price = uninstallPrice(
				planCode,
				catalog[planCode].unit_amount ?? 0,
			);
			if (item.price.unit_amount !== price.ordinaryAmount)
				throw new Error("Subscription price changed.");
			const terms = {
				user_id: userId,
				stripe_customer_id: customer.id,
				stripe_subscription_id: sub.id,
				coupon_id: coupon.id,
				product_ids: Object.values(catalog).map(
					(p) => stripeObjectId(p.product) ?? "",
				),
				price_id: item.price.id,
				plan_code: planCode,
				unit_amount: price.ordinaryAmount,
				target_period_start: item.current_period_end,
			} as const;
			const review = JSON.stringify({
				kind: "renewal",
				...terms,
				currentPeriodStart: item.current_period_start,
			});
			return {
				offer: {
					...base,
					kind: "renewal",
					price,
					renewsAt: new Date(item.current_period_end * 1000).toISOString(),
					revision: revisions.sign(review),
					manageUrl,
				} as UninstallOffer,
				review,
				terms,
			};
		}
		if (paid)
			return {
				offer: {
					...base,
					kind: "former",
					reason: "Previous subscribers can return using regular pricing.",
				} as UninstallOffer,
			};
		if (account.grant === "renewal")
			return {
				offer: {
					...base,
					kind: "disabled",
					reason: "Your one-time uninstall offer was already reserved.",
				} as UninstallOffer,
			};
		if (customer?.discount)
			return manage("Your account already has a discount.");
		if (!config.firstCoupon)
			return {
				offer: {
					...base,
					kind: "disabled",
					reason: "No first-month offer is currently available.",
				} as UninstallOffer,
			};
		const coupon = await deps.stripe.coupons.retrieve(
			config.firstCoupon,
			{ expand: ["applies_to"] },
			REQUEST,
		);
		verifyUninstallCoupon(
			coupon,
			config.firstCoupon,
			UNINSTALL_FIRST_CAMPAIGN,
			catalog,
		);
		const prices = (["plus", "pro"] as const).map((plan) =>
			uninstallPrice(plan, catalog[plan].unit_amount ?? 0),
		);
		const review = JSON.stringify({
			kind: "first_month",
			userId,
			couponId: coupon.id,
			prices: Object.values(catalog).map((p) => [
				p.id,
				p.unit_amount,
				stripeObjectId(p.product),
			]),
		});
		return {
			offer: {
				...base,
				kind: "first_month",
				prices,
				revision: revisions.sign(review),
			} as UninstallOffer,
			review,
			catalog,
			couponId: coupon.id,
		};
	}
	return {
		async offer(userId: string | null): Promise<UninstallOffer> {
			if (!userId)
				return {
					kind: "sign_in",
					ownerUserId: null,
					validForMs: UNINSTALL_OFFER_VALID_FOR_MS,
					loginUrl: "/login?next=%2Funinstall",
				};
			try {
				return (await snapshot(userId)).offer;
			} catch {
				return {
					kind: "unavailable",
					ownerUserId: userId,
					validForMs: UNINSTALL_OFFER_VALID_FOR_MS,
					reason: "We could not verify your offer. Please retry.",
				};
			}
		},
		async claim(
			userId: string,
			input: UninstallClaimInput,
		): Promise<UninstallOffer> {
			if (input.expectedOwnerUserId !== userId)
				throw new UninstallError(
					409,
					"Your account changed. Reload the offer.",
				);
			const current = await snapshot(userId);
			if (current.claim) {
				if (current.claim.review_revision !== input.revision)
					throw new UninstallError(
						409,
						"This account already has a reserved offer. Reload the page.",
					);
				return current.offer;
			}
			if (current.offer.kind !== "renewal" || !current.review || !current.terms)
				throw new UninstallError(
					409,
					"This renewal offer is no longer available.",
				);
			revisions.verify(input.revision, current.review);
			const claim = await deps.reserve({
				...current.terms,
				review_revision: input.revision,
			});
			if (
				claim.user_id !== userId ||
				claim.review_revision !== input.revision ||
				claim.stripe_subscription_id !== current.terms.stripe_subscription_id
			)
				throw new Error("Renewal reservation changed.");
			return claimedUninstallOffer(claim, now());
		},
		async checkout(
			userId: string,
			input: UninstallCheckoutInput,
			origin: string,
		) {
			if (input.expectedOwnerUserId !== userId)
				throw new UninstallError(
					409,
					"Your account changed. Reload the offer.",
				);
			const current = await snapshot(userId);
			if (
				current.offer.kind !== "first_month" ||
				!current.review ||
				!current.catalog ||
				!current.couponId
			)
				throw new UninstallError(
					409,
					"This first-month offer is no longer available.",
				);
			revisions.verify(input.revision, current.review);
			const expected = current.offer.prices.find(
				(p) => p.planCode === input.planCode,
			);
			if (
				!expected ||
				!input.expectedPrice ||
				Object.entries(expected).some(
					([k, v]) => input.expectedPrice[k as keyof typeof expected] !== v,
				)
			)
				throw new UninstallError(
					409,
					"The displayed price changed. Review it again.",
				);
			const result = await deps.checkout({
				userId,
				email: "",
				planCode: input.planCode,
				priceId: current.catalog[input.planCode].id,
				billingPeriod: "monthly",
				origin,
				requestId: input.requestId,
				displayedOffer: {
					trial: false,
					price: { unitAmount: expected.ordinaryAmount, currency: "usd" },
				},
				attribution: {
					checkoutPromotionPolicy: UNINSTALL_CHECKOUT_POLICY,
					uninstallCouponId: current.couponId,
					billingPeriod: "monthly",
					checkoutPagePath: "/uninstall",
				},
			});
			return { ownerUserId: userId, url: result.url, kind: result.kind };
		},
	};
}
