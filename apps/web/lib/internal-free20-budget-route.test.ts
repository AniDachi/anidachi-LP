import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/internal/rooms/[roomId]/free20-budget/route";
import { verifyRoomToken } from "./anidachi-auth/jwt";
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const owner = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ roomId: "room-1" }) };
const request = (body: unknown, secret = "rooms") =>
	new NextRequest("https://web.test/api/internal/rooms/room-1/free20-budget", {
		method: "POST",
		headers: {
			authorization: `Bearer ${secret}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
let calls: string[];
let used: number;
let failAuthority: boolean;
let roomSeconds: number;
let now: number;
const input = () => ({
	roomId: "room-1",
	roomGeneration: 1,
	checkpointSequence: 1,
	usage: [{ day: new Date(now).toISOString().slice(0, 10), seconds: 180 }],
});
beforeEach(() => {
	Object.assign(process.env, {
		ANIDACHI_INTERNAL_API_SECRET: "rooms",
		NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
		SUPABASE_SERVICE_ROLE_KEY: "synthetic-key",
		ANIDACHI_JWT_SECRET: "synthetic-test-signing-secret",
	});
	delete process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED;
	calls = [];
	used = 420;
	roomSeconds = 0;
	failAuthority = false;
	now = Date.now();
	globalThis.fetch = async (url, init) => {
		const path = new URL(String(url)).pathname;
		calls.push(path);
		const body = init?.body ? JSON.parse(String(init.body)) : null;
		if (path.endsWith("/rooms"))
			return Response.json({
				room_id: "room-1",
				host_user_id: owner,
				host_plan_code: "free",
				status: "live",
				max_participants: 4,
				max_cameras: 4,
				max_microphones: 4,
			});
		if (path.endsWith("commit_room_usage_day_v1")) {
			const accepted = Math.max(roomSeconds, body.p_cumulative_seconds);
			used += accepted - roomSeconds;
			roomSeconds = accepted;
			return Response.json({ day: body.p_day, seconds: accepted });
		}
		if (path.endsWith("resolve_watch_history_access_v1")) {
			if (failAuthority)
				return Response.json({ message: "private detail" }, { status: 500 });
			return Response.json({
				planCode: "free",
				selectedPlanExpiresAt: null,
				paidUntil: null,
				hosting: {
					hostingPolicyVersion: 2,
					hostingActivationAt: "2026-09-28T00:00:00Z",
					canHost: false,
					trialEligibility: "eligible",
					trialEndsAt: null,
				},
				history: {
					accessVersion: 1,
					ownerUserId: owner,
					accountGeneration: 3,
					accessEpoch: 4,
					youtubeConsentEpoch: 2,
					state: "plan_required",
					serverTime: new Date(now).toISOString(),
					captureNotBefore: "2026-09-08T10:00:00Z",
					validUntil: new Date(now + 300000).toISOString(),
					youtubeHistoryEnabled: true,
				},
			});
		}
		if (path.endsWith("/usage_daily"))
			return Response.json({ host_seconds: used });
		if (path.endsWith("renew_room_media_lease_v3"))
			return Response.json({
				roomId: "room-1",
				roomGeneration: 1,
				issuedAt: new Date(now).toISOString(),
				paidUntil: null,
				capabilities: {
					mediaProtocolVersion: 3,
					hostPlanCode: "free",
					maxParticipants: 4,
					maxCameras: 4,
					maxMediaSeats: 4,
					capabilityRevision: 2,
					capabilitiesValidUntil: new Date(now + 1800000).toISOString(),
				},
			});
		throw new Error(`Unexpected database call ${path}`);
	};
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	process.env = { ...originalEnv };
});
test("requires room service auth and explicit server opt-in before any database access", async () => {
	assert.equal((await POST(request(input(), "wrong"), context)).status, 401);
	for (const flag of [undefined, "false", "1", "TRUE", " true "]) {
		if (flag === undefined)
			delete process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED;
		else process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = flag;
		assert.equal((await POST(request(input()), context)).status, 503);
	}
	assert.deepEqual(calls, []);
});
test("rejects mismatched route, unsupported generation, duplicate days and extra caller authority", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	for (const body of [
		{ ...input(), roomId: "other" },
		{ ...input(), roomGeneration: 2 },
		{ ...input(), ownerUserId: owner },
		{ ...input(), usage: [...input().usage, ...input().usage] },
	])
		assert.equal((await POST(request(body), context)).status, 400);
	assert.deepEqual(calls, []);
});
test("settles then reads account authority and signs the pinned lease without a legacy quota read", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	const response = await POST(request(input()), context);
	assert.equal(response.status, 200);
	const result = await response.json();
	assert.equal(result.checkpoint.committedSeconds, 600);
	assert.equal(result.checkpoint.ownerUserId, owner);
	assert.deepEqual(result.checkpoint.acknowledged, input().usage);
	assert.equal(calls.filter((p) => p.endsWith("/usage_daily")).length, 1);
	assert.ok(
		calls.findIndex((p) => p.endsWith("commit_room_usage_day_v1")) <
			calls.findIndex((p) => p.endsWith("resolve_watch_history_access_v1")),
	);
	const token = await verifyRoomToken(result.policy.roomToken);
	assert.equal(token?.hostUserId, owner);
	assert.equal(token?.mediaLease?.capabilities.hostPlanCode, "free");
	assert.equal("quota" in result.policy, false);
});
test("authority failure after commit returns no budget; a cumulative retry charges no duplicate seconds", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	failAuthority = true;
	const failed = await POST(request(input()), context);
	assert.equal(failed.status, 503);
	assert.equal((await failed.text()).includes("private detail"), false);
	assert.equal(used, 600);
	failAuthority = false;
	const retried = await POST(
		request({ ...input(), checkpointSequence: 2 }),
		context,
	);
	assert.equal(retried.status, 200);
	assert.equal((await retried.json()).checkpoint.committedSeconds, 600);
	assert.equal(used, 600);
});
