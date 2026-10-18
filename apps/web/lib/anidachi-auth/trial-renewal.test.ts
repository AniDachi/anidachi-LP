import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type Stripe from "stripe";
import {
	createTrialRenewalService,
	type TrialRenewalDeps,
	type TrialRenewalOperation,
} from "./trial-renewal";

const USER = "a1000000-0000-4000-8000-000000000001";
function fixture() {
	let time = Date.parse("2026-10-11T12:00:00Z");
	const start = Math.floor(time / 1000),
		end = start + 259200;
	const metadata = {
		userId: USER,
		trialActivationId: "a2000000-0000-4000-8000-000000000001",
		anidachiTrial: "72h_v1",
		anidachiTrialMode: "cardless_v1",
		planCode: "plus",
	};
	const sub = {
		id: "sub_trial",
		customer: "cus_trial",
		livemode: false,
		metadata,
		status: "trialing",
		trial_start: start,
		trial_end: end,
		schedule: "sched_trial" as string | null,
		cancel_at: end as number | null,
		cancel_at_period_end: false,
		default_payment_method: null as string | null,
		collection_method: "charge_automatically",
		items: { data: [{ price: { id: "price_plus_monthly" }, quantity: 1 }] },
	};
	const schedule = {
		id: "sched_trial",
		customer: "cus_trial",
		livemode: false,
		metadata: { ...metadata },
		status: "active",
		subscription: sub.id as string | null,
		released_subscription: null as string | null,
		end_behavior: "cancel",
		default_settings: { default_payment_method: null as string | null },
		phases: [
			{
				start_date: start,
				end_date: end,
				trial_end: end,
				items: [{ price: "price_plus_monthly", quantity: 1 }],
				metadata: { ...metadata },
			},
		],
	};
	const operations = new Map<string, TrialRenewalOperation>();
	type SetupSessionFixture = {
		id: string;
		mode: string;
		customer: string;
		livemode: boolean;
		status: string;
		metadata: Stripe.Checkout.SessionCreateParams["metadata"];
		client_reference_id: string | undefined;
		setup_intent: string | null;
		url: string;
	};
	type SetupIntentFixture = {
		id: string;
		customer: string;
		livemode: boolean;
		status: string;
		usage: string;
		payment_method: string;
		metadata: SetupSessionFixture["metadata"];
	};
	const sessions = new Map<string, SetupSessionFixture>();
	const intents = new Map<string, SetupIntentFixture>();
	const updates: {
			params: Stripe.SubscriptionScheduleUpdateParams;
			key: string | undefined;
		}[] = [],
		creates: {
			params: Stripe.Checkout.SessionCreateParams;
			key: string | undefined;
		}[] = [],
		syncs: string[] = [];
	let changedPrice = false,
		failCommit = false,
		failCreate = false,
		failUpdate = false;
	const latest = () => [...operations.values()].at(-1) ?? null;
	const owned = (user: string, op: TrialRenewalOperation) => {
		assert.equal(user, USER);
		if (op.id !== latest()?.id) throw new Error("TRIAL_RENEWAL_STALE");
		return operations.get(op.id)!;
	};
	const deps: TrialRenewalDeps = {
		livemode: false,
		now: () => time,
		stripe: {
			subscriptionSchedules: {
				retrieve: async () => structuredClone(schedule),
				update: async (
					_id: string,
					params: Stripe.SubscriptionScheduleUpdateParams,
					options: Stripe.RequestOptions,
				) => {
					updates.push({ params, key: options.idempotencyKey });
					assert.equal(schedule.status, "active");
					Object.assign(schedule, params);
					if (params.phases) {
						const price = params.phases[0].items[0].price;
						assert.equal(typeof price, "string");
						sub.items.data[0].price.id = price!;
						sub.metadata = { ...sub.metadata, ...params.phases[0].metadata };
					}
					sub.default_payment_method =
						schedule.default_settings.default_payment_method;
					sub.cancel_at = params.end_behavior === "cancel" ? end : null;
					if (failUpdate) {
						failUpdate = false;
						throw new Error("response lost after Stripe applied");
					}
					return structuredClone(schedule);
				},
			},
			subscriptions: { retrieve: async () => structuredClone(sub) },
			checkout: {
				sessions: {
					list: async () => ({
						data: [...sessions.values()].map((s) => structuredClone(s)),
						has_more: false,
					}),
					retrieve: async (id: string) => structuredClone(sessions.get(id)),
					create: async (
						params: Stripe.Checkout.SessionCreateParams,
						options: Stripe.RequestOptions,
					) => {
						creates.push({ params, key: options.idempotencyKey });
						const session: SetupSessionFixture = {
							id: `cs_${creates.length}`,
							mode: "setup",
							customer: "cus_trial",
							livemode: false,
							status: "open",
							metadata: params.metadata,
							client_reference_id: params.client_reference_id,
							setup_intent: null,
							url: "https://checkout.stripe.com/c/pay/test_session",
						};
						sessions.set(session.id, session);
						if (failCreate) {
							failCreate = false;
							throw new Error("lost create response");
						}
						return structuredClone(session);
					},
				},
			},
			setupIntents: {
				retrieve: async (id: string) => structuredClone(intents.get(id)),
			},
			paymentMethods: {
				retrieve: async () => ({
					id: "pm_owned",
					customer: "cus_trial",
					livemode: false,
					type: "card",
					card: { brand: "visa", last4: "4242" },
				}),
			},
		} as unknown as Stripe,
		readContext: async (user) =>
			user === USER
				? {
						userId: USER,
						activationId: metadata.trialActivationId,
						customerId: "cus_trial",
						subscriptionId: sub.id,
						scheduleId: schedule.id,
						trialStartedAt: new Date(start * 1000).toISOString(),
						trialEndsAt: new Date(end * 1000).toISOString(),
					}
				: null,
		readOperation: async (user, id) => {
			const o = operations.get(id);
			return o?.user_id === user ? structuredClone(o) : null;
		},
		readLatest: async () => structuredClone(latest()),
		readSavedCard: async (user, subscription) =>
			structuredClone(
				[...operations.values()]
					.reverse()
					.find(
						(o) =>
							o.user_id === user &&
							o.stripe_subscription_id === subscription &&
							o.state === "applied" &&
							o.action === "enable",
					) ?? null,
			),
		beginSavedCard: async (user, op, origin, requestId, source) => {
			const o = owned(user, op);
			o.state = "applying";
			o.consented_at = new Date(time).toISOString();
			o.setup_origin = origin;
			o.setup_request_id = requestId;
			o.payment_method_id = source.payment_method_id;
			o.payment_source_operation_id = source.id;
			return structuredClone(o);
		},
		readPrice: async (plan, period) => ({
			priceId: `price_${plan}_${period}`,
			amount: changedPrice ? 899 : period === "yearly" ? 7670 : 799,
			currency: "usd",
		}),
		reserve: async (user, requestId, context, action, terms) => {
			const same = [...operations.values()].find(
				(o) => o.request_id === requestId,
			);
			if (same) return structuredClone(same);
			if (latest()?.state === "applying")
				throw new Error("TRIAL_MUTATION_UNRESOLVED");
			for (const o of operations.values())
				if (["quoted", "setup_pending"].includes(o.state)) o.state = "canceled";
			const op: TrialRenewalOperation = {
				id: randomUUID(),
				user_id: user,
				request_id: requestId,
				stripe_subscription_id: context.subscriptionId,
				generation: operations.size + 1,
				action,
				state: action === "enable" ? "quoted" : "applying",
				terms,
				plan_code: terms.planCode ?? null,
				billing_period: terms.billingPeriod ?? null,
				price_id: terms.priceId ?? null,
				amount: terms.amount ?? null,
				currency: terms.currency ?? null,
				terms_revision: terms.termsRevision ?? null,
				quote_revision: terms.quoteRevision ?? null,
				original_trial_end: context.trialEndsAt,
				quote_expires_at: new Date(
					Math.min(time + 300000, end * 1000),
				).toISOString(),
				consented_at: null,
				setup_origin: null,
				setup_request_id: null,
				setup_session_id: null,
				setup_intent_id: null,
				payment_method_id: null,
				created_at: new Date(time).toISOString(),
				updated_at: new Date(time).toISOString(),
			};
			operations.set(op.id, op);
			return structuredClone(op);
		},
		beginSetup: async (user, op, origin, requestId) => {
			const o = owned(user, op);
			if (o.state === "quoted") {
				o.state = "setup_pending";
				o.consented_at = new Date(time).toISOString();
				o.setup_origin = origin;
				o.setup_request_id = requestId;
			}
			return structuredClone(o);
		},
		saveSetup: async (user, op, id) => {
			const o = owned(user, op);
			o.setup_session_id = id;
			return structuredClone(o);
		},
		commit: async (user, op, state, proof = {}) => {
			const o = owned(user, op);
			if (failCommit && state === "applied") {
				failCommit = false;
				throw new Error("DB commit timeout");
			}
			o.state = state;
			o.updated_at = new Date(time).toISOString();
			if (state === "applying") {
				o.setup_session_id = proof.setupSessionId as string;
				o.setup_intent_id = proof.setupIntentId as string;
				o.payment_method_id = proof.paymentMethodId as string;
			}
			return structuredClone(o);
		},
		settleExpired: async (user, op) => {
			const o = owned(user, op);
			o.state = "expired";
			return structuredClone(o);
		},
		sync: async (id) => {
			syncs.push(id);
		},
	};
	const service = createTrialRenewalService(deps);
	async function setup(period: "monthly" | "yearly" = "monthly") {
		const quote = await service.quoteTrialRenewal(USER, {
			planCode: "plus",
			billingPeriod: period,
		});
		const result = await service.beginTrialRenewal(
			USER,
			quote.id,
			randomUUID(),
			"https://staging.anidachi.app",
		);
		return { quote, result };
	}
	function confirm(quoteId: string) {
		const op = operations.get(quoteId)!;
		const session = sessions.get(op.setup_session_id!)!;
		session.status = "complete";
		session.setup_intent = `seti_${session.id}`;
		intents.set(session.setup_intent, {
			id: session.setup_intent,
			customer: "cus_trial",
			livemode: false,
			status: "succeeded",
			usage: "off_session",
			payment_method: "pm_owned",
			metadata: session.metadata,
		});
	}
	return {
		service,
		deps,
		operations,
		sessions,
		intents,
		schedule,
		sub,
		updates,
		creates,
		syncs,
		setup,
		confirm,
		end,
		setTime: (t: number) => (time = t),
		changePrice: () => (changedPrice = true),
		loseCommit: () => (failCommit = true),
		loseCreate: () => (failCreate = true),
		loseUpdate: () => (failUpdate = true),
	};
}

test("setup_does_not_grant_paid_access and saved_card_is_not_renewal_consent", async () => {
	const f = fixture();
	f.sub.default_payment_method = "pm_saved";
	const { quote, result } = await f.setup();
	assert.equal(result.state, "setup");
	assert.equal(f.creates[0].params.mode, "setup");
	assert.equal(
		f.creates[0].params.setup_intent_data!.metadata!.trialRenewalId,
		quote.id,
	);
	assert.equal(f.creates[0].params.line_items, undefined);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"pending",
	);
	assert.equal(f.updates.length, 0);
	assert.equal(f.schedule.end_behavior, "cancel");
	assert.equal(f.syncs.length, 0);
});
test("duplicate_setup_event_is_noop and explicit annual opt-in preserves original end", async () => {
	const f = fixture();
	const { quote } = await f.setup("yearly");
	f.confirm(quote.id);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	assert.equal(f.updates.length, 1);
	assert.equal(f.sub.trial_end, f.end);
	assert.equal(f.updates[0].params.phases![0].end_date, f.end);
	assert.equal(f.updates[0].params.phases![0].trial_end, f.end);
	assert.equal(
		f.updates[0].params.phases![0].items[0].price,
		"price_plus_yearly",
	);
	assert.equal(f.updates[0].params.proration_behavior, "none");
	assert.equal(f.sub.schedule, "sched_trial");
	assert.equal(f.schedule.end_behavior, "release");
});
test("late_setup_after_cancel_stays_canceled", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	assert.equal(
		(await f.service.cancelTrialRenewal(USER, randomUUID())).state,
		"canceled",
	);
	const count = f.updates.length;
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"superseded",
	);
	assert.equal(f.updates.length, count);
	assert.equal(f.schedule.end_behavior, "cancel");
});
test("setup_for_other_owner_rejected before Stripe reads or writes", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.deps.stripe.checkout.sessions.retrieve = async () => {
		throw new Error("must not read another owner");
	};
	assert.equal(
		(
			await f.service.completeTrialRenewal(
				"a1000000-0000-4000-8000-000000000002",
				quote.id,
			)
		).state,
		"unavailable",
	);
	assert.equal(f.updates.length, 0);
});
test("expired_setup_requires_new_payment_confirmation", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.setTime(f.end * 1000);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"expired",
	);
	assert.equal(f.updates.length, 0);
	assert.equal(f.operations.get(quote.id)?.state, "expired");
});
test("changed_price_invalidates_quote both before setup and before opt-in", async () => {
	const f = fixture();
	const quote = await f.service.quoteTrialRenewal(USER, {
		planCode: "plus",
		billingPeriod: "monthly",
	});
	f.changePrice();
	assert.equal(
		(
			await f.service.beginTrialRenewal(
				USER,
				quote.id,
				randomUUID(),
				"https://staging.anidachi.app",
			)
		).state,
		"offer_changed",
	);
	assert.equal(f.creates.length, 0);
	const g = fixture();
	const { quote: q } = await g.setup();
	g.confirm(q.id);
	g.changePrice();
	assert.equal(
		(await g.service.completeTrialRenewal(USER, q.id)).state,
		"offer_changed",
	);
	assert.equal(g.updates.length, 0);
});
test("confirmed setup may finish after quote TTL, but stale quote cannot begin", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.setTime(Date.parse(quote.expiresAt) + 1);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	const g = fixture();
	const q = await g.service.quoteTrialRenewal(USER, {
		planCode: "plus",
		billingPeriod: "monthly",
	});
	g.setTime(Date.parse(q.expiresAt));
	assert.equal(
		(
			await g.service.beginTrialRenewal(
				USER,
				q.id,
				randomUUID(),
				"https://staging.anidachi.app",
			)
		).state,
		"expired",
	);
	assert.equal(g.creates.length, 0);
});
test("lost setup create response recovers the same Session", async () => {
	const f = fixture();
	f.loseCreate();
	const { quote, result } = await f.setup();
	assert.equal(result.state, "pending");
	assert.equal(
		(
			await f.service.beginTrialRenewal(
				USER,
				quote.id,
				randomUUID(),
				"https://staging.anidachi.app",
			)
		).state,
		"setup",
	);
	assert.equal(f.creates.length, 1);
});
test("unknown Stripe update and DB commit recover without another mutation", async () => {
	for (const failure of ["loseUpdate", "loseCommit"] as const) {
		const f = fixture();
		const { quote } = await f.setup();
		f.confirm(quote.id);
		f[failure]();
		assert.equal(
			(await f.service.completeTrialRenewal(USER, quote.id)).state,
			"pending",
		);
		assert.equal(
			(await f.service.completeTrialRenewal(USER, quote.id)).state,
			"active",
		);
		assert.equal(f.updates.length, 1);
	}
});
test("cancel first reconciles an unknown enable and old applied callback stays canceled", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.loseCommit();
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"pending",
	);
	assert.equal(
		(await f.service.cancelTrialRenewal(USER, randomUUID())).state,
		"canceled",
	);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"superseded",
	);
	assert.equal(f.updates.length, 2);
});
test("a foreign PaymentMethod or SetupIntent cannot enable renewal", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	[...f.intents.values()][0].customer = "cus_other";
	assert.notEqual(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	assert.equal(f.updates.length, 0);
});

test("a setup for on-session usage cannot enable an off-session renewal", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	[...f.intents.values()][0].usage = "on_session";
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"unavailable",
	);
	assert.equal(f.updates.length, 0);
});
test("unknown setup absence beyond the replay window never creates a second Session", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	const op = f.operations.get(quote.id)!;
	op.setup_session_id = null;
	f.sessions.clear();
	f.setTime(Date.parse(op.consented_at!) + 23 * 3600000);
	assert.equal(
		(
			await f.service.beginTrialRenewal(
				USER,
				quote.id,
				randomUUID(),
				"https://staging.anidachi.app",
			)
		).state,
		"pending",
	);
	assert.equal(f.creates.length, 1);
	assert.equal(f.updates.length, 0);
});
test("unknown applying mutation settles only after verified native cancellation", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.deps.stripe.subscriptionSchedules.update = async () => {
		throw Error("network unknown");
	};
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"pending",
	);
	assert.equal(f.operations.get(quote.id)!.state, "applying");
	f.setTime(f.end * 1000 + 1);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"pending",
	);
	f.schedule.status = "completed";
	f.sub.status = "canceled";
	f.sub.schedule = null;
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"expired",
	);
	assert.equal(f.operations.get(quote.id)!.state, "expired");
});
test("a lost successful enable can reconcile after native release without repeating update", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	f.confirm(quote.id);
	f.loseCommit();
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"pending",
	);
	f.setTime(f.end * 1000 + 1);
	f.schedule.status = "released";
	f.schedule.subscription = null;
	f.schedule.released_subscription = f.sub.id;
	f.sub.status = "active";
	f.sub.schedule = null;
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	assert.equal(f.updates.length, 1);
});

test("replaying an obsolete cancel cannot confirm cancellation of a later opt-in", async () => {
	const f = fixture();
	const first = await f.setup();
	f.confirm(first.quote.id);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, first.quote.id)).state,
		"active",
	);
	const cancelRequest = randomUUID();
	assert.equal(
		(await f.service.cancelTrialRenewal(USER, cancelRequest)).state,
		"canceled",
	);
	const second = await f.setup();
	f.confirm(second.quote.id);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, second.quote.id)).state,
		"active",
	);
	const count = f.updates.length;
	assert.equal(
		(await f.service.cancelTrialRenewal(USER, cancelRequest)).state,
		"superseded",
	);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, first.quote.id)).state,
		"superseded",
	);
	assert.equal(f.schedule.end_behavior, "release");
	assert.equal(f.operations.get(second.quote.id)?.state, "applied");
	assert.equal(f.updates.length, count);
});

test("quote terms are canonical regardless of JSON property order or untrusted extras", async () => {
	for (const input of [
		{ billingPeriod: "monthly" as const, planCode: "plus" as const },
		{
			planCode: "plus" as const,
			billingPeriod: "monthly" as const,
			clientVersion: 99,
			amount: 1,
			currency: "eur",
			priceId: "price_attacker",
			termsRevision: "attacker",
		},
	]) {
		const f = fixture();
		const q = await f.service.quoteTrialRenewal(USER, input);
		const result = await f.service.beginTrialRenewal(
			USER,
			q.id,
			randomUUID(),
			"https://staging.anidachi.app",
		);
		assert.equal(result.state, "setup");
		assert.deepEqual(
			Object.keys(f.operations.get(q.id)!.terms).sort(),
			[
				"amount",
				"billingPeriod",
				"currency",
				"planCode",
				"priceId",
				"quoteRevision",
				"termsRevision",
			].sort(),
		);
		assert.equal(q.amount, 799);
		assert.equal(q.currency, "usd");
	}
});

test("a second tab cannot supersede consented card setup by requesting a quote", async () => {
	const f = fixture();
	const { quote } = await f.setup();
	await assert.rejects(
		f.service.quoteTrialRenewal(USER, {
			planCode: "pro",
			billingPeriod: "yearly",
		}),
		(error: any) => error.state === "pending",
	);
	f.confirm(quote.id);
	assert.equal(
		(await f.service.completeTrialRenewal(USER, quote.id)).state,
		"active",
	);
	assert.equal(f.creates.length, 1);
});

test("a renewal preview reads all choices without reserving or changing an operation", async () => {
	const f = fixture();
	const preview = await f.service.previewTrialRenewal(USER);
	assert.equal(preview.options.length, 4);
	assert.equal(preview.firstChargeAt, new Date(f.end * 1000).toISOString());
	assert.equal(preview.savedCard, null);
	assert.equal(f.operations.size, 0);
	assert.equal(f.updates.length, 0);
	assert.equal(f.creates.length, 0);
});

test("explicit changes reuse the verified saved card without another Checkout", async () => {
	const f = fixture();
	const { quote: first } = await f.setup();
	f.confirm(first.id);
	await f.service.completeTrialRenewal(USER, first.id);
	const preview = await f.service.previewTrialRenewal(USER);
	assert.deepEqual(preview.savedCard, {
		sourceId: first.id,
		brand: "visa",
		last4: "4242",
	});
	const quote = await f.service.quoteTrialRenewal(USER, {
		planCode: "pro",
		billingPeriod: "yearly",
	});
	const request = randomUUID();
	const confirm = () =>
		f.service.beginTrialRenewal(
			USER,
			quote.id,
			request,
			"https://staging.anidachi.app",
			first.id,
		);
	assert.equal((await confirm()).state, "active");
	assert.equal((await confirm()).state, "active");
	assert.equal(f.creates.length, 1);
	assert.equal(f.updates.length, 2);
	assert.equal(f.sub.items.data[0].price.id, "price_pro_yearly");
	assert.equal(f.sub.trial_end, f.end);
});

test("a removed saved card requires review and never silently starts another setup", async () => {
	const f = fixture();
	const { quote: first } = await f.setup();
	f.confirm(first.id);
	await f.service.completeTrialRenewal(USER, first.id);
	const quote = await f.service.quoteTrialRenewal(USER, {
		planCode: "pro",
		billingPeriod: "monthly",
	});
	f.sub.default_payment_method = null;
	assert.equal(
		(
			await f.service.beginTrialRenewal(
				USER,
				quote.id,
				randomUUID(),
				"https://staging.anidachi.app",
				first.id,
			)
		).state,
		"offer_changed",
	);
	assert.equal(f.creates.length, 1);
	assert.equal(f.updates.length, 1);
});

for (const replacement of [null, "pm_replacement"])
	test(`saved-card apply and recovery never restore a changed default: ${replacement}`, async () => {
		const f = fixture();
		const { quote: first } = await f.setup();
		f.confirm(first.id);
		await f.service.completeTrialRenewal(USER, first.id);
		const quote = await f.service.quoteTrialRenewal(USER, {
			planCode: "pro",
			billingPeriod: "yearly",
		});
		const begin = f.deps.beginSavedCard;
		f.deps.beginSavedCard = async (...args) => {
			const op = await begin(...args);
			f.sub.default_payment_method = replacement;
			return op;
		};
		assert.equal(
			(
				await f.service.beginTrialRenewal(
					USER,
					quote.id,
					randomUUID(),
					"https://staging.anidachi.app",
					first.id,
				)
			).state,
			"pending",
		);
		assert.equal(
			(await f.service.completeTrialRenewal(USER, quote.id)).state,
			"pending",
		);
		assert.equal(f.sub.default_payment_method, replacement);
		assert.equal(
			f.updates.length,
			1,
			"no new Stripe mutation after the card changed",
		);
	});
