import assert from "node:assert/strict";
import test from "node:test";
import {
	recordTrialConversion,
	resolveTrialAnalyticsEnvironment,
	drainTrialConversionEvents,
	type TrialConversionEvent,
} from "./trial-conversion-events";

const EVENT = "a5000000-0000-4000-8000-000000000001";
const USER = "a1000000-0000-4000-8000-000000000001";
const base: TrialConversionEvent = {
	id: EVENT,
	userId: USER,
	eventType: "trial_started",
	mode: "cardless",
	planCode: "plus",
	billingPeriod: "monthly",
	environment: "staging",
	occurredAt: "2026-10-11T12:00:00.000Z",
};

test("verified retry retains one event identity and original occurrence time", async () => {
	const sent: unknown[] = [];
	const deliver = async (value: unknown) => {
		sent.push(value);
		return true;
	};
	assert.equal(await recordTrialConversion(base, deliver), true);
	assert.equal(await recordTrialConversion(base, deliver), true);
	assert.deepEqual(sent[0], sent[1]);
	assert.deepEqual(sent[0], {
		eventType: "trial_started",
		insertId: EVENT,
		userId: USER,
		occurredAt: Date.parse(base.occurredAt),
		properties: {
			trial_mode: "cardless",
			plan: "plus",
			billing_period: "monthly",
			environment: "staging",
			source: "verified_server",
		},
	});
});

test("analytics maps only allowlisted fields, never email or card/Stripe data", async () => {
	let sent: unknown;
	await recordTrialConversion(
		{
			...base,
			email: "never@example.invalid",
			paymentMethodId: "pm_never",
			stripeCustomerId: "cus_never",
		} as TrialConversionEvent,
		async (value) => {
			sent = value;
			return true;
		},
	);
	assert.doesNotMatch(
		JSON.stringify(sent),
		/email|pm_never|cus_never|device_id|ip/,
	);
});

test("invalid environment, identity, plan and unverified click/setup are never sent", async () => {
	let calls = 0;
	for (const bad of [
		{ environment: undefined },
		{ environment: "preview" },
		{ id: "random" },
		{ userId: "other@email.invalid" },
		{ eventType: "setup" },
		{ eventType: "checkout_click" },
		{ planCode: "free" },
		{ occurredAt: "bad" },
	]) {
		assert.equal(
			await recordTrialConversion(
				{ ...base, ...bad } as TrialConversionEvent,
				async () => {
					calls++;
					return true;
				},
			),
			false,
		);
	}
	assert.equal(calls, 0);
});

test("disabled or mismatched environment fails closed; canonical staging/production are separate", () => {
	assert.equal(
		resolveTrialAnalyticsEnvironment({
			VERCEL_ENV: "preview",
			NEXT_PUBLIC_SITE_URL: "https://staging.anidachi.app",
		}),
		"staging",
	);
	assert.equal(
		resolveTrialAnalyticsEnvironment({
			VERCEL_ENV: "production",
			NEXT_PUBLIC_SITE_URL: "https://www.anidachi.app",
		}),
		"production",
	);
	assert.equal(resolveTrialAnalyticsEnvironment({}), null);
	assert.equal(
		resolveTrialAnalyticsEnvironment({
			VERCEL_ENV: "preview",
			NEXT_PUBLIC_SITE_URL: "https://www.anidachi.app",
		}),
		null,
	);
	assert.equal(
		resolveTrialAnalyticsEnvironment({
			VERCEL_ENV: "production",
			NEXT_PUBLIC_SITE_URL: "https://staging.anidachi.app",
		}),
		null,
	);
});

test("delivery failure keeps a claimed transition retryable and success acknowledges its lease", async () => {
	const finished: unknown[] = [];
	const claim = { ...base, leaseToken: "a6000000-0000-4000-8000-000000000001" };
	const repository = {
		claim: async () => [claim],
		finish: async (...args: unknown[]) => {
			finished.push(args);
			return true;
		},
	};
	const failed = await drainTrialConversionEvents({
		environment: "staging",
		repository,
		deliver: async () => {
			throw Error("network");
		},
	});
	assert.equal(failed.retried, 1);
	assert.equal(failed.delivered, 0);
	const success = await drainTrialConversionEvents({
		environment: "staging",
		repository,
		deliver: async () => true,
	});
	assert.equal(success.delivered, 1);
	assert.deepEqual(finished, [
		[claim, false],
		[claim, true],
	]);
});

test("drain never sends a claim for another environment and does no work when disabled", async () => {
	let calls = 0;
	const repository = {
		claim: async () => {
			calls++;
			return [
				{ ...base, environment: "production" as const, leaseToken: EVENT },
			];
		},
		finish: async () => {
			throw Error("must not settle foreign claim");
		},
	};
	assert.equal(
		(
			await drainTrialConversionEvents({
				environment: null,
				repository,
				deliver: async () => {
					throw Error("must not send");
				},
			})
		).claimed,
		0,
	);
	assert.equal(calls, 0);
	const result = await drainTrialConversionEvents({
		environment: "staging",
		repository,
		deliver: async () => {
			throw Error("must not send");
		},
	});
	assert.equal(result.errors, 1);
	assert.equal(result.delivered, 0);
});

test("lost database acknowledgement never invents delivery completion", async () => {
	const result = await drainTrialConversionEvents({
		environment: "staging",
		repository: {
			claim: async () => [{ ...base, leaseToken: EVENT }],
			finish: async () => {
				throw Error("lost response");
			},
		},
		deliver: async () => true,
	});
	assert.equal(result.delivered, 0);
	assert.equal(result.errors, 1);
});
