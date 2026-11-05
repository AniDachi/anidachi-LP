import { db } from "./db";

export type CancellationTerms = {
	user_id: string;
	stripe_customer_id: string;
	stripe_subscription_id: string;
	price_id: string;
	product_ids: [string, string];
	target_period_start: number;
};
export type CancellationOffer = CancellationTerms & {
	id: string;
	coupon_id: string;
	redeem_by: number;
	state: "pending" | "accepted" | "expired";
	created_at: string;
	accepted_at: string | null;
	reconciled_at: string | null;
};
export type CancellationEvidence = {
	observedAt: number;
	timesRedeemed: 0 | 1;
	missing: boolean;
	couponValid: boolean | null;
	expiryAuthoritative: boolean;
};
export type CancellationStore = {
	pending(userId: string): Promise<CancellationOffer | null>;
	account(userId: string): Promise<{
		customerId: string | null;
		subscriptionIds: string[];
		hasGrant: boolean;
		legacyBusy: boolean;
	}>;
	reserve(terms: CancellationTerms): Promise<CancellationOffer>;
	reconcile(
		offer: CancellationOffer,
		evidence: CancellationEvidence,
	): Promise<void>;
};
const signal = () => AbortSignal.timeout(8000);
async function rpc(name: string, input: Record<string, unknown>) {
	const result = await db().rpc(name, input).abortSignal(signal());
	if (result.error || !result.data)
		throw new Error("Cancellation offer storage unavailable.");
	return result.data;
}
export const cancellationRetentionStore: CancellationStore = {
	async pending(userId) {
		const result = await db()
			.from("cancellation_retention_offers")
			.select("*")
			.eq("user_id", userId)
			.eq("state", "pending")
			.abortSignal(signal())
			.maybeSingle();
		if (result.error || (result.data && result.data.user_id !== userId))
			throw new Error("Cancellation reservation unavailable.");
		return result.data as CancellationOffer | null;
	},
	async account(userId) {
		const [mapping, subs, grants, trials, activations, renewals] =
			await Promise.all([
				db()
					.from("billing_customers")
					.select("user_id,stripe_customer_id")
					.eq("user_id", userId)
					.abortSignal(signal())
					.maybeSingle(),
				db()
					.from("subscriptions")
					.select("user_id,stripe_customer_id,stripe_subscription_id")
					.eq("user_id", userId)
					.limit(101)
					.abortSignal(signal()),
				db()
					.from("uninstall_offer_grants")
					.select("user_id,stripe_customer_id")
					.eq("user_id", userId)
					.abortSignal(signal())
					.maybeSingle(),
				db()
					.from("account_subscription_trials")
					.select("user_id,trial_ends_at,first_payment_state")
					.eq("user_id", userId)
					.limit(101)
					.abortSignal(signal()),
				db()
					.from("subscription_trial_activations")
					.select("user_id,state")
					.eq("user_id", userId)
					.in("state", ["pending", "created"])
					.limit(1)
					.abortSignal(signal()),
				db()
					.from("subscription_trial_renewals")
					.select("user_id,state")
					.eq("user_id", userId)
					.eq("state", "applying")
					.limit(1)
					.abortSignal(signal()),
			]);
		if (
			[mapping, subs, grants, trials, activations, renewals].some(
				(r) => r.error,
			) ||
			!subs.data ||
			!trials.data ||
			!activations.data ||
			!renewals.data ||
			subs.data.length > 100 ||
			trials.data.length > 100 ||
			(mapping.data && mapping.data.user_id !== userId) ||
			(grants.data && grants.data.user_id !== userId)
		)
			throw new Error("Cancellation account history unavailable.");
		const customerId = mapping.data?.stripe_customer_id ?? null;
		if (
			subs.data.some(
				(s) => s.user_id !== userId || s.stripe_customer_id !== customerId,
			) ||
			(grants.data && grants.data.stripe_customer_id !== customerId)
		)
			throw new Error("Cancellation account mapping changed.");
		return {
			customerId,
			subscriptionIds: subs.data.map((s) => s.stripe_subscription_id as string),
			hasGrant: !!grants.data,
			legacyBusy:
				!!activations.data.length ||
				!!renewals.data.length ||
				trials.data.some(
					(t) =>
						t.user_id !== userId ||
						(t.first_payment_state !== "paid" &&
							new Date(t.trial_ends_at).getTime() > Date.now()),
				),
		};
	},
	reserve: (terms) =>
		rpc("reserve_cancellation_retention_v1", {
			p_user_id: terms.user_id,
			p_customer_id: terms.stripe_customer_id,
			p_subscription_id: terms.stripe_subscription_id,
			p_price_id: terms.price_id,
			p_product_ids: terms.product_ids,
			p_target_period_start: terms.target_period_start,
		}),
	async reconcile(offer, evidence) {
		await rpc("reconcile_cancellation_retention_v1", {
			p_user_id: offer.user_id,
			p_customer_id: offer.stripe_customer_id,
			p_offer_id: offer.id,
			p_coupon_id: offer.coupon_id,
			p_observed_at: evidence.observedAt,
			p_times_redeemed: evidence.timesRedeemed,
			p_coupon_missing: evidence.missing,
			p_coupon_valid: evidence.couponValid,
			p_expiry_authoritative: evidence.expiryAuthoritative,
		});
	},
};

/** Billing can inspect an accepted coupon's frozen target without issuing one. */
export async function readCancellationRetentionOffer(
	userId: string,
	subscriptionId: string,
): Promise<CancellationOffer | null> {
	const result = await db()
		.from("cancellation_retention_offers")
		.select("*")
		.eq("user_id", userId)
		.eq("stripe_subscription_id", subscriptionId)
		.in("state", ["pending", "accepted"])
		.order("created_at", { ascending: false })
		.limit(1)
		.abortSignal(signal())
		.maybeSingle();
	if (
		result.error ||
		(result.data &&
			(result.data.user_id !== userId ||
				result.data.stripe_subscription_id !== subscriptionId))
	)
		throw new Error("Cancellation offer billing unavailable.");
	return result.data as CancellationOffer | null;
}
