import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { STRIPE_API_VERSION } from "../lib/anidachi-auth/stripe-env";
import {
	assertOwnedTestObject,
	assertProofTarget,
	assertTestObject,
	parseProofOptions,
} from "./stripe/cardless-trial-proof";
import { createTestCliStripeClient } from "./stripe/stripe-test-cli-transport";

// Task-0 browser fixture. The receipt is ignored and contains synthetic objects
// only; the ephemeral Portal URL must not be committed with acceptance evidence.
type Receipt = {
	accountId: string;
	runId: string;
	customerId: string;
	clockId: string;
	clockName: string;
	priceId: string;
	configurationId: string;
	portalId: string;
	portalCreated: number;
	portalUrl: string;
	subscriptionId?: string;
	trialEnd?: number;
	scheduleId?: string;
};

async function main() {
	const [rawPhase, ...args] = process.argv.slice(2);
	const useSchedule = rawPhase?.endsWith("-schedule");
	const phase = useSchedule ? rawPhase.slice(0, -"-schedule".length) : rawPhase;
	assert.ok(["prepare", "create-trial", "inspect", "advance"].includes(phase));
	const receiptPath = fileURLToPath(
		new URL(
			`../../../.superpowers/sdd/2026-10-11-cardless-trial/${useSchedule ? "schedule-" : ""}portal-fixture.json`,
			import.meta.url,
		),
	);
	const { accountId, cliProfile } = parseProofOptions(
		args,
		process.env.VERCEL_ENV,
	);
	assert.ok(cliProfile);
	const stripe = createTestCliStripeClient(cliProfile);
	const account = await stripe.accounts.retrieve();
	const balance = await stripe.balance.retrieve();
	assertProofTarget(
		accountId,
		account.id,
		balance.livemode,
		balance.lastResponse.apiVersion,
	);
	if (phase === "prepare") {
		// Preserve any previous fixture rather than overwriting its evidence.
		const existing = await readFile(receiptPath, "utf8").catch(() => null);
		assert.equal(existing, null, "Portal fixture already prepared");
		const config = (
			await stripe.billingPortal.configurations.list({
				is_default: true,
				active: true,
				limit: 1,
			})
		).data[0];
		assertTestObject(config);
		assert.equal(config.features.subscription_cancel.enabled, true);
		assert.equal(config.features.subscription_cancel.mode, "at_period_end");
		assert.equal(config.features.subscription_update.enabled, false);
		const runId = randomUUID();
		const metadata = { anidachiProof: "cardless_trial", proofRun: runId };
		const key = (operation: string) => ({
			idempotencyKey: `cardless-portal-proof:${runId}:${operation}`,
		});
		const clockName = `cardless-portal-proof:${runId}`;
		const clock = await stripe.testHelpers.testClocks.create(
			{ name: clockName, frozen_time: Math.floor(Date.now() / 1000) },
			key("clock"),
		);
		assertTestObject(clock);
		const customer = await stripe.customers.create(
			{
				name: "Synthetic cardless proof: already-open Portal",
				test_clock: clock.id,
				metadata,
			},
			key("customer"),
		);
		assertOwnedTestObject(customer, runId);
		const method = await stripe.paymentMethods.create(
			{ type: "card", card: { token: "tok_visa" }, metadata },
			key("method"),
		);
		assertOwnedTestObject(method, runId);
		const attached = await stripe.paymentMethods.attach(
			method.id,
			{ customer: customer.id },
			key("attach"),
		);
		assertOwnedTestObject(attached, runId);
		assert.equal(attached.customer, customer.id);
		assertOwnedTestObject(
			await stripe.customers.update(
				customer.id,
				{ invoice_settings: { default_payment_method: method.id } },
				key("saved-card"),
			),
			runId,
		);
		const product = await stripe.products.create(
			{ name: "AniDachi cardless Portal proof (synthetic)", metadata },
			key("product"),
		);
		assertOwnedTestObject(product, runId);
		const price = await stripe.prices.create(
			{
				product: product.id,
				currency: "usd",
				unit_amount: 799,
				recurring: { interval: "month" },
				metadata,
			},
			key("price"),
		);
		assertOwnedTestObject(price, runId);
		const portal = await stripe.billingPortal.sessions.create(
			{
				customer: customer.id,
				configuration: config.id,
				return_url: "https://staging.anidachi.app/account/billing",
			},
			key("portal"),
		);
		assertTestObject(portal);
		assert.equal(portal.customer, customer.id);
		const receipt: Receipt = {
			accountId,
			runId,
			customerId: customer.id,
			clockId: clock.id,
			clockName,
			priceId: price.id,
			configurationId: config.id,
			portalId: portal.id,
			portalCreated: portal.created,
			portalUrl: portal.url,
		};
		await mkdir(dirname(receiptPath), { recursive: true });
		await writeFile(receiptPath, JSON.stringify(receipt, null, 2), {
			mode: 0o600,
		});
		console.log(
			JSON.stringify({
				phase,
				accountId,
				livemode: false,
				apiVersion: STRIPE_API_VERSION,
				runId,
				portalUrl: portal.url,
			}),
		);
		return;
	}
	const receipt: Receipt = JSON.parse(await readFile(receiptPath, "utf8"));
	assert.equal(receipt.accountId, accountId);
	const customer = await stripe.customers.retrieve(receipt.customerId);
	assertOwnedTestObject(customer, receipt.runId);
	assert.ok(!customer.deleted);
	assert.equal(customer.test_clock, receipt.clockId);
	assertOwnedTestObject(
		await stripe.prices.retrieve(receipt.priceId),
		receipt.runId,
	);
	const clock = await stripe.testHelpers.testClocks.retrieve(receipt.clockId);
	assertTestObject(clock);
	assert.equal(clock.name, receipt.clockName);
	if (phase === "create-trial") {
		assert.equal(receipt.subscriptionId, undefined);
		const metadata = {
			anidachiProof: "cardless_trial",
			proofRun: receipt.runId,
		};
		let subscription;
		if (useSchedule) {
			const end = clock.frozen_time + 259200;
			const schedule = await stripe.subscriptionSchedules.create(
				{
					customer: receipt.customerId,
					start_date: "now",
					end_behavior: "cancel",
					phases: [
						{
							items: [{ price: receipt.priceId }],
							end_date: end,
							trial_end: end,
							proration_behavior: "none",
							metadata,
						},
					],
					metadata,
				},
				{ idempotencyKey: `cardless-portal-proof:${receipt.runId}:schedule` },
			);
			assertOwnedTestObject(schedule, receipt.runId);
			assert.equal(schedule.end_behavior, "cancel");
			assert.equal(schedule.status, "active");
			assert.ok(typeof schedule.subscription === "string");
			receipt.scheduleId = schedule.id;
			subscription = await stripe.subscriptions.retrieve(schedule.subscription);
			assert.equal(subscription.schedule, schedule.id);
			assert.equal(subscription.cancel_at, end);
		} else {
			subscription = await stripe.subscriptions.create(
				{
					customer: receipt.customerId,
					items: [{ price: receipt.priceId }],
					trial_period_days: 3,
					cancel_at_period_end: true,
					collection_method: "charge_automatically",
					trial_settings: {
						end_behavior: { missing_payment_method: "cancel" },
					},
					metadata,
				},
				{
					idempotencyKey: `cardless-portal-proof:${receipt.runId}:subscription`,
				},
			);
			assert.equal(subscription.cancel_at_period_end, true);
		}
		assertOwnedTestObject(subscription, receipt.runId);
		assert.equal(subscription.status, "trialing");
		assert.ok(subscription.trial_end && subscription.trial_start !== null);
		assert.equal(subscription.trial_end - subscription.trial_start, 259200);
		receipt.subscriptionId = subscription.id;
		receipt.trialEnd = subscription.trial_end;
		await writeFile(receiptPath, JSON.stringify(receipt, null, 2), {
			mode: 0o600,
		});
	}
	assert.ok(receipt.subscriptionId && receipt.trialEnd);
	if (phase === "advance") {
		const to = receipt.trialEnd + 4 * 3600;
		assertTestObject(
			await stripe.testHelpers.testClocks.advance(
				receipt.clockId,
				{ frozen_time: to },
				{ idempotencyKey: `cardless-portal-proof:${receipt.runId}:advance` },
			),
		);
		const deadline = Date.now() + 45_000;
		let ready = false;
		while (Date.now() < deadline) {
			const current = await stripe.testHelpers.testClocks.retrieve(
				receipt.clockId,
			);
			assertTestObject(current);
			assert.equal(current.name, receipt.clockName);
			assert.notEqual(current.status, "internal_failure");
			if (current.status === "ready") {
				assert.equal(current.frozen_time, to);
				ready = true;
				break;
			}
			await delay(1000);
		}
		assert.ok(ready, "Clock advance timed out");
	}
	const subscription = await stripe.subscriptions.retrieve(
		receipt.subscriptionId,
	);
	assertOwnedTestObject(subscription, receipt.runId);
	const invoices = await stripe.invoices.list({
		customer: receipt.customerId,
		subscription: subscription.id,
		limit: 100,
	});
	const intents = await stripe.paymentIntents.list({
		customer: receipt.customerId,
		limit: 100,
	});
	const charges = await stripe.charges.list({
		customer: receipt.customerId,
		limit: 100,
	});
	for (const collection of [invoices, intents, charges]) {
		assert.equal(collection.has_more, false);
		for (const item of collection.data) {
			assertTestObject(item);
			assert.equal(item.customer, receipt.customerId);
		}
	}
	console.log(
		JSON.stringify(
			{
				phase: rawPhase,
				accountId,
				runId: receipt.runId,
				livemode: false,
				apiVersion: STRIPE_API_VERSION,
				customerId: receipt.customerId,
				subscriptionId: subscription.id,
				scheduleId: receipt.scheduleId,
				clockId: receipt.clockId,
				configurationId: receipt.configurationId,
				status: subscription.status,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
				cancelAt: subscription.cancel_at,
				trialStart: subscription.trial_start,
				trialEnd: subscription.trial_end,
				invoices: invoices.data.map((i) => ({
					id: i.id,
					reason: i.billing_reason,
					status: i.status,
					due: i.amount_due,
					paid: i.amount_paid,
					remaining: i.amount_remaining,
					attempts: i.attempt_count,
				})),
				paymentIntents: intents.data.map((i) => ({
					id: i.id,
					status: i.status,
					amount: i.amount,
				})),
				charges: charges.data.map((c) => ({
					id: c.id,
					status: c.status,
					paid: c.paid,
					amount: c.amount,
				})),
			},
			null,
			2,
		),
	);
}
main().catch(() => {
	console.error("Portal proof did not complete; raw errors omitted.");
	process.exitCode = 1;
});
