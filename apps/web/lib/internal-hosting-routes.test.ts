import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST as admission } from "../app/api/internal/rooms/[roomId]/admission/route";
import { POST as drainRoute } from "../app/api/internal/rooms/cutover/drain/route";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const userId = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ roomId: "room-1" }) };
const request = (secret: string, body: unknown = { userId }) =>
	new NextRequest("https://web.test/api/internal/rooms/room-1/admission", {
		method: "POST",
		headers: {
			authorization: `Bearer ${secret}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
let calls: { path: string; body: unknown }[];
let decision: unknown;
let fail: boolean;
beforeEach(() => {
	Object.assign(process.env, {
		ANIDACHI_INTERNAL_API_SECRET: "rooms",
		ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET: "cutover",
		ANIDACHI_NOTIFICATION_DRAIN_SECRET: "notifications",
		NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
		SUPABASE_SERVICE_ROLE_KEY: "test-key",
	});
	calls = [];
	fail = false;
	decision = {
		roomId: "room-1",
		roomGeneration: 1,
		allowed: false,
		code: "HOST_SUBSCRIPTION_REQUIRED",
	};
	globalThis.fetch = async (input, init) => {
		const path = new URL(String(input)).pathname;
		calls.push({ path, body: JSON.parse(String(init?.body)) });
		if (fail)
			return Response.json({ message: "private diagnostic" }, { status: 500 });
		if (path.endsWith("check_room_hosting_socket_v1"))
			return Response.json(decision);
		if (path.endsWith("claim_room_hosting_cutover_v1"))
			return Response.json([]);
		throw new Error("Unexpected request");
	};
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	process.env = { ...originalEnv };
});
test("narrow scheduler credentials cannot check room authority", async () => {
	for (const secret of ["cutover", "notifications", "bad"])
		assert.equal((await admission(request(secret), context)).status, 401);
	assert.equal(calls.length, 0);
});
test("validates identity and returns database admission authority", async () => {
	assert.equal(
		(await admission(request("rooms", { userId: "bad" }), context)).status,
		400,
	);
	const response = await admission(request("rooms"), context);
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), decision);
	assert.deepEqual(calls[0].body, { p_room_id: "room-1", p_user_id: userId });
});
test("database failure and mismatched room produce temporary errors without private details", async () => {
	for (const databaseFailure of [true, false]) {
		fail = databaseFailure;
		decision = { roomId: "other", roomGeneration: 1, allowed: true };
		const response = await admission(request("rooms"), context);
		assert.equal(response.status, 503);
		assert.ok(!(await response.text()).includes("private diagnostic"));
	}
});
test("only dedicated cutover credential can drain; request body cannot select targets", async () => {
	for (const secret of ["rooms", "notifications", "bad"])
		assert.equal((await drainRoute(request(secret))).status, 401);
	assert.equal(calls.length, 0);
	const response = await drainRoute(
		request("cutover", { roomId: "injected", revision: 99 }),
	);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), '{"ok":true}');
	assert.deepEqual(calls, [
		{
			path: "/rest/v1/rpc/claim_room_hosting_cutover_v1",
			body: { p_limit: 4 },
		},
	]);
});
test("failed drain and missing dedicated secret never get a health acknowledgement", async () => {
	fail = true;
	assert.equal((await drainRoute(request("cutover"))).status, 503);
	delete process.env.ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET;
	assert.equal((await drainRoute(request("rooms"))).status, 401);
});
