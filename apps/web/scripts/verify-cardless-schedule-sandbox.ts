import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type Stripe from "stripe";
import { STRIPE_API_VERSION } from "../lib/anidachi-auth/stripe-env";
import {
	assertNoUnconsentedBilling,
	assertOwnedTestObject,
	assertProofTarget,
	assertTestObject,
	parseProofOptions,
	TRIAL_SECONDS,
} from "./stripe/cardless-trial-proof";
import { createTestCliStripeClient } from "./stripe/stripe-test-cli-transport";

// Real Stripe characterization tests only. No product endpoints, shared settings,
// real customer lookup, dotenv loading, cleanup/deletion or live-mode fallback.
const CASES = [
	"expiry-no-card",
	"expiry-saved-card",
	"expiry-relative-duration",
	"opt-in-monthly",
	"opt-in-pro-annual",
	"cancel-after-opt-in",
	"late-setup-no-card",
	"late-setup-saved-card",
	"boundary-no-card",
	"boundary-saved-card",
	"boundary-exact-no-card",
	"boundary-exact-saved-card",
	"decline-after-opt-in",
	"checkout",
	"checkout-3ds",
] as const;
type CaseName = (typeof CASES)[number];
type Receipt = {
	caseName: CaseName;
	runId: string;
	accountId: string;
	startedAt: string;
	apiVersion: string;
	livemode: false;
	phase: string;
	passed: boolean;
	customerId?: string;
	clockId?: string;
	clockName?: string;
	priceId?: string;
	chosenPriceId?: string;
	amount?: number;
	subscriptionId?: string;
	scheduleId?: string;
	trialStart?: number;
	trialEnd?: number;
	methodId?: string;
	setupId?: string;
	checkoutId?: string;
	checkoutUrl?: string;
	hostedInvoiceUrl?: string;
	snapshots: Record<string, unknown>[];
	error?: { kind: string; code?: string; param?: string; message?: string };
};
const objectId = (value: string | { id: string } | null) =>
	typeof value === "string" ? value : (value?.id ?? null);
const base = fileURLToPath(
	new URL(
		"../../../.superpowers/sdd/2026-10-11-cardless-trial/",
		import.meta.url,
	),
);

async function main() {
	const [phase, caseNameArg, ...args] = process.argv.slice(2);
	assert.ok(
		["run", "prepare", "complete", "advance", "inspect", "verify"].includes(
			phase,
		),
	);
	assert.ok((CASES as readonly string[]).includes(caseNameArg));
	const caseName = caseNameArg as CaseName;
	const browserCase = caseName.startsWith("checkout");
	assert.ok(browserCase ? phase !== "run" : ["run", "verify"].includes(phase));
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
	const receiptPath = `${base}schedule-${caseName}.json`;
	const existing = await readFile(receiptPath, "utf8").catch(() => null);
	if (phase === "run" || phase === "prepare")
		assert.equal(existing, null, "Existing proof must be preserved");
	else assert.ok(existing, "Prepare the browser fixture first");
	const receipt: Receipt = existing
		? JSON.parse(existing)
		: {
				caseName,
				runId: randomUUID(),
				accountId,
				startedAt: new Date().toISOString(),
				apiVersion: STRIPE_API_VERSION,
				livemode: false,
				phase,
				passed: false,
				snapshots: [],
			};
	assert.equal(receipt.accountId, accountId);
	assert.equal(receipt.caseName, caseName);
	assert.equal(receipt.apiVersion, STRIPE_API_VERSION);
	assert.equal(receipt.livemode, false);
	const metadata = { anidachiProof: "cardless_trial", proofRun: receipt.runId };
	const own = (value: unknown) => assertOwnedTestObject(value, receipt.runId);
	const key = (label: string) => ({
		idempotencyKey: `cardless-schedule:${receipt.runId}:${label}`,
	});
	const save = async () => {
		await mkdir(dirname(receiptPath), { recursive: true });
		await writeFile(receiptPath, JSON.stringify(receipt, null, 2), {
			mode: 0o600,
		});
	};
	const record = async (label: string, extra: Record<string, unknown> = {}) => {
		assert.ok(
			receipt.subscriptionId && receipt.customerId && receipt.scheduleId,
		);
		const sub = await stripe.subscriptions.retrieve(receipt.subscriptionId);
		const schedule = await stripe.subscriptionSchedules.retrieve(
			receipt.scheduleId,
		);
		own(sub);
		own(schedule);
		assert.equal(objectId(sub.customer), receipt.customerId);
		assert.equal(objectId(schedule.customer), receipt.customerId);
		assert.equal(sub.trial_start, receipt.trialStart);
		assert.equal(sub.trial_end, receipt.trialEnd);
		const invoices = await stripe.invoices.list({
			customer: receipt.customerId,
			subscription: sub.id,
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
				assert.equal(objectId(item.customer), receipt.customerId);
			}
		}
		const snapshot = {
			label,
			recordedAt: new Date().toISOString(),
			status: sub.status,
			scheduleStatus: schedule.status,
			endBehavior: schedule.end_behavior,
			cancelAt: sub.cancel_at,
			cancelAtPeriodEnd: sub.cancel_at_period_end,
			trialStart: sub.trial_start,
			trialEnd: sub.trial_end,
			subscriptionPrice: sub.items.data.map((item) => item.price.id),
			invoices: invoices.data.map((i) => ({
				id: i.id,
				reason: i.billing_reason,
				created: i.created,
				status: i.status,
				due: i.amount_due,
				paid: i.amount_paid,
				remaining: i.amount_remaining,
				attempts: i.attempt_count,
				currency: i.currency,
			})),
			intents: intents.data.map((i) => ({
				id: i.id,
				status: i.status,
				amount: i.amount,
				errorCode: i.last_payment_error?.code,
				nextAction: i.next_action?.type,
			})),
			charges: charges.data.map((c) => ({
				id: c.id,
				status: c.status,
				paid: c.paid,
				amount: c.amount,
				created: c.created,
				failureCode: c.failure_code,
			})),
			...extra,
		};
		receipt.snapshots.push(snapshot);
		receipt.hostedInvoiceUrl =
			invoices.data.find((i) => i.amount_due > 0)?.hosted_invoice_url ??
			undefined;
		await save();
		console.log(JSON.stringify({ caseName, ...snapshot }));
		return {
			sub,
			schedule,
			invoices: invoices.data,
			intents: intents.data,
			charges: charges.data,
		};
	};
	const advance = async (to: number) => {
		assert.ok(receipt.clockId && receipt.clockName);
		const old = await stripe.testHelpers.testClocks.retrieve(receipt.clockId);
		assertTestObject(old);
		assert.equal(old.name, receipt.clockName);
		assert.equal(old.status, "ready");
		assert.ok(to > old.frozen_time);
		assertTestObject(
			await stripe.testHelpers.testClocks.advance(
				old.id,
				{ frozen_time: to },
				key(`advance:${to}`),
			),
		);
		const deadline = Date.now() + 55_000;
		while (Date.now() < deadline) {
			const clock: Stripe.Response<Stripe.TestHelpers.TestClock> =
				await stripe.testHelpers.testClocks.retrieve(old.id);
			assertTestObject(clock);
			assert.equal(clock.name, receipt.clockName);
			assert.notEqual(clock.status, "internal_failure");
			if (clock.status === "ready") {
				assert.equal(clock.frozen_time, to);
				return;
			}
			await delay(1000);
		}
		throw new Error("clock_timeout");
	};
	const createMethod = async (token = "tok_visa", suffix = "setup") => {
		assert.ok(["tok_visa", "tok_chargeCustomerFail"].includes(token));
		const method = await stripe.paymentMethods.create(
			{ type: "card", card: { token }, metadata },
			key(`${suffix}:method`),
		);
		own(method);
		return method;
	};
	const setup = async (confirm: boolean, token = "tok_visa") => {
		assert.ok(receipt.customerId);
		const method = await createMethod(token);
		receipt.methodId = method.id;
		const intent = await stripe.setupIntents.create(
			{
				customer: receipt.customerId,
				payment_method: method.id,
				payment_method_types: ["card"],
				usage: "off_session",
				confirm,
				metadata,
			},
			key("setup"),
		);
		own(intent);
		assert.equal(objectId(intent.customer), receipt.customerId);
		receipt.setupId = intent.id;
		await save();
		if (confirm) assert.equal(intent.status, "succeeded");
		return intent;
	};
	const optInParams = (
		method: string,
	): Stripe.SubscriptionScheduleUpdateParams => {
		assert.ok(receipt.trialStart && receipt.trialEnd && receipt.chosenPriceId);
		return {
			end_behavior: "release",
			proration_behavior: "none",
			default_settings: {
				default_payment_method: method,
				collection_method: "charge_automatically",
			},
			phases: [
				{
					start_date: receipt.trialStart,
					end_date: receipt.trialEnd,
					trial_end: receipt.trialEnd,
					items: [{ price: receipt.chosenPriceId }],
					proration_behavior: "none",
					metadata,
				},
			],
		};
	};
	const optIn = async (methodId: string) => {
		assert.ok(receipt.scheduleId && receipt.customerId);
		const method = await stripe.paymentMethods.retrieve(methodId);
		assertTestObject(method);
		assert.equal(objectId(method.customer), receipt.customerId);
		const schedule = await stripe.subscriptionSchedules.retrieve(
			receipt.scheduleId,
		);
		own(schedule);
		assert.equal(objectId(schedule.customer), receipt.customerId);
		const result = await stripe.subscriptionSchedules.update(
			schedule.id,
			optInParams(methodId),
			key("opt-in"),
		);
		own(result);
		assert.equal(result.end_behavior, "release");
		assert.equal(result.status, "active");
	};
	const noPayment = async (label: string) => {
		const state = await record(label);
		assertNoUnconsentedBilling(
			state.sub,
			state.invoices,
			state.intents,
			state.charges,
		);
	};
	const paidOnce = async () => {
		const state = await record("paid-renewal");
		assert.equal(state.sub.status, "active");
		const bills = state.invoices.filter((i) => i.amount_due > 0);
		assert.equal(bills.length, 1);
		const bill = bills[0];
		assert.equal(bill.billing_reason, "subscription_cycle");
		assert.ok(bill.created >= (receipt.trialEnd ?? Infinity));
		assert.equal(bill.amount_due, receipt.amount);
		assert.equal(bill.amount_paid, receipt.amount);
		assert.equal(bill.amount_remaining, 0);
		assert.equal(bill.status, "paid");
		assert.equal(bill.currency, "usd");
		if (caseName === "checkout-3ds") assert.ok(bill.attempt_count >= 1);
		else assert.equal(bill.attempt_count, 1);
		assert.equal(state.intents.length, 1);
		assert.equal(state.intents[0].status, "succeeded");
		const paidCharges = state.charges.filter((c) => c.paid);
		assert.equal(paidCharges.length, 1);
		assert.equal(paidCharges[0].amount, receipt.amount);
		if (caseName !== "checkout-3ds") assert.equal(state.charges.length, 1);
		// Stripe Test Clock advances invoices/subscriptions but Charge.created can
		// retain wall-clock time. Use the cycle invoice's simulated created time
		// and the zero-intent/zero-charge snapshot before expiry, never compare
		// timestamps from different clocks.
		assert.deepEqual(
			state.sub.items.data.map((item) => item.price.id),
			[receipt.chosenPriceId],
		);
	};
	try {
		if (existing) {
			assert.ok(receipt.customerId && receipt.clockId);
			const customer = await stripe.customers.retrieve(receipt.customerId);
			own(customer);
			assert.ok(!customer.deleted);
			assert.equal(customer.test_clock, receipt.clockId);
		} else {
			receipt.clockName = `cardless-schedule:${receipt.runId}`;
			const clock = await stripe.testHelpers.testClocks.create(
				{ frozen_time: Math.floor(Date.now() / 1000), name: receipt.clockName },
				key("clock"),
			);
			assertTestObject(clock);
			receipt.clockId = clock.id;
			const customer = await stripe.customers.create(
				{
					name: `Synthetic cardless proof ${caseName}`,
					test_clock: clock.id,
					metadata,
				},
				key("customer"),
			);
			own(customer);
			receipt.customerId = customer.id;
			await save();
			if (caseName.includes("saved-card")) {
				const method = await createMethod("tok_visa", "saved");
				const attached = await stripe.paymentMethods.attach(
					method.id,
					{ customer: customer.id },
					key("saved:attach"),
				);
				own(attached);
				assert.equal(objectId(attached.customer), customer.id);
				own(
					await stripe.customers.update(
						customer.id,
						{ invoice_settings: { default_payment_method: method.id } },
						key("saved:default"),
					),
				);
			}
			const product = await stripe.products.create(
				{ name: `AniDachi schedule proof ${caseName}`, metadata },
				key("product"),
			);
			own(product);
			const price = await stripe.prices.create(
				{
					product: product.id,
					currency: "usd",
					unit_amount: 799,
					recurring: { interval: "month" },
					metadata,
				},
				key("monthly-price"),
			);
			own(price);
			receipt.priceId = price.id;
			receipt.chosenPriceId = price.id;
			receipt.amount = 799;
			if (caseName === "opt-in-pro-annual") {
				const annual = await stripe.prices.create(
					{
						product: product.id,
						currency: "usd",
						unit_amount: 14390,
						recurring: { interval: "year" },
						metadata,
					},
					key("annual-price"),
				);
				own(annual);
				receipt.chosenPriceId = annual.id;
				receipt.amount = 14390;
			}
			const end = clock.frozen_time + TRIAL_SECONDS;
			const trialPhase: Stripe.SubscriptionScheduleCreateParams.Phase = {
				items: [{ price: price.id }],
				proration_behavior: "none",
				metadata,
				...(caseName === "expiry-relative-duration" ||
				browserCase ||
				caseName.startsWith("boundary-exact")
					? { duration: { interval: "day", interval_count: 3 }, trial: true }
					: { end_date: end, trial_end: end }),
			};
			const schedule = await stripe.subscriptionSchedules.create(
				{
					customer: customer.id,
					start_date: "now",
					end_behavior: "cancel",
					phases: [trialPhase],
					metadata,
				},
				key("schedule"),
			);
			own(schedule);
			assert.equal(schedule.status, "active");
			assert.equal(schedule.end_behavior, "cancel");
			assert.ok(typeof schedule.subscription === "string");
			receipt.scheduleId = schedule.id;
			receipt.subscriptionId = schedule.subscription;
			const sub = await stripe.subscriptions.retrieve(schedule.subscription);
			own(sub);
			assert.equal(objectId(sub.customer), customer.id);
			assert.equal(sub.schedule, schedule.id);
			assert.equal(sub.status, "trialing");
			assert.equal(sub.cancel_at, end);
			assert.ok(sub.trial_start !== null && sub.trial_end !== null);
			assert.equal(sub.trial_end - sub.trial_start, TRIAL_SECONDS);
			receipt.trialStart = sub.trial_start;
			receipt.trialEnd = sub.trial_end;
			await record("created");
		}
		assert.ok(
			receipt.trialStart &&
				receipt.trialEnd &&
				receipt.scheduleId &&
				receipt.customerId,
		);
		if (phase === "verify") {
			assert.ok(
				[
					"opt-in-monthly",
					"opt-in-pro-annual",
					"checkout",
					"checkout-3ds",
				].includes(caseName),
			);
			await paidOnce();
			receipt.passed = true;
			receipt.phase = "complete";
			delete receipt.error;
			await save();
			console.log(JSON.stringify({ caseName, passed: true, receiptPath }));
			return;
		}
		if (phase === "prepare") {
			const session = await stripe.checkout.sessions.create(
				{
					mode: "setup",
					customer: receipt.customerId,
					currency: "usd",
					payment_method_types: ["card"],
					setup_intent_data: { metadata },
					metadata,
					success_url: "https://staging.anidachi.app/success?cardless_proof=1",
					cancel_url: "https://staging.anidachi.app/?cardless_proof=cancel",
				},
				key("checkout"),
			);
			assertTestObject(session);
			assert.equal(objectId(session.customer), receipt.customerId);
			receipt.checkoutId = session.id;
			receipt.checkoutUrl = session.url ?? undefined;
			receipt.phase = "awaiting-browser";
			await save();
			console.log(
				JSON.stringify({
					caseName,
					phase: receipt.phase,
					checkoutUrl: receipt.checkoutUrl,
				}),
			);
			return;
		}
		if (phase === "inspect") {
			await record("inspected");
			return;
		}
		if (phase === "complete") {
			assert.ok(receipt.checkoutId);
			const session = await stripe.checkout.sessions.retrieve(
				receipt.checkoutId,
			);
			own(session);
			assert.equal(objectId(session.customer), receipt.customerId);
			assert.equal(session.mode, "setup");
			assert.equal(session.status, "complete");
			const setupId = objectId(session.setup_intent);
			assert.ok(setupId);
			const intent = await stripe.setupIntents.retrieve(setupId);
			own(intent);
			assert.equal(intent.status, "succeeded");
			assert.equal(objectId(intent.customer), receipt.customerId);
			const methodId = objectId(intent.payment_method);
			assert.ok(methodId);
			receipt.setupId = intent.id;
			receipt.methodId = methodId;
			await optIn(methodId);
			await record("checkout-opt-in");
			receipt.phase = "opted-in";
			await save();
			return;
		}
		if (phase === "advance") {
			assert.equal(receipt.phase, "opted-in");
			await advance(receipt.trialEnd);
			await advance(receipt.trialEnd + 4 * 3600);
			if (caseName === "checkout-3ds") {
				const state = await record("first-payment-requires-3ds");
				assert.equal(state.sub.status, "past_due");
				assert.equal(state.intents.length, 1);
				assert.equal(state.intents[0].status, "requires_action");
				assert.equal(state.invoices.filter((i) => i.amount_due > 0).length, 1);
				assert.equal(state.charges.filter((c) => c.paid).length, 0);
				receipt.phase = "awaiting-payment-3ds";
			} else {
				await paidOnce();
				receipt.passed = true;
				receipt.phase = "complete";
			}
			await save();
			console.log(
				JSON.stringify({
					caseName,
					phase: receipt.phase,
					passed: receipt.passed,
					hostedInvoiceUrl: receipt.hostedInvoiceUrl,
				}),
			);
			return;
		}
		if (caseName.startsWith("expiry")) {
			await advance(receipt.trialEnd);
			await advance(receipt.trialEnd + 4 * 3600);
			await noPayment("expired-without-consent");
		} else if (
			caseName.startsWith("late-setup") ||
			caseName.startsWith("boundary")
		) {
			const intent = await setup(!caseName.startsWith("late-setup"));
			await advance(receipt.trialEnd - 1);
			const before = await record("read-before-expiry");
			assert.equal(before.schedule.status, "active");
			await advance(receipt.trialEnd);
			if (!caseName.startsWith("boundary-exact"))
				await advance(receipt.trialEnd + 4 * 3600);
			if (caseName.startsWith("late-setup")) {
				const completed = await stripe.setupIntents.confirm(
					intent.id,
					{},
					key("late-setup-completion"),
				);
				own(completed);
				assert.equal(completed.status, "succeeded");
			}
			assert.ok(receipt.methodId);
			// Simulate a request delayed AFTER a fresh read. Stripe, not a local time
			// if-statement, must reject updating the expired schedule.
			let rejected = false;
			try {
				await optIn(receipt.methodId);
			} catch (error) {
				if (
					error &&
					typeof error === "object" &&
					"type" in error &&
					error.type === "StripeInvalidRequestError"
				)
					rejected = true;
				else throw error;
			}
			assert.equal(
				rejected,
				true,
				"Expired schedule update must be refused by Stripe",
			);
			await noPayment("late-opt-in-rejected");
		} else {
			const intent = await setup(
				true,
				caseName === "decline-after-opt-in"
					? "tok_chargeCustomerFail"
					: "tok_visa",
			);
			const methodId = objectId(intent.payment_method);
			assert.ok(methodId);
			await advance(receipt.trialStart + 24 * 3600);
			await optIn(methodId);
			const first = await record("opted-in");
			assert.equal(first.sub.cancel_at, null);
			assert.equal(first.sub.status, "trialing");
			assert.equal(first.intents.length, 0);
			assert.equal(first.charges.length, 0);
			if (caseName === "cancel-after-opt-in") {
				own(
					await stripe.subscriptionSchedules.update(
						receipt.scheduleId,
						{ end_behavior: "cancel" },
						key("cancel"),
					),
				);
				await record("canceled-renewal");
				// Replay a delayed duplicate completion with the SAME operation key.
				// A cached old response must never be treated as current server truth.
				await optIn(methodId);
				const current = await record("duplicate-opt-in-after-cancel");
				assert.equal(current.schedule.end_behavior, "cancel");
				assert.equal(current.sub.cancel_at, receipt.trialEnd);
			} else {
				await optIn(methodId);
				const repeated = await record("duplicate-opt-in");
				assert.equal(repeated.schedule.end_behavior, "release");
			}
			await advance(receipt.trialEnd);
			await advance(receipt.trialEnd + 4 * 3600);
			if (caseName === "cancel-after-opt-in")
				await noPayment("canceled-expiry");
			else if (caseName === "decline-after-opt-in") {
				const state = await record("declined-first-payment");
				assert.equal(state.sub.status, "past_due");
				const bills = state.invoices.filter((i) => i.amount_due > 0);
				assert.equal(bills.length, 1);
				assert.equal(bills[0].amount_due, 799);
				assert.equal(bills[0].amount_paid, 0);
				assert.equal(bills[0].status, "open");
				assert.equal(state.intents.length, 1);
				assert.equal(state.intents[0].status, "requires_payment_method");
				assert.equal(state.charges.filter((c) => c.paid).length, 0);
			} else await paidOnce();
		}
		receipt.phase = "complete";
		receipt.passed = true;
		await save();
		console.log(
			JSON.stringify({
				caseName,
				passed: true,
				runId: receipt.runId,
				receiptPath,
			}),
		);
	} catch (error) {
		receipt.passed = false;
		// Assertions contain only fixture IDs/allowlisted billing state here. Never
		// serialize raw Stripe errors, response bodies, auth headers or secrets.
		const type =
			error && typeof error === "object" && "type" in error
				? error.type
				: undefined;
		const code =
			error && typeof error === "object" && "code" in error
				? error.code
				: undefined;
		const param =
			error && typeof error === "object" && "param" in error
				? error.param
				: undefined;
		receipt.error = {
			kind:
				error instanceof assert.AssertionError
					? "assertion"
					: typeof type === "string"
						? type
						: "request",
			...(typeof code === "string" && /^[a-z_]+$/.test(code) ? { code } : {}),
			...(typeof param === "string" && /^[a-z_[\]0-9]+$/.test(param)
				? { param }
				: {}),
			...(error instanceof assert.AssertionError
				? { message: error.message.slice(0, 400) }
				: {}),
		};
		await save();
		console.log(
			JSON.stringify({
				caseName,
				passed: false,
				error: receipt.error,
				receiptPath,
			}),
		);
		process.exitCode = 1;
	}
}
main().catch(() => {
	console.error("Schedule proof refused or incomplete; raw error omitted");
	process.exitCode = 1;
});
