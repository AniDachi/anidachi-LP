import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { ACCOUNT_HOSTING_OWNER_HEADER } from "@anidachi/protocol";
import {
	createFree20WarningHandler,
	claimFree20Warning,
} from "./free20-warning";
const owner = "f6260000-0000-4000-8000-000000000001";
const at = Date.parse("2026-11-01T12:00:00Z");
const iso = (n: number) => new Date(n).toISOString();
const body = {
	hostingWarningVersion: 1,
	roomId: "warning-room",
	roomGeneration: 1,
	utcDay: "2026-11-01",
};
function authority() {
	return {
		enabled: true,
		ownerUserId: owner,
		planCode: "free",
		serverTime: iso(at),
		refreshBy: iso(at + 300000),
		resetAt: "2026-11-02T00:00:00.000Z",
		accountGeneration: 1,
		accessEpoch: 1,
		committedSeconds: 800,
		grant: null,
		assignment: {
			roomId: body.roomId,
			roomGeneration: 1,
			role: "host",
			sessionId: "tab-a",
			hostingTimeMode: "daily_free20",
			status: "live",
			hostUserId: owner,
		},
	};
}
function live(remainingSeconds = 300, metering = false) {
	return {
		liveStatusVersion: 1,
		ownerUserId: owner,
		roomId: body.roomId,
		roomGeneration: 1,
		utcDay: body.utcDay,
		serverTime: at,
		validUntil: at + 300000,
		access: {
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 1200 - remainingSeconds,
			remainingSeconds,
			metering,
		},
	};
}
const reply = (decision = "show") => ({
	...body,
	ownerUserId: owner,
	decision,
	serverTime: at,
	validUntil: at + 10000,
	...(decision === "show"
		? { thresholdSeconds: 300, claimId: "f6260000-0000-4000-8000-000000000002" }
		: {}),
});
type Overrides = Partial<Parameters<typeof createFree20WarningHandler>[0]>;
function fixture(overrides: Overrides = {}) {
	const calls = { authority: 0, live: 0, claim: 0 };
	const handler = createFree20WarningHandler({
		getSession: async () => ({
			userId: owner,
			email: "fixture@example.test",
			plan: "free",
			source: "cookie",
		}),
		enabled: () => true,
		clock: () => 0,
		readAuthority: async () => {
			calls.authority++;
			return authority();
		},
		readLive: async () => {
			calls.live++;
			return live();
		},
		claim: async (user, context, measurement) => {
			calls.claim++;
			assert.equal(user, owner);
			assert.equal(context.serverTime, at);
			assert.equal(context.assignment.sessionId, "tab-a");
			assert.equal("committedSeconds" in context, false);
			assert.equal(measurement.access.remainingSeconds, 300);
			return reply();
		},
		...overrides,
	});
	return {
		calls,
		request: (value: unknown = body, header: string | null = owner) =>
			handler(
				new NextRequest(
					"https://web.example.test/api/me/hosting-warning/claim",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...(header === null
								? {}
								: { [ACCOUNT_HOSTING_OWNER_HEADER]: header }),
						},
						body: typeof value === "string" ? value : JSON.stringify(value),
					},
				),
			),
	};
}
test("auth, owner and disabled gates perform no downstream work", async () => {
	for (const [overrides, header, status] of [
		[{ getSession: async () => null }, owner, 401],
		[{}, null, 409],
		[{}, "other", 409],
		[{ enabled: () => false }, owner, 404],
	] as const) {
		const f = fixture(overrides);
		const r = await f.request(body, header);
		assert.equal(r.status, status);
		assert.deepEqual(f.calls, { authority: 0, live: 0, claim: 0 });
		assert.equal(r.headers.get("cache-control"), "private, no-store");
		assert.equal(
			r.headers.get("vary"),
			"Cookie, Authorization, x-anidachi-hosting-owner",
		);
	}
});
test("strict bounded JSON rejects client authority before reads", async () => {
	for (const value of [
		"{",
		" ".repeat(1025),
		{},
		{ ...body, remainingSeconds: 1 },
		{ ...body, ownerUserId: owner },
		{ ...body, roomGeneration: 0 },
		{ ...body, utcDay: "2026-02-30" },
	]) {
		const f = fixture();
		assert.equal((await f.request(value)).status, 400);
		assert.equal(f.calls.authority, 0);
	}
});
test("show consumes the existing DO total once and normalized authority fences", async () => {
	const f = fixture();
	const r = await f.request();
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), reply());
	assert.deepEqual(f.calls, { authority: 1, live: 1, claim: 1 });
});
test("301 and zero are authoritative ineligible; 300 and one can claim including host alone", async () => {
	for (const n of [301, 300, 1, 0]) {
		let claims = 0;
		const r = await fixture({
			readLive: async () => live(n),
			claim: async () => {
				claims++;
				return reply();
			},
		}).request();
		assert.equal(r.status, 200);
		assert.equal(
			(await r.json()).decision,
			n > 0 && n <= 300 ? "show" : "not_eligible",
		);
		assert.equal(claims, n > 0 && n <= 300 ? 1 : 0);
	}
});
test("paid, guest, ended, no-host and legacy observations create no marker", async () => {
	for (const change of [
		{
			planCode: "plus",
			grant: { source: "paid", validUntil: iso(at + 3600000) },
		},
		{ assignment: null },
		{
			assignment: {
				...authority().assignment,
				role: "member",
				hostUserId: "f6260000-0000-4000-8000-000000000009",
			},
		},
		{ assignment: { ...authority().assignment, status: "ended" } },
		{ assignment: { ...authority().assignment, hostingTimeMode: null } },
	]) {
		const f = fixture({
			readAuthority: async () => ({ ...authority(), ...change }),
		});
		const r = await f.request();
		assert.equal(r.status, 200);
		assert.equal((await r.json()).decision, "not_eligible");
		assert.equal(f.calls.live, 0);
		assert.equal(f.calls.claim, 0);
	}
});
test("requested room/generation/day mismatch is context conflict", async () => {
	for (const change of [
		{ roomId: "other" },
		{ roomGeneration: 2 },
		{ utcDay: "2026-10-31" },
	]) {
		const f = fixture();
		assert.equal((await f.request({ ...body, ...change })).status, 409);
		assert.equal(f.calls.live, 0);
		assert.equal(f.calls.claim, 0);
	}
});
test("unknown, malformed, pending and stale upstream cannot become a successful fallback", async () => {
	for (const raw of [
		null,
		{},
		{ ...authority(), grant: {} },
		{ ...authority(), refreshBy: iso(at) },
	])
		assert.equal(
			(await fixture({ readAuthority: async () => raw }).request()).status,
			503,
		);
	for (const raw of [
		null,
		{ pending: true },
		{ ...live(), roomId: "other" },
		{ ...live(), roomGeneration: 2 },
		{ ...live(), ownerUserId: "f6260000-0000-4000-8000-000000000009" },
		{ ...live(), utcDay: "2026-10-31" },
		{ ...live(), serverTime: at - 1 },
		{ ...live(), validUntil: at },
		{ ...live(), access: { ...live().access, remainingSeconds: NaN } },
	])
		assert.equal(
			(await fixture({ readLive: async () => raw }).request()).status,
			503,
		);
	for (const key of ["readAuthority", "readLive", "claim"] as const)
		assert.equal(
			(
				await fixture({
					[key]: async () => {
						throw new Error("offline");
					},
				}).request()
			).status,
			503,
		);
	assert.equal(
		(
			await fixture({
				readAuthority: async () => ({ enabled: false }),
			}).request()
		).status,
		404,
	);
});
test("claim replies enforce exact binding, union and short-lived authorization", async () => {
	for (const change of [
		{ roomId: "other" },
		{ utcDay: "2026-10-31" },
		{ ownerUserId: "f6260000-0000-4000-8000-000000000009" },
		{ validUntil: at + 10001 },
		{ claimId: undefined },
		{ decision: "unknown" },
	])
		assert.equal(
			(
				await fixture({
					claim: async () => ({ ...reply(), ...change }),
				}).request()
			).status,
			503,
		);
	for (const decision of ["already_claimed", "not_eligible"]) {
		const r = await fixture({ claim: async () => reply(decision) }).request();
		assert.equal(r.status, 200);
		assert.equal((await r.json()).decision, decision);
	}
});
test("monotonic elapsed bounds expiry and never publishes an expired claim", async () => {
	let elapsed = 0;
	const f = fixture({
		clock: () => elapsed,
		claim: async () => {
			elapsed = 2000;
			return reply();
		},
	});
	const r = await f.request();
	assert.equal(r.status, 200);
	assert.equal((await r.json()).validUntil, at + 8000);
	for (const delay of [10000, NaN, -1]) {
		elapsed = 0;
		const r = await fixture({
			clock: () => elapsed,
			claim: async () => {
				elapsed = delay;
				return reply();
			},
		}).request();
		assert.equal(r.status, 503);
	}
});
test("fresh Free accounts with accessEpoch zero can claim", async () => {
	const response = await fixture({
		readAuthority: async () => ({ ...authority(), accessEpoch: 0 }),
	}).request();
	assert.equal(response.status, 200);
});

test("claim transport preserves context errors, disabled policy and uncertainty", async (t) => {
	const saved = {
		url: process.env.NEXT_PUBLIC_SUPABASE_URL,
		key: process.env.SUPABASE_SERVICE_ROLE_KEY,
	};
	t.after(() => {
		if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
		if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
	});
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-key";
	let message = "HOSTING_WARNING_CONTEXT_CHANGED";
	t.mock.method(
		globalThis,
		"fetch",
		async (url: URL | RequestInfo, init?: RequestInit) => {
			assert.equal(
				String(url),
				"https://fixture.example.test/rest/v1/rpc/claim_free20_daily_warning_v1",
			);
			assert.equal(init?.method, "POST");
			assert.ok(init?.signal instanceof AbortSignal);
			const sent = JSON.parse(String(init?.body));
			assert.equal(sent.p_user_id, owner);
			assert.equal(sent.p_expected_context.assignment.sessionId, "tab-a");
			assert.equal(sent.p_live.access.remainingSeconds, 300);
			if (message === "timeout")
				throw new DOMException("Timed out", "TimeoutError");
			return new Response(
				JSON.stringify({ message, code: "P0001", details: null, hint: null }),
				{ status: 400 },
			);
		},
	);
	for (const [code, status] of [
		["HOSTING_WARNING_CONTEXT_CHANGED", 409],
		["FREE20_DISABLED", 404],
		["HOSTING_WARNING_UNAVAILABLE", 503],
		["timeout", 503],
	] as const) {
		message = code;
		const response = await fixture({ claim: claimFree20Warning }).request();
		assert.equal(response.status, status);
		assert.equal(
			(await response.json()).code,
			status === 503 ? "HOSTING_WARNING_UNAVAILABLE" : code,
		);
	}
});
test("metering exhaustion caps show and request latency can exhaust it", async () => {
	const measurement = live(1, true);
	for (const elapsed of [0, 1000]) {
		let clock = 0;
		const response = await fixture({
			readLive: async () => measurement,
			clock: () => clock,
			claim: async () => {
				clock = elapsed;
				return { ...reply(), validUntil: at + 1000 };
			},
		}).request();
		assert.equal(response.status, elapsed === 0 ? 200 : 503);
	}
	assert.equal(
		(
			await fixture({
				readLive: async () => measurement,
				claim: async () => reply(),
			}).request()
		).status,
		503,
	);
});
