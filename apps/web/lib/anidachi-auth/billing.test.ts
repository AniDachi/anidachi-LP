import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import type { AccountEntitlements } from "./account-entitlements";
import {
	BillingError,
	canCancelSubscription,
	createBillingService,
} from "./billing";
import type { SubscriptionRow } from "./db";
import type { StripeSubscriptionSyncResult } from "./stripe-subscription-sync";

const row: SubscriptionRow = {
	id: "local-subscription",
	user_id: "owner",
	stripe_customer_id: "cus_owner",
	stripe_subscription_id: "sub_owner",
	stripe_price_id: "price_plus",
	plan_code: "plus",
	status: "active",
	current_period_end: "2030-01-01T00:00:00.000Z",
	cancel_at_period_end: false,
	created_at: "2026-09-09T00:00:00.000Z",
	updated_at: "2026-09-09T00:00:00.000Z",
};
const result: StripeSubscriptionSyncResult = {
	userId: "owner",
	stripeCustomerId: "cus_owner",
	stripeSubscriptionId: "sub_owner",
	stripePriceId: "price_plus",
	planCode: "plus",
	status: "active",
	effectivePlan: "plus",
	currentPeriodEnd: row.current_period_end,
	cancelAtPeriodEnd: false,
};
const returnUrl = "https://staging.anidachi.app/account/billing?billing=return";
function fixture(
	options: {
		rows?: SubscriptionRow[];
		customerOwner?: string;
		customerId?: string;
		syncResult?: StripeSubscriptionSyncResult;
		mode?: "live" | "test";
		config?: Record<string, unknown> | null;
		syncFailure?: boolean;
	} = {},
) {
	const calls: string[] = [];
	let portalParams: Stripe.BillingPortal.SessionCreateParams | undefined;
	const stripe = {
		billingPortal: {
			configurations: {
				list: async (params: unknown) => {
					calls.push("config");
					assert.deepEqual(params, {
						is_default: true,
						active: true,
						limit: 1,
					});
					return {
						data:
							options.config === null
								? []
								: [
										{
											id: "bpc_default",
											active: true,
											is_default: true,
											livemode: false,
											features: {
												subscription_cancel: {
													enabled: true,
													mode: "at_period_end",
												},
											},
											...options.config,
										},
									],
					};
				},
			},
			sessions: {
				create: async (params: Stripe.BillingPortal.SessionCreateParams) => {
					calls.push("portal");
					portalParams = params;
					return { url: "https://billing.stripe.com/p/session/test_fixture" };
				},
			},
		},
	} as unknown as Stripe;
	const service = createBillingService({
		listSubscriptions: async (userId) => {
			assert.equal(userId, "owner");
			return options.rows ?? [{ ...row }];
		},
		getCustomer: async (userId) => ({
			user_id: options.customerOwner ?? userId,
			stripe_customer_id: options.customerId ?? "cus_owner",
			created_at: "",
			updated_at: "",
		}),
		resolveEntitlements: async () =>
			({ policy: { planCode: "free" } }) as AccountEntitlements,
		createStripe: () => {
			calls.push("client");
			return stripe;
		},
		sync: async (_stripe, id, deps) => {
			calls.push("sync");
			assert.equal(id, "sub_owner");
			assert.equal(deps?.expectedUserId, "owner");
			if (options.syncFailure) throw new Error("busy refresh");
			return options.syncResult ?? result;
		},
		mode: () => options.mode ?? "test",
	});
	return { service, calls, params: () => portalParams };
}

test("cancellation refreshes owned subscription before creating the verified end-period portal", async () => {
	const f = fixture();
	await f.service.cancellationPortal("owner", row.id, returnUrl);
	assert.deepEqual(f.calls, ["client", "sync", "config", "portal"]);
	assert.deepEqual(f.params(), {
		configuration: "bpc_default",
		customer: "cus_owner",
		return_url: returnUrl,
		flow_data: {
			type: "subscription_cancel",
			subscription_cancel: { subscription: "sub_owner" },
			after_completion: {
				type: "redirect",
				redirect: { return_url: returnUrl },
			},
		},
	});
});

test("foreign Stripe IDs and nonexistent local rows cannot select a subscription", async () => {
	for (const id of ["sub_owner", "sub_foreign", "other-local-id"]) {
		const f = fixture();
		await assert.rejects(
			f.service.cancellationPortal("owner", id, returnUrl),
			(error: unknown) => error instanceof BillingError && error.status === 404,
		);
		assert.deepEqual(f.calls, []);
	}
});

test("conflicting customer, local ownership, and fresh Stripe ownership fail closed", async () => {
	for (const options of [
		{ rows: [{ ...row, user_id: "foreign" }] },
		{ customerOwner: "foreign" },
		{ customerId: "cus_foreign" },
		{ syncResult: { ...result, userId: "foreign" } },
		{ syncResult: { ...result, stripeCustomerId: "cus_foreign" } },
		{ syncResult: { ...result, stripeSubscriptionId: "sub_foreign" } },
	]) {
		const f = fixture(options);
		await assert.rejects(
			f.service.cancellationPortal("owner", row.id, returnUrl),
		);
		assert.ok(!f.calls.includes("portal"));
	}
});

test("missing, wrong-mode, disabled and immediate-cancel configurations never open a portal", async () => {
	for (const options of [
		{ config: null },
		{ config: { active: false } },
		{ config: { is_default: false } },
		{ config: { livemode: true } },
		{ mode: "live" as const },
		{
			config: {
				features: {
					subscription_cancel: { enabled: false, mode: "at_period_end" },
				},
			},
		},
		{
			config: {
				features: {
					subscription_cancel: { enabled: true, mode: "immediately" },
				},
			},
		},
	]) {
		const f = fixture(options);
		await assert.rejects(
			f.service.cancellationPortal("owner", row.id, returnUrl),
			/temporarily unavailable/,
		);
		assert.ok(!f.calls.includes("portal"));
	}
});

test("fresh scheduled cancellation and terminal status prevent duplicate cancellation flows", async () => {
	for (const syncResult of [
		{ ...result, cancelAtPeriodEnd: true },
		{ ...result, status: "canceled" },
		{ ...result, status: "incomplete_expired" },
	]) {
		const f = fixture({ syncResult });
		await assert.rejects(
			f.service.cancellationPortal("owner", row.id, returnUrl),
			(error: unknown) => error instanceof BillingError && error.status === 409,
		);
		assert.ok(!f.calls.includes("portal"));
	}
	const busy = fixture({ syncFailure: true });
	await assert.rejects(
		busy.service.cancellationPortal("owner", row.id, returnUrl),
	);
	assert.ok(!busy.calls.includes("portal"));
});

test("overview uses current entitlement authority and exposes no Stripe identifiers", async () => {
	const { service } = fixture({
		rows: [{ ...row, cancel_at_period_end: true }],
	});
	const view = await service.overview("owner");
	assert.equal(view.planCode, "free");
	assert.equal(view.ownerUserId, "owner");
	assert.equal(view.subscriptions[0]?.canCancel, false);
	assert.equal(view.subscriptions[0]?.currentPeriodEnd, row.current_period_end);
	assert.doesNotMatch(JSON.stringify(view), /cus_owner|sub_owner|price_plus/);
});

test("refresh retains pending cancellations for fenced reconciliation, without refreshing terminal rows", async () => {
	const f = fixture({
		rows: [
			{ ...row, cancel_at_period_end: true },
			{ ...row, status: "canceled" },
		],
	});
	await f.service.refresh("owner");
	assert.deepEqual(f.calls, ["client", "sync"]);
	const empty = fixture({ rows: [] });
	await empty.service.refresh("owner");
	assert.deepEqual(empty.calls, []);
});

test("payment problem and paused subscriptions can stop renewal without claiming paid access", () => {
	for (const status of ["active", "trialing", "past_due", "unpaid", "paused"])
		assert.equal(canCancelSubscription(status, false), true);
	for (const status of [
		"canceled",
		"incomplete",
		"incomplete_expired",
		"unknown",
	])
		assert.equal(canCancelSubscription(status, false), false);
});
