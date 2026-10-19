import assert from "node:assert/strict";
import test from "node:test";
import { readPendingTrialActivation } from "./cardless-trial-status";
const row = {
	id: "b1000000-0000-4000-8000-000000000001",
	user_id: "owner",
	state: "pending",
	plan_code: "pro",
	billing_period: "yearly",
};
test("pending activation discovery maps only the owned frozen selection", async () => {
	assert.deepEqual(
		await readPendingTrialActivation("owner", async () => ({
			...row,
			stripe_customer_id: "cus_private",
		})),
		{ id: row.id, planCode: "pro", billingPeriod: "yearly" },
	);
	assert.equal(
		await readPendingTrialActivation("owner", async () => null),
		null,
	);
});
test("foreign, terminal or malformed activation status never becomes recovery authority", async () => {
	for (const patch of [
		{ user_id: "other" },
		{ state: "committed" },
		{ state: "failed" },
		{ id: "not-uuid" },
		{ plan_code: "free" },
		{ billing_period: "forever" },
	]) {
		await assert.rejects(
			readPendingTrialActivation("owner", async () => ({ ...row, ...patch })),
			/unavailable/,
		);
	}
	await assert.rejects(
		readPendingTrialActivation("owner", async () => {
			throw Error("database unavailable");
		}),
		/unavailable/,
	);
});
