// Staging webhook proof. The operator maps this synthetic customer in staging
// before `subscribe`, then reserves its exact renewal via the private SQL RPC
// before `advance`. No real user session or credential is fabricated.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createTestCliStripeClient } from "./stripe-test-cli-transport";

type Receipt = {
	run: string;
	userId: string;
	clockId: string;
	customerId: string;
	phase: "prepared" | "subscribed" | "advanced" | "passed";
	subscriptionId?: string;
	targetPeriod?: number;
	invoiceId?: string;
	claimId?: string;
};
function required<T>(value: T | undefined): T {
	assert.ok(
		value !== undefined,
		"Fixture is incomplete; reconcile before retry",
	);
	return value;
}
async function main() {
	const [mode, file] = process.argv.slice(2);
	assert.ok(["prepare", "subscribe", "advance", "verify"].includes(mode));
	assert.ok(file?.startsWith("/") && file.endsWith(".json"));
	const stripe = createTestCliStripeClient("anidachi-cardless-proof");
	assert.equal((await stripe.accounts.retrieve()).id, "acct_1RlmiIPQIEOqG7pr");
	let receipt: Receipt;
	const save = () =>
		writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`);
	if (mode === "prepare") {
		assert.ok(!existsSync(file), "Never overwrite an existing fixture");
		const run = randomUUID();
		const clock = await stripe.testHelpers.testClocks.create({
			frozen_time: Math.floor(Date.now() / 1000),
			name: `Uninstall hosted ${run.slice(0, 8)}`,
		});
		assert.equal(clock.livemode, false);
		const userId = randomUUID();
		const customer = await stripe.customers.create({
			name: "AniDachi uninstall hosted proof",
			test_clock: clock.id,
			metadata: {
				userId,
				proofRun: run,
				anidachiProof: "uninstall_hosted_2026",
			},
		});
		assert.equal(customer.livemode, false);
		receipt = {
			run,
			userId,
			clockId: clock.id,
			customerId: customer.id,
			phase: "prepared",
		};
		save();
		const method = await stripe.paymentMethods.attach("pm_card_visa", {
			customer: customer.id,
		});
		await stripe.customers.update(customer.id, {
			invoice_settings: { default_payment_method: method.id },
		});
		console.log(JSON.stringify(receipt));
		return;
	}
	receipt = JSON.parse(readFileSync(file, "utf8"));
	const customer = await stripe.customers.retrieve(receipt.customerId);
	assert.ok(!customer.deleted && !customer.livemode);
	assert.equal(customer.metadata.proofRun, receipt.run);
	assert.equal(customer.metadata.userId, receipt.userId);
	assert.equal(customer.metadata.anidachiProof, "uninstall_hosted_2026");
	assert.equal(customer.test_clock, receipt.clockId);
	assert.ok(customer.invoice_settings.default_payment_method);
	if (mode === "subscribe") {
		assert.equal(receipt.phase, "prepared");
		const sub = await stripe.subscriptions.create(
			{
				customer: receipt.customerId,
				items: [{ price: "price_1TkktLPQIEOqG7prWLOncTeX" }],
				metadata: {
					userId: receipt.userId,
					proofRun: receipt.run,
					anidachiProof: "uninstall_hosted_2026",
				},
			},
			{ idempotencyKey: `uninstall-hosted-sub:${receipt.run}` },
		);
		assert.equal(sub.status, "active");
		assert.equal(sub.livemode, false);
		receipt.subscriptionId = sub.id;
		receipt.targetPeriod = sub.items.data[0].current_period_end;
		receipt.phase = "subscribed";
		save();
		console.log(JSON.stringify(receipt));
		return;
	}
	const subId = required(receipt.subscriptionId);
	const sub = await stripe.subscriptions.retrieve(subId);
	assert.equal(sub.customer, receipt.customerId);
	assert.equal(sub.metadata.proofRun, receipt.run);
	assert.equal(sub.livemode, false);
	if (mode === "advance") {
		assert.equal(receipt.phase, "subscribed");
		await stripe.testHelpers.testClocks.advance(
			receipt.clockId,
			{
				frozen_time: required(receipt.targetPeriod) + 60,
			},
			{ idempotencyKey: `uninstall-hosted-advance:${receipt.run}` },
		);
		receipt.phase = "advanced";
		save();
		console.log("Clock advancing; verify once Stripe reports ready.");
		return;
	}
	assert.equal(receipt.phase, "advanced");
	const clock = await stripe.testHelpers.testClocks.retrieve(receipt.clockId);
	assert.equal(clock.status, "ready", "Clock is still advancing");
	const invoice = await stripe.invoices.retrieve(sub.latest_invoice as string, {
		expand: ["discounts"],
	});
	assert.equal(invoice.billing_reason, "subscription_cycle");
	assert.equal(invoice.customer, receipt.customerId);
	assert.equal(invoice.lines.data[0].period.start, receipt.targetPeriod);
	assert.equal(
		invoice.total,
		479,
		"Hosted signed webhook has not confirmed the discount yet",
	);
	assert.equal(invoice.discounts.length, 1);
	const discount = invoice.discounts[0];
	assert.ok(typeof discount !== "string" && !("deleted" in discount));
	assert.equal(discount.coupon.id, "anidachi_uninstall_renewal40_2026_test");
	assert.equal(discount.invoice, invoice.id);
	assert.ok(!discount.subscription);
	assert.ok(invoice.metadata?.uninstallRetentionClaimId);
	assert.equal(sub.discounts.length, 0);
	receipt.invoiceId = required(invoice.id);
	receipt.claimId = invoice.metadata.uninstallRetentionClaimId;
	// This is our synthetic fixture; stop future automatic test renewals.
	await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
	receipt.phase = "passed";
	save();
	console.log(
		JSON.stringify({
			phase: receipt.phase,
			invoiceId: receipt.invoiceId,
			claimId: receipt.claimId,
			total: invoice.total,
		}),
	);
}
void main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Hosted Sandbox proof failed",
	);
	process.exitCode = 1;
});
