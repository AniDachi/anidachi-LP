import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import {
	GET,
	POST,
} from "../app/api/internal/billing/trial-events/drain/route";
import { POST as endRoom } from "../app/api/internal/rooms/[roomId]/ended/route";
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let calls = 0;
beforeEach(() => {
	process.env.ANIDACHI_TRIAL_EVENT_DRAIN_SECRET = "trial-drain-test";
	process.env.ANIDACHI_INTERNAL_API_SECRET = "room-test";
	process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET = "notification-test";
	process.env.VERCEL_ENV = "preview";
	process.env.NEXT_PUBLIC_SITE_URL = "https://staging.anidachi.app";
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
	calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return Response.json([]);
	};
});
afterEach(() => {
	process.env = { ...originalEnv };
	globalThis.fetch = originalFetch;
});
function request(value?: string) {
	return new NextRequest(
		"https://staging.anidachi.app/api/internal/billing/trial-events/drain",
		{
			method: "POST",
			headers: value ? { authorization: `Bearer ${value}` } : {},
		},
	);
}
test("dedicated analytics bearer is required before any database access", async () => {
	for (const value of [undefined, "wrong", "room-test", "notification-test"])
		assert.equal((await POST(request(value))).status, 401);
	delete process.env.ANIDACHI_TRIAL_EVENT_DRAIN_SECRET;
	assert.equal((await POST(request("room-test"))).status, 401);
	assert.equal((await GET()).status, 405);
	assert.equal(calls, 0);
});
test("analytics bearer cannot authorize room callbacks", async () => {
	assert.equal(
		(
			await endRoom(request("trial-drain-test"), {
				params: Promise.resolve({ roomId: "fixture" }),
			})
		).status,
		401,
	);
	assert.equal(calls, 0);
});
test("only canonical environment produces a private bounded drain acknowledgement", async () => {
	const result = await POST(request("trial-drain-test"));
	assert.equal(result.status, 200);
	assert.deepEqual(await result.json(), { ok: true });
	assert.equal(calls, 1);
	delete process.env.VERCEL_ENV;
	assert.equal((await POST(request("trial-drain-test"))).status, 503);
	assert.equal(calls, 1);
});
test("database error never produces a success receipt", async () => {
	globalThis.fetch = async () =>
		Response.json({ message: "private" }, { status: 503 });
	const result = await POST(request("trial-drain-test"));
	assert.equal(result.status, 503);
	assert.doesNotMatch(await result.text(), /private/);
});
