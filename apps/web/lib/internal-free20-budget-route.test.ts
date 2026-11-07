import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/internal/rooms/[roomId]/free20-budget/route";
import { verifyRoomToken } from "./anidachi-auth/jwt";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const owner = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ roomId: "room-1" }) };
const request = (body: unknown, secret = "rooms", displayVersion?: string) =>
	new NextRequest("https://web.test/api/internal/rooms/room-1/free20-budget", {
		method: "POST",
		headers: {
			authorization: `Bearer ${secret}`,
			"content-type": "application/json",
			...(displayVersion === undefined
				? {}
				: { "x-anidachi-hosting-time-version": displayVersion }),
		},
		body: JSON.stringify(body),
	});
let calls: string[];
let used: number;
let failAuthority: boolean;
let roomSeconds: number;
let now: number;
let accountPlan: "free" | "plus" | "pro";
let displayAuthority: unknown;
let denyPolicy: boolean;
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
	accountPlan = "free";
	displayAuthority = null;
	denyPolicy = false;
	globalThis.fetch = async (url, init) => {
		const path = new URL(String(url)).pathname;
		calls.push(path);
		const body = init?.body ? JSON.parse(String(init.body)) : null;
		if (path.endsWith("read_free20_account_status_v1")) {
			assert.equal(body.p_user_id, owner);
			if (displayAuthority instanceof Error)
				return Response.json(
					{ message: "private display detail" },
					{ status: 500 },
				);
			return Response.json(displayAuthority);
		}
		if (path.endsWith("/rooms"))
			return Response.json({
				room_id: "room-1",
				host_user_id: owner,
				host_plan_code: "free",
				hosting_time_mode: "daily_free20",
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
				planCode: accountPlan,
				selectedPlanExpiresAt: null,
				paidUntil: null,
				hosting: {
					hostingPolicyVersion: 2,
					hostingActivationAt: "2026-09-28T00:00:00Z",
					canHost: accountPlan !== "free",
					trialEligibility: accountPlan === "free" ? "eligible" : "unavailable",
					trialEndsAt: null,
				},
				history: {
					accessVersion: 1,
					ownerUserId: owner,
					accountGeneration: 3,
					accessEpoch: 4,
					youtubeConsentEpoch: 2,
					state: accountPlan === "free" ? "plan_required" : "allowed",
					serverTime: new Date(now).toISOString(),
					captureNotBefore: "2026-09-08T10:00:00Z",
					validUntil: new Date(now + 300000).toISOString(),
					youtubeHistoryEnabled: true,
				},
			});
		}
		if (path.endsWith("/usage_daily"))
			return Response.json({ host_seconds: used });
		if (path.endsWith("renew_room_media_lease_v3")) {
			if (denyPolicy)
				return Response.json({
					denied: true,
					closingAt: new Date(now + 5000).toISOString(),
				});
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
		}
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

test("confirmed account access removes only the time cap after settlement and retains the signed Free media capabilities", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	for (const plan of ["plus", "pro"] as const) {
		accountPlan = plan;
		const response = await POST(request(input()), context);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.checkpoint.kind, "confirmed_unlimited");
		assert.equal(body.checkpoint.authority, "account_entitlements_v1");
		assert.equal(body.checkpoint.planCode, plan);
		assert.equal(
			body.checkpoint.refreshBy,
			Math.min(now + 300000, (Math.floor(now / 86400000) + 1) * 86400000),
		);
		assert.deepEqual(body.checkpoint.acknowledged, input().usage);
		assert.equal(used, 600);
		assert.equal(
			calls.some((p) => p.endsWith("/usage_daily")),
			false,
		);
		const token = await verifyRoomToken(body.policy.roomToken);
		assert.equal(token?.mediaLease?.capabilities.hostPlanCode, "free");
		assert.equal(token?.mediaLease?.capabilities.maxParticipants, 4);
	}
});

function displaySource(source: "paid" | "trial" | "manual") {
	const resetAt = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
	return {
		enabled: true,
		ownerUserId: owner,
		planCode: accountPlan,
		serverTime: new Date(now).toISOString(),
		refreshBy: new Date(Math.min(now + 60_000, resetAt)).toISOString(),
		resetAt: new Date(resetAt).toISOString(),
		accountGeneration: 1,
		accessEpoch: 1,
		committedSeconds: 600,
		grant: {
			source,
			validUntil:
				source === "manual" ? null : new Date(now + 120_000).toISOString(),
		},
		assignment: {
			roomId: "room-1",
			roomGeneration: 1,
			role: "host",
			sessionId: "host-tab",
			hostingTimeMode: "daily_free20",
			status: "live",
			hostUserId: owner,
		},
	};
}
test("explicit display negotiation retains the actual paid, trial and manual source without changing accounting", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	accountPlan = "plus";
	for (const source of ["paid", "trial", "manual"] as const) {
		displayAuthority = displaySource(source);
		const response = await POST(request(input(), "rooms", "1"), context);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.deepEqual(body.displayTime, {
			access: {
				kind: "confirmed_unlimited",
				source,
				validUntil: source === "manual" ? null : now + 120_000,
			},
			validUntil: Math.min(now + 60_000, body.checkpoint.refreshBy),
		});
		assert.equal("source" in body.checkpoint, false);
		assert.equal(used, 600);
	}
	assert.equal(
		calls.filter((path) => path.endsWith("read_free20_account_status_v1"))
			.length,
		3,
	);
});
test("old, unknown-version, finite and denied requests never add a display read or response field", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	accountPlan = "plus";
	displayAuthority = displaySource("paid");
	for (const version of [undefined, "0", "2", "01", "1, 2"]) {
		const response = await POST(request(input(), "rooms", version), context);
		assert.equal(response.status, 200);
		assert.deepEqual(Object.keys(await response.json()), [
			"checkpoint",
			"policy",
		]);
	}
	accountPlan = "free";
	assert.deepEqual(
		Object.keys(
			await (await POST(request(input(), "rooms", "1"), context)).json(),
		),
		["checkpoint", "policy"],
	);
	accountPlan = "plus";
	denyPolicy = true;
	const denied = await POST(request(input(), "rooms", "1"), context);
	assert.equal(denied.status, 200);
	assert.deepEqual(Object.keys(await denied.json()), ["checkpoint", "policy"]);
	assert.equal(
		calls.some((path) => path.endsWith("read_free20_account_status_v1")),
		false,
	);
});
test("missing, expired or mismatched display provenance never turns an accounted paid room into 503", async () => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	accountPlan = "plus";
	const source = displaySource("paid");
	for (const invalid of [
		null,
		{ enabled: false },
		new Error("unavailable"),
		{ ...source, grant: null },
		{ ...source, ownerUserId: "22222222-2222-4222-8222-222222222222" },
		{ ...source, planCode: "pro" },
		{
			...source,
			grant: { source: "paid", validUntil: new Date(now).toISOString() },
		},
		{ ...source, assignment: { ...source.assignment, roomId: "other-room" } },
	]) {
		displayAuthority = invalid;
		const response = await POST(request(input(), "rooms", "1"), context);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.deepEqual(Object.keys(body), ["checkpoint", "policy"]);
		assert.equal(body.checkpoint.kind, "confirmed_unlimited");
		assert.equal(used, 600);
	}
});

test("slow accounting or an invalid elapsed clock skips optional display work and returns the settled response", async (t) => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	accountPlan = "plus";
	displayAuthority = displaySource("paid");
	const databaseFetch = globalThis.fetch;
	let elapsed = 0;
	let accountingDuration = 0;
	t.mock.method(performance, "now", () => elapsed);
	globalThis.fetch = async (url, init) => {
		if (new URL(String(url)).pathname.endsWith("renew_room_media_lease_v3"))
			elapsed = accountingDuration;
		return databaseFetch(url, init);
	};
	for (const duration of [5001, 7000, 8000, Number.NaN, Infinity, -1]) {
		elapsed = 0;
		accountingDuration = duration;
		calls.length = 0;
		const response = await POST(request(input(), "rooms", "1"), context);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.deepEqual(Object.keys(body), ["checkpoint", "policy"]);
		assert.equal(body.checkpoint.kind, "confirmed_unlimited");
		assert.deepEqual(body.checkpoint.acknowledged, input().usage);
		assert.equal(used, 600);
		assert.equal(
			calls.some((path) => path.endsWith("read_free20_account_status_v1")),
			false,
		);
	}
});

test("accounting within five seconds can still use the existing bounded display read", async (t) => {
	process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED = "true";
	accountPlan = "plus";
	displayAuthority = displaySource("trial");
	const databaseFetch = globalThis.fetch;
	let elapsed = 0;
	let accountingDuration = 0;
	t.mock.method(performance, "now", () => elapsed);
	globalThis.fetch = async (url, init) => {
		if (new URL(String(url)).pathname.endsWith("renew_room_media_lease_v3"))
			elapsed = accountingDuration;
		return databaseFetch(url, init);
	};
	for (const duration of [0, 4999, 5000]) {
		elapsed = 0;
		accountingDuration = duration;
		calls.length = 0;
		const response = await POST(request(input(), "rooms", "1"), context);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.displayTime.access.source, "trial");
		assert.equal(
			calls.filter((path) => path.endsWith("read_free20_account_status_v1"))
				.length,
			1,
		);
	}
});
