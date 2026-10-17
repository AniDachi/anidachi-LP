import assert from "node:assert/strict";
import { STRIPE_API_VERSION } from "../../lib/anidachi-auth/stripe-env";

export const TRIAL_SECONDS = 72 * 60 * 60;
export const REQUIRED_SCENARIOS = [
	"no_renewal_without_consent_without_card",
	"no_renewal_without_consent_with_saved_card",
	"opt_in_preserves_trial_end",
	"expired_setup_never_restores_trial",
	"cancel_wins_over_late_setup",
	"update_crossing_trial_end",
	"decline_after_opt_in",
	"sca_after_opt_in",
	"plan_and_period_change_preserves_trial_end",
	"zero_initial_invoice_is_not_conversion",
	"already_open_portal_cannot_bypass_consent",
] as const;

export type ScenarioResult = {
	name: string;
	status: "passed" | "failed" | "pending";
	checkedAt?: string;
	trialStart?: number;
	trialEnd?: number;
	customerId?: string;
	subscriptionId?: string;
	clockId?: string;
	error?: string;
};

export type CardlessStripeProof = {
	apiVersion: string;
	accountId: string;
	livemode: false;
	runId: string;
	createdAt: string;
	passed: boolean;
	scenarios: ScenarioResult[];
};

export function parseProofOptions(
	args: string[],
	environment?: string,
): { accountId: string; cliProfile?: string } {
	assert.notEqual(environment, "production", "Proof cannot run in production");
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index++) {
		const flag = args[index];
		assert.ok(
			["--test", "--account", "--cli-profile"].includes(flag),
			"Unknown proof option",
		);
		assert.ok(!values.has(flag), "Duplicate proof option");
		const value = flag === "--test" ? "true" : args[++index];
		assert.ok(value && !value.startsWith("--"), "Missing proof option value");
		values.set(flag, value);
	}
	assert.equal(values.get("--test"), "true", "Explicit --test required");
	const accountId = values.get("--account");
	assert.ok(accountId, "Explicit --account required");
	assert.match(
		accountId,
		/^acct_[A-Za-z0-9]+$/,
		"Expected an exact Stripe account ID",
	);
	const cliProfile = values.get("--cli-profile");
	if (cliProfile) assert.match(cliProfile, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
	return { accountId, ...(cliProfile ? { cliProfile } : {}) };
}

export function assertProofTarget(
	expected: string,
	actual: string,
	live: boolean,
	version?: string,
): void {
	assert.equal(
		actual,
		expected,
		"Stripe account does not match the explicitly selected sandbox",
	);
	assert.equal(live, false, "Live Stripe response refused");
	assert.equal(
		version,
		STRIPE_API_VERSION,
		"Stripe response API version was not verified against the application pin",
	);
}

export function assertTestObject(
	value: unknown,
): asserts value is { livemode: false } {
	assert.ok(
		value &&
			typeof value === "object" &&
			"livemode" in value &&
			value.livemode === false,
		"Missing or live Stripe mode refused",
	);
}

export function assertOwnedTestObject(value: unknown, runId: string): void {
	assertTestObject(value);
	const metadata = (value as { metadata?: Record<string, string> }).metadata;
	assert.equal(
		metadata?.anidachiProof,
		"cardless_trial",
		"Object is not owned by the trial proof",
	);
	assert.equal(
		metadata?.proofRun,
		runId,
		"Object belongs to another proof run",
	);
}

type SubscriptionEvidence = {
	status: string;
	trial_start: number | null;
	trial_end: number | null;
};
type InvoiceEvidence = {
	billing_reason: string | null;
	created: number;
	amount_due: number;
	amount_paid: number;
	amount_remaining: number;
	attempt_count: number;
};

export function assertNoUnconsentedBilling(
	subscription: SubscriptionEvidence,
	invoices: InvoiceEvidence[],
	intents: unknown[],
	charges: unknown[],
): void {
	assert.equal(subscription.status, "canceled", "Trial did not terminate");
	assert.ok(
		subscription.trial_start !== null && subscription.trial_end !== null,
		"Trial timestamps missing",
	);
	assert.equal(
		subscription.trial_end - subscription.trial_start,
		TRIAL_SECONDS,
		"Trial is not exactly 72 hours",
	);
	assert.equal(invoices.length, 1, "Expected only the initial zero invoice");
	for (const invoice of invoices) {
		assert.equal(
			invoice.billing_reason,
			"subscription_create",
			"Unexpected renewal invoice",
		);
		assert.ok(
			invoice.created < subscription.trial_end,
			"Invoice appeared at or after trial expiry",
		);
		assert.equal(invoice.amount_due, 0, "Unexpected amount due");
		assert.equal(invoice.amount_paid, 0, "Unexpected paid amount");
		assert.equal(invoice.amount_remaining, 0, "Unexpected debt");
		assert.equal(invoice.attempt_count, 0, "Unexpected payment attempt");
	}
	assert.equal(
		intents.length,
		0,
		"Unexpected PaymentIntent, including failed attempts",
	);
	assert.equal(
		charges.length,
		0,
		"Unexpected charge, including failed or refunded charges",
	);
}

export function summarizeProof(
	results: ScenarioResult[],
): Pick<CardlessStripeProof, "passed" | "scenarios"> {
	assert.equal(
		new Set(results.map((result) => result.name)).size,
		results.length,
		"Duplicate scenario evidence",
	);
	assert.ok(
		results.every((result) =>
			(REQUIRED_SCENARIOS as readonly string[]).includes(result.name),
		),
		"Unknown proof scenario",
	);
	const scenarios = REQUIRED_SCENARIOS.map(
		(name): ScenarioResult =>
			results.find((result) => result.name === name) ?? {
				name,
				status: "pending",
			},
	);
	return {
		passed: scenarios.every((result) => result.status === "passed"),
		scenarios,
	};
}
