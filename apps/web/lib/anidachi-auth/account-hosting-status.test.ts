import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { ACCOUNT_HOSTING_OWNER_HEADER } from "@anidachi/protocol";
import {
	createAccountHostingStatusHandler,
	readLiveFree20Status,
} from "./account-hosting-status";

const owner = "f6250000-0000-4000-8000-000000000001";
const at = Date.parse("2026-10-31T12:00:00Z");
const iso = (time: number) => new Date(time).toISOString();
function authority() {
	return {
		enabled: true,
		ownerUserId: owner,
		planCode: "free",
		serverTime: iso(at),
		refreshBy: iso(at + 300_000),
		resetAt: "2026-11-01T00:00:00.000Z",
		accountGeneration: 1,
		accessEpoch: 1,
		committedSeconds: 420,
		grant: null,
		assignment: null,
	};
}
function assigned(role = "host") {
	return {
		roomId: "status-room",
		roomGeneration: 1,
		role,
		sessionId: "tab-a",
		hostingTimeMode: "daily_free20",
		status: "live",
		hostUserId:
			role === "host" ? owner : "f6250000-0000-4000-8000-000000000002",
	};
}
function live() {
	return {
		liveStatusVersion: 1,
		ownerUserId: owner,
		roomId: "status-room",
		roomGeneration: 1,
		utcDay: "2026-10-31",
		serverTime: at + 180_000,
		validUntil: at + 300_000,
		access: {
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 600,
			remainingSeconds: 600,
			metering: true,
		},
	};
}
type Overrides = Partial<
	Parameters<typeof createAccountHostingStatusHandler>[0]
>;
function fixture(value: unknown = authority(), overrides: Overrides = {}) {
	const calls = { sql: 0, worker: 0 };
	const handler = createAccountHostingStatusHandler({
		getSession: async () => ({
			userId: owner,
			email: "status@example.test",
			plan: "free",
			source: "cookie",
		}),
		enabled: () => true,
		readAuthority: async (userId) => {
			assert.equal(userId, owner);
			calls.sql++;
			return value;
		},
		readLive: async (input) => {
			assert.deepEqual(input, {
				ownerUserId: owner,
				roomId: "status-room",
				roomGeneration: 1,
			});
			calls.worker++;
			return live();
		},
		clock: () => 0,
		...overrides,
	});
	return {
		calls,
		request: (expectedOwner: string | null = owner) =>
			handler(
				new NextRequest("https://web.example.test/api/me/hosting-status", {
					headers:
						expectedOwner === null
							? {}
							: { [ACCOUNT_HOSTING_OWNER_HEADER]: expectedOwner },
				}),
			),
	};
}
test("idle Free20 reads once and distinguishes available from exhausted", async () => {
	for (const [used, remaining, canCreate] of [
		[420, 780, true],
		[1200, 0, false],
		[1400, 0, false],
	] as const) {
		const f = fixture({ ...authority(), committedSeconds: used });
		const response = await f.request();
		const body = await response.json();
		assert.equal(response.status, 200);
		assert.equal(body.access.remainingSeconds, remaining);
		assert.equal(body.canCreateRoom, canCreate);
		assert.equal(body.access.usedSeconds + remaining, 1200);
		assert.deepEqual(f.calls, { sql: 1, worker: 0 });
		assert.match(
			response.headers.get("cache-control") ?? "",
			/private, no-store/,
		);
	}
});
test("confirmed paid, old-trial and manual rights keep their exact source and expiry", async () => {
	for (const source of ["paid", "trial", "manual"]) {
		const f = fixture({
			...authority(),
			planCode: "plus",
			grant: {
				source,
				validUntil: source === "manual" ? null : iso(at + 3_600_000),
			},
		});
		const response = await f.request();
		const body = await response.json();
		assert.equal(response.status, 200);
		assert.equal(body.access.kind, "confirmed_unlimited");
		assert.equal(body.access.source, source);
		assert.equal(body.canCreateRoom, true);
		assert.equal(f.calls.worker, 0);
	}
});
test("a hosted room reads the live 10-minute remainder, rechecks its identity and prevents a second room", async () => {
	const f = fixture({ ...authority(), assignment: assigned() });
	const response = await f.request();
	const body = await response.json();
	assert.equal(response.status, 200);
	assert.equal(body.access.remainingSeconds, 600);
	assert.equal(body.serverTime, at + 180_000);
	assert.equal(body.canCreateRoom, false);
	assert.deepEqual(f.calls, { sql: 2, worker: 1 });
});
test("being a guest blocks another assignment but does not spend the guest's hosting budget", async () => {
	const f = fixture({ ...authority(), assignment: assigned("member") });
	const response = await f.request();
	const body = await response.json();
	assert.equal(response.status, 200);
	assert.equal(body.access.remainingSeconds, 780);
	assert.equal(body.canCreateRoom, false);
	assert.equal(f.calls.worker, 0);
});
test("auth, owner and disabled gates do no authority or Worker work", async () => {
	for (const [overrides, expectedOwner, status] of [
		[{ getSession: async () => null }, owner, 401],
		[{}, null, 409],
		[{}, "other", 409],
		[{ enabled: () => false }, owner, 404],
	] as const) {
		const f = fixture(authority(), overrides);
		assert.equal((await f.request(expectedOwner)).status, status);
		assert.deepEqual(f.calls, { sql: 0, worker: 0 });
	}
	const f = fixture({ enabled: false });
	assert.equal((await f.request()).status, 404);
});
test("malformed, missing and stale authority is unavailable, never zero or unlimited", async () => {
	for (const bad of [
		null,
		{},
		{ ...authority(), ownerUserId: "f6250000-0000-4000-8000-000000000002" },
		{ ...authority(), committedSeconds: -1 },
		{ ...authority(), refreshBy: iso(at) },
		{ ...authority(), resetAt: iso(at + 3_600_000) },
		{ ...authority(), planCode: "pro" },
		{
			...authority(),
			planCode: "plus",
			grant: { source: "paid", validUntil: null },
		},
		{ ...authority(), assignment: { ...assigned(), hostingTimeMode: null } },
		{ ...authority(), assignment: { ...assigned(), status: "ended" } },
	]) {
		const response = await fixture(bad).request();
		assert.equal(response.status, 503);
		const body = await response.json();
		assert.equal(body.code, "HOSTING_STATUS_UNAVAILABLE");
		assert.equal("access" in body, false);
	}
});
test("lost Worker results and mismatched snapshots cannot fall back to committed usage", async () => {
	for (const readLive of [
		async () => {
			throw new Error("timeout");
		},
		async () => null,
		async () => ({ ...live(), roomId: "other-room" }),
		async () => ({
			...live(),
			ownerUserId: "f6250000-0000-4000-8000-000000000002",
		}),
		async () => ({ ...live(), utcDay: "2026-10-30" }),
	])
		assert.equal(
			(
				await fixture(
					{ ...authority(), assignment: assigned() },
					{ readLive },
				).request()
			).status,
			503,
		);
});
test("account, grant and assignment changes during a live read invalidate the response", async () => {
	for (const changed of [
		{ assignment: null },
		{ assignment: { ...assigned(), sessionId: "tab-b" } },
		{ accessEpoch: 2 },
		{ accountGeneration: 2 },
		{
			planCode: "plus",
			grant: { source: "paid", validUntil: iso(at + 3_600_000) },
		},
		{ enabled: false },
	]) {
		let reads = 0;
		const f = fixture(null, {
			readAuthority: async () =>
				++reads === 1
					? { ...authority(), assignment: assigned() }
					: { ...authority(), assignment: assigned(), ...changed },
		});
		assert.equal((await f.request()).status, 503);
	}
});
test("authority expiring while the response is assembled cannot be published", async () => {
	let elapsed = 0;
	const f = fixture(null, {
		clock: () => elapsed,
		readAuthority: async () => {
			elapsed = 2000;
			return { ...authority(), refreshBy: iso(at + 1000) };
		},
	});
	assert.equal((await f.request()).status, 503);
});

test("the Worker transport authenticates, never caches or follows redirects, and bounds lost reads", async (t) => {
	const previousBase = process.env.ANIDACHI_API_INTERNAL_BASE_URL;
	const previousSecret = process.env.ANIDACHI_INTERNAL_API_SECRET;
	t.after(() => {
		for (const [key, value] of [
			["ANIDACHI_API_INTERNAL_BASE_URL", previousBase],
			["ANIDACHI_INTERNAL_API_SECRET", previousSecret],
		]) {
			if (value === undefined) delete process.env[key!];
			else process.env[key!] = value;
		}
	});
	process.env.ANIDACHI_API_INTERNAL_BASE_URL = "https://worker.example.test";
	process.env.ANIDACHI_INTERNAL_API_SECRET = "synthetic-test-secret";
	const input = {
		ownerUserId: owner,
		roomId: "status-room",
		roomGeneration: 1,
	};
	let reply = new Response(JSON.stringify(live()), { status: 200 });
	let offline = false;
	const fetcher = t.mock.method(
		globalThis,
		"fetch",
		async (url: URL | RequestInfo, init?: RequestInit) => {
			assert.equal(
				String(url),
				"https://worker.example.test/internal/rooms/status-room/free20-status",
			);
			assert.equal(init?.method, "POST");
			assert.equal(init?.cache, "no-store");
			assert.equal(init?.redirect, "error");
			assert.equal(
				new Headers(init?.headers).get("authorization"),
				"Bearer synthetic-test-secret",
			);
			assert.deepEqual(JSON.parse(String(init?.body)), input);
			assert.ok(init?.signal instanceof AbortSignal);
			if (offline) throw new DOMException("Timed out", "TimeoutError");
			return reply;
		},
	);
	assert.deepEqual(await readLiveFree20Status(input), live());
	for (const status of [302, 401, 404, 500, 503]) {
		reply = new Response("unavailable", { status });
		await assert.rejects(readLiveFree20Status(input));
	}
	reply = new Response("malformed", { status: 200 });
	await assert.rejects(readLiveFree20Status(input));
	offline = true;
	await assert.rejects(readLiveFree20Status(input), { name: "TimeoutError" });
	delete process.env.ANIDACHI_INTERNAL_API_SECRET;
	const before = fetcher.mock.callCount();
	await assert.rejects(readLiveFree20Status(input), /not configured/);
	assert.equal(fetcher.mock.callCount(), before);
});
