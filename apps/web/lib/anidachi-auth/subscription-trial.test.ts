import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
	createSubscriptionCheckoutService,
	parseCheckoutReservation,
	type CheckoutReservation,
} from "./subscription-trial";

const input = {
	userId: "11111111-1111-4111-8111-111111111111",
	email: "fixture@example.test",
	planCode: "plus" as const,
	priceId: "price_plus",
	origin: "https://anidachi.test",
	requestId: "22222222-2222-4222-8222-222222222222",
	attribution: {},
};
const now = Date.parse("2026-09-27T12:00:00Z");
function fixture(
	trial = true,
	readOffer = async () => ({
		action: trial ? "trial" : "subscribe",
		price: { unitAmount: 799, currency: "usd" },
	}),
) {
	let clock = now;
	let reserved = false;
	const reservation: CheckoutReservation = {
		user_id: input.userId,
		id: input.requestId,
		request_id: input.requestId,
		plan_code: "plus",
		price_id: "price_plus",
		origin: input.origin,
		attribution: {},
		policy_revision: 1,
		trial_offered: trial,
		created_at: new Date(now).toISOString(),
		stripe_session_id: null,
		stripe_subscription_id: null,
		state: "pending",
	};
	let params: Stripe.Checkout.SessionCreateParams | undefined;
	let options: Stripe.RequestOptions | undefined;
	let createCalls = 0,
		finishCalls = 0,
		uncertain = false;
	let subscriptionRows: unknown[] = [];
	let subscriptionReads = 0;
	let subscriptionVisibleAt = 1;
	let legacySessions: unknown[] = [];
	let expirationOutcome = "expired";
	let syncCalls = 0;
	let subscriptionStatus = "active";
	let syncedStatus = "active";
	let syncFailure = false;
	let trialEligibility = trial ? "eligible" : "used";
	const createdRequests: {
		params: Stripe.Checkout.SessionCreateParams;
		key: string | undefined;
	}[] = [];
	const expiredSessions: string[] = [];
	const session = {
		id: "cs_new",
		mode: "subscription",
		status: "open",
		customer: "cus_owner",
		client_reference_id: input.userId,
		metadata: { userId: input.userId, checkoutReservationId: reservation.id },
		url: "https://checkout.stripe.com/c/pay/cs_new",
		subscription: null,
	};
	const stripe = {
		customers: {
			create: async () => {
				throw Error("mapped customer exists");
			},
		},
		subscriptions: {
			list: async () => ({
				data:
					++subscriptionReads >= subscriptionVisibleAt ? subscriptionRows : [],
				has_more: false,
			}),
		},
		checkout: {
			sessions: {
				list: async () => ({ data: legacySessions, has_more: false }),
				retrieve: async (sessionId: string) =>
					sessionId === "cs_legacy" ? legacySessions[0] : session,
				expire: async (sessionId: string) => {
					expiredSessions.push(sessionId);
					const target = (
						sessionId === "cs_legacy" ? legacySessions[0] : session
					) as typeof session;
					target.status = expirationOutcome;
					if (expirationOutcome === "complete")
						target.subscription = "sub_won" as unknown as null;
					return target;
				},
				create: async (
					p: Stripe.Checkout.SessionCreateParams,
					o: Stripe.RequestOptions,
				) => {
					params = p;
					options = o;
					createCalls++;
					createdRequests.push({
						params: structuredClone(p),
						key: o.idempotencyKey,
					});
					if (uncertain) {
						uncertain = false;
						throw Error("response lost after Stripe commit");
					}
					return session;
				},
			},
		},
		billingPortal: {
			sessions: {
				create: async () => ({
					url: "https://billing.stripe.com/p/session/test",
				}),
			},
		},
	} as unknown as Stripe;
	const service = createSubscriptionCheckoutService({
		stripe,
		offer: readOffer,
		now: () => clock,
		reserve: async () => {
			if (!reserved) {
				reservation.created_at = new Date(
					Date.parse(reservation.created_at) + clock - now,
				).toISOString();
				reserved = true;
			}
			if (
				reservation.state === "expired" ||
				(reservation.state === "complete" &&
					["canceled", "incomplete_expired"].includes(syncedStatus))
			) {
				Object.assign(reservation, {
					id: "33333333-3333-4333-8333-333333333333",
					created_at: new Date(clock).toISOString(),
					stripe_subscription_id: null,
					state: "pending",
					stripe_session_id: null,
					trial_offered: trialEligibility === "eligible",
				});
				Object.assign(session, {
					id: "cs_replacement",
					status: "open",
					subscription: null,
					url: "https://checkout.stripe.com/c/pay/cs_replacement",
					metadata: {
						userId: input.userId,
						checkoutReservationId: reservation.id,
					},
				});
			}
			return reservation;
		},
		finish: async (_r, s, state, subscriptionId) => {
			finishCalls++;
			reservation.stripe_session_id = s;
			reservation.state = state;
			if (state === "complete")
				reservation.stripe_subscription_id = subscriptionId ?? null;
		},
		getCustomer: async () => ({
			user_id: input.userId,
			stripe_customer_id: "cus_owner",
		}),
		saveCustomer: async () => {},
		access: async () => ({
			hostingPolicyVersion: 1,
			trialEligibility,
		}),
		sync: async () => {
			syncCalls++;
			if (syncFailure) throw new Error("fresh subscription unavailable");
			syncedStatus = subscriptionStatus;
			return { status: subscriptionStatus };
		},
	});
	return {
		service,
		reservation,
		session,
		createdRequests,
		expiredSessions,
		setTrialEligibility(value: "eligible" | "used") {
			trialEligibility = value;
		},
		get params() {
			return params;
		},
		get options() {
			return options;
		},
		get createCalls() {
			return createCalls;
		},
		get finishCalls() {
			return finishCalls;
		},
		get syncCalls() {
			return syncCalls;
		},
		get reserved() {
			return reserved;
		},
		failSync() {
			syncFailure = true;
		},
		completedSubscriptionEnds(status = "canceled") {
			clock += 4 * 24 * 60 * 60 * 1000;
			subscriptionStatus = status;
			trialEligibility = "used";
			Object.assign(session, { status: "complete", subscription: "sub_ended" });
		},
		cancelSubscriptionAfterTwoDays() {
			clock += 2 * 24 * 60 * 60 * 1000;
			subscriptionRows = [];
			legacySessions = [];
			trialEligibility = "used";
			if (!reserved) reservation.trial_offered = false;
		},
		legacyCheckout() {
			legacySessions = [
				{
					...session,
					id: "cs_legacy",
					metadata: { userId: input.userId },
					url: "https://checkout.stripe.com/c/pay/cs_legacy",
				},
			];
		},
		expirationBecomes(outcome: string) {
			expirationOutcome = outcome;
		},
		loseResponse() {
			uncertain = true;
		},
		activeSubscription(visibleAtRead = 1) {
			subscriptionVisibleAt = visibleAtRead;
			subscriptionRows = [
				{
					id: "sub_current",
					customer: "cus_owner",
					status: "active",
					metadata: { userId: input.userId },
				},
			];
		},
	};
}
test("eligible Free checkout requires a card and exactly three trial days", async () => {
	const f = fixture();
	const r = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(r.kind, "checkout");
	assert.equal(r.trialOffered, true);
	assert.equal(f.params?.subscription_data?.trial_period_days, 3);
	assert.equal(f.params?.payment_method_collection, "always");
	assert.deepEqual(f.params?.payment_method_types, ["card"]);
	assert.equal(
		f.params?.subscription_data?.metadata?.checkoutReservationId,
		input.requestId,
	);
	assert.equal(f.options?.idempotencyKey, `checkout:${input.requestId}`);
});
test("an account with a used trial receives ordinary checkout without a second trial", async () => {
	const f = fixture(false);
	const r = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(r.trialOffered, false);
	assert.equal(f.params?.subscription_data?.trial_period_days, undefined);
	assert.equal(f.createCalls, 1);
	assert.deepEqual(f.params?.line_items, [
		{ price: "price_plus", quantity: 1 },
	]);
});
test("lost Stripe response keeps reservation and retries exact idempotency parameters", async () => {
	const f = fixture();
	f.loseResponse();
	await assert.rejects(f.service.prepareSubscriptionCheckout(input));
	const firstParams = structuredClone(f.params),
		firstKey = f.options?.idempotencyKey;
	assert.equal(f.finishCalls, 0);
	await f.service.prepareSubscriptionCheckout(input);
	assert.deepEqual(f.params, firstParams);
	assert.equal(f.options?.idempotencyKey, firstKey);
});
test("known open checkout is reused without another Stripe create", async () => {
	const f = fixture();
	await f.service.prepareSubscriptionCheckout(input);
	const second = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(second.url, "https://checkout.stripe.com/c/pay/cs_new");
	assert.equal(f.createCalls, 1);
});
test("active subscription is managed instead of creating another", async () => {
	const f = fixture();
	f.activeSubscription();
	const r = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(r.kind, "manage_subscription");
	assert.equal(f.createCalls, 0);
});
for (const existing of ["subscription", "legacy-completion"] as const) {
	test(`managing ${existing} leaves resubscription available after cancellation beyond the replay window`, async () => {
		const f = fixture();
		if (existing === "subscription") f.activeSubscription();
		else {
			f.legacyCheckout();
			f.expirationBecomes("complete");
		}
		assert.equal(
			(await f.service.prepareSubscriptionCheckout(input)).kind,
			"manage_subscription",
		);
		assert.equal(
			f.reserved,
			false,
			"management must not reserve a checkout that will never be created",
		);
		f.cancelSubscriptionAfterTwoDays();
		const result = await f.service.prepareSubscriptionCheckout(input);
		assert.equal(result.kind, "checkout");
		assert.equal(result.trialOffered, false);
		assert.equal(f.createCalls, 1);
	});
}
for (const outcome of ["expired", "complete", "open"] as const) {
	test(`a subscription appearing during checkout preparation settles the session before management: ${outcome}`, async () => {
		const f = fixture();
		f.activeSubscription(2);
		f.expirationBecomes(outcome);
		if (outcome === "open") {
			await assert.rejects(
				f.service.prepareSubscriptionCheckout(input),
				/still open/i,
			);
		} else {
			assert.equal(
				(await f.service.prepareSubscriptionCheckout(input)).kind,
				"manage_subscription",
			);
		}
		assert.deepEqual(f.expiredSessions, ["cs_new"]);
		assert.equal(f.reservation.state, outcome);
		assert.equal(f.createCalls, 1);
	});
}
test("unknown outcome beyond Stripe idempotency retention does not create another checkout", async () => {
	const f = fixture();
	f.reservation.created_at = "2026-09-25T12:00:00Z";
	await assert.rejects(
		f.service.prepareSubscriptionCheckout(input),
		/reconcil/i,
	);
	assert.equal(f.createCalls, 0);
});
test("mismatched retrieved session owner never exposes its checkout URL", async () => {
	const f = fixture();
	f.reservation.stripe_session_id = "cs_new";
	f.reservation.state = "open";
	f.session.client_reference_id = "another-owner";
	await assert.rejects(
		f.service.prepareSubscriptionCheckout(input),
		/owner|identity/i,
	);
});
test("legacy checkout completion racing expiration is reconciled before any new session", async () => {
	const f = fixture();
	f.legacyCheckout();
	f.expirationBecomes("complete");
	const result = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(result.kind, "manage_subscription");
	assert.equal(f.createCalls, 0);
	assert.equal(f.syncCalls, 1);
});
test("legacy checkout still open after expiration attempt blocks new checkout", async () => {
	const f = fixture();
	f.legacyCheckout();
	f.expirationBecomes("open");
	await assert.rejects(
		f.service.prepareSubscriptionCheckout(input),
		/open|reconcil/i,
	);
	assert.equal(f.createCalls, 0);
});
test("small DB versus application clock skew does not block checkout", async () => {
	const f = fixture();
	f.reservation.created_at = new Date(now + 1000).toISOString();
	assert.equal(
		(await f.service.prepareSubscriptionCheckout(input)).kind,
		"checkout",
	);
});
test("a completed session racing a plan change wins over a second checkout", async () => {
	const f = fixture();
	await f.service.prepareSubscriptionCheckout(input);
	f.expirationBecomes("complete");
	const result = await f.service.prepareSubscriptionCheckout({
		...input,
		planCode: "pro",
		priceId: "price_pro",
	});
	assert.equal(result.kind, "manage_subscription");
	assert.equal(f.createCalls, 1);
	assert.equal(f.reservation.state, "complete");
	assert.equal(f.syncCalls, 1);
});
test("plan change with uncertain expiration keeps the old reservation", async () => {
	const f = fixture();
	await f.service.prepareSubscriptionCheckout(input);
	f.expirationBecomes("open");
	await assert.rejects(
		f.service.prepareSubscriptionCheckout({
			...input,
			planCode: "pro",
			priceId: "price_pro",
		}),
		/open/i,
	);
	assert.equal(f.createCalls, 1);
	assert.equal(f.reservation.state, "open");
});
test("new eligibility retires an open nontrial checkout before returning a card trial", async () => {
	const f = fixture(false);
	await f.service.prepareSubscriptionCheckout(input);
	const original = structuredClone(f.createdRequests[0]);
	f.setTrialEligibility("eligible");
	const result = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(result.trialOffered, true);
	assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_replacement");
	assert.deepEqual(f.expiredSessions, ["cs_new"]);
	assert.equal(f.createCalls, 2);
	assert.deepEqual(f.createdRequests[0], original);
	assert.notEqual(f.createdRequests[1].key, original.key);
	assert.equal(f.params?.subscription_data?.trial_period_days, 3);
	assert.equal(f.params?.payment_method_collection, "always");
});
test("unknown old checkout creation is reconciled with its original terms before a trial replaces it", async () => {
	const f = fixture(false);
	f.loseResponse();
	await assert.rejects(f.service.prepareSubscriptionCheckout(input));
	f.setTrialEligibility("eligible");
	const result = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(result.trialOffered, true);
	assert.deepEqual(f.createdRequests[1], f.createdRequests[0]);
	assert.equal(
		f.createdRequests[0].params.subscription_data?.trial_period_days,
		undefined,
	);
	assert.equal(
		f.createdRequests[2].params.subscription_data?.trial_period_days,
		3,
	);
	assert.deepEqual(f.expiredSessions, ["cs_new"]);
});
test("completion of the old nontrial checkout wins over newly eligible trial", async () => {
	const f = fixture(false);
	await f.service.prepareSubscriptionCheckout(input);
	f.setTrialEligibility("eligible");
	f.expirationBecomes("complete");
	const result = await f.service.prepareSubscriptionCheckout(input);
	assert.equal(result.kind, "manage_subscription");
	assert.equal(f.createCalls, 1);
	assert.equal(f.syncCalls, 1);
	assert.equal(f.reservation.state, "complete");
});
test("uncertain expiration of a nontrial checkout cannot expose its old offer or create a trial", async () => {
	const f = fixture(false);
	await f.service.prepareSubscriptionCheckout(input);
	f.setTrialEligibility("eligible");
	f.expirationBecomes("open");
	await assert.rejects(
		f.service.prepareSubscriptionCheckout(input),
		/open|reconcil/i,
	);
	assert.equal(f.createCalls, 1);
	assert.equal(f.reservation.state, "open");
});
test("reservation parser rejects incomplete or inconsistent database authority", () => {
	const r = fixture().reservation;
	assert.deepEqual(parseCheckoutReservation(r), r);
	for (const bad of [
		{ ...r, trial_offered: "true" },
		{ ...r, price_id: null },
		{ ...r, state: "complete" },
		{ ...r, origin: "javascript:alert(1)" },
		{ ...r, policy_revision: 0 },
	])
		assert.throws(() => parseCheckoutReservation(bad), /reservation/i);
});

for (const trial of [true, false]) {
	for (const status of ["canceled", "incomplete_expired"]) {
		test(`first resubscribe after a completed ${trial ? "trial" : "paid"} checkout with ${status} subscription opens payment immediately`, async () => {
			const f = fixture(trial);
			await f.service.prepareSubscriptionCheckout(input);
			assert.equal(f.reservation.state, "open");
			f.completedSubscriptionEnds(status);
			const next = await f.service.prepareSubscriptionCheckout(input);
			assert.equal(next.kind, "checkout");
			assert.equal(
				next.url,
				"https://checkout.stripe.com/c/pay/cs_replacement",
			);
			assert.equal(next.trialOffered, false);
			assert.equal(f.createCalls, 2);
			assert.notEqual(f.createdRequests[0].key, f.createdRequests[1].key);
			assert.equal(f.params?.subscription_data?.trial_period_days, undefined);
		});
	}
}
test("resubscribe cannot release a completed session without fresh subscription authority", async () => {
	const f = fixture();
	await f.service.prepareSubscriptionCheckout(input);
	f.completedSubscriptionEnds();
	f.failSync();
	await assert.rejects(
		f.service.prepareSubscriptionCheckout(input),
		/fresh subscription unavailable/,
	);
	assert.equal(f.createCalls, 1);
	assert.equal(f.reservation.state, "open");
});
for (const status of [
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"paused",
	"incomplete",
]) {
	test(`a completed checkout with nonterminal ${status} subscription never starts another purchase`, async () => {
		const f = fixture();
		await f.service.prepareSubscriptionCheckout(input);
		f.completedSubscriptionEnds(status);
		assert.equal(
			(await f.service.prepareSubscriptionCheckout(input)).kind,
			"manage_subscription",
		);
		assert.equal(f.createCalls, 1);
	});
}

test("a changed displayed price is rejected before reserving or creating checkout", async () => {
	const f = fixture();
	await assert.rejects(
		f.service.prepareSubscriptionCheckout({
			...input,
			displayedOffer: {
				trial: true,
				price: { unitAmount: 599, currency: "usd" },
			},
		}),
		{ status: 409 },
	);
	assert.equal(f.reserved, false);
	assert.equal(f.createCalls, 0);
});

test("a displayed trial or subscription action is rechecked on the server before checkout", async () => {
	for (const action of ["subscribe", "manage", "sign_in"]) {
		const f = fixture(true, async () => ({
			action,
			price: { unitAmount: 799, currency: "usd" },
		}));
		await assert.rejects(
			f.service.prepareSubscriptionCheckout({
				...input,
				displayedOffer: {
					trial: true,
					price: { unitAmount: 799, currency: "usd" },
				},
			}),
			{ status: 409 },
		);
		assert.equal(f.reserved, false);
		assert.equal(f.createCalls, 0);
	}
});

test("malformed displayed prices cannot start checkout", async () => {
	for (const price of [
		null,
		{},
		{ unitAmount: -1, currency: "usd" },
		{ unitAmount: 799.5, currency: "usd" },
		{ unitAmount: 799, currency: "eur" },
	]) {
		const f = fixture();
		await assert.rejects(
			f.service.prepareSubscriptionCheckout({
				...input,
				displayedOffer: { trial: true, price },
			}),
			{ status: 400 },
		);
		assert.equal(f.reserved, false);
		assert.equal(f.createCalls, 0);
	}
});

test("an unavailable fresh checkout offer creates no reservation or Stripe session", async () => {
	const f = fixture(true, async () => {
		throw new Error("authority unavailable");
	});
	await assert.rejects(
		f.service.prepareSubscriptionCheckout({
			...input,
			displayedOffer: {
				trial: true,
				price: { unitAmount: 799, currency: "usd" },
			},
		}),
	);
	assert.equal(f.reserved, false);
	assert.equal(f.createCalls, 0);
});

test("a matching displayed offer uses the server-configured Stripe price and original trial rules", async () => {
	const f = fixture();
	const result = await f.service.prepareSubscriptionCheckout({
		...input,
		displayedOffer: {
			trial: true,
			price: { unitAmount: 799, currency: "usd" },
		},
	});
	assert.equal(result.kind, "checkout");
	assert.equal(result.trialOffered, true);
	assert.deepEqual(f.params?.line_items, [
		{ price: "price_plus", quantity: 1 },
	]);
	assert.equal(f.params?.subscription_data?.trial_period_days, 3);
});
