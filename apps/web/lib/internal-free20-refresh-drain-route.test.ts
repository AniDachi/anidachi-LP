import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/internal/rooms/free20-refresh/drain/route";
const env = { ...process.env },
	fetchOriginal = globalThis.fetch;
const request = (secret: string, body: unknown = {}) =>
	new NextRequest(
		"https://web.example/api/internal/rooms/free20-refresh/drain",
		{
			method: "POST",
			headers: { authorization: `Bearer ${secret}` },
			body: JSON.stringify(body),
		},
	);
let calls: { path: string; body: unknown }[] = [];
let fail = false;
beforeEach(() => {
	Object.assign(process.env, {
		ANIDACHI_INTERNAL_API_SECRET: "rooms",
		ANIDACHI_NOTIFICATION_DRAIN_SECRET: "notifications",
		ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET: "cutover",
		ANIDACHI_FREE20_ACCOUNTING_ENABLED: "true",
		NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
		SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
	});
	calls = [];
	fail = false;
	globalThis.fetch = async (url, init) => {
		calls.push({
			path: new URL(String(url)).pathname,
			body: JSON.parse(String(init?.body)),
		});
		return Response.json(fail ? { message: "private diagnostic" } : [], {
			status: fail ? 503 : 200,
		});
	};
});
afterEach(() => {
	process.env = { ...env };
	globalThis.fetch = fetchOriginal;
});
test("only existing room service credential can drain; exact flag precedes all DB work", async () => {
	for (const secret of ["wrong", "notifications", "cutover", ""])
		assert.equal((await POST(request(secret))).status, 401);
	for (const flag of [undefined, "false", "TRUE", "1", " true "]) {
		if (flag === undefined)
			delete process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED;
		else process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = flag;
		assert.equal((await POST(request("rooms"))).status, 503);
	}
	assert.deepEqual(calls, []);
});
test("scheduled recovery ignores caller targets and acknowledges only minimal success", async () => {
	const response = await POST(
		request("rooms", {
			ownerUserId: "attacker",
			roomId: "arbitrary",
			grant: "paid",
		}),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { ok: true });
	assert.deepEqual(calls, [
		{
			path: "/rest/v1/rpc/claim_free20_room_refresh_v1",
			body: { p_limit: 4, p_owner_user_id: null },
		},
	]);
	assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("database failure is retryable and does not leak private diagnostics", async () => {
	fail = true;
	const response = await POST(request("rooms"));
	assert.equal(response.status, 503);
	assert.equal((await response.text()).includes("private diagnostic"), false);
});
