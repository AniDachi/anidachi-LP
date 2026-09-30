import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { createTrialPlanChangeService } from "./trial-plan-change";

const start = 1_790_000_000,
	end = start + 259200;
const requestId = "11111111-1111-4111-8111-111111111111";
function fixture() {
	const calls: string[] = [];
	const updates: {
		params: Stripe.SubscriptionUpdateParams;
		options: Stripe.RequestOptions;
	}[] = [];
	const price = (plan: string) =>
		({
			id: `price_${plan}`,
			active: true,
			livemode: false,
			type: "recurring",
			billing_scheme: "per_unit",
			unit_amount:
				plan === "plus"
					? 799
					: plan === "pro"
						? 1499
						: plan === "plus_yearly"
							? 7670
							: 14390,
			currency: "usd",
			recurring: {
				interval: plan.endsWith("_yearly") ? "year" : "month",
				interval_count: 1,
				usage_type: "licensed",
			},
			transform_quantity: null,
		}) as Stripe.Price;
	const sub = {
		id: "sub_owner",
		customer: "cus_owner",
		livemode: false,
		status: "trialing",
		metadata: { userId: "owner", planCode: "plus" },
		trial_start: start,
		trial_end: end,
		cancel_at_period_end: false,
		cancel_at: null,
		schedule: null,
		pending_update: null,
		items: {
			has_more: false,
			data: [{ id: "si_owner", quantity: 1, price: price("plus") }],
		},
	} as unknown as Stripe.Subscription;
	let now = (start + 3600) * 1000,
		owner = "owner",
		timeout = false,
		syncFailure = false;
	const stripe = {
		prices: { retrieve: async (id: string) => price(id.replace("price_", "")) },
		subscriptions: {
			retrieve: async () => {
				calls.push("retrieve");
				return structuredClone(sub);
			},
			update: async (
				_id: string,
				params: Stripe.SubscriptionUpdateParams,
				options: Stripe.RequestOptions,
			) => {
				calls.push("update");
				updates.push({ params, options });
				sub.items.data[0].price = price(
					params.items![0].price!.replace("price_", ""),
				);
				if (timeout) throw new Error("lost response");
				return structuredClone(sub);
			},
		},
	} as unknown as Stripe;
	const trial = {
		user_id: "owner",
		stripe_subscription_id: "sub_owner",
		trial_started_at: new Date(start * 1000).toISOString(),
		trial_ends_at: new Date(end * 1000).toISOString(),
		first_invoice_id: null,
		first_payment_state: "awaiting" as const,
		first_paid_at: null,
	};
	const service = createTrialPlanChangeService({
		listSubscriptions: async () =>
			[
				{
					id: "local-row",
					user_id: owner,
					stripe_customer_id: "cus_owner",
					stripe_subscription_id: "sub_owner",
				},
			] as never,
		getCustomer: async () =>
			({ user_id: "owner", stripe_customer_id: "cus_owner" }) as never,
		readTrial: async () => trial,
		createStripe: () => stripe,
		priceId: (plan, period = "monthly") =>
			`price_${plan}${period === "yearly" ? "_yearly" : ""}`,
		mode: () => "test",
		now: () => now,
		sync: async () => {
			calls.push("sync");
			if (syncFailure) throw new Error("lease busy");
			return {
				userId: "owner",
				stripeCustomerId: "cus_owner",
				stripeSubscriptionId: sub.id,
				stripePriceId: sub.items.data[0].price.id,
				planCode: sub.items.data[0].price.id.startsWith("price_pro")
					? "pro"
					: "plus",
			} as never;
		},
	});
	return {
		service,
		sub,
		trial,
		calls,
		updates,
		price,
		setNow: (v: number) => {
			now = v;
		},
		setOwner: (v: string) => {
			owner = v;
		},
		setTimeout: () => {
			timeout = true;
		},
		setSyncFailure: () => {
			syncFailure = true;
		},
	};
}
test("trial quote is read-only and presents price, original end and cancellation", async () => {
	const f = fixture();
	f.sub.cancel_at_period_end = true;
	f.sub.cancel_at = end;
	const quote = await f.service.quote("owner", "local-row", "pro");
	assert.equal(quote.unitAmount, 1499);
	assert.equal(quote.currency, "usd");
	assert.equal(quote.trialEndsAt, f.trial.trial_ends_at);
	assert.equal(quote.renewalCanceled, true);
	assert.equal(quote.currentPlanCode, "plus");
	assert.equal(quote.planCode, "pro");
	assert.equal(f.updates.length, 0);
});
test("confirmed trial change retains original end and never changes cancellation flags", async () => {
	const f = fixture();
	f.sub.cancel_at_period_end = true;
	f.sub.cancel_at = end;
	const quote = await f.service.quote("owner", "local-row", "pro");
	await f.service.confirm("owner", "local-row", "pro", quote, requestId);
	assert.equal(f.sub.items.data[0].price.id, "price_pro");
	assert.equal(f.sub.cancel_at_period_end, true);
	assert.equal(f.sub.trial_end, end);
	assert.deepEqual(f.updates[0].params, {
		items: [{ id: "si_owner", price: "price_pro", quantity: 1 }],
		trial_end: end,
		proration_behavior: "none",
		metadata: { planCode: "pro" },
	});
	assert.equal(
		f.updates[0].options.idempotencyKey,
		`trial-plan:owner:${requestId}`,
	);
	assert.equal(f.calls.at(-1), "sync");
});
test("lost Stripe response can be reconciled without applying the plan twice", async () => {
	const f = fixture();
	const quote = await f.service.quote("owner", "local-row", "pro");
	f.setTimeout();
	await assert.rejects(
		f.service.confirm("owner", "local-row", "pro", quote, requestId),
	);
	await f.service.confirm("owner", "local-row", "pro", quote, requestId);
	assert.equal(f.updates.length, 1);
	assert.equal(f.calls.at(-1), "sync");
});
test("foreign local, customer, metadata or trial ownership never permits a change", async () => {
	for (const mismatch of ["row", "customer", "metadata", "trial"]) {
		const f = fixture();
		if (mismatch === "row") f.setOwner("foreign");
		if (mismatch === "customer") f.sub.customer = "cus_foreign";
		if (mismatch === "metadata") f.sub.metadata.userId = "foreign";
		if (mismatch === "trial") f.trial.user_id = "foreign";
		await assert.rejects(f.service.quote("owner", "local-row", "pro"));
		assert.equal(f.updates.length, 0);
	}
	await assert.rejects(fixture().service.quote("owner", "sub_owner", "pro"));
});
test("an ended trial, mutated original date and unsupported subscription shape fail closed", async () => {
	for (const kind of [
		"expired",
		"active",
		"extended",
		"multiple",
		"quantity",
		"schedule",
		"wrong-mode",
	]) {
		const f = fixture();
		if (kind === "expired") f.setNow(end * 1000);
		if (kind === "active") f.sub.status = "active";
		if (kind === "extended") f.sub.trial_end = end + 1;
		if (kind === "multiple") f.sub.items.has_more = true;
		if (kind === "quantity") f.sub.items.data[0].quantity = 2;
		if (kind === "schedule") f.sub.schedule = "sub_sched_other";
		if (kind === "wrong-mode") f.sub.livemode = true;
		await assert.rejects(f.service.quote("owner", "local-row", "pro"));
		assert.equal(f.updates.length, 0);
	}
});
test("confirmation rejects changed quoted terms and a trial ending since the quote", async () => {
	for (const field of [
		"unitAmount",
		"currency",
		"trialEndsAt",
		"renewalCanceled",
		"currentPlanCode",
	]) {
		const f = fixture();
		const quote = await f.service.quote("owner", "local-row", "pro");
		const changed = {
			...quote,
			[field]:
				field === "unitAmount"
					? 1
					: field === "renewalCanceled"
						? true
						: "changed",
		};
		await assert.rejects(
			f.service.confirm(
				"owner",
				"local-row",
				"pro",
				changed as never,
				requestId,
			),
		);
		assert.equal(f.updates.length, 0);
	}
	const f = fixture();
	const quote = await f.service.quote("owner", "local-row", "pro");
	f.setNow(end * 1000);
	await assert.rejects(
		f.service.confirm("owner", "local-row", "pro", quote, requestId),
	);
	assert.equal(f.updates.length, 0);
});
test("mutation cannot claim success before durable fresh synchronization", async () => {
	const f = fixture();
	const quote = await f.service.quote("owner", "local-row", "pro");
	f.setSyncFailure();
	await assert.rejects(
		f.service.confirm("owner", "local-row", "pro", quote, requestId),
	);
	assert.equal(f.updates.length, 1);
});

test("monthly trial can switch to yearly without charging early or extending the trial", async () => {
	const f = fixture();
	const quote = await f.service.quote("owner", "local-row", "plus", "yearly");
	assert.equal(quote.billingPeriod, "yearly");
	assert.equal(quote.currentBillingPeriod, "monthly");
	assert.equal(quote.unitAmount, 7670);
	await f.service.confirm(
		"owner",
		"local-row",
		"plus",
		quote,
		requestId,
		"yearly",
	);
	assert.equal(f.updates[0].params.items![0].price, "price_plus_yearly");
	assert.equal(f.updates[0].params.trial_end, end);
	assert.equal(f.updates[0].params.proration_behavior, "none");
	await f.service.confirm(
		"owner",
		"local-row",
		"plus",
		quote,
		requestId,
		"yearly",
	);
	assert.equal(f.updates.length, 1);
});
test("changing Plus to Pro during an annual trial preserves annual billing", async () => {
	const f = fixture();
	f.sub.items.data[0].price = f.price("plus_yearly");
	const quote = await f.service.quote("owner", "local-row", "pro");
	assert.equal(quote.billingPeriod, "yearly");
	assert.equal(quote.unitAmount, 14390);
	await f.service.confirm("owner", "local-row", "pro", quote, requestId);
	assert.equal(f.sub.items.data[0].price.id, "price_pro_yearly");
	assert.equal(f.sub.trial_end, end);
});
test("annual trial confirmation rejects a stale or tampered period before any change", async () => {
	const f = fixture();
	const q = await f.service.quote("owner", "local-row", "plus", "yearly");
	await assert.rejects(
		f.service.confirm(
			"owner",
			"local-row",
			"plus",
			{ ...q, billingPeriod: "monthly" },
			requestId,
			"yearly",
		),
	);
	await assert.rejects(
		f.service.confirm("owner", "local-row", "plus", q, requestId, "monthly"),
	);
	assert.equal(f.updates.length, 0);
});
