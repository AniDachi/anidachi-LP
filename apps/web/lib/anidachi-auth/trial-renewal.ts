import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { BillingPeriod } from "../billing-view";
import type { PaidPlanCode } from "./plan-entitlements";

export type RenewalQuoteInput = {
	planCode: PaidPlanCode;
	billingPeriod: BillingPeriod;
};
export type TrialRenewalQuote = RenewalQuoteInput & {
	id: string;
	amount: number;
	currency: string;
	firstChargeAt: string;
	expiresAt: string;
	termsRevision: string;
};
export type RenewalResult = {
	state:
		| "active"
		| "pending"
		| "expired"
		| "canceled"
		| "superseded"
		| "offer_changed"
		| "unavailable";
};
export type RenewalSetupResult =
	| RenewalResult
	| { state: "setup"; url: string };
export type RenewalTerms = Partial<
	RenewalQuoteInput & {
		priceId: string;
		amount: number;
		currency: string;
		termsRevision: string;
		quoteRevision: string;
	}
>;
export type TrialRenewalContext = {
	userId: string;
	activationId: string;
	customerId: string;
	subscriptionId: string;
	scheduleId: string;
	trialStartedAt: string;
	trialEndsAt: string;
};
export type TrialRenewalOperation = {
	id: string;
	user_id: string;
	request_id: string;
	stripe_subscription_id: string;
	generation: number;
	action: "enable" | "cancel";
	terms: RenewalTerms;
	state:
		| "quoted"
		| "setup_pending"
		| "applying"
		| "applied"
		| "canceled"
		| "expired"
		| "failed";
	plan_code: PaidPlanCode | null;
	billing_period: BillingPeriod | null;
	price_id: string | null;
	amount: number | null;
	currency: string | null;
	terms_revision: string | null;
	quote_revision: string | null;
	original_trial_end: string;
	quote_expires_at: string;
	consented_at: string | null;
	setup_origin: string | null;
	setup_request_id: string | null;
	setup_session_id: string | null;
	setup_intent_id: string | null;
	payment_method_id: string | null;
	created_at: string;
	updated_at: string;
};
export type TrialRenewalDeps = {
	stripe: Stripe;
	livemode: boolean;
	now?: () => number;
	readContext(userId: string): Promise<TrialRenewalContext | null>;
	readOperation(
		userId: string,
		operationId: string,
	): Promise<TrialRenewalOperation | null>;
	readLatest(userId: string): Promise<TrialRenewalOperation | null>;
	readPrice(
		plan: PaidPlanCode,
		period: BillingPeriod,
	): Promise<{ priceId: string; amount: number; currency: string }>;
	reserve(
		userId: string,
		requestId: string,
		context: TrialRenewalContext,
		action: "enable" | "cancel",
		terms: RenewalTerms,
	): Promise<TrialRenewalOperation>;
	beginSetup(
		userId: string,
		operation: TrialRenewalOperation,
		origin: string,
		requestId: string,
	): Promise<TrialRenewalOperation>;
	saveSetup(
		userId: string,
		operation: TrialRenewalOperation,
		sessionId: string,
	): Promise<TrialRenewalOperation>;
	commit(
		userId: string,
		operation: TrialRenewalOperation,
		state: TrialRenewalOperation["state"],
		proof?: Record<string, unknown>,
	): Promise<TrialRenewalOperation>;
	settleExpired(
		userId: string,
		operation: TrialRenewalOperation,
		proof: Record<string, unknown>,
	): Promise<TrialRenewalOperation>;
	sync(subscriptionId: string, userId: string): Promise<void>;
};
export class TrialRenewalError extends Error {
	constructor(public state: RenewalResult["state"]) {
		super("Trial renewal requires verification");
	}
}
const REQUEST = { timeout: 15000, maxNetworkRetries: 0 } as const;
const TERMS = "cardless-renewal-v1";
const REPLAY_MS = 23 * 3600000;
const id = (v: string | { id: string } | null | undefined) =>
	typeof v === "string" ? v : (v?.id ?? null);
export const validTrialOperationId = (v: unknown): v is string =>
	typeof v === "string" &&
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validRenewalQuoteInput(v: unknown): v is RenewalQuoteInput {
	if (!v || typeof v !== "object" || Array.isArray(v)) return false;
	const o = v as Record<string, unknown>;
	return (
		["plus", "pro"].includes(String(o.planCode)) &&
		["monthly", "yearly"].includes(String(o.billingPeriod))
	);
}
export function parseTrialRenewalOperation(
	value: unknown,
): TrialRenewalOperation {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new TrialRenewalError("unavailable");
	const o = value as TrialRenewalOperation;
	if (
		!validTrialOperationId(o.id) ||
		!validTrialOperationId(o.user_id) ||
		!validTrialOperationId(o.request_id) ||
		!Number.isSafeInteger(o.generation) ||
		o.generation < 1 ||
		!o.stripe_subscription_id ||
		!["enable", "cancel"].includes(o.action) ||
		![
			"quoted",
			"setup_pending",
			"applying",
			"applied",
			"canceled",
			"expired",
			"failed",
		].includes(o.state) ||
		[o.original_trial_end, o.quote_expires_at, o.created_at, o.updated_at].some(
			(d) => !Number.isFinite(Date.parse(d)),
		)
	)
		throw new TrialRenewalError("unavailable");
	if (
		o.action === "enable" &&
		(!validRenewalQuoteInput({
			planCode: o.plan_code,
			billingPeriod: o.billing_period,
		}) ||
			!o.price_id ||
			!Number.isSafeInteger(o.amount) ||
			o.amount! <= 0 ||
			o.currency !== "usd" ||
			!o.terms_revision ||
			!o.quote_revision)
	)
		throw new TrialRenewalError("unavailable");
	return o;
}

export function createTrialRenewalService(deps: TrialRenewalDeps) {
	const { stripe } = deps,
		now = deps.now ?? Date.now;
	async function context(userId: string): Promise<TrialRenewalContext> {
		const c = await deps.readContext(userId);
		if (
			!c ||
			c.userId !== userId ||
			!c.customerId ||
			!c.subscriptionId ||
			!c.scheduleId ||
			Date.parse(c.trialEndsAt) - Date.parse(c.trialStartedAt) !== 259200000
		)
			throw new TrialRenewalError("unavailable");
		return c;
	}
	async function operation(userId: string, opId: string) {
		if (!validTrialOperationId(userId) || !validTrialOperationId(opId))
			throw new TrialRenewalError("unavailable");
		const o = await deps.readOperation(userId, opId);
		if (!o || o.user_id !== userId || o.id !== opId)
			throw new TrialRenewalError("unavailable");
		const latest = await deps.readLatest(userId);
		if (
			!latest ||
			latest.user_id !== userId ||
			latest.id !== o.id ||
			latest.generation !== o.generation
		)
			throw new TrialRenewalError("superseded");
		return o;
	}
	function matchContext(c: TrialRenewalContext, o: TrialRenewalOperation) {
		if (
			o.user_id !== c.userId ||
			o.stripe_subscription_id !== c.subscriptionId ||
			Date.parse(o.original_trial_end) !== Date.parse(c.trialEndsAt)
		)
			throw new TrialRenewalError("unavailable");
	}
	async function terms(input: RenewalQuoteInput): Promise<RenewalTerms> {
		const p = await deps.readPrice(input.planCode, input.billingPeriod);
		if (
			!p.priceId ||
			!Number.isSafeInteger(p.amount) ||
			p.amount <= 0 ||
			p.currency !== "usd"
		)
			throw new TrialRenewalError("unavailable");
		// Only canonical server-approved fields enter the quote fingerprint. JSON
		// property order and additional client fields are not payment conditions.
		const base = {
			planCode: input.planCode,
			billingPeriod: input.billingPeriod,
			priceId: p.priceId,
			amount: p.amount,
			currency: p.currency,
			termsRevision: TERMS,
		};
		return {
			...base,
			quoteRevision: createHash("sha256")
				.update(JSON.stringify(base))
				.digest("hex"),
		};
	}
	async function unchanged(o: TrialRenewalOperation) {
		if (!o.plan_code || !o.billing_period) return false;
		const t = await terms({
			planCode: o.plan_code,
			billingPeriod: o.billing_period,
		});
		return (
			t.quoteRevision === o.quote_revision &&
			t.priceId === o.price_id &&
			t.amount === o.amount &&
			t.currency === o.currency &&
			o.terms_revision === TERMS
		);
	}
	async function snapshot(c: TrialRenewalContext) {
		const [schedule, sub] = await Promise.all([
			stripe.subscriptionSchedules.retrieve(c.scheduleId, {}, REQUEST),
			stripe.subscriptions.retrieve(c.subscriptionId, {}, REQUEST),
		]);
		const start = Date.parse(c.trialStartedAt) / 1000,
			end = Date.parse(c.trialEndsAt) / 1000;
		const phase = schedule.phases[0];
		const linked =
			schedule.status === "released"
				? id(schedule.released_subscription)
				: id(schedule.subscription);
		if (
			schedule.id !== c.scheduleId ||
			sub.id !== c.subscriptionId ||
			[schedule, sub].some(
				(s) =>
					s.livemode !== deps.livemode ||
					id(s.customer) !== c.customerId ||
					s.metadata?.userId !== c.userId ||
					s.metadata?.trialActivationId !== c.activationId ||
					s.metadata?.anidachiTrialMode !== "cardless_v1",
			) ||
			linked !== sub.id ||
			sub.trial_start !== start ||
			sub.trial_end !== end ||
			schedule.phases.length !== 1 ||
			phase?.start_date !== start ||
			phase.end_date !== end ||
			phase.trial_end !== end ||
			phase.items.length !== 1 ||
			phase.items[0].quantity !== 1 ||
			sub.items.data.length !== 1 ||
			sub.items.data[0].quantity !== 1 ||
			sub.pending_update ||
			sub.pause_collection ||
			sub.discounts?.length ||
			phase.discounts?.length ||
			sub.collection_method !== "charge_automatically" ||
			(schedule.status === "active" && id(sub.schedule) !== schedule.id)
		)
			throw new TrialRenewalError("unavailable");
		return { schedule, sub };
	}
	function proof(
		c: TrialRenewalContext,
		s: Awaited<ReturnType<typeof snapshot>>,
	) {
		return {
			scheduleId: c.scheduleId,
			subscriptionId: c.subscriptionId,
			customerId: c.customerId,
			trialEndsAt: c.trialEndsAt,
			endBehavior: s.schedule.end_behavior,
			priceId: s.sub.items.data[0].price.id,
			paymentMethodId: id(s.sub.default_payment_method),
			scheduleStatus: s.schedule.status,
			subscriptionStatus: s.sub.status,
		};
	}
	const terminal = (o: TrialRenewalOperation): RenewalResult | null =>
		o.state === "canceled"
			? { state: "canceled" }
			: o.state === "expired"
				? { state: "expired" }
				: o.state === "failed"
					? { state: "offer_changed" }
					: null;
	async function stop(
		userId: string,
		o: TrialRenewalOperation,
		state: "expired" | "failed",
	): Promise<RenewalResult> {
		await deps.commit(userId, o, state);
		return { state: state === "failed" ? "offer_changed" : state };
	}
	function verifySession(
		c: TrialRenewalContext,
		o: TrialRenewalOperation,
		session: Stripe.Checkout.Session,
	) {
		if (
			!session ||
			session.mode !== "setup" ||
			session.livemode !== deps.livemode ||
			id(session.customer) !== c.customerId ||
			session.metadata?.userId !== c.userId ||
			session.metadata?.trialRenewalId !== o.id ||
			session.metadata?.trialRenewalGeneration !== String(o.generation) ||
			session.metadata?.quoteRevision !== o.quote_revision ||
			session.client_reference_id !== c.userId ||
			(o.setup_session_id && session.id !== o.setup_session_id)
		)
			throw new TrialRenewalError("unavailable");
	}
	async function findSession(c: TrialRenewalContext, o: TrialRenewalOperation) {
		if (o.setup_session_id)
			return stripe.checkout.sessions.retrieve(o.setup_session_id, {}, REQUEST);
		const list = await stripe.checkout.sessions.list(
			{ customer: c.customerId, limit: 100 },
			REQUEST,
		);
		const matches = list.data.filter(
			(s) => s.metadata?.trialRenewalId === o.id,
		);
		if (list.has_more || matches.length > 1)
			throw new TrialRenewalError("pending");
		return matches[0]
			? stripe.checkout.sessions.retrieve(matches[0].id, {}, REQUEST)
			: null;
	}
	async function apply(
		userId: string,
		initial: TrialRenewalOperation,
		c: TrialRenewalContext,
	): Promise<RenewalResult> {
		let o = await operation(userId, initial.id);
		if (o.state !== "applying")
			return (
				terminal(o) ?? { state: o.state === "applied" ? "active" : "pending" }
			);
		matchContext(c, o);
		let s = await snapshot(c);
		const verifiedEnable = () =>
			s.schedule.end_behavior === "release" &&
			s.schedule.metadata?.trialRenewalId === o.id &&
			s.schedule.metadata?.trialRenewalGeneration === String(o.generation) &&
			id(s.schedule.default_settings.default_payment_method) ===
				o.payment_method_id &&
			s.sub.items.data[0].price.id === o.price_id &&
			id(s.schedule.phases[0].items[0].price) === o.price_id &&
			id(s.sub.default_payment_method) === o.payment_method_id;
		const verifiedCancel = () =>
			s.schedule.end_behavior === "cancel" &&
			(s.schedule.status === "active"
				? s.sub.cancel_at === Date.parse(c.trialEndsAt) / 1000
				: s.sub.status === "canceled");
		if (!(o.action === "enable" ? verifiedEnable() : verifiedCancel())) {
			if (Date.parse(c.trialEndsAt) <= now()) {
				if (
					["completed", "canceled"].includes(s.schedule.status) &&
					s.sub.status === "canceled" &&
					s.schedule.end_behavior === "cancel"
				) {
					await deps.settleExpired(userId, o, proof(c, s));
					await deps.sync(c.subscriptionId, userId);
					return { state: "expired" };
				}
				return { state: "pending" };
			}
			if (s.schedule.status !== "active" || s.sub.status !== "trialing")
				return { state: "pending" };
			// No later generation may start until this external effect has been proven.
			// Beyond Stripe's idempotency retention, absence is not safe to replay.
			o = await operation(userId, o.id);
			if (o.state !== "applying") return terminal(o) ?? { state: "pending" };
			const age = now() - Date.parse(o.updated_at);
			if (age < -300000 || age >= REPLAY_MS) return { state: "pending" };
			const metadata = {
				...s.schedule.metadata,
				trialRenewalId: o.id,
				trialRenewalGeneration: String(o.generation),
			};
			let params: Stripe.SubscriptionScheduleUpdateParams = {
				end_behavior: "cancel",
				metadata,
			};
			if (o.action === "enable") {
				if (
					!o.payment_method_id ||
					!o.price_id ||
					!o.plan_code ||
					!o.consented_at
				)
					throw new TrialRenewalError("unavailable");
				params = {
					end_behavior: "release",
					metadata,
					proration_behavior: "none",
					default_settings: {
						default_payment_method: o.payment_method_id,
						collection_method: "charge_automatically",
					},
					phases: [
						{
							start_date: Date.parse(c.trialStartedAt) / 1000,
							end_date: Date.parse(c.trialEndsAt) / 1000,
							trial_end: Date.parse(c.trialEndsAt) / 1000,
							items: [{ price: o.price_id, quantity: 1 }],
							proration_behavior: "none",
							metadata: {
								userId,
								trialActivationId: c.activationId,
								anidachiTrial: "72h_v1",
								anidachiTrialMode: "cardless_v1",
								planCode: o.plan_code,
								trialRenewalId: o.id,
								trialRenewalGeneration: String(o.generation),
							},
						},
					],
				};
			}
			await stripe.subscriptionSchedules.update(c.scheduleId, params, {
				...REQUEST,
				idempotencyKey: `trial-renewal:${o.id}`,
			});
			// Even a successful idempotent response may describe a state before cancellation.
			s = await snapshot(c);
			if (!(o.action === "enable" ? verifiedEnable() : verifiedCancel()))
				return { state: "pending" };
		}
		await deps.commit(
			userId,
			o,
			o.action === "enable" ? "applied" : "canceled",
			proof(c, s),
		);
		await deps.sync(c.subscriptionId, userId);
		return { state: o.action === "enable" ? "active" : "canceled" };
	}
	async function completeTrialRenewal(
		userId: string,
		opId: string,
	): Promise<RenewalResult> {
		let found = false;
		try {
			let o = await operation(userId, opId);
			found = true;
			const ended = terminal(o);
			if (ended) return ended;
			const c = await context(userId);
			matchContext(c, o);
			if (o.state === "applied") {
				await deps.sync(c.subscriptionId, userId);
				return { state: "active" };
			}
			if (o.state === "applying") return await apply(userId, o, c);
			if (Date.parse(o.original_trial_end) <= now())
				return await stop(userId, o, "expired");
			if (o.state !== "setup_pending" || !o.consented_at)
				return { state: "pending" };
			const session = await findSession(c, o);
			if (!session) return { state: "pending" };
			verifySession(c, o, session);
			if (!o.setup_session_id) o = await deps.saveSetup(userId, o, session.id);
			if (session.status === "expired") return await stop(userId, o, "expired");
			if (session.status !== "complete") return { state: "pending" };
			const intentId = id(session.setup_intent);
			if (!intentId) throw new TrialRenewalError("unavailable");
			const intent = await stripe.setupIntents.retrieve(intentId, {}, REQUEST);
			if (
				intent.id !== intentId ||
				intent.livemode !== deps.livemode ||
				id(intent.customer) !== c.customerId ||
				intent.status !== "succeeded" ||
				intent.usage !== "off_session" ||
				intent.metadata?.userId !== userId ||
				intent.metadata?.trialRenewalId !== o.id ||
				intent.metadata?.trialRenewalGeneration !== String(o.generation) ||
				intent.metadata?.quoteRevision !== o.quote_revision
			)
				throw new TrialRenewalError("unavailable");
			const methodId = id(intent.payment_method);
			if (!methodId) throw new TrialRenewalError("unavailable");
			const method = await stripe.paymentMethods.retrieve(
				methodId,
				{},
				REQUEST,
			);
			if (
				method.id !== methodId ||
				id(method.customer) !== c.customerId ||
				method.livemode !== deps.livemode ||
				method.type !== "card"
			)
				throw new TrialRenewalError("unavailable");
			if (!(await unchanged(o))) return await stop(userId, o, "failed");
			if (Date.parse(o.original_trial_end) <= now())
				return await stop(userId, o, "expired");
			o = await deps.commit(userId, o, "applying", {
				setupSessionId: session.id,
				setupIntentId: intent.id,
				paymentMethodId: method.id,
			});
			return await apply(userId, o, c);
		} catch (e) {
			return {
				state:
					e instanceof TrialRenewalError
						? e.state
						: found
							? "pending"
							: "unavailable",
			};
		}
	}
	async function reconcileApplying(userId: string) {
		const previous = await deps.readLatest(userId);
		if (previous?.user_id !== userId && previous)
			throw new TrialRenewalError("unavailable");
		if (previous?.state === "applying") {
			const result = await completeTrialRenewal(userId, previous.id);
			if (!["active", "canceled", "expired"].includes(result.state))
				throw new TrialRenewalError("pending");
		}
	}
	return {
		async quoteTrialRenewal(
			userId: string,
			input: RenewalQuoteInput,
		): Promise<TrialRenewalQuote> {
			if (!validTrialOperationId(userId) || !validRenewalQuoteInput(input))
				throw new TrialRenewalError("unavailable");
			await reconcileApplying(userId);
			const c = await context(userId);
			if (Date.parse(c.trialEndsAt) <= now())
				throw new TrialRenewalError("expired");
			const s = await snapshot(c);
			if (s.schedule.status !== "active" || s.sub.status !== "trialing")
				throw new TrialRenewalError("expired");
			const t = await terms(input);
			const o = await deps.reserve(userId, randomUUID(), c, "enable", t);
			matchContext(c, o);
			return {
				id: o.id,
				...input,
				amount: o.amount!,
				currency: o.currency!,
				firstChargeAt: o.original_trial_end,
				expiresAt: o.quote_expires_at,
				termsRevision: o.terms_revision!,
			};
		},
		async beginTrialRenewal(
			userId: string,
			opId: string,
			requestId: string,
			origin: string,
		): Promise<RenewalSetupResult> {
			let found = false;
			try {
				if (!validTrialOperationId(requestId))
					throw new TrialRenewalError("unavailable");
				let o = await operation(userId, opId);
				found = true;
				const ended = terminal(o);
				if (ended) return ended;
				if (["applying", "applied"].includes(o.state))
					return completeTrialRenewal(userId, o.id);
				const c = await context(userId);
				matchContext(c, o);
				if (
					Date.parse(o.original_trial_end) <= now() ||
					(o.state === "quoted" && Date.parse(o.quote_expires_at) <= now())
				)
					return await stop(userId, o, "expired");
				if (!(await unchanged(o))) return await stop(userId, o, "failed");
				if (o.state === "quoted")
					o = await deps.beginSetup(userId, o, origin, requestId);
				if (!o.setup_origin || !o.consented_at || o.state !== "setup_pending")
					throw new TrialRenewalError("unavailable");
				let session = await findSession(c, o);
				if (!session) {
					const age = now() - Date.parse(o.consented_at);
					if (age < -300000 || age >= REPLAY_MS) return { state: "pending" };
					const metadata = {
						userId,
						trialRenewalId: o.id,
						trialRenewalGeneration: String(o.generation),
						quoteRevision: o.quote_revision!,
					};
					// Checkout setup creates an off-session SetupIntent; this API version
					// accepts metadata here, not a `usage` override. Verify usage on return.
					session = await stripe.checkout.sessions.create(
						{
							mode: "setup",
							currency: o.currency!,
							customer: c.customerId,
							client_reference_id: userId,
							payment_method_types: ["card"],
							metadata,
							setup_intent_data: { metadata },
							success_url: `${o.setup_origin}/account/billing?trial_setup=${o.id}`,
							cancel_url: `${o.setup_origin}/account/billing?trial_setup_cancel=${o.id}`,
						},
						{ ...REQUEST, idempotencyKey: `trial-setup:${o.id}` },
					);
				}
				verifySession(c, o, session);
				if (!o.setup_session_id)
					o = await deps.saveSetup(userId, o, session.id);
				if (session.status === "complete")
					return completeTrialRenewal(userId, o.id);
				if (session.status === "expired")
					return await stop(userId, o, "expired");
				if (session.status !== "open" || !session.url)
					throw new TrialRenewalError("unavailable");
				const url = new URL(session.url);
				if (
					url.protocol !== "https:" ||
					url.hostname !== "checkout.stripe.com" ||
					url.username ||
					url.password
				)
					throw new TrialRenewalError("unavailable");
				return { state: "setup", url: session.url };
			} catch (e) {
				return {
					state:
						e instanceof TrialRenewalError
							? e.state
							: found
								? "pending"
								: "unavailable",
				};
			}
		},
		completeTrialRenewal,
		async cancelTrialRenewal(
			userId: string,
			requestId: string,
		): Promise<RenewalResult> {
			try {
				if (!validTrialOperationId(userId) || !validTrialOperationId(requestId))
					throw new TrialRenewalError("unavailable");
				await reconcileApplying(userId);
				const c = await context(userId);
				if (Date.parse(c.trialEndsAt) <= now()) return { state: "expired" };
				const o = await deps.reserve(userId, requestId, c, "cancel", {});
				matchContext(c, o);
				return completeTrialRenewal(userId, o.id);
			} catch (e) {
				return { state: e instanceof TrialRenewalError ? e.state : "pending" };
			}
		},
	};
}
