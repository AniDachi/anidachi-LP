import assert from "node:assert/strict";
import test from "node:test";
import { HistoryAccessError } from "./account-entitlements";
import { readFree20AccountBudget } from "./free20-account-budget";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-30T12:00:00.000Z");

// Complete response of the existing authority RPC. The real account resolver
// validates it; only the two external database reads are replaced in these tests.
function authority(
	plan: "free" | "plus" | "pro" = "free",
	at = now.toISOString(),
) {
	return {
		planCode: plan,
		selectedPlanExpiresAt: plan === "free" ? null : "2026-11-03T12:00:00.000Z",
		paidUntil: plan === "free" ? null : "2026-11-03T12:00:00.000Z",
		hosting: {
			hostingPolicyVersion: 2,
			hostingActivationAt: "2026-09-28T00:00:00.000Z",
			canHost: plan !== "free",
			trialEligibility: plan === "free" ? "eligible" : "unavailable",
			trialEndsAt: null as string | null,
		},
		history: {
			accessVersion: 1,
			ownerUserId: owner,
			accountGeneration: 3,
			accessEpoch: 4,
			youtubeConsentEpoch: 2,
			state: plan === "free" ? "plan_required" : "allowed",
			serverTime: at,
			captureNotBefore: "2026-09-08T10:00:00.000Z",
			validUntil: new Date(Date.parse(at) + 300_000).toISOString(),
			youtubeHistoryEnabled: true,
		},
	};
}

function db(value = authority(), committedSeconds = 420) {
	return {
		resolveAuthority: async (userId: string) => {
			assert.equal(userId, value.history.ownerUserId);
			return value;
		},
		readUsage: async (userId: string, day: string) => {
			assert.equal(userId, value.history.ownerUserId);
			assert.equal(
				day,
				new Date(value.history.serverTime).toISOString().slice(0, 10),
			);
			return committedSeconds;
		},
	};
}

test("Free20 leaves 13 minutes after seven committed minutes without granting legacy hosting", async () => {
	const raw = authority();
	const view = await readFree20AccountBudget(owner, now, db(raw));
	assert.deepEqual(view, {
		ownerUserId: owner,
		serverTime: "2026-10-30T12:00:00.000Z",
		utcDay: "2026-10-30",
		resetAt: "2026-10-31T00:00:00.000Z",
		refreshBy: "2026-10-30T12:05:00.000Z",
		kind: "daily_free",
		budgetSeconds: 1200,
		committedSeconds: 420,
		remainingAfterCommittedSeconds: 780,
	});
	assert.equal(raw.hosting.canHost, false);
	assert.equal(raw.history.state, "plan_required");
});

test("zero, last second, exhaustion and settlement overshoot preserve committed usage", async () => {
	for (const [used, remaining] of [
		[0, 1200],
		[1199, 1],
		[1200, 0],
		[1500, 0],
	]) {
		const view = await readFree20AccountBudget(
			owner,
			now,
			db(authority(), used),
		);
		assert.equal(view.kind, "daily_free");
		if (view.kind !== "daily_free") assert.fail("Expected daily budget");
		assert.equal(view.committedSeconds, used);
		assert.equal(view.remainingAfterCommittedSeconds, remaining);
	}
});

test("repeated reads share the account bucket and observe new committed usage", async () => {
	let used = 420;
	const dependencies = {
		...db(),
		readUsage: async (id: string, day: string) => {
			assert.equal(id, owner);
			assert.equal(day, "2026-10-30");
			return used;
		},
	};
	const first = await readFree20AccountBudget(owner, now, dependencies);
	assert.deepEqual(
		await readFree20AccountBudget(owner, now, dependencies),
		first,
	);
	used = 480;
	const next = await readFree20AccountBudget(owner, now, dependencies);
	assert.equal(next.kind, "daily_free");
	if (next.kind !== "daily_free") assert.fail("Expected daily budget");
	assert.equal(next.remainingAfterCommittedSeconds, 720);
});

test("different accounts read their own daily usage", async () => {
	const raw = authority();
	raw.history.ownerUserId = other;
	const view = await readFree20AccountBudget(other, now, db(raw, 60));
	assert.equal(view.ownerUserId, other);
	assert.equal(view.kind, "daily_free");
	if (view.kind !== "daily_free") assert.fail("Expected daily budget");
	assert.equal(view.remainingAfterCommittedSeconds, 1140);
});

test("database UTC time selects the bucket despite application clock and date offset", async () => {
	const raw = authority("free", "2026-10-31T06:59:59.000+07:00");
	const view = await readFree20AccountBudget(
		owner,
		new Date("2030-01-01"),
		db(raw, 1200),
	);
	assert.equal(view.serverTime, "2026-10-30T23:59:59.000Z");
	assert.equal(view.utcDay, "2026-10-30");
	assert.equal(view.resetAt, "2026-10-31T00:00:00.000Z");
	assert.equal(view.refreshBy, "2026-10-31T00:00:00.000Z");
});

test("exact UTC midnight reads a fresh day without carrying old usage or unused time", async () => {
	const usage = new Map([
		["2026-10-31", 1200],
		["2026-11-01", 0],
	]);
	for (const [at, day, remaining, resetAt] of [
		["2026-10-31T23:59:59.999Z", "2026-10-31", 0, "2026-11-01T00:00:00.000Z"],
		[
			"2026-11-01T00:00:00.000Z",
			"2026-11-01",
			1200,
			"2026-11-02T00:00:00.000Z",
		],
	] as const) {
		const view = await readFree20AccountBudget(owner, now, {
			...db(authority("free", at)),
			readUsage: async (id, requestedDay) => {
				assert.equal(id, owner);
				assert.equal(requestedDay, day);
				const seconds = usage.get(requestedDay);
				assert.notEqual(seconds, undefined);
				return seconds as number;
			},
		});
		assert.equal(view.utcDay, day);
		assert.equal(view.resetAt, resetAt);
		assert.equal(view.kind, "daily_free");
		if (view.kind !== "daily_free") assert.fail("Expected daily budget");
		assert.equal(view.remainingAfterCommittedSeconds, remaining);
	}
	assert.deepEqual(
		[...usage],
		[
			["2026-10-31", 1200],
			["2026-11-01", 0],
		],
	);
});

test("a used trial or unavailable trial offer does not remove a confirmed Free account's daily budget", async () => {
	for (const eligibility of ["eligible", "used", "unavailable"]) {
		const raw = authority();
		raw.hosting.trialEligibility = eligibility;
		if (eligibility === "used")
			raw.hosting.trialEndsAt = "2026-10-29T12:00:00.000Z";
		const view = await readFree20AccountBudget(owner, now, db(raw));
		assert.equal(view.kind, "daily_free");
		if (view.kind !== "daily_free") assert.fail("Expected daily budget");
		assert.equal(view.remainingAfterCommittedSeconds, 780);
	}
});

test("confirmed Plus and Pro do not read or apply the daily Free budget", async () => {
	for (const plan of ["plus", "pro"] as const) {
		const view = await readFree20AccountBudget(owner, now, {
			...db(authority(plan)),
			readUsage: async () =>
				assert.fail("Unlimited authority must not read Free usage"),
		});
		assert.deepEqual(view, {
			ownerUserId: owner,
			serverTime: "2026-10-30T12:00:00.000Z",
			utcDay: "2026-10-30",
			resetAt: "2026-10-31T00:00:00.000Z",
			refreshBy: "2026-10-30T12:05:00.000Z",
			kind: "unlimited",
		});
	}
});

test("existing trial remains unlimited until its confirmed expiry", async () => {
	const raw = authority("pro");
	raw.hosting.trialEligibility = "used";
	raw.hosting.trialEndsAt = "2026-10-30T12:01:00.000Z";
	raw.paidUntil =
		raw.selectedPlanExpiresAt =
		raw.history.validUntil =
			raw.hosting.trialEndsAt;
	const view = await readFree20AccountBudget(owner, now, db(raw));
	assert.equal(view.kind, "unlimited");
	assert.equal(view.refreshBy, "2026-10-30T12:01:00.000Z");
	assert.equal(raw.hosting.trialEndsAt, "2026-10-30T12:01:00.000Z");
});

test("an old trial date does not override current paid authority", async () => {
	const raw = authority("plus");
	raw.hosting.trialEligibility = "used";
	raw.hosting.trialEndsAt = "2026-10-29T12:00:00.000Z";
	assert.equal(
		(await readFree20AccountBudget(owner, now, db(raw))).kind,
		"unlimited",
	);
});

test("finite and indefinite manual grants use the existing resolved authority without guessing a source", async () => {
	for (const expiry of ["2026-10-30T12:01:00.000Z", null]) {
		const raw = authority("pro");
		raw.paidUntil = raw.selectedPlanExpiresAt = expiry;
		if (expiry) raw.history.validUntil = expiry;
		const view = await readFree20AccountBudget(owner, now, db(raw));
		assert.equal(view.kind, "unlimited");
		assert.equal(view.refreshBy, expiry ?? "2026-10-30T12:05:00.000Z");
	}
});

test("selected-plan expiry bounds refresh even when another paid grant lasts longer", async () => {
	const raw = authority("pro");
	raw.selectedPlanExpiresAt = "2026-10-30T12:00:30.000Z";
	const view = await readFree20AccountBudget(owner, now, db(raw));
	assert.equal(view.kind, "unlimited");
	assert.equal(view.refreshBy, "2026-10-30T12:00:30.000Z");
});

test("fresh authority after trial expiry uses the same spent daily budget", async () => {
	const raw = authority("free", "2026-10-30T12:01:00.000Z");
	raw.hosting.trialEligibility = "used";
	raw.hosting.trialEndsAt = "2026-10-30T12:01:00.000Z";
	const view = await readFree20AccountBudget(owner, now, db(raw, 900));
	assert.equal(view.kind, "daily_free");
	if (view.kind !== "daily_free") assert.fail("Expected daily budget");
	assert.equal(view.remainingAfterCommittedSeconds, 300);
});

test("invalid ledger data is unavailable, never a refreshed or unlimited budget", async () => {
	for (const used of [
		-1,
		0.5,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.MAX_SAFE_INTEGER + 1,
		null,
		"420",
	]) {
		await assert.rejects(
			readFree20AccountBudget(owner, now, db(authority(), used as number)),
			/Invalid committed Free20 usage/,
		);
	}
});

test("usage read failure never returns a full daily budget", async () => {
	await assert.rejects(
		readFree20AccountBudget(owner, now, {
			...db(),
			readUsage: async () => {
				throw new Error("usage unavailable");
			},
		}),
		/usage unavailable/,
	);
});

test("unknown, wrong-owner and expired authority fail before reading usage", async () => {
	const wrongOwner = authority();
	wrongOwner.history.ownerUserId = other;
	const expired = authority("plus");
	expired.selectedPlanExpiresAt = now.toISOString();
	for (const raw of [
		null,
		{},
		{ ...authority(), planCode: "unknown" },
		wrongOwner,
		expired,
	]) {
		await assert.rejects(
			readFree20AccountBudget(owner, now, {
				resolveAuthority: async () => raw,
				readUsage: async () =>
					assert.fail("Invalid authority must not read usage"),
			}),
			HistoryAccessError,
		);
	}
});

test("authority outage never becomes Free", async () => {
	await assert.rejects(
		readFree20AccountBudget(owner, now, {
			resolveAuthority: async () => {
				throw new Error("authority unavailable");
			},
			readUsage: async () =>
				assert.fail("Missing authority must not read usage"),
		}),
		HistoryAccessError,
	);
});
