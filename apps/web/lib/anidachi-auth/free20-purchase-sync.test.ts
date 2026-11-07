import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type Stripe from "stripe";
import { commitStripeSubscriptionRefresh } from "./db";
import {
	syncStripeSubscriptionById,
	type SyncStripeSubscriptionDeps,
} from "./stripe-subscription-sync";

const env = { ...process.env },
	fetchOriginal = globalThis.fetch;
afterEach(() => {
	process.env = { ...env };
	globalThis.fetch = fetchOriginal;
});
const owner = "f6260000-0000-4000-8000-000000000001";
const lease = { fence: 5, token: "f6260000-0000-4000-8000-000000000002" };
const params = {
	userId: owner,
	stripeSubscriptionId: "sub_test",
	stripeCustomerId: "cus_test",
	stripePriceId: "price_plus",
	planCode: "plus" as const,
	status: "active",
	currentPeriodEnd: "2027-01-01T00:00:00Z",
	cancelAtPeriodEnd: false,
};
test("exact Free20 flag dispatches v4, dormant paths preserve v2/v3, and missing v4 never falls back", async () => {
	Object.assign(process.env, {
		NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
		SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
	});
	const seen: string[] = [];
	let fail = false;
	globalThis.fetch = async (url) => {
		seen.push(new URL(String(url)).pathname.split("/").pop()!);
		return Response.json(
			fail ? { message: "missing function" } : { planCode: "plus" },
			{ status: fail ? 404 : 200 },
		);
	};
	for (const flag of [undefined, "false", "TRUE", "1", " true "]) {
		if (flag === undefined)
			delete process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED;
		else process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = flag;
		await commitStripeSubscriptionRefresh(params, lease);
		assert.equal(seen.at(-1), "commit_stripe_subscription_refresh_v2");
		await commitStripeSubscriptionRefresh(
			{ ...params, trial: { trialMode: "cardless" } as never },
			lease,
		);
		assert.equal(seen.at(-1), "commit_stripe_subscription_refresh_v3");
	}
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	for (const trial of [undefined, { trialMode: "cardless" } as never]) {
		await commitStripeSubscriptionRefresh({ ...params, trial }, lease);
		assert.equal(seen.at(-1), "commit_stripe_subscription_refresh_v4");
	}
	const before = seen.length;
	fail = true;
	await assert.rejects(commitStripeSubscriptionRefresh(params, lease));
	assert.deepEqual(seen.slice(before), [
		"commit_stripe_subscription_refresh_v4",
	]);
});
const stripe = {
	subscriptions: {
		retrieve: async () => ({
			id: "sub_test",
			customer: "cus_test",
			metadata: { userId: owner, planCode: "plus" },
			status: "active",
			cancel_at_period_end: false,
			items: {
				data: [
					{ price: { id: "price_plus" }, current_period_end: 1_800_000_000 },
				],
			},
		}),
	},
} as unknown as Stripe;
function syncDeps(): SyncStripeSubscriptionDeps {
	return {
		begin: async () => lease,
		release: async () => {},
		resolveUserId: async () => owner,
		resolveSubscriptionOwner: async () => owner,
		readTrial: async () => null,
		commit: async () => "plus",
	};
}
test("owner-scoped deferred delivery is registered only after awaited durable commit", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	const tasks: (() => Promise<void>)[] = [];
	const delivered: string[] = [];
	const order: string[] = [];
	let resolveCommit!: (value: "plus") => void;
	const committed = new Promise<"plus">((resolve) => {
		resolveCommit = resolve;
	});
	const options = {
		...syncDeps(),
		begin: async () => {
			order.push("begin");
			return lease;
		},
		commit: async () => {
			order.push("commit-start");
			return committed;
		},
		release: async () => {
			order.push("release");
		},
		defer: (task: () => Promise<void>) => {
			order.push("defer");
			tasks.push(task);
		},
		drainFree20: async (options: { ownerUserId?: string } = {}) => {
			delivered.push(options.ownerUserId!);
			return { claimed: 0, completed: 0, pending: 0, errors: 0 };
		},
	};
	const promise = syncStripeSubscriptionById(stripe, "sub_test", options);
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(order, ["begin", "commit-start"]);
	assert.equal(tasks.length, 0);
	assert.equal(delivered.length, 0);
	resolveCommit("plus");
	assert.equal((await promise)?.effectivePlan, "plus");
	assert.deepEqual(order, ["begin", "commit-start", "defer", "release"]);
	assert.equal(delivered.length, 0);
	await tasks[0]();
	assert.deepEqual(delivered, [owner]);
});
test("commit rejection and expected owner mismatch cannot schedule work; lease still releases", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	for (const reason of ["commit", "owner"]) {
		let scheduled = 0,
			released = 0,
			commits = 0;
		await assert.rejects(
			syncStripeSubscriptionById(stripe, "sub_test", {
				...syncDeps(),
				expectedUserId: reason === "owner" ? "other" : owner,
				commit: async () => {
					commits++;
					throw new Error("rollback");
				},
				release: async () => {
					released++;
				},
				defer: () => {
					scheduled++;
				},
			}),
		);
		assert.equal(scheduled, 0);
		assert.equal(released, 1);
		assert.equal(commits, reason === "commit" ? 1 : 0);
	}
});
test("disabled flag schedules no delivery, and scheduling or Worker failures never fail a successful sync", async () => {
	let scheduled = 0;
	delete process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED;
	await syncStripeSubscriptionById(stripe, "sub_test", {
		...syncDeps(),
		defer: () => {
			scheduled++;
		},
	});
	assert.equal(scheduled, 0);
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	assert.equal(
		(
			await syncStripeSubscriptionById(stripe, "sub_test", {
				...syncDeps(),
				defer: () => {
					scheduled++;
					throw new Error("closed response");
				},
			})
		)?.effectivePlan,
		"plus",
	);
	assert.equal(scheduled, 1);
	const tasks: (() => Promise<void>)[] = [];
	assert.equal(
		(
			await syncStripeSubscriptionById(stripe, "sub_test", {
				...syncDeps(),
				defer: (task) => tasks.push(task),
				drainFree20: async () => {
					throw new Error("Worker offline");
				},
			})
		)?.effectivePlan,
		"plus",
	);
	await tasks[0]();
});
