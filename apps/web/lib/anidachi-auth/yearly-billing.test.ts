import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { yearlyBillingPortal } from "./yearly-billing";
import type { SubscriptionRow, BillingCustomerRow } from "./db";

function fixture() {
	const now = Date.parse("2030-01-15T00:00:00Z");
	const price = {
		id: "price_plus_month",
		product: "prod_plus",
		active: true,
		livemode: false,
		type: "recurring",
		billing_scheme: "per_unit",
		transform_quantity: null,
		currency: "usd",
		unit_amount: 799,
		recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
	} as Stripe.Price;
	const target = {
		...price,
		id: "price_plus_year",
		unit_amount: 7670,
		recurring: { ...price.recurring!, interval: "year" },
	} as Stripe.Price;
	const row = {
		id: "row",
		user_id: "owner",
		stripe_customer_id: "cus_owner",
		stripe_subscription_id: "sub_owner",
	} as SubscriptionRow;
	const customer = {
		user_id: "owner",
		stripe_customer_id: "cus_owner",
	} as BillingCustomerRow;
	const sub = {
		id: "sub_owner",
		customer: "cus_owner",
		metadata: { userId: "owner" },
		livemode: false,
		status: "active",
		collection_method: "charge_automatically",
		cancel_at_period_end: false,
		cancel_at: null,
		schedule: null,
		pending_update: null,
		pause_collection: null,
		latest_invoice: "in_paid",
		items: {
			has_more: false,
			data: [
				{
					id: "si_owner",
					quantity: 1,
					price,
					current_period_end: now / 1000 + 86400,
				},
			],
		},
	} as unknown as Stripe.Subscription;
	const invoice = {
		id: "in_paid",
		customer: "cus_owner",
		livemode: false,
		status: "paid",
		amount_remaining: 0,
		parent: { subscription_details: { subscription: sub.id } },
	} as Stripe.Invoice;
	const config = {
		id: "bpc_year",
		active: true,
		is_default: false,
		livemode: false,
		features: {
			subscription_update: {
				enabled: true,
				default_allowed_updates: ["price"],
				proration_behavior: "always_invoice",
				schedule_at_period_end: { conditions: [] },
				products: [{ product: "prod_plus", prices: [target.id] }],
			},
		},
	} as unknown as Stripe.BillingPortal.Configuration;
	const sessions: Stripe.BillingPortal.SessionCreateParams[] = [];
	const stripe = {
		subscriptions: { retrieve: async () => sub },
		prices: { retrieve: async () => target },
		invoices: { retrieve: async () => invoice },
		billingPortal: {
			configurations: {
				retrieve: async (_id: string, params: { expand: string[] }) => {
					assert.deepEqual(params.expand, [
						"features.subscription_update.products",
					]);
					return config;
				},
			},
			sessions: {
				create: async (params: Stripe.BillingPortal.SessionCreateParams) => {
					sessions.push(params);
					return { url: "https://billing.stripe.com/p/session/test" };
				},
			},
		},
	} as unknown as Stripe;
	const deps = {
		listSubscriptions: async () => [row],
		getCustomer: async () => customer,
		createStripe: () => stripe,
		mode: () => "test" as const,
		planCode: () => "plus" as const,
		priceId: (_plan: string, period?: string) =>
			period === "yearly" ? target.id : price.id,
		configurationId: () => config.id,
		now: () => now,
	};
	return {
		sub,
		row,
		customer,
		target,
		config,
		invoice,
		sessions,
		open: () =>
			yearlyBillingPortal(
				"owner",
				"row",
				"https://anidachi.test/account/billing?billing=return",
				deps,
			),
	};
}

test("paid monthly conversion opens a same-item annual Stripe confirmation without mutating a subscription", async () => {
	const f = fixture();
	await f.open();
	assert.equal(f.sessions.length, 1);
	assert.equal(f.sub.items.data[0].price.id, "price_plus_month");
	assert.deepEqual(f.sessions[0].flow_data?.subscription_update_confirm, {
		subscription: "sub_owner",
		items: [{ id: "si_owner", price: "price_plus_year", quantity: 1 }],
	});
	assert.equal(f.sessions[0].flow_data?.type, "subscription_update_confirm");
	assert.equal(f.sessions[0].configuration, "bpc_year");
});

test("ownership, unpaid invoices and unsafe portal configuration block yearly conversion", async () => {
	const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
		(f) => {
			f.row.user_id = "foreign";
		},
		(f) => {
			f.customer.user_id = "foreign";
		},
		(f) => {
			f.sub.customer = "cus_foreign";
		},
		(f) => {
			f.sub.metadata.userId = "foreign";
		},
		(f) => {
			f.sub.livemode = true;
		},
		(f) => {
			f.sub.status = "trialing";
		},
		(f) => {
			f.sub.status = "past_due";
		},
		(f) => {
			f.sub.cancel_at_period_end = true;
		},
		(f) => {
			f.sub.cancel_at = 1;
		},
		(f) => {
			f.sub.schedule = "sched";
		},
		(f) => {
			f.sub.pending_update = {} as never;
		},
		(f) => {
			f.sub.items.data[0].current_period_end = 1;
		},
		(f) => {
			f.sub.items.data[0].quantity = 2;
		},
		(f) => {
			f.sub.items.has_more = true;
		},
		(f) => {
			f.sub.items.data[0].price.recurring!.interval = "year";
		},
		(f) => {
			f.invoice.status = "open";
		},
		(f) => {
			f.invoice.amount_remaining = 100;
		},
		(f) => {
			f.invoice.customer = "foreign";
		},
		(f) => {
			f.target.product = "foreign";
		},
		(f) => {
			f.target.active = false;
		},
		(f) => {
			f.target.recurring!.interval = "month";
		},
		(f) => {
			f.config.is_default = true;
		},
		(f) => {
			f.config.features.subscription_update.proration_behavior = "none";
		},
		(f) => {
			f.config.features.subscription_update.default_allowed_updates = [
				"price",
				"quantity",
			];
		},
		(f) => {
			f.config.features.subscription_update.products = [];
		},
		(f) => {
			f.config.features.subscription_update.schedule_at_period_end = {
				conditions: [{ type: "decreasing_item_amount" }],
			};
		},
	];
	for (const mutate of mutations) {
		const f = fixture();
		mutate(f);
		await assert.rejects(f.open());
		assert.equal(f.sessions.length, 0);
	}
});
