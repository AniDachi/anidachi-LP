import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import type Stripe from "stripe";
import {
	createStripeClient,
	STRIPE_API_VERSION,
} from "../lib/anidachi-auth/stripe-env";
import {
	assertNoUnconsentedBilling,
	assertOwnedTestObject,
	assertProofTarget,
	assertTestObject,
	type CardlessStripeProof,
	parseProofOptions,
	type ScenarioResult,
	summarizeProof,
	TRIAL_SECONDS,
} from "./stripe/cardless-trial-proof";
import { createTestCliStripeClient } from "./stripe/stripe-test-cli-transport";

// Deliberately no dotenv loading, production fallback, supplied customer IDs,
// customer enumeration, or deletion. Only this run's synthetic objects are used.
function safeFailure(error: unknown): string {
	if (error instanceof assert.AssertionError) return "proof_assertion_failed";
	const code =
		typeof error === "object" && error !== null && "code" in error
			? error.code
			: undefined;
	return typeof code === "string" && /^[a-z_]{1,80}$/.test(code)
		? code
		: "proof_request_failed";
}

const objectId = (value: string | { id: string } | null): string | null =>
	typeof value === "string" ? value : (value?.id ?? null);

export async function verifyCardlessTrialSandbox(
	args: string[],
): Promise<CardlessStripeProof> {
	const { accountId, cliProfile } = parseProofOptions(
		args,
		process.env.VERCEL_ENV,
	);
	const stripe = cliProfile
		? createTestCliStripeClient(cliProfile)
		: createStripeClient("test");
	// These read-only checks precede every write, regardless of credential source.
	const account = await stripe.accounts.retrieve();
	const balance = await stripe.balance.retrieve();
	assertProofTarget(
		accountId,
		account.id,
		balance.livemode,
		balance.lastResponse.apiVersion,
	);

	const runId = randomUUID();
	const metadata = { anidachiProof: "cardless_trial", proofRun: runId };
	const results: ScenarioResult[] = [];
	const report = (): CardlessStripeProof => ({
		accountId,
		livemode: false,
		apiVersion: STRIPE_API_VERSION,
		runId,
		createdAt: new Date().toISOString(),
		...summarizeProof(results),
	});
	const key = (operation: string) => ({
		idempotencyKey: `cardless-proof:${runId}:${operation}`,
	});
	const product = await stripe.products.create(
		{ name: `AniDachi cardless proof ${runId}`, metadata },
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

	for (const savedCard of [false, true]) {
		const name = savedCard
			? "no_renewal_without_consent_with_saved_card"
			: "no_renewal_without_consent_without_card";
		const result: ScenarioResult = { name, status: "pending" };
		results.push(result);
		try {
			const clockName = `cardless-proof:${runId}:${savedCard ? "saved" : "none"}`;
			const clock = await stripe.testHelpers.testClocks.create(
				{ frozen_time: Math.floor(Date.now() / 1000), name: clockName },
				key(`${name}:clock`),
			);
			assertTestObject(clock);
			result.clockId = clock.id;
			const customer = await stripe.customers.create(
				{
					name: `Synthetic cardless proof ${savedCard ? "saved card" : "no card"}`,
					test_clock: clock.id,
					metadata,
				},
				key(`${name}:customer`),
			);
			assertOwnedTestObject(customer, runId);
			result.customerId = customer.id;

			if (savedCard) {
				const method = await stripe.paymentMethods.create(
					{ type: "card", card: { token: "tok_visa" }, metadata },
					key(`${name}:payment-method`),
				);
				assertOwnedTestObject(method, runId);
				const attached = await stripe.paymentMethods.attach(
					method.id,
					{ customer: customer.id },
					key(`${name}:attach`),
				);
				assertOwnedTestObject(attached, runId);
				assert.equal(objectId(attached.customer), customer.id);
				const updated = await stripe.customers.update(
					customer.id,
					{ invoice_settings: { default_payment_method: method.id } },
					key(`${name}:saved-card`),
				);
				assertOwnedTestObject(updated, runId);
			}

			const subscription = await stripe.subscriptions.create(
				{
					customer: customer.id,
					items: [{ price: price.id }],
					collection_method: "charge_automatically",
					trial_period_days: 3,
					cancel_at_period_end: true,
					trial_settings: {
						end_behavior: { missing_payment_method: "cancel" },
					},
					metadata,
				},
				key(`${name}:subscription`),
			);
			assertOwnedTestObject(subscription, runId);
			assert.equal(objectId(subscription.customer), customer.id);
			assert.equal(subscription.status, "trialing");
			assert.equal(subscription.cancel_at_period_end, true);
			assert.ok(
				subscription.trial_start !== null && subscription.trial_end !== null,
			);
			assert.equal(
				subscription.trial_end - subscription.trial_start,
				TRIAL_SECONDS,
			);
			result.subscriptionId = subscription.id;
			result.trialStart = subscription.trial_start;
			result.trialEnd = subscription.trial_end;

			const advance = async (to: number) => {
				const current = await stripe.testHelpers.testClocks.retrieve(clock.id);
				assertTestObject(current);
				assert.equal(current.name, clockName);
				const advancing = await stripe.testHelpers.testClocks.advance(
					clock.id,
					{ frozen_time: to },
					key(`${name}:advance:${to}`),
				);
				assertTestObject(advancing);
				const deadline = Date.now() + 45_000;
				while (Date.now() < deadline) {
					const latest: Stripe.Response<Stripe.TestHelpers.TestClock> =
						await stripe.testHelpers.testClocks.retrieve(clock.id);
					assertTestObject(latest);
					assert.equal(latest.name, clockName);
					assert.notEqual(latest.status, "internal_failure");
					if (latest.status === "ready") {
						assert.equal(latest.frozen_time, to);
						return;
					}
					await delay(1000);
				}
				throw new Error("Proof clock timeout");
			};

			await advance(subscription.trial_end);
			const atExpiry = await stripe.subscriptions.retrieve(subscription.id);
			assertOwnedTestObject(atExpiry, runId);
			assert.equal(atExpiry.status, "canceled");
			// Observe beyond Stripe's normal invoice finalization window as well.
			await advance(subscription.trial_end + 4 * 3600);
			const final = await stripe.subscriptions.retrieve(subscription.id);
			assertOwnedTestObject(final, runId);
			const invoices = await stripe.invoices
				.list({
					customer: customer.id,
					subscription: subscription.id,
					limit: 100,
				})
				.autoPagingToArray({ limit: 100 });
			const intents = await stripe.paymentIntents
				.list({ customer: customer.id, limit: 100 })
				.autoPagingToArray({ limit: 100 });
			const charges = await stripe.charges
				.list({ customer: customer.id, limit: 100 })
				.autoPagingToArray({ limit: 100 });
			for (const object of [...invoices, ...intents, ...charges]) {
				assertTestObject(object);
				assert.equal(objectId(object.customer), customer.id);
			}
			assertNoUnconsentedBilling(final, invoices, intents, charges);
			result.status = "passed";
			result.checkedAt = new Date().toISOString();
		} catch (error) {
			result.status = "failed";
			result.error = safeFailure(error);
			result.checkedAt = new Date().toISOString();
			break;
		}
	}
	// Portal/Checkout, consent fencing, SCA and boundary evidence are separate
	// mandatory checks. A successful API smoke alone can never pass Task 0.
	return report();
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	verifyCardlessTrialSandbox(process.argv.slice(2))
		.then((proof) => {
			process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
			process.exitCode = proof.passed
				? 0
				: proof.scenarios.some((result) => result.status === "failed")
					? 1
					: 2;
		})
		.catch((error: unknown) => {
			// Never print raw Stripe errors, customer payloads, client secrets or keys.
			process.stderr.write(
				`${safeFailure(error)}; proof not passed. Use --test --account acct_... with an authenticated test environment.\n`,
			);
			process.exitCode = 1;
		});
}
