import type { TrialAbuseMarkers } from "./trial-abuse";
import type Stripe from "stripe";
import type { BillingPeriod } from "../billing-view";
import type { PaidPlanCode } from "./plan-entitlements";
import type { CardlessTrialActivationRecord } from "./stripe-trial-state";

export type TrialStartInput = {
	requestId: string;
	planCode: PaidPlanCode;
	billingPeriod: BillingPeriod;
	offerRevision: string;
};
export type TrialStartResult =
	| { state: "active"; trialEndsAt: string; planCode: PaidPlanCode }
	| { state: "pending"; kind: "activation"; operationId: string }
	| { state: "pending"; kind: "legacy_checkout" }
	| {
			state:
				| "ineligible"
				| "offer_changed"
				| "unavailable"
				| "verification_required"
				| "trial_used"
				| "trial_busy"
				| "context_required";
	  };
export type CardlessTrialActivation = CardlessTrialActivationRecord & {
	request_id: string;
	idempotency_key: string;
	plan_code: PaidPlanCode;
	billing_period: BillingPeriod;
	price_id: string;
	policy_revision: number;
	created_at: string;
};
export type CardlessTrialOffer = {
	action: string;
	trialMode: string;
	revision: string;
	policyRevision: number;
	priceId: string;
};
export type TrialCreatedProof = {
	customerId: string;
	scheduleId: string;
	subscriptionId: string;
	priceId: string;
	trialStartedAt: string;
	trialEndsAt: string;
};
export type CardlessTrialDeps = {
	stripe: Stripe;
	livemode: boolean;
	now?: () => number;
	isVerified(userId: string): Promise<boolean>;
	findActivation(
		userId: string,
		requestId: string,
	): Promise<CardlessTrialActivation | null>;
	findRecoverableActivation(
		userId: string,
		operationId?: string,
	): Promise<CardlessTrialActivation | null>;
	offer(
		userId: string,
		plan: PaidPlanCode,
		period: BillingPeriod,
	): Promise<CardlessTrialOffer>;
	reconcileLegacy(userId: string): Promise<"clear" | "pending" | "ineligible">;
	reserve(
		userId: string,
		input: TrialStartInput,
		offer: CardlessTrialOffer,
		markers?: TrialAbuseMarkers,
	): Promise<CardlessTrialActivation>;
	bindCustomer(
		userId: string,
		activationId: string,
		customerId: string,
	): Promise<CardlessTrialActivation>;
	recordCreated(
		userId: string,
		activationId: string,
		proof: TrialCreatedProof,
	): Promise<CardlessTrialActivation>;

	beginExternalAttempt(
		userId: string,
		activationId: string,
		kind: "customer" | "schedule",
		key: string,
	): Promise<string>;
	finishExternalAttempt(
		userId: string,
		activationId: string,
		attemptId: string,
		receipt: {
			outcome: "succeeded" | "unknown";
			objectId: string | null;
			requestId: string | null;
		},
	): Promise<void>;
	sync(subscriptionId: string, userId: string): Promise<{ status: string }>;
};
export class CardlessTrialError extends Error {
	constructor(
		public state:
			| "ineligible"
			| "offer_changed"
			| "unavailable"
			| "trial_used"
			| "trial_busy"
			| "context_required",
		public operationId?: string,
	) {
		super("Trial state requires reconciliation");
	}
}
const REQUEST = { timeout: 15000, maxNetworkRetries: 0 } as const;
const REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validTrialStartInput(value: unknown): value is TrialStartInput {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.requestId === "string" &&
		uuid.test(v.requestId) &&
		(v.planCode === "plus" || v.planCode === "pro") &&
		(v.billingPeriod === "monthly" || v.billingPeriod === "yearly") &&
		typeof v.offerRevision === "string" &&
		/^[1-9]\d{0,14}$/.test(v.offerRevision)
	);
}
export function parseCardlessTrialActivation(
	value: unknown,
): CardlessTrialActivation {
	const invalid = () => new CardlessTrialError("unavailable");
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw invalid();
	const a = value as CardlessTrialActivation;
	if (
		!uuid.test(a.id) ||
		!uuid.test(a.user_id) ||
		!uuid.test(a.request_id) ||
		a.idempotency_key !== `cardless-trial-v1:${a.id}` ||
		!["plus", "pro"].includes(a.plan_code) ||
		!["monthly", "yearly"].includes(a.billing_period) ||
		!Number.isSafeInteger(a.policy_revision) ||
		a.policy_revision < 1 ||
		typeof a.price_id !== "string" ||
		!a.price_id ||
		!Number.isFinite(Date.parse(a.created_at)) ||
		!["pending", "created", "committed", "failed"].includes(a.state)
	)
		throw invalid();
	for (const key of [
		"stripe_customer_id",
		"stripe_schedule_id",
		"stripe_subscription_id",
	] as const)
		if (a[key] !== null && (typeof a[key] !== "string" || !a[key]))
			throw invalid();
	if (a.state === "created" || a.state === "committed") {
		if (
			!a.stripe_customer_id ||
			!a.stripe_schedule_id ||
			!a.stripe_subscription_id ||
			!a.trial_started_at ||
			!a.trial_ends_at ||
			Date.parse(a.trial_ends_at) - Date.parse(a.trial_started_at) !== 259200000
		)
			throw invalid();
	} else if (
		a.stripe_schedule_id ||
		a.stripe_subscription_id ||
		a.trial_started_at ||
		a.trial_ends_at
	)
		throw invalid();
	return a;
}
const id = (v: string | { id: string } | null) =>
	typeof v === "string" ? v : (v?.id ?? null);

/** Shared by the initiating request and webhook recovery. No grants or external
 * writes happen until the durable reservation agrees with both fresh objects. */
export function verifyCardlessTrialCreated(
	a: CardlessTrialActivationRecord,
	schedule: Stripe.SubscriptionSchedule,
	sub: Stripe.Subscription,
	livemode: boolean,
): TrialCreatedProof {
	const phase = schedule.phases[0],
		start = sub.trial_start,
		end = sub.trial_end;
	if (
		!a.price_id ||
		!a.plan_code ||
		!a.stripe_customer_id ||
		id(schedule.subscription) !== sub.id ||
		id(sub.customer) !== a.stripe_customer_id ||
		id(schedule.customer) !== a.stripe_customer_id ||
		sub.livemode !== livemode ||
		schedule.livemode !== livemode ||
		[sub.metadata, schedule.metadata].some(
			(m) =>
				m?.userId !== a.user_id ||
				m?.trialActivationId !== a.id ||
				m?.anidachiTrialMode !== "cardless_v1" ||
				m?.anidachiTrial !== "72h_v1" ||
				m?.planCode !== a.plan_code,
		) ||
		!start ||
		!end ||
		end - start !== 259200 ||
		schedule.end_behavior !== "cancel" ||
		schedule.phases.length !== 1 ||
		phase?.start_date !== start ||
		phase.end_date !== end ||
		phase.trial_end !== end ||
		phase.items.length !== 1 ||
		id(phase.items[0].price) !== a.price_id ||
		phase.items[0].quantity !== 1 ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		sub.items.data[0].price.id !== a.price_id ||
		sub.items.data[0].quantity !== 1 ||
		(schedule.status === "active"
			? id(sub.schedule) !== schedule.id ||
				sub.status !== "trialing" ||
				sub.cancel_at !== end
			: !(schedule.status === "completed" && sub.status === "canceled"))
	)
		throw new CardlessTrialError("unavailable");
	return {
		customerId: a.stripe_customer_id,
		scheduleId: schedule.id,
		subscriptionId: sub.id,
		priceId: a.price_id,
		trialStartedAt: new Date(start * 1000).toISOString(),
		trialEndsAt: new Date(end * 1000).toISOString(),
	};
}

/** The DB reservation and Stripe key provide cross-instance safety; the map only
 * coalesces simultaneous clicks served by this instance. No rights live here. */
export function createCardlessTrialService(deps: CardlessTrialDeps) {
	async function createExternal<T extends { id: string }>(
		a: CardlessTrialActivation,
		kind: "customer" | "schedule",
		key: string,
		create: () => Promise<T>,
	): Promise<T> {
		// Admission is rechecked in the database even when run() holds an old snapshot.
		const attemptId = await deps.beginExternalAttempt(
			a.user_id,
			a.id,
			kind,
			key,
		);
		let value: T;
		try {
			value = await create();
		} catch (error) {
			const requestId =
				error &&
				typeof error === "object" &&
				"requestId" in error &&
				typeof error.requestId === "string" &&
				/^req_[A-Za-z0-9_]{1,251}$/.test(error.requestId)
					? error.requestId
					: null;
			await deps.finishExternalAttempt(a.user_id, a.id, attemptId, {
				outcome: "unknown",
				objectId: null,
				requestId,
			});
			throw error;
		}
		const response = value as T & { lastResponse?: { requestId?: string } };
		await deps.finishExternalAttempt(a.user_id, a.id, attemptId, {
			outcome: "succeeded",
			objectId: value.id,
			requestId: response.lastResponse?.requestId ?? null,
		});
		return value;
	}

	const inflight = new Map<string, Promise<TrialStartResult>>();
	const now = deps.now ?? Date.now;
	const stripe = deps.stripe;
	async function run(
		userId: string,
		input: TrialStartInput,
		reservedActivation?: CardlessTrialActivation,
		resolveMarkers?: () => Promise<TrialAbuseMarkers>,
	): Promise<TrialStartResult> {
		let a: CardlessTrialActivation | null = null;
		try {
			const existing =
				reservedActivation ??
				(await deps.findActivation(userId, input.requestId));
			if (
				existing &&
				(existing.user_id !== userId || existing.request_id !== input.requestId)
			)
				return { state: "unavailable" };
			a = existing;
			if (!a) {
				const offer = await deps.offer(
					userId,
					input.planCode,
					input.billingPeriod,
				);
				if (offer.action !== "trial") return { state: "ineligible" };
				if (
					offer.trialMode !== "cardless" ||
					offer.revision !== input.offerRevision
				)
					return { state: "offer_changed" };
				if (!(await deps.isVerified(userId)))
					return { state: "verification_required" };
				const previous = await deps.reconcileLegacy(userId);
				if (previous !== "clear")
					return previous === "pending"
						? { state: "pending", kind: "legacy_checkout" }
						: { state: "ineligible" };
				a = await deps.reserve(userId, input, offer, await resolveMarkers?.());
			}
			if (
				a.user_id !== userId ||
				a.request_id !== input.requestId ||
				a.idempotency_key !== `cardless-trial-v1:${a.id}`
			)
				throw new CardlessTrialError("unavailable");
			if (
				a.plan_code !== input.planCode ||
				a.billing_period !== input.billingPeriod ||
				String(a.policy_revision) !== input.offerRevision
			)
				return { state: "offer_changed" };
			if (a.state === "failed") return { state: "unavailable" };
			const age = now() - Date.parse(a.created_at);
			if (!Number.isFinite(age) || age < -300000)
				throw new CardlessTrialError("unavailable");
			if (!a.stripe_customer_id) {
				let customer: Stripe.Customer | undefined;
				if (age >= REPLAY_WINDOW_MS) {
					// Only a positive, uniquely owned search result can recover a lost ID.
					// Search absence is never proof that the earlier create failed.
					const found = await stripe.customers.search(
						{
							query: `metadata['trialActivationId']:'${a.id}' AND metadata['userId']:'${userId}'`,
							limit: 100,
						},
						REQUEST,
					);
					if (found.has_more || found.data.length !== 1)
						throw new CardlessTrialError("unavailable");
					customer = found.data[0];
				} else
					customer = await createExternal(
						a,
						"customer",
						`trial-customer:${a.id}`,
						() =>
							stripe.customers.create(
								{ metadata: { userId, trialActivationId: a!.id } },
								{ ...REQUEST, idempotencyKey: `trial-customer:${a!.id}` },
							),
					);
				if (
					!customer ||
					customer.livemode !== deps.livemode ||
					customer.metadata.userId !== userId ||
					customer.metadata.trialActivationId !== a.id
				)
					throw new CardlessTrialError("unavailable");
				a = await deps.bindCustomer(userId, a.id, customer.id);
				if (a.user_id !== userId || a.stripe_customer_id !== customer.id)
					throw new CardlessTrialError("unavailable");
			}
			const reserved = a;
			const customerId = a.stripe_customer_id;
			if (!customerId) throw new CardlessTrialError("unavailable");
			if (a.state === "pending") {
				const schedules = await stripe.subscriptionSchedules.list(
					{ customer: customerId, limit: 100 },
					REQUEST,
				);
				if (schedules.has_more) throw new CardlessTrialError("unavailable");
				const matching = schedules.data.filter(
					(s) => s.metadata?.trialActivationId === reserved.id,
				);
				if (matching.length > 1) throw new CardlessTrialError("unavailable");
				let schedule = matching[0];
				if (!schedule) {
					if (age >= REPLAY_WINDOW_MS)
						throw new CardlessTrialError("unavailable");
					const metadata = {
						userId,
						trialActivationId: a.id,
						anidachiTrial: "72h_v1",
						anidachiTrialMode: "cardless_v1",
						planCode: a.plan_code,
					};
					schedule = await createExternal(
						a,
						"schedule",
						a.idempotency_key,
						() =>
							stripe.subscriptionSchedules.create(
								{
									customer: customerId,
									start_date: "now",
									end_behavior: "cancel",
									phases: [
										{
											items: [{ price: reserved.price_id, quantity: 1 }],
											duration: { interval: "day", interval_count: 3 },
											trial: true,
											proration_behavior: "none",
											metadata,
										},
									],
									metadata,
								},
								{ ...REQUEST, idempotencyKey: reserved.idempotency_key },
							),
					);
				}
				// A cached create response is not evidence of the present state.
				schedule = await stripe.subscriptionSchedules.retrieve(
					schedule.id,
					{},
					REQUEST,
				);
				const subId = id(schedule.subscription);
				if (!subId) throw new CardlessTrialError("unavailable");
				const sub = await stripe.subscriptions.retrieve(subId, {}, REQUEST);
				if (sub.id !== subId) throw new CardlessTrialError("unavailable");
				a = await deps.recordCreated(
					userId,
					a.id,
					verifyCardlessTrialCreated(a, schedule, sub, deps.livemode),
				);
			}
			if (!a.stripe_subscription_id || !a.trial_ends_at)
				throw new CardlessTrialError("unavailable");
			const result = await deps.sync(a.stripe_subscription_id, userId);
			if (
				Date.parse(a.trial_ends_at) <= now() ||
				!["trialing", "active"].includes(result.status)
			)
				return { state: "ineligible" };
			return {
				state: "active",
				trialEndsAt: a.trial_ends_at,
				planCode: a.plan_code,
			};
		} catch (error) {
			// A timeout or persistence error cannot clear the reservation or invent a new key.
			if (a) return { state: "pending", kind: "activation", operationId: a.id };
			if (error instanceof CardlessTrialError)
				return error.operationId
					? {
							state: "pending",
							kind: "activation",
							operationId: error.operationId,
						}
					: { state: error.state };
			return { state: "unavailable" };
		}
	}
	return {
		async recoverCardlessTrial(
			userId: string,
			operationId?: string,
		): Promise<TrialStartResult> {
			if (
				!uuid.test(userId) ||
				(operationId !== undefined && !uuid.test(operationId))
			)
				return { state: "unavailable" };
			try {
				// This resumes an existing account reservation, including after a tab
				// lost its request ID. It cannot reserve a trial or alter its terms.
				const a = await deps.findRecoverableActivation(userId, operationId);
				if (!a) return { state: "ineligible" };
				if (
					a.user_id !== userId ||
					(operationId !== undefined && a.id !== operationId)
				)
					return { state: "unavailable" };
				return run(
					userId,
					{
						requestId: a.request_id,
						planCode: a.plan_code,
						billingPeriod: a.billing_period,
						offerRevision: String(a.policy_revision),
					},
					a,
				);
			} catch {
				return { state: "unavailable" };
			}
		},
		startCardlessTrial(
			userId: string,
			input: TrialStartInput,
			resolveMarkers?: () => Promise<TrialAbuseMarkers>,
		): Promise<TrialStartResult> {
			if (!uuid.test(userId) || !validTrialStartInput(input))
				return Promise.resolve({ state: "offer_changed" });
			const key = JSON.stringify([userId, input]);
			const active = inflight.get(key);
			if (active) return active;
			const pending = run(userId, input, undefined, resolveMarkers).finally(
				() => inflight.delete(key),
			);
			inflight.set(key, pending);
			return pending;
		},
	};
}
