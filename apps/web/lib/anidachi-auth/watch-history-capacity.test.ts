import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createWatchHistoryCapacityHandler, getWatchHistoryCapacity } from "./watch-history-capacity";
import { publicDatabaseError, WatchHistoryV3ApiError } from "./watch-history-v3";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
const owner = "11111111-1111-4111-8111-111111111111";
const capacity = {
	capacityVersion: 1, ownerUserId: owner, accountGeneration: 2,
	serverTime: "2026-09-09T00:00:00.000Z",
	providers: { youtube: { used: 101, limit: 100 }, crunchyroll: { used: 250, limit: 200 } },
};
const session = { userId: owner, email: "owner@example.test", plan: "free" as const, source: "cookie" as const };
function request(query = "", expectedOwner = owner) {
	return new NextRequest(`https://example.test/api/watch-history/v3/capacity${query}`, { headers: { [WATCH_HISTORY_OWNER_HEADER]: expectedOwner } });
}
test("Free reads real above-limit counts using verified identity and requested generation", async () => {
	let calls = 0;
	const handle = createWatchHistoryCapacityHandler({ getSession: async () => session,
		store: { load: async (user, generation) => { calls++; assert.equal(user, owner); assert.equal(generation, 2); return capacity; } },
	});
	const result = await handle(request("?accountGeneration=2&userId=attacker"));
	assert.equal(result.status, 200); assert.equal(calls, 1); assert.deepEqual(await result.json(), capacity);
	assert.equal(result.headers.get("Cache-Control"), "private, no-store");
	assert.equal(result.headers.get("Vary"), "Cookie, Authorization");
});
test("auth and owner mismatch prevent database reads", async () => {
	for (const [identity, expectedOwner, status] of [[null, owner, 401], [session, "other", 409]] as const) {
		const handle = createWatchHistoryCapacityHandler({ getSession: async () => identity,
			store: { load: async () => { throw Error("must not read"); } },
		});
		const result = await handle(request("", expectedOwner));
		assert.equal(result.status, status); assert.equal(result.headers.get("Cache-Control"), "private, no-store");
	}
});
test("generation query is positive, bounded, and fenced", async () => {
	const handle = createWatchHistoryCapacityHandler({ getSession: async () => session, store: { load: async () => capacity } });
	for (const generation of ["0", "-1", "1.5", "Infinity", "9007199254740992", ""])
		assert.equal((await handle(request(`?accountGeneration=${generation}`))).status, 400);
	const stale = await handle(request("?accountGeneration=1"));
	assert.equal(stale.status, 409); assert.equal((await stale.json()).code, "GENERATION_MISMATCH");
});
test("capacity rejects cross-owner or invalid database payload and hides raw failures", async () => {
	for (const data of [{ ...capacity, ownerUserId: "22222222-2222-4222-8222-222222222222" }, { ...capacity, providers: {} }])
		await assert.rejects(getWatchHistoryCapacity({ userId: owner, store: { load: async () => data } }),
			(error: unknown) => error instanceof WatchHistoryV3ApiError && error.status === 502);
	const handle = createWatchHistoryCapacityHandler({ getSession: async () => session, store: { load: async () => { throw Error("private database detail"); } } });
	const result = await handle(request()); assert.equal(result.status, 503);
	assert.equal((await result.text()).includes("private database detail"), false);
});
test("capacity rejection is a public 409 without access revocation", () => {
	const error = publicDatabaseError({ message: "HISTORY_LIMIT_REACHED" });
	assert.equal(error.status, 409); assert.equal(error.code, "HISTORY_LIMIT_REACHED");
});
