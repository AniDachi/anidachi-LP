import { reconcileCancellationRetention } from "./cancellation-retention";
import { cancellationRetentionStore } from "./cancellation-retention-store";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { db } from "./db";
import type { RetentionClaim, RetentionInvoiceDeps } from "./retention-invoice";
import { UninstallError, type UninstallFeedbackInput } from "./uninstall-offer";
import type { UninstallBinding } from "./uninstall-promotion";

const signal = () => AbortSignal.timeout(8000);
async function rpc(name: string, input: Record<string, unknown>) {
	const { data, error } = await db().rpc(name, input).abortSignal(signal());
	if (error) throw new Error("Uninstall offer storage unavailable.");
	return data;
}
export async function readUninstallAccount(
	userId: string,
	options: { presentationOnly?: boolean } = {},
) {
	// Reconcile provider redemption before trusting the shared allowance. A live
	// pending hold is temporary unavailability, never a permanent used claim.
	if (
		resolveStripeMode() === "test" &&
		(await cancellationRetentionStore.pending(userId))
	) {
		await reconcileCancellationRetention(userId, createStripeClient());
		if (!options.presentationOnly && await cancellationRetentionStore.pending(userId))
			throw new Error("Cancellation offer verification pending. Please retry.");
	}

	const [mapping, subs, trials, grant] = await Promise.all([
		db()
			.from("billing_customers")
			.select("user_id,stripe_customer_id")
			.eq("user_id", userId)
			.abortSignal(signal())
			.maybeSingle(),
		db()
			.from("subscriptions")
			.select("user_id,stripe_customer_id,stripe_subscription_id,status")
			.eq("user_id", userId)
			.limit(101)
			.abortSignal(signal()),
		db()
			.from("account_subscription_trials")
			.select("first_paid_at,first_cash_paid_at")
			.eq("user_id", userId)
			.limit(101)
			.abortSignal(signal()),
		db()
			.from("uninstall_offer_grants")
			.select("user_id,stripe_customer_id,kind")
			.eq("user_id", userId)
			.abortSignal(signal())
			.maybeSingle(),
	]);
	if (
		mapping.error ||
		subs.error ||
		trials.error ||
		grant.error ||
		!subs.data ||
		!trials.data ||
		subs.data.length > 100 ||
		trials.data.length > 100 ||
		(mapping.data && mapping.data.user_id !== userId) ||
		(grant.data && grant.data.user_id !== userId)
	)
		throw new Error("Offer history unavailable.");
	const customerId: string | null = mapping.data?.stripe_customer_id ?? null;
	const customerIds = subs.data.map((s) => s.stripe_customer_id as string);
	if (
		customerIds.some((id) => id !== customerId) ||
		(grant.data && grant.data.stripe_customer_id !== customerId)
	)
		throw new Error("Offer account mapping changed.");
	let firstBinding: UninstallBinding | null = null;
	if (grant.data?.kind === "first") {
		const binding = await db().from("uninstall_first_bindings")
			.select("id,user_id,stripe_customer_id,coupon_id,created_at")
			.eq("user_id", userId).abortSignal(signal()).maybeSingle();
		if (binding.error || !binding.data || binding.data.user_id !== userId ||
			binding.data.stripe_customer_id !== customerId)
			throw new Error("First-month reservation unavailable.");
		firstBinding = binding.data as UninstallBinding;
	}
	return {
		customerId,
		customerIds,
		hasPaid: trials.data.some((t) => t.first_paid_at || t.first_cash_paid_at),
		grant: grant.data?.kind as "first" | "renewal" | "cancellation" | undefined,
		firstBinding,
		subscriptionIds: subs.data.map((s) => s.stripe_subscription_id as string),
	};
}
export async function claimUninstallFirst(
	userId: string,
	customerId: string,
	couponId: string,
): Promise<UninstallBinding> {
	return rpc("claim_uninstall_first_v1", {
		p_user_id: userId,
		p_customer_id: customerId,
		p_coupon_id: couponId,
	});
}
export async function readRetentionClaim(
	userId: string,
): Promise<RetentionClaim | null> {
	const { data, error } = await db()
		.from("uninstall_retention_claims")
		.select("*")
		.eq("user_id", userId)
		.abortSignal(signal())
		.maybeSingle();
	if (error) throw new Error("Retention state unavailable.");
	if (data && data.user_id !== userId)
		throw new Error("Retention owner mismatch.");
	return data as RetentionClaim | null;
}
export async function reserveRetention(
	c: Omit<
		RetentionClaim,
		"id" | "state" | "stripe_invoice_id" | "reason" | "created_at"
	>,
): Promise<RetentionClaim> {
	return rpc("reserve_uninstall_retention_v1", {
		p_user_id: c.user_id,
		p_customer_id: c.stripe_customer_id,
		p_subscription_id: c.stripe_subscription_id,
		p_coupon_id: c.coupon_id,
		p_product_ids: c.product_ids,
		p_price_id: c.price_id,
		p_plan_code: c.plan_code,
		p_unit_amount: c.unit_amount,
		p_target_period_start: c.target_period_start,
		p_review_revision: c.review_revision,
	});
}
export const retentionInvoiceStore: Omit<RetentionInvoiceDeps, "stripe"> = {
	async find(subscriptionId) {
		const { data, error } = await db()
			.from("uninstall_retention_claims")
			.select("*")
			.eq("stripe_subscription_id", subscriptionId)
			.abortSignal(signal())
			.maybeSingle();
		if (error) throw new Error("Retention invoice lookup unavailable.");
		return data as RetentionClaim | null;
	},
	bind: (claimId, invoiceId) =>
		rpc("bind_uninstall_retention_invoice_v1", {
			p_claim_id: claimId,
			p_invoice_id: invoiceId,
		}),
	async finish(claimId, invoiceId, state, reason) {
		await rpc("finish_uninstall_retention_v1", {
			p_claim_id: claimId,
			p_invoice_id: invoiceId,
			p_state: state,
			p_reason: reason,
		});
	},
};
export async function storeUninstallFeedback(
	input: UninstallFeedbackInput,
	userId: string | null,
	actorHash: string,
) {
	const result = await rpc("submit_uninstall_feedback_v1", {
		p_submission_id: input.submissionId,
		p_actor_hash: actorHash,
		p_user_id: userId,
		p_reason: input.reason,
		p_note: input.note ?? "",
	});
	if (result === "rate_limited")
		throw new UninstallError(
			429,
			"You have sent several responses. Please try again later.",
		);
	if (result !== "saved") throw new Error("Feedback outcome unavailable.");
	return { saved: true as const };
}
