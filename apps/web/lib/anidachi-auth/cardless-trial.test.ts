import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
	type CardlessTrialActivation,
	type CardlessTrialDeps,
	createCardlessTrialService,
	type TrialStartInput,
} from "./cardless-trial";

const USER = "a1000000-0000-4000-8000-000000000001";
const REQUEST = "a2000000-0000-4000-8000-000000000001";
const ACTIVATION = "a3000000-0000-4000-8000-000000000001";
const NOW = 1_900_000_000_000;
const input: TrialStartInput = {
	requestId: REQUEST,
	planCode: "plus",
	billingPeriod: "monthly",
	offerRevision: "7",
};
function fixture() {
	let activation: CardlessTrialActivation | null = null;
	const state = {
		enabled: true,
		eligible: true,
		legacy: "clear" as "clear" | "pending" | "ineligible",
		loseCreate: false,
		loseCommit: false,
		now: NOW,
		creates: 0,
		customerCreates: 0,
		reserves: 0,
		syncs: 0,
		schedules: [] as Stripe.SubscriptionSchedule[],
		params: [] as Stripe.SubscriptionScheduleCreateParams[],
		keys: [] as string[],
	};
	const metadata = {
		userId: USER,
		trialActivationId: ACTIVATION,
		anidachiTrial: "72h_v1",
		anidachiTrialMode: "cardless_v1",
		planCode: "plus",
	};
	const subscription = {
		id: "sub_trial",
		customer: "cus_trial",
		livemode: false,
		metadata,
		schedule: "sched_trial",
		status: "trialing",
		trial_start: NOW / 1000,
		trial_end: NOW / 1000 + 259200,
		cancel_at: NOW / 1000 + 259200,
		items: { data: [{ price: { id: "price_plus" }, quantity: 1 }] },
	} as unknown as Stripe.Subscription;
	const schedule = {
		id: "sched_trial",
		customer: "cus_trial",
		livemode: false,
		metadata,
		subscription: "sub_trial",
		released_subscription: null,
		status: "active",
		end_behavior: "cancel",
		phases: [
			{
				start_date: NOW / 1000,
				end_date: NOW / 1000 + 259200,
				trial_end: NOW / 1000 + 259200,
				items: [{ price: "price_plus", quantity: 1 }],
			},
		],
	} as unknown as Stripe.SubscriptionSchedule;
	const stripe = {
		customers: {
			create: async (p: Stripe.CustomerCreateParams) => {
				assert.ok(
					activation,
					"account must be reserved before Customer creation",
				);
				state.customerCreates++;
				return { id: "cus_trial", livemode: false, metadata: p.metadata };
			},
			search: async () => ({ data: [], has_more: false }),
		},
		subscriptionSchedules: {
			list: async () => ({ data: state.schedules, has_more: false }),
			create: async (
				p: Stripe.SubscriptionScheduleCreateParams,
				o: Stripe.RequestOptions,
			) => {
				state.creates++;
				state.params.push(p);
				assert.ok(o.idempotencyKey);
				state.keys.push(o.idempotencyKey);
				state.schedules.push(schedule);
				if (state.loseCreate) {
					state.loseCreate = false;
					throw Error("lost response");
				}
				return schedule;
			},
			retrieve: async () => schedule,
		},
		subscriptions: { retrieve: async () => subscription },
	} as unknown as Stripe;
	const deps: CardlessTrialDeps = {
		stripe,
		livemode: false,
		now: () => state.now,
		isVerified: async () => true,
		findActivation: async () => activation,
		offer: async () => ({
			action: state.eligible ? "trial" : "subscribe",
			trialMode: state.enabled ? "cardless" : "card_required",
			revision: "7",
			policyRevision: 7,
			priceId: "price_plus",
		}),
		reconcileLegacy: async () => state.legacy,
		reserve: async () => {
			state.reserves++;
			activation ??= {
				id: ACTIVATION,
				user_id: USER,
				request_id: REQUEST,
				plan_code: "plus",
				billing_period: "monthly",
				price_id: "price_plus",
				policy_revision: 7,
				stripe_customer_id: null,
				stripe_schedule_id: null,
				stripe_subscription_id: null,
				state: "pending",
				created_at: new Date(NOW).toISOString(),
				trial_started_at: null,
				trial_ends_at: null,
			};
			return activation;
		},
		bindCustomer: async (_u, a, c) => {
			assert.equal(a, ACTIVATION);
			assert.ok(activation);
			activation.stripe_customer_id = c;
			return activation;
		},
		recordCreated: async (_u, a, proof) => {
			assert.equal(a, ACTIVATION);
			assert.ok(activation);
			Object.assign(activation, {
				state: "created",
				stripe_schedule_id: proof.scheduleId,
				stripe_subscription_id: proof.subscriptionId,
				trial_started_at: proof.trialStartedAt,
				trial_ends_at: proof.trialEndsAt,
			});
			return activation;
		},
		sync: async () => {
			state.syncs++;
			assert.ok(activation);
			if (state.loseCommit) {
				state.loseCommit = false;
				throw Error("database unavailable");
			}
			activation.state = "committed";
			return { status: "trialing" };
		},
	};
	return {
		state,
		deps,
		subscription,
		schedule,
		service: createCardlessTrialService(deps),
		activation: () => activation,
	};
}

test("double_click_reuses_activation", async () => {
	const f = fixture();
	const results = await Promise.all([
		f.service.startCardlessTrial(USER, input),
		f.service.startCardlessTrial(USER, input),
	]);
	assert.deepEqual(
		results.map((r) => r.state),
		["active", "active"],
	);
	assert.equal(f.state.creates, 1);
	assert.equal(f.state.customerCreates, 1);
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"active",
	);
	assert.equal(f.state.creates, 1);
	assert.equal(f.state.params[0].end_behavior, "cancel");
	assert.deepEqual(f.state.params[0].phases?.[0].duration, {
		interval: "day",
		interval_count: 3,
	});
	assert.equal(f.state.params[0].phases?.[0].trial, true);
	assert.equal(f.state.keys[0], "trial:" + ACTIVATION);
});
test("created_but_response_lost_reconciles", async () => {
	const f = fixture();
	f.state.loseCreate = true;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"pending",
	);
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"active",
	);
	assert.equal(f.state.creates, 1);
	assert.equal(f.activation()?.stripe_schedule_id, "sched_trial");
	assert.equal(f.activation()?.stripe_subscription_id, "sub_trial");
});
test("committed_response_lost_preserves_identity_and_original_expiry", async () => {
	const f = fixture();
	f.state.loseCommit = true;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"pending",
	);
	f.state.now += 5000;
	const result = await f.service.startCardlessTrial(USER, input);
	assert.equal(result.state, "active");
	if (result.state === "active")
		assert.equal(result.trialEndsAt, new Date(NOW + 259200000).toISOString());
	assert.equal(f.state.creates, 1);
});
test("completed_legacy_checkout_blocks_cardless", async () => {
	const f = fixture();
	f.state.legacy = "ineligible";
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"ineligible",
	);
	assert.equal(f.state.reserves, 0);
	assert.equal(f.state.creates, 0);
});
test("flag_disabled_during_recovery_finishes_existing_operation", async () => {
	const f = fixture();
	f.state.loseCreate = true;
	await f.service.startCardlessTrial(USER, input);
	f.state.enabled = false;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"active",
	);
	assert.equal(f.state.creates, 1);
	const fresh = fixture();
	fresh.state.enabled = false;
	assert.equal(
		(await fresh.service.startCardlessTrial(USER, input)).state,
		"offer_changed",
	);
	assert.equal(fresh.state.reserves, 0);
});
test("used_trial_never_becomes_paid_checkout", async () => {
	const f = fixture();
	f.state.eligible = false;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"ineligible",
	);
	assert.equal(f.state.reserves, 0);
	assert.equal(f.state.creates, 0);
});
test("changed_offer_or_replayed_selection_never_changes_reserved_terms", async () => {
	const f = fixture();
	assert.equal(
		(await f.service.startCardlessTrial(USER, { ...input, offerRevision: "6" }))
			.state,
		"offer_changed",
	);
	assert.equal(f.state.reserves, 0);
	f.state.loseCreate = true;
	await f.service.startCardlessTrial(USER, input);
	assert.equal(
		(await f.service.startCardlessTrial(USER, { ...input, planCode: "pro" }))
			.state,
		"offer_changed",
	);
	assert.equal(f.state.creates, 1);
});
test("uncertain_creation_older_than_retention_never_blindly_recreates", async () => {
	const f = fixture();
	f.state.loseCreate = true;
	await f.service.startCardlessTrial(USER, input);
	f.state.schedules = [];
	f.state.now += 24 * 60 * 60 * 1000;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"pending",
	);
	assert.equal(f.state.creates, 1);
});
test("untrusted_stripe_owner_dates_price_or_mode_cannot_grant_access", async () => {
	for (const alter of [
		(f: ReturnType<typeof fixture>) => {
			f.subscription.customer = "cus_other";
		},
		(f: ReturnType<typeof fixture>) => {
			assert.ok(f.subscription.trial_end);
			f.subscription.trial_end++;
		},
		(f: ReturnType<typeof fixture>) => {
			f.schedule.livemode = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.schedule.end_behavior = "release";
		},
		(f: ReturnType<typeof fixture>) => {
			f.subscription.items.data[0].price.id = "price_other";
		},
	]) {
		const f = fixture();
		alter(f);
		assert.equal(
			(await f.service.startCardlessTrial(USER, input)).state,
			"pending",
		);
		assert.equal(f.state.syncs, 0);
		assert.equal(f.activation()?.state, "pending");
	}
});
test("expired_trial_replay_never_restores_access", async () => {
	const f = fixture();
	await f.service.startCardlessTrial(USER, input);
	f.state.now += 259200000;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"ineligible",
	);
	assert.equal(f.state.creates, 1);
});
test("new trial requires provider-verified email without consuming an activation", async () => {
	const f = fixture();
	f.deps.isVerified = async () => false;
	assert.equal(
		(await f.service.startCardlessTrial(USER, input)).state,
		"verification_required",
	);
	assert.equal(f.state.reserves, 0);
});
