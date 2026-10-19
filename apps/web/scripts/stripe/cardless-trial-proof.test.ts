import assert from "node:assert/strict";
import test from "node:test";
import {
	assertNoUnconsentedBilling,
	assertOwnedTestObject,
	assertProofTarget,
	parseProofOptions,
	summarizeProof,
} from "./cardless-trial-proof";

test("an explicit CLI profile can reuse its test login without copying a secret", () => {
	assert.deepEqual(
		parseProofOptions(
			[
				"--test",
				"--account",
				"acct_proof",
				"--cli-profile",
				"anidachi-cardless-proof",
			],
			"development",
		),
		{
			accountId: "acct_proof",
			cliProfile: "anidachi-cardless-proof",
		},
	);
	for (const extra of [
		["--cli-profile"],
		["--cli-profile", ""],
		["--cli-profile", "a", "--cli-profile", "b"],
		["--live"],
	]) {
		assert.throws(() =>
			parseProofOptions(
				["--test", "--account", "acct_proof", ...extra],
				"development",
			),
		);
	}
});

test("proof requires explicit test mode and exact account before making requests", () => {
	for (const args of [
		[],
		["--account", "acct_proof"],
		["--test"],
		["--live", "--account", "acct_proof"],
		["--test", "--account", "org_proof"],
		["--test", "--account", "acct_proof", "--live"],
	]) {
		assert.throws(() => parseProofOptions(args, "development"));
	}
	assert.deepEqual(
		parseProofOptions(["--test", "--account", "acct_proof"], "development"),
		{ accountId: "acct_proof" },
	);
	assert.throws(() =>
		parseProofOptions(["--test", "--account", "acct_proof"], "production"),
	);
});

test("wrong Stripe account, live response, and unverified API version block all writes", () => {
	assert.doesNotThrow(() =>
		assertProofTarget("acct_proof", "acct_proof", false, "2025-08-27.basil"),
	);
	assert.throws(() =>
		assertProofTarget("acct_proof", "acct_other", false, "2025-08-27.basil"),
	);
	assert.throws(() =>
		assertProofTarget("acct_proof", "acct_proof", true, "2025-08-27.basil"),
	);
	assert.throws(() =>
		assertProofTarget("acct_proof", "acct_proof", false, undefined),
	);
	assert.throws(() =>
		assertProofTarget("acct_proof", "acct_proof", false, "2026-09-30.endive"),
	);
});

const owned = {
	livemode: false,
	metadata: { anidachiProof: "cardless_trial", proofRun: "this-run" },
};

test("test mode alone never authorizes another customer or another proof run", () => {
	assert.doesNotThrow(() => assertOwnedTestObject(owned, "this-run"));
	for (const value of [
		{ ...owned, livemode: true },
		{ ...owned, livemode: undefined },
		{ livemode: false },
		{
			...owned,
			metadata: { anidachiProof: "cardless_trial", proofRun: "another-run" },
		},
	])
		assert.throws(() => assertOwnedTestObject(value, "this-run"));
});

const canceled = { status: "canceled", trial_start: 100, trial_end: 259300 };
const zeroInvoice = {
	billing_reason: "subscription_create",
	created: 100,
	amount_due: 0,
	amount_paid: 0,
	amount_remaining: 0,
	attempted: true,
	attempt_count: 0,
};

test("completed 72h trial permits its initial zero invoice but no renewal invoice", () => {
	assert.doesNotThrow(() =>
		assertNoUnconsentedBilling(canceled, [zeroInvoice], [], []),
	);
	assert.throws(() =>
		assertNoUnconsentedBilling(
			{ ...canceled, status: "active" },
			[zeroInvoice],
			[],
			[],
		),
	);
	assert.throws(() =>
		assertNoUnconsentedBilling(
			{ ...canceled, trial_end: 259299 },
			[zeroInvoice],
			[],
			[],
		),
	);
	assert.throws(() =>
		assertNoUnconsentedBilling(
			canceled,
			[
				zeroInvoice,
				{
					...zeroInvoice,
					billing_reason: "subscription_cycle",
					created: canceled.trial_end,
				},
			],
			[],
			[],
		),
	);
});

test("failed or voided payment attempts still fail the no-consent guarantee", () => {
	const debt = { ...zeroInvoice, amount_due: 799, amount_remaining: 799 };
	const attempted = {
		...zeroInvoice,
		created: canceled.trial_end + 1,
		attempt_count: 1,
	};
	assert.throws(() => assertNoUnconsentedBilling(canceled, [debt], [], []));
	assert.throws(() =>
		assertNoUnconsentedBilling(canceled, [attempted], [], []),
	);
	assert.throws(() =>
		assertNoUnconsentedBilling(
			canceled,
			[zeroInvoice],
			[{ status: "requires_payment_method" }],
			[],
		),
	);
	assert.throws(() =>
		assertNoUnconsentedBilling(
			canceled,
			[zeroInvoice],
			[],
			[{ status: "failed" }],
		),
	);
});

test("missing or pending mandatory scenarios cannot produce a passing proof", () => {
	assert.equal(summarizeProof([]).passed, false);
	assert.equal(
		summarizeProof([
			{ name: "no_renewal_without_consent_with_saved_card", status: "passed" },
		]).passed,
		false,
	);
	const result = summarizeProof([
		{ name: "no_renewal_without_consent_with_saved_card", status: "failed" },
	]);
	assert.equal(result.passed, false);
	assert.equal(
		result.scenarios.some(
			(s) =>
				s.name === "already_open_portal_cannot_bypass_consent" &&
				s.status === "pending",
		),
		true,
	);
});
