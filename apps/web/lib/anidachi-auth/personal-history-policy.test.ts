import assert from "node:assert/strict";
import test from "node:test";
import {
	withPersonalHistoryRead,
	type PersonalHistoryReadFence,
} from "./personal-history-policy";
import { WatchHistoryV3ApiError } from "./watch-history-v3";
const owner = "11111111-1111-4111-8111-111111111111";
const paid: PersonalHistoryReadFence = {
	active: true,
	policyVersion: 1,
	access: { ownerUserId: owner, accountGeneration: 1, accessEpoch: 2 },
};
test("Free stops reads before store and unavailable stays unavailable", async () => {
	for (const [code, status] of [
		["HISTORY_PLAN_REQUIRED", 403],
		["HISTORY_ACCESS_UNAVAILABLE", 503],
	] as const) {
		let reads = 0;
		await assert.rejects(
			withPersonalHistoryRead(
				owner,
				async () => {
					reads++;
					return "private";
				},
				"read",
				async () => {
					throw new WatchHistoryV3ApiError(status, code, code);
				},
			),
			{ status, code },
		);
		assert.equal(reads, 0);
	}
});
test("access epoch, owner, generation or activation change during fetch discards result", async () => {
	for (const after of [
		{ ...paid, active: false, access: null },
		{ ...paid, access: { ...paid.access!, accessEpoch: 4 } },
		{ ...paid, access: { ...paid.access!, accountGeneration: 2 } },
		{ ...paid, access: { ...paid.access!, ownerUserId: "other" } },
	]) {
		let checks = 0;
		await assert.rejects(
			withPersonalHistoryRead(
				owner,
				async () => "private",
				"read",
				async () => (checks++ ? after : paid),
			),
			{ code: "HISTORY_ACCESS_CHANGED", status: 409 },
		);
		assert.equal(checks, 2);
	}
});
test("same durable fence returns data and inactive compatibility is explicit", async () => {
	for (const value of [
		paid,
		{
			active: false,
			policyVersion: 1,
			access: null,
		} as PersonalHistoryReadFence,
	]) {
		let checks = 0;
		assert.equal(
			await withPersonalHistoryRead(
				owner,
				async () => "private",
				"read",
				async () => {
					checks++;
					return value;
				},
			),
			"private",
		);
		assert.equal(checks, 2);
	}
});
