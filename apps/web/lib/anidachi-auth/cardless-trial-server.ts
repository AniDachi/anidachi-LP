import type Stripe from "stripe";
import { readBillingPrice } from "./billing-price";
import {
	type CardlessTrialActivation,
	CardlessTrialError,
	createCardlessTrialService,
	parseCardlessTrialActivation,
} from "./cardless-trial";
import { db } from "./db";
import { getPricingOffer } from "./pricing-offer";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";
import { subscriptionCheckoutService } from "./subscription-checkout-server";
import { hasVerifiedAccountEmail } from "./verified-email";

export function cardlessTrialService(stripe: Stripe = createStripeClient()) {
	const legacy = subscriptionCheckoutService(stripe);
	async function rpc(
		name: string,
		args: Record<string, unknown>,
	): Promise<CardlessTrialActivation> {
		const { data, error } = await db()
			.rpc(name, args)
			.abortSignal(AbortSignal.timeout(20000));
		if (error) {
			if (error.message.includes("TRIAL_ACTIVATION_BUSY")) {
				const pending = await db()
					.from("subscription_trial_activations")
					.select("id")
					.eq("user_id", args.p_user_id as string)
					.neq("state", "failed")
					.abortSignal(AbortSignal.timeout(8000))
					.maybeSingle();
				if (!pending.error && pending.data?.id)
					throw new CardlessTrialError("unavailable", pending.data.id);
			}
			if (error.message.includes("TRIAL_MARKER_USED"))
				throw new CardlessTrialError("trial_used");
			if (error.message.includes("TRIAL_MARKER_BUSY"))
				throw new CardlessTrialError("trial_busy");
			if (error.message.includes("TRIAL_CONTEXT_REQUIRED"))
				throw new CardlessTrialError("context_required");
			if (error.message.includes("TRIAL_INELIGIBLE"))
				throw new CardlessTrialError("ineligible");
			if (
				/TRIAL_OFFER_CHANGED|CARDLESS_TRIAL_UNAVAILABLE|TRIAL_REQUEST_MISMATCH/.test(
					error.message,
				)
			)
				throw new CardlessTrialError("offer_changed");
			throw new CardlessTrialError("unavailable");
		}
		return parseCardlessTrialActivation(data);
	}
	return createCardlessTrialService({
		stripe,
		livemode: resolveStripeMode() === "live",

		isVerified: hasVerifiedAccountEmail,
		async beginExternalAttempt(userId, activationId, kind, key) {
			const { data, error } = await db()
				.rpc("begin_cardless_trial_attempt_v1", {
					p_user_id: userId,
					p_activation_id: activationId,
					p_kind: kind,
					p_key: key,
				})
				.abortSignal(AbortSignal.timeout(20000));
			if (error || typeof data !== "string" || !/^[0-9a-f-]{36}$/i.test(data))
				throw new CardlessTrialError("unavailable");
			return data;
		},
		async finishExternalAttempt(userId, activationId, attemptId, receipt) {
			const { error } = await db()
				.rpc("finish_cardless_trial_attempt_v1", {
					p_user_id: userId,
					p_activation_id: activationId,
					p_attempt_id: attemptId,
					p_outcome: receipt.outcome,
					p_object_id: receipt.objectId,
					p_request_id: receipt.requestId,
				})
				.abortSignal(AbortSignal.timeout(20000));
			if (error) throw new CardlessTrialError("unavailable");
		},
		async findRecoverableActivation(userId, operationId) {
			let query = db()
				.from("subscription_trial_activations")
				.select("*")
				.eq("user_id", userId)
				.neq("state", "failed");
			if (operationId) query = query.eq("id", operationId);
			const { data, error } = await query
				.abortSignal(AbortSignal.timeout(8000))
				.maybeSingle();
			if (error) throw new CardlessTrialError("unavailable");
			return data ? parseCardlessTrialActivation(data) : null;
		},
		async findActivation(userId, requestId) {
			const { data, error } = await db()
				.from("subscription_trial_activations")
				.select("*")
				.eq("user_id", userId)
				.eq("request_id", requestId)
				.abortSignal(AbortSignal.timeout(8000))
				.maybeSingle();
			if (error) throw new CardlessTrialError("unavailable");
			return data ? parseCardlessTrialActivation(data) : null;
		},
		async offer(userId, plan, period) {
			const offer = await getPricingOffer(userId);
			if (offer.ownerUserId !== userId)
				throw new CardlessTrialError("unavailable");
			const priceId = stripePriceIdForPlanCode(plan, period);
			if (!priceId) throw new CardlessTrialError("unavailable");
			// Never trust a cached displayed price or an ID from the browser.
			await readBillingPrice(priceId, true, period);
			return {
				action: offer.action,
				trialMode: offer.trialMode ?? "card_required",
				revision: offer.trialOfferRevision ?? "",
				policyRevision: Number(offer.trialOfferRevision),
				priceId,
			};
		},
		reconcileLegacy: legacy.retireForCardless,
		reserve: (userId, input, offer, markers) =>
			rpc("reserve_cardless_trial_v2", {
				p_user_id: userId,
				p_request_id: input.requestId,
				p_plan_code: input.planCode,
				p_billing_period: input.billingPeriod,
				p_price_id: offer.priceId,
				p_customer_id: null,
				p_policy_revision: offer.policyRevision,
				p_browser_hash: markers?.browser ?? null,
				p_installation_hash: markers?.installation ?? null,
			}),
		bindCustomer: (userId, activationId, customerId) =>
			rpc("record_cardless_trial_customer_v1", {
				p_user_id: userId,
				p_activation_id: activationId,
				p_customer_id: customerId,
			}),
		recordCreated: (userId, activationId, proof) =>
			rpc("record_cardless_trial_created_v1", {
				p_user_id: userId,
				p_activation_id: activationId,
				p_customer_id: proof.customerId,
				p_schedule_id: proof.scheduleId,
				p_subscription_id: proof.subscriptionId,
				p_price_id: proof.priceId,
				p_trial_start: proof.trialStartedAt,
				p_trial_end: proof.trialEndsAt,
			}),
		async sync(subscriptionId, userId) {
			const result = await syncStripeSubscriptionById(stripe, subscriptionId, {
				expectedUserId: userId,
			});
			if (!result) throw new CardlessTrialError("unavailable");
			return result;
		},
	});
}

export async function allowTrialAction(
	userId: string,
	action: "start" | "quote" | "setup" | "complete" | "cancel",
): Promise<boolean> {
	const { data, error } = await db()
		.rpc("consume_trial_action_rate_limit_v1", {
			p_user_id: userId,
			p_action: action,
		})
		.abortSignal(AbortSignal.timeout(8000));
	if (error || typeof data !== "boolean")
		throw new Error("Trial request limit unavailable");
	return data;
}
