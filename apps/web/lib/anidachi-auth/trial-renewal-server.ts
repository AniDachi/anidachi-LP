import type Stripe from "stripe";
import { readBillingPrice } from "./billing-price";
import { db } from "./db";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";
import {
	createTrialRenewalService,
	parseTrialRenewalOperation,
	TrialRenewalError,
	type TrialRenewalOperation,
	validTrialOperationId,
} from "./trial-renewal";

const timeout = () => AbortSignal.timeout(10000);
export async function readTrialRenewal(
	userId: string,
	operationId?: string,
): Promise<TrialRenewalOperation | null> {
	let query = db()
		.from("subscription_trial_renewals")
		.select("*")
		.eq("user_id", userId);
	if (operationId) query = query.eq("id", operationId);
	const { data, error } = await query
		.order("generation", { ascending: false })
		.limit(1)
		.abortSignal(timeout())
		.maybeSingle();
	if (error) throw new TrialRenewalError("unavailable");
	return data ? parseTrialRenewalOperation(data) : null;
}
export function trialRenewalService(stripe: Stripe = createStripeClient()) {
	async function rpc(name: string, args: Record<string, unknown>) {
		const { data, error } = await db().rpc(name, args).abortSignal(timeout());
		if (error) {
			if (/TRIAL_RENEWAL_STALE/.test(error.message))
				throw new TrialRenewalError("superseded");
			if (/TRIAL_EXPIRED|TRIAL_QUOTE_EXPIRED/.test(error.message))
				throw new TrialRenewalError("expired");
			if (
				/TRIAL_REQUEST_MISMATCH|TRIAL_SETUP_REQUEST_MISMATCH/.test(
					error.message,
				)
			)
				throw new TrialRenewalError("offer_changed");
			throw new TrialRenewalError("pending");
		}
		return parseTrialRenewalOperation(data);
	}
	const fence = (userId: string, o: TrialRenewalOperation) => ({
		p_user_id: userId,
		p_operation_id: o.id,
		p_generation: o.generation,
	});
	return createTrialRenewalService({
		stripe,
		livemode: resolveStripeMode() === "live",
		async readContext(userId) {
			const t = await db()
				.from("account_subscription_trials")
				.select(
					"user_id,stripe_subscription_id,trial_activation_id,stripe_schedule_id,trial_started_at,trial_ends_at",
				)
				.eq("user_id", userId)
				.eq("trial_mode", "cardless")
				.abortSignal(timeout())
				.maybeSingle();
			if (t.error) throw new TrialRenewalError("unavailable");
			if (!t.data) return null;
			const [a, customer] = await Promise.all([
				db()
					.from("subscription_trial_activations")
					.select(
						"id,user_id,state,stripe_customer_id,stripe_subscription_id,stripe_schedule_id,trial_started_at,trial_ends_at",
					)
					.eq("user_id", userId)
					.eq("id", t.data.trial_activation_id)
					.abortSignal(timeout())
					.maybeSingle(),
				db()
					.from("billing_customers")
					.select("user_id,stripe_customer_id")
					.eq("user_id", userId)
					.abortSignal(timeout())
					.maybeSingle(),
			]);
			if (
				a.error ||
				customer.error ||
				!a.data ||
				!customer.data ||
				a.data.state !== "committed" ||
				a.data.user_id !== userId ||
				customer.data.user_id !== userId ||
				a.data.stripe_customer_id !== customer.data.stripe_customer_id ||
				a.data.stripe_subscription_id !== t.data.stripe_subscription_id ||
				a.data.stripe_schedule_id !== t.data.stripe_schedule_id ||
				Date.parse(a.data.trial_started_at) !==
					Date.parse(t.data.trial_started_at) ||
				Date.parse(a.data.trial_ends_at) !== Date.parse(t.data.trial_ends_at)
			)
				throw new TrialRenewalError("unavailable");
			return {
				userId,
				activationId: a.data.id,
				customerId: a.data.stripe_customer_id,
				subscriptionId: a.data.stripe_subscription_id,
				scheduleId: a.data.stripe_schedule_id,
				trialStartedAt: t.data.trial_started_at,
				trialEndsAt: t.data.trial_ends_at,
			};
		},
		readOperation: readTrialRenewal,
		readLatest: (user) => readTrialRenewal(user),
		async readPrice(plan, period) {
			const priceId = stripePriceIdForPlanCode(plan, period);
			if (!priceId) throw new TrialRenewalError("unavailable");
			const price = await readBillingPrice(priceId, true, period);
			return { priceId, amount: price.unitAmount, currency: price.currency };
		},
		reserve: (user, requestId, c, action, terms) =>
			rpc("reserve_trial_renewal_v1", {
				p_user_id: user,
				p_request_id: requestId,
				p_subscription_id: c.subscriptionId,
				p_action: action,
				p_terms: terms,
			}),
		beginSetup: (user, o, origin, requestId) =>
			rpc("begin_trial_setup_v1", {
				...fence(user, o),
				p_request_id: requestId,
				p_origin: origin,
			}),
		saveSetup: (user, o, sessionId) =>
			rpc("record_trial_setup_session_v1", {
				...fence(user, o),
				p_session_id: sessionId,
			}),
		commit: (user, o, state, proof = {}) =>
			rpc("commit_trial_renewal_v2", {
				...fence(user, o),
				p_expected_state: o.state,
				p_state: state,
				p_snapshot: proof,
			}),
		settleExpired: (user, o, proof) =>
			rpc("settle_expired_trial_renewal_v1", {
				...fence(user, o),
				p_snapshot: proof,
			}),
		async sync(subscriptionId, userId) {
			const result = await syncStripeSubscriptionById(stripe, subscriptionId, {
				expectedUserId: userId,
			});
			if (!result || result.userId !== userId)
				throw new TrialRenewalError("pending");
		},
	});
}

/** Signature verification is upstream; fresh Stripe data and the owner-scoped DB
 * operation still decide whether this Session may enable anything. */
export async function finalizeTrialSetupSession(
	stripe: Stripe,
	sessionId: string,
) {
	const s = await stripe.checkout.sessions.retrieve(
		sessionId,
		{},
		{ timeout: 10000, maxNetworkRetries: 0 },
	);
	const userId = s.metadata?.userId,
		opId = s.metadata?.trialRenewalId;
	if (
		s.id !== sessionId ||
		s.mode !== "setup" ||
		s.livemode !== (resolveStripeMode() === "live") ||
		!validTrialOperationId(userId) ||
		!validTrialOperationId(opId)
	)
		throw new Error("Trial setup identity unavailable");
	const o = await readTrialRenewal(userId, opId);
	if (!o || (o.setup_session_id && o.setup_session_id !== sessionId))
		throw new Error("Trial setup owner or Session mismatch");
	const result = await trialRenewalService(stripe).completeTrialRenewal(
		userId,
		opId,
	);
	if (["pending", "unavailable"].includes(result.state))
		throw new Error("Trial setup pending; retry delivery");
}
