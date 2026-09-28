import type Stripe from "stripe";
import type { PaidPlanCode } from "./plan-entitlements";

export type CheckoutReservation = {
	user_id: string;
	id: string;
	request_id: string;
	plan_code: PaidPlanCode;
	price_id: string;
	origin: string;
	attribution: Record<string, string>;
	policy_revision: number;
	trial_offered: boolean;
	created_at: string;
	stripe_session_id: string | null;
	stripe_subscription_id: string | null;
	state: "pending" | "open" | "complete" | "expired";
};
export type CheckoutInput = {
	userId: string;
	email: string;
	planCode: PaidPlanCode;
	priceId: string;
	origin: string;
	requestId: string;
	attribution: Record<string, string>;
};
export type CheckoutResult = {
	kind: "checkout" | "manage_subscription";
	url: string;
	planCode: PaidPlanCode;
	trialOffered: boolean;
};
export type CheckoutDeps = {
	stripe: Stripe;
	now?: () => number;
	reserve: (input: CheckoutInput) => Promise<CheckoutReservation>;
	finish: (
		reservation: CheckoutReservation,
		sessionId: string,
		state: "open" | "complete" | "expired",
		subscriptionId?: string,
	) => Promise<void>;
	getCustomer: (
		userId: string,
	) => Promise<{ user_id: string; stripe_customer_id: string } | null>;
	saveCustomer: (userId: string, customerId: string) => Promise<void>;
	access: (
		userId: string,
	) => Promise<{ hostingPolicyVersion: number; trialEligibility: string }>;
	sync: (subscriptionId: string, userId: string) => Promise<void>;
};
export class SubscriptionCheckoutError extends Error {
	constructor(
		message: string,
		public readonly status = 503,
	) {
		super(message);
		this.name = "SubscriptionCheckoutError";
	}
}
export function parseCheckoutReservation(value: unknown): CheckoutReservation {
	const invalid = () =>
		new SubscriptionCheckoutError("Invalid checkout reservation.");
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw invalid();
	const r = value as Record<string, unknown>;
	for (const key of [
		"user_id",
		"id",
		"request_id",
		"price_id",
		"origin",
		"created_at",
	])
		if (typeof r[key] !== "string" || !(r[key] as string).length)
			throw invalid();
	for (const key of ["user_id", "id", "request_id"])
		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				r[key] as string,
			)
		)
			throw invalid();
	if (
		!Number.isFinite(Date.parse(r.created_at as string)) ||
		!Number.isSafeInteger(r.policy_revision) ||
		(r.policy_revision as number) < 1 ||
		typeof r.trial_offered !== "boolean" ||
		!["plus", "pro"].includes(r.plan_code as string) ||
		!["pending", "open", "complete", "expired"].includes(r.state as string)
	)
		throw invalid();
	for (const key of ["stripe_session_id", "stripe_subscription_id"])
		if (
			r[key] !== null &&
			(typeof r[key] !== "string" || !(r[key] as string).length)
		)
			throw invalid();
	if (
		(r.state === "pending") !== (r.stripe_session_id === null) ||
		(r.state === "complete" && r.stripe_subscription_id === null)
	)
		throw invalid();
	if (
		!r.attribution ||
		typeof r.attribution !== "object" ||
		Array.isArray(r.attribution) ||
		Object.values(r.attribution).some((v) => typeof v !== "string")
	)
		throw invalid();
	try {
		const url = new URL(r.origin as string);
		if (!["http:", "https:"].includes(url.protocol) || url.origin !== r.origin)
			throw invalid();
	} catch {
		throw invalid();
	}
	return value as CheckoutReservation;
}
const REQUEST = { timeout: 15_000, maxNetworkRetries: 0 } as const;
const REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000;
const id = (value: string | { id: string } | null) =>
	typeof value === "string" ? value : (value?.id ?? null);
function safeStripeUrl(value: string | null, host: string): string {
	if (!value)
		throw new SubscriptionCheckoutError(
			"Stripe did not return a checkout URL.",
		);
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.hostname !== host ||
		url.username ||
		url.password
	)
		throw new SubscriptionCheckoutError("Stripe URL identity mismatch.");
	return value;
}
export function createSubscriptionCheckoutService(deps: CheckoutDeps) {
	const stripe = deps.stripe;
	async function portal(
		customerId: string,
		input: CheckoutInput,
	): Promise<CheckoutResult> {
		const session = await stripe.billingPortal.sessions.create(
			{ customer: customerId, return_url: input.origin + "/account/billing" },
			REQUEST,
		);
		return {
			kind: "manage_subscription",
			url: safeStripeUrl(session.url, "billing.stripe.com"),
			planCode: input.planCode,
			trialOffered: false,
		};
	}
	function verifySession(
		session: Stripe.Checkout.Session,
		r: CheckoutReservation,
		customerId: string,
	) {
		if (
			session.mode !== "subscription" ||
			id(session.customer) !== customerId ||
			session.client_reference_id !== r.user_id ||
			session.metadata?.userId !== r.user_id ||
			session.metadata?.checkoutReservationId !== r.id ||
			(r.stripe_session_id !== null && session.id !== r.stripe_session_id)
		)
			throw new SubscriptionCheckoutError(
				"Checkout owner or reservation identity mismatch.",
			);
	}
	async function existingSubscription(customerId: string, userId: string) {
		const list = await stripe.subscriptions.list(
			{ customer: customerId, status: "all", limit: 100 },
			REQUEST,
		);
		if (list.has_more)
			throw new SubscriptionCheckoutError(
				"Subscription reconciliation required.",
			);
		for (const sub of list.data) {
			if (
				id(sub.customer) !== customerId ||
				(sub.metadata.userId && sub.metadata.userId !== userId)
			)
				throw new SubscriptionCheckoutError("Subscription owner mismatch.");
			if (!["canceled", "incomplete_expired"].includes(sub.status)) return sub;
		}
		return null;
	}
	async function expireAndRead(
		session: Stripe.Checkout.Session,
		customerId: string,
		userId: string,
	) {
		if (
			id(session.customer) !== customerId ||
			session.client_reference_id !== userId ||
			session.metadata?.userId !== userId
		)
			throw new SubscriptionCheckoutError("Previous checkout owner mismatch.");
		try {
			await stripe.checkout.sessions.expire(session.id, {}, REQUEST);
		} catch {
			/* Only the subsequent read determines whether completion or expiration won. */
		}
		const outcome = await stripe.checkout.sessions.retrieve(
			session.id,
			{},
			REQUEST,
		);
		if (
			outcome.id !== session.id ||
			outcome.mode !== "subscription" ||
			id(outcome.customer) !== customerId ||
			outcome.client_reference_id !== userId ||
			outcome.metadata?.userId !== userId
		)
			throw new SubscriptionCheckoutError("Previous checkout owner mismatch.");
		return outcome;
	}
	async function retireLegacyCheckouts(customerId: string, input: CheckoutInput) {
		// Older deployments issued unreserved sessions. Retire their URLs before
		// preparing a new offer; a concurrently completed one must be synchronized.
		const open = await stripe.checkout.sessions.list(
			{ customer: customerId, status: "open", limit: 100 },
			REQUEST,
		);
		if (open.has_more)
			throw new SubscriptionCheckoutError(
				"Checkout reconciliation required.",
			);
		for (const previous of open.data) {
			if (
				previous.mode !== "subscription" ||
				previous.metadata?.checkoutReservationId
			)
				continue;
			const outcome = await expireAndRead(
				previous,
				customerId,
				input.userId,
			);
			if (outcome.status === "complete") {
				const subId = id(outcome.subscription);
				if (!subId)
					throw new SubscriptionCheckoutError(
						"Checkout reconciliation required.",
					);
				await deps.sync(subId, input.userId);
				return subId;
			}
			if (outcome.status !== "expired")
				throw new SubscriptionCheckoutError(
					"Previous checkout is still open. Please retry.",
				);
		}
		return null;
	}
	return {
		async prepareSubscriptionCheckout(
			input: CheckoutInput,
		): Promise<CheckoutResult> {
			// All values in input are supplied by the authenticated route, never arbitrary Stripe IDs from a client.
			for (let attempt = 0; attempt < 3; attempt++) {
				let customer = await deps.getCustomer(input.userId);
				if (customer && customer.user_id !== input.userId)
					throw new SubscriptionCheckoutError("Customer owner mismatch.");
				// Management and unreserved legacy completion must not create a
				// pending row that has no Stripe creation to reconcile later.
				if (customer) {
					const customerId = customer.stripe_customer_id;
					if (await retireLegacyCheckouts(customerId, input))
						return portal(customerId, input);
					const active = await existingSubscription(customerId, input.userId);
					if (active) {
						await deps.sync(active.id, input.userId);
						return portal(customerId, input);
					}
				}
				const r = await deps.reserve(input);
				if (r.user_id !== input.userId)
					throw new SubscriptionCheckoutError("Reservation owner mismatch.");
				const age = (deps.now ?? Date.now)() - Date.parse(r.created_at);
				if (!Number.isFinite(age) || age < -300_000)
					throw new SubscriptionCheckoutError("Checkout clock unavailable.");
				if (!customer) {
					if (age >= REPLAY_WINDOW_MS)
						throw new SubscriptionCheckoutError(
							"Customer reconciliation required before retry.",
						);
					// Omit mutable email/name from replay parameters; Checkout collects billing contact details.
					const created = await stripe.customers.create(
						{ metadata: { userId: input.userId, checkoutReservationId: r.id } },
						{ ...REQUEST, idempotencyKey: "checkout-customer:" + r.id },
					);
					await deps.saveCustomer(input.userId, created.id);
					customer = { user_id: input.userId, stripe_customer_id: created.id };
				}
				const customerId = customer.stripe_customer_id;
				const access = await deps.access(input.userId);
				const matches =
					r.plan_code === input.planCode &&
					r.price_id === input.priceId &&
					r.origin === input.origin &&
					r.policy_revision === access.hostingPolicyVersion &&
					r.trial_offered === (access.trialEligibility === "eligible");
				let session: Stripe.Checkout.Session | null = null;
				if (r.stripe_session_id)
					session = await stripe.checkout.sessions.retrieve(
						r.stripe_session_id,
						{},
						REQUEST,
					);
				else {
					const sessions = await stripe.checkout.sessions.list(
						{
							customer: customerId,
							limit: 100,
							created: { gte: Math.floor(Date.parse(r.created_at) / 1000) - 1 },
						},
						REQUEST,
					);
					if (sessions.has_more)
						throw new SubscriptionCheckoutError(
							"Checkout reconciliation required.",
						);
					const matching = sessions.data.filter(
						(s) => s.metadata?.checkoutReservationId === r.id,
					);
					if (matching.length > 1)
						throw new SubscriptionCheckoutError(
							"Checkout reconciliation required.",
						);
					session = matching[0] ?? null;
					if (!session) {
						if (age >= REPLAY_WINDOW_MS)
							throw new SubscriptionCheckoutError(
								"Checkout reconciliation required before retry.",
							);
						const metadata = {
							...r.attribution,
							userId: r.user_id,
							planCode: r.plan_code,
							checkoutReservationId: r.id,
							...(r.trial_offered ? { anidachiTrial: "72h_v1" } : {}),
						};
						session = await stripe.checkout.sessions.create(
							{
								mode: "subscription",
								customer: customerId,
								client_reference_id: r.user_id,
								// Product requirement is explicitly a card-backed trial; preserve the existing card-only flow.
								payment_method_types: ["card"],
								payment_method_collection: "always",
								line_items: [{ price: r.price_id, quantity: 1 }],
								success_url:
									r.origin + "/success?session_id={CHECKOUT_SESSION_ID}",
								cancel_url: r.origin + "/pricing",
								allow_promotion_codes: true,
								billing_address_collection: "required",
								metadata,
								subscription_data: {
									metadata,
									...(r.trial_offered
										? {
												trial_period_days: 3,
												trial_settings: {
													end_behavior: {
														missing_payment_method: "cancel" as const,
													},
												},
											}
										: {}),
								},
							},
							{ ...REQUEST, idempotencyKey: "checkout:" + r.id },
						);
					}
				}
				verifySession(session, r, customerId);
				if (session.status === "complete") {
					const subscriptionId = id(session.subscription);
					if (!subscriptionId)
						throw new SubscriptionCheckoutError(
							"Completed checkout awaits subscription reconciliation.",
						);
					await deps.sync(subscriptionId, input.userId);
					await deps.finish(r, session.id, "complete", subscriptionId);
					return portal(customerId, input);
				}
				if (session.status === "expired") {
					await deps.finish(r, session.id, "expired");
					continue;
				}
				if (session.status !== "open")
					throw new SubscriptionCheckoutError("Unknown checkout state.");
				await deps.finish(r, session.id, "open");
				// If a subscription appeared after the pre-reservation check, settle
				// this real session before management. Never strand or release an
				// ambiguous creation, and never expose a second checkout URL.
				const active = await existingSubscription(customerId, input.userId);
				if (active) await deps.sync(active.id, input.userId);
				if (!matches || active) {
					// Expire first. A concurrent completion wins; refetch its actual result before any release.
					const outcome = await expireAndRead(
						session,
						customerId,
						input.userId,
					);
					verifySession(outcome, r, customerId);
					if (outcome.status === "expired") {
						await deps.finish(r, outcome.id, "expired");
						if (active) return portal(customerId, input);
						continue;
					}
					if (outcome.status === "complete") {
						const subscriptionId = id(outcome.subscription);
						if (!subscriptionId)
							throw new SubscriptionCheckoutError(
								"Checkout reconciliation required.",
							);
						await deps.sync(subscriptionId, input.userId);
						await deps.finish(r, outcome.id, "complete", subscriptionId);
						return portal(customerId, input);
					}
					throw new SubscriptionCheckoutError(
						"Previous checkout is still open. Please retry.",
					);
				}
				return {
					kind: "checkout",
					url: safeStripeUrl(session.url, "checkout.stripe.com"),
					planCode: r.plan_code,
					trialOffered: r.trial_offered,
				};
			}
			throw new SubscriptionCheckoutError(
				"Checkout changed during preparation. Please retry.",
			);
		},
	};
}
