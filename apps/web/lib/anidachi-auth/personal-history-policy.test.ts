import assert from "node:assert/strict";
import test from "node:test";
import {
	withPersonalHistoryRead,
	checkPersonalHistoryOperation,
	type PersonalHistoryReadFence,
} from "./personal-history-policy";
import { WatchHistoryV3ApiError } from "./watch-history-v3";
const owner = "11111111-1111-4111-8111-111111111111";
const paid: PersonalHistoryReadFence = {
	active: true,
	policyVersion: 1,
	access: { ownerUserId: owner, accountGeneration: 1, accessEpoch: 2 },
};
test("server denial stops reads before store and unavailable stays unavailable", async () => {
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

test("real Web policy permits Free reads while rejecting personal and legacy writes", async () => {
	const originalFetch = globalThis.fetch;
	const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://history-policy-fixture.invalid";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "history-policy-fixture-key";
	const requests: string[] = [];
	const issued = Date.now();
	const access = { accessVersion: 1, ownerUserId: owner, accountGeneration: 1, accessEpoch: 2, youtubeConsentEpoch: 1,
		state: "plan_required", youtubeHistoryEnabled: false, serverTime: new Date(issued).toISOString(),
		validUntil: new Date(issued + 300_000).toISOString(), captureNotBefore: new Date(issued).toISOString() };
	globalThis.fetch = async (url, init) => {
		assert.match(String(url), /history-policy-fixture.invalid\/rest\/v1\/rpc\/check_personal_history_operation_v1/);
		const input = JSON.parse(String(init?.body));
		assert.equal(input.p_user_id, owner); requests.push(input.p_operation);
		return Response.json({ active: true, policyVersion: 1, access });
	};
	try {
		for (const operation of ["read", "metadata"] as const) {
			assert.equal((await checkPersonalHistoryOperation(owner, operation)).access?.accessEpoch, 2);
		}
		for (const operation of ["personal", "legacy"] as const) {
			await assert.rejects(checkPersonalHistoryOperation(owner, operation), { code: "HISTORY_PLAN_REQUIRED", status: 403 });
		}
		assert.deepEqual(requests, ["read", "metadata", "personal", "legacy"]);
		access.ownerUserId = "22222222-2222-4222-8222-222222222222";
		await assert.rejects(checkPersonalHistoryOperation(owner, "read"), { code: "HISTORY_ACCESS_UNAVAILABLE", status: 503 });
	} finally {
		globalThis.fetch = originalFetch;
		if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
		if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
	}
});
