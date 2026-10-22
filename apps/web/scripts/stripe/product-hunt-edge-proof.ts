// Sandbox-only proof of invoice recovery, customer isolation and hosted UI.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createTestCliStripeClient } from "./stripe-test-cli-transport";
import { ensureProductHuntPromotion } from "../../lib/anidachi-auth/product-hunt-promo";

async function main() {
	const stripe = createTestCliStripeClient("anidachi-cardless-proof");
	assert.equal((await stripe.accounts.retrieve()).id, "acct_1RlmiIPQIEOqG7pr");
	const run = randomUUID();
	const metadata = { anidachiProof: "product_hunt_edge_2026", proofRun: run };
	const customers = await Promise.all(
		["retry", "checkout", "foreign"].map(async (name) => {
			const userId = randomUUID();
			const customer = await stripe.customers.create({
				name: "ANIHUNT40 proof " + name,
				metadata: { ...metadata, userId },
			});
			assert.equal(customer.livemode, false);
			return { customer, userId, binding: randomUUID() };
		}),
	);
	const report: Record<string, unknown> = {
		run,
		customers: customers.map((c) => c.customer.id),
	};
	const save = () =>
		writeFileSync(
			"/tmp/anihunt-edge-proof.json",
			JSON.stringify(report, null, 2),
		);
	save();
	for (const c of customers.slice(0, 2)) {
		assert.equal(
			await ensureProductHuntPromotion(
				{ userId: c.userId, customerId: c.customer.id },
				{
					stripe,
					couponId: "anihunt40_monthly_2026_test",
					livemode: false,
					monthlyPriceIds: [
						"price_1TkktLPQIEOqG7prWLOncTeX",
						"price_1Tkku6PQIEOqG7prqtCEYYEq",
					],
					accountHistory: async () => ({
						customerIds: [c.customer.id],
						hasPaid: false,
					}),
					claim: async () => ({
						id: c.binding,
						user_id: c.userId,
						stripe_customer_id: c.customer.id,
						coupon_id: "anihunt40_monthly_2026_test",
						created_at: new Date().toISOString(),
					}),
				},
			),
			true,
		);
	}
	const code = (
		await stripe.promotionCodes.list({
			customer: customers[0].customer.id,
			code: "ANIHUNT40",
		})
	).data[0];
	await assert.rejects(
		() =>
			stripe.subscriptions.create({
				customer: customers[2].customer.id,
				items: [{ price: "price_1TkktLPQIEOqG7prWLOncTeX" }],
				discounts: [{ promotion_code: code.id }],
				metadata,
			}),
		/customer/i,
	);
	report.crossCustomerRejected = true;
	const decline = await stripe.paymentMethods.attach(
		"pm_card_chargeCustomerFail",
		{ customer: customers[0].customer.id },
	);
	await stripe.customers.update(customers[0].customer.id, {
		invoice_settings: { default_payment_method: decline.id },
	});
	const sub = await stripe.subscriptions.create({
		customer: customers[0].customer.id,
		items: [{ price: "price_1TkktLPQIEOqG7prWLOncTeX" }],
		discounts: [{ promotion_code: code.id }],
		metadata,
		payment_behavior: "allow_incomplete",
		expand: ["discounts"],
	});
	report.subscription = sub.id;
	save();
	assert.equal(sub.status, "incomplete");
	const invoice = await stripe.invoices.retrieve(sub.latest_invoice as string);
	assert.ok(invoice.id);
	report.invoice = invoice.id;
	save();
	assert.equal(invoice.status, "open");
	assert.equal(invoice.total, 479);
	assert.equal(invoice.amount_paid, 0);
	const visa = await stripe.paymentMethods.attach("pm_card_visa", {
		customer: customers[0].customer.id,
	});
	await stripe.customers.update(customers[0].customer.id, {
		invoice_settings: { default_payment_method: visa.id },
	});
	const paid = await stripe.invoices.pay(invoice.id, {
		payment_method: visa.id,
	});
	assert.equal(paid.id, invoice.id);
	assert.equal(paid.status, "paid");
	assert.equal(paid.amount_paid, 479);
	const fresh = await stripe.subscriptions.retrieve(sub.id, {
		expand: ["discounts"],
	});
	assert.equal(fresh.status, "active");
	assert.equal(JSON.stringify(fresh.discounts), JSON.stringify(sub.discounts));
	assert.equal(
		(await stripe.promotionCodes.retrieve(code.id)).times_redeemed,
		1,
	);
	report.retrySameInvoicePaid = 479;
	report.discountPreserved = true;
	save();
	const sessions = [];
	for (const [period, price] of [
		["monthly", "price_1TkktLPQIEOqG7prWLOncTeX"],
		["yearly", "price_1ULJ4FPQIEOqG7prxAO9Ju9I"],
	]) {
		const session = await stripe.checkout.sessions.create({
			mode: "subscription",
			customer: customers[1].customer.id,
			line_items: [{ price, quantity: 1 }],
			allow_promotion_codes: period === "monthly",
			success_url: "https://staging.anidachi.app/account/billing",
			cancel_url: "https://staging.anidachi.app/pricing",
			metadata,
		});
		assert.equal(session.livemode, false);
		assert.equal(session.allow_promotion_codes, period === "monthly");
		sessions.push({ id: session.id, period, url: session.url });
	}
	report.sessions = sessions;
	save();
	await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
	console.log(
		JSON.stringify({
			crossCustomerRejected: true,
			retrySameInvoicePaid: 479,
			discountPreserved: true,
			sessions: sessions.map((s) => ({ id: s.id, period: s.period })),
		}),
	);
}
main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Sandbox proof failed",
	);
	process.exitCode = 1;
});
