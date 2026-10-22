// Sandbox-only integration proof. Uses the CLI-owned credential; never reads a key.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import type Stripe from "stripe";
import { createTestCliStripeClient } from "./stripe-test-cli-transport";
import {
	ensureProductHuntPromotion,
	PRODUCT_HUNT_EXPIRES_AT,
} from "../../lib/anidachi-auth/product-hunt-promo";

async function main() {
	const stripe = createTestCliStripeClient("anidachi-cardless-proof");
	const account = await stripe.accounts.retrieve();
	assert.equal(account.id, "acct_1RlmiIPQIEOqG7pr");
	const run = randomUUID();
	const metadata = { anidachiProof: "product_hunt_2026", proofRun: run };
	const plus = "price_1TkktLPQIEOqG7prWLOncTeX";
	const pro = "price_1Tkku6PQIEOqG7prqtCEYYEq";
	const prices = await Promise.all(
		[plus, pro].map((id) => stripe.prices.retrieve(id)),
	);
	assert.ok(
		prices.every(
			(p) => !p.livemode && p.active && p.recurring?.interval === "month",
		),
	);
	const couponId = "anihunt40_monthly_2026_test";
	let coupon;
	try {
		coupon = await stripe.coupons.retrieve(couponId);
	} catch (error) {
		if (
			!(
				error &&
				typeof error === "object" &&
				"statusCode" in error &&
				error.statusCode === 404
			)
		)
			throw error;
		coupon = await stripe.coupons.create(
			{
				id: couponId,
				name: "Product Hunt · 40% for 3 months",
				percent_off: 40,
				duration: "repeating",
				duration_in_months: 3,
				redeem_by: PRODUCT_HUNT_EXPIRES_AT,
				applies_to: { products: prices.map((p) => p.product as string) },
				metadata: { anidachiCampaign: "product_hunt_2026" },
			},
			{ idempotencyKey: "anihunt40-sandbox-coupon-2026" },
		);
	}
	assert.equal(coupon.livemode, false);
	assert.equal(coupon.redeem_by, PRODUCT_HUNT_EXPIRES_AT);
	const clock = await stripe.testHelpers.testClocks.create({
		frozen_time: Math.floor(Date.now() / 1000),
		name: "ANIHUNT40 proof " + run.slice(0, 8),
	});
	assert.equal(clock.livemode, false);
	const report: Record<string, unknown> = {
		run,
		clock: clock.id,
		coupon: coupon.id,
		customers: [],
		subscriptions: [],
		cycles: [],
	};
	const save = () =>
		writeFileSync(
			"/tmp/anihunt-sandbox-proof.json",
			JSON.stringify(report, null, 2),
		);
	save();
	async function advance(time: number) {
		await stripe.testHelpers.testClocks.advance(clock.id, {
			frozen_time: time,
		});
		for (let i = 0; i < 40; i++) {
			const fresh = await stripe.testHelpers.testClocks.retrieve(clock.id);
			if (fresh.status === "ready") return;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		throw new Error(
			"Test clock did not become ready; inspect saved proof IDs.",
		);
	}
	const customers = await Promise.all(
		["plus", "pro", "prior-paid"].map(async (label) => {
			const userId = randomUUID();
			const c = await stripe.customers.create({
				name: "ANIHUNT40 proof " + label,
				test_clock: clock.id,
				metadata: { ...metadata, userId },
			});
			assert.equal(c.livemode, false);
			return {
				customer: c,
				userId,
				binding: randomUUID(),
				createdAt: new Date().toISOString(),
			};
		}),
	);
	report.customers = customers.map((c) => ({
		id: c.customer.id,
		userId: c.userId,
	}));
	save();
	// The first account actually finishes a free 3-day trial, with no card or charge.
	const trialEnd = clock.frozen_time + 3 * 86400;
	const trial = await stripe.subscriptions.create({
		customer: customers[0].customer.id,
		items: [{ price: plus }],
		trial_end: trialEnd,
		cancel_at: trialEnd,
		metadata,
		trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
	});
	report.trial = trial.id;
	save();
	await advance(trialEnd + 60);
	const ended = await stripe.subscriptions.retrieve(trial.id);
	assert.equal(ended.status, "canceled");
	const zero = await stripe.invoices.list({
		customer: customers[0].customer.id,
	});
	assert.ok(zero.data.every((i) => i.total === 0));
	for (const c of customers) {
		const pm = await stripe.paymentMethods.attach("pm_card_visa", {
			customer: c.customer.id,
		});
		await stripe.customers.update(c.customer.id, {
			invoice_settings: { default_payment_method: pm.id },
		});
	}
	const prior = await stripe.subscriptions.create({
		customer: customers[2].customer.id,
		items: [{ price: plus }],
		metadata,
	});
	assert.equal(prior.status, "active");
	report.priorPaid = prior.id;
	save();
	async function provision(c: (typeof customers)[number]) {
		return ensureProductHuntPromotion(
			{ userId: c.userId, customerId: c.customer.id },
			{
				stripe,
				couponId,
				livemode: false,
				monthlyPriceIds: [plus, pro],
				accountHistory: async () => ({
					customerIds: [c.customer.id],
					hasPaid: false,
				}),
				claim: async () => ({
					id: c.binding,
					user_id: c.userId,
					stripe_customer_id: c.customer.id,
					coupon_id: couponId,
					created_at: c.createdAt,
				}),
			},
		);
	}
	assert.equal(await provision(customers[2]), false);
	const subs: Stripe.Subscription[] = [];
	for (const [index, c] of customers.slice(0, 2).entries()) {
		assert.equal(await provision(c), true);
		assert.equal(await provision(c), true);
		const codes = await stripe.promotionCodes.list({
			customer: c.customer.id,
			code: "ANIHUNT40",
		});
		assert.equal(codes.data.length, 1);
		assert.equal(codes.data[0].max_redemptions, 1);
		const sub = await stripe.subscriptions.create({
			customer: c.customer.id,
			items: [{ price: index === 0 ? plus : pro }],
			discounts: [{ promotion_code: codes.data[0].id }],
			metadata: { ...metadata, userId: c.userId },
			expand: ["discounts"],
		});
		assert.equal(sub.status, "active");
		assert.equal(sub.livemode, false);
		subs.push(sub);
		report.subscriptions = subs.map((s) => s.id);
		save();
		const invoice = await stripe.invoices.retrieve(
			sub.latest_invoice as string,
		);
		assert.equal(invoice.amount_paid, index === 0 ? 479 : 899);
		assert.equal(await provision(c), false);
	}
	console.log(
		JSON.stringify({
			stage: "created",
			clock: clock.id,
			coupon: coupon.id,
			subscriptions: subs.map((s) => s.id),
			firstPaid: [479, 899],
			expiredTrialAllowed: true,
			priorPaidBlocked: true,
		}),
	);
	for (let cycle = 2; cycle <= 4; cycle++) {
		const fresh = await stripe.subscriptions.retrieve(subs[0].id);
		await advance(fresh.items.data[0].current_period_end + 7200);
		const amounts = [];
		for (const [index, sub] of subs.entries()) {
			const updated = await stripe.subscriptions.retrieve(sub.id, {
				expand: ["discounts", "items.data.discounts"],
			});
			const invoice = await stripe.invoices.retrieve(
				updated.latest_invoice as string,
			);
			assert.equal(invoice.status, "paid");
			assert.equal(
				invoice.amount_paid,
				cycle <= 3 ? (index === 0 ? 479 : 899) : index === 0 ? 799 : 1499,
			);
			amounts.push(invoice.amount_paid);
		}
		(report.cycles as unknown[]).push({ cycle, amounts });
		save();
		console.log(JSON.stringify({ cycle, amounts }));
	}
	report.result = "PASS";
	save();
	console.log(
		"PASS: first three monthly invoices discounted, fourth full price; expired trial allowed, previous paid blocked, no duplicate code.",
	);
}
void main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Sandbox proof failed",
	);
	process.exitCode = 1;
});
