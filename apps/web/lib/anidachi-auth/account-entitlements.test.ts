import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveAccountEntitlements,
	HistoryAccessError,
} from "./account-entitlements";

const owner = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-08T12:00:00Z");
function result(planCode = "plus") {
	return {
		planCode,
		selectedPlanExpiresAt: "2026-09-08T12:01:00Z",
		paidUntil: "2026-09-08T12:01:00Z",
		history: {
			accessVersion: 1,
			ownerUserId: owner,
			accountGeneration: 3,
			accessEpoch: 4,
			youtubeConsentEpoch: 2,
			state: planCode === "free" ? "plan_required" : "allowed",
			serverTime: now.toISOString(),
			captureNotBefore: "2026-09-08T10:00:00Z",
			validUntil: "2026-09-08T12:01:00Z",
			youtubeHistoryEnabled: true,
		},
	};
}
test("durable authority resolves Free/Plus/Pro without JWT plan claims", async () => {
	for (const plan of ["free", "plus", "pro"]) {
		const resolved = await resolveAccountEntitlements(owner, now, async () =>
			result(plan),
		);
		assert.equal(resolved.policy.planCode, plan);
		assert.equal(
			resolved.history.state,
			plan === "free" ? "plan_required" : "allowed",
		);
	}
});
test("unknown, missing, mismatched or unavailable authority never becomes Free", async () => {
	for (const value of [
		null,
		{},
		result("unknown"),
		{
			...result(),
			history: {
				...result().history,
				ownerUserId: "22222222-2222-4222-8222-222222222222",
			},
		},
	]) {
		await assert.rejects(
			resolveAccountEntitlements(owner, now, async () => value),
			HistoryAccessError,
		);
	}
	await assert.rejects(
		resolveAccountEntitlements(owner, now, async () => {
			throw new Error("DB offline");
		}),
		{ status: 503, code: "HISTORY_ACCESS_UNAVAILABLE" },
	);
});
test("paid issuance rejects expired/overlong paid leases and inconsistent plan state", async () => {
	for (const value of [
		{ ...result(), paidUntil: "2026-09-08T11:59:59Z" },
		{ ...result(), paidUntil: "2026-09-08T12:00:30Z" },
		{ ...result("free"), history: result().history },
		{
			...result(),
			history: { ...result().history, validUntil: "2026-09-08T12:06:00Z" },
		},
	])
		await assert.rejects(
			resolveAccountEntitlements(owner, now, async () => value),
			HistoryAccessError,
		);
});

import { NextRequest } from "next/server";
import { createAccountAccessHandlers } from "./watch-history-access";
import type { ApiSession } from "./api-session";
const session: ApiSession = {
	userId: owner,
	email: "fixture@example.test",
	plan: "pro",
	source: "extension",
};
function request(headers: Record<string, string> = {}) {
	return new NextRequest("https://anidachi.test/api/watch-history/v3/access", {
		headers,
	});
}
test("access and entitlements bind authenticated owner, ignore stale JWT, and disable caching", async () => {
	const handlers = createAccountAccessHandlers({
		getSession: async () => session,
		resolve: (id, date) =>
			resolveAccountEntitlements(id, date, async () => result("free")),
	});
	const access = await handlers.getAccess(request());
	assert.equal(access.status, 200);
	assert.match(access.headers.get("cache-control")!, /private, no-store/);
	assert.equal((await access.json()).state, "plan_required");
	const metadata = await handlers.getEntitlements(request());
	const body = await metadata.json();
	assert.equal(body.planCode, "free");
	assert.equal(body.ownerUserId, owner);
	assert.equal(body.entitlementsVersion, 1);
	assert.equal("historyRetentionDays" in body.entitlements.account, false);
	assert.equal("maxActiveTrackedTitles" in body.entitlements.account, false);
	assert.equal(body.policy.historyEnabled, false);
});
test("unauthorized and owner mismatch short circuit; outages return 503 not Free", async () => {
	let called = false;
	const mismatch = createAccountAccessHandlers({
		getSession: async () => session,
		resolve: async () => {
			called = true;
			throw new Error("offline");
		},
	});
	assert.equal(
		(await mismatch.getAccess(request({ "x-anidachi-history-owner": "other" })))
			.status,
		409,
	);
	assert.equal(called, false);
	const unavailable = await mismatch.getAccess(request());
	assert.equal(unavailable.status, 503);
	assert.equal((await unavailable.json()).code, "HISTORY_ACCESS_UNAVAILABLE");
	assert.match(unavailable.headers.get("cache-control")!, /no-store/);
	const unauth = createAccountAccessHandlers({
		getSession: async () => null,
		resolve: async () => {
			throw new Error("must not run");
		},
	});
	assert.equal((await unauth.getAccess(request())).status, 401);
});

test("personal access preflight returns authority or typed plan/unavailable errors", async () => {
	const { requirePersonalHistoryAccess } = await import(
		"./watch-history-access"
	);
	const free = (id: string, date: Date) =>
		resolveAccountEntitlements(id, date, async () => result("free"));
	await assert.rejects(requirePersonalHistoryAccess(owner, now, free), {
		status: 403,
		code: "HISTORY_PLAN_REQUIRED",
	});
	const paid = (id: string, date: Date) =>
		resolveAccountEntitlements(id, date, async () => result("pro"));
	assert.equal(
		(await requirePersonalHistoryAccess(owner, now, paid)).policy.planCode,
		"pro",
	);
	await assert.rejects(
		requirePersonalHistoryAccess(owner, now, async () => {
			throw new HistoryAccessError("HISTORY_ACCESS_UNAVAILABLE", 503);
		}),
		{ status: 503, code: "HISTORY_ACCESS_UNAVAILABLE" },
	);
});

test("both account endpoints select verified bearer before another account cookie and preserve fallback", async () => {
	const { signExtensionAccessToken } = await import("./extension-session");
	const oldSecret = process.env.ANIDACHI_JWT_SECRET;
	process.env.ANIDACHI_JWT_SECRET = "task2-dual-credential-test-only-secret";
	try {
		const bearerOwner = "22222222-2222-4222-8222-222222222222";
		const bearer = await signExtensionAccessToken({
			sub: bearerOwner,
			email: "bearer@example.test",
			plan: "pro",
		});
		let cookieReads = 0;
		let resolved: string[] = [];
		let cookiePresent = true;
		// Run the factory's actual default credential-selection path. Only the
		// Next request-scoped cookie reader is injected; bearer parsing/JWT verification are real.
		const handlers = createAccountAccessHandlers({
			getCookieSession: async () => {
				cookieReads++;
				return cookiePresent
					? {
							userId: owner,
							email: "cookie@example.test",
							plan: "free" as const,
						}
					: null;
			},
			resolve: (id, date) => {
				resolved.push(id);
				const value = result(id === bearerOwner ? "plus" : "free");
				return resolveAccountEntitlements(id, date, async () => ({
					...value,
					history: { ...value.history, ownerUserId: id },
				}));
			},
		});
		const fallbackHeaders: Record<string, string>[] = [
			{},
			{ authorization: "Bearer invalid-token" },
			{ authorization: "Basic invalid" },
		];
		for (const handler of [handlers.getAccess, handlers.getEntitlements]) {
			const readsBeforeBearer = cookieReads;
			const response = await handler(
				request({
					authorization: `Bearer ${bearer}`,
					cookie: "anidachi_access=cookie-for-a",
				}),
			);
			assert.equal(response.status, 200);
			assert.equal((await response.json()).ownerUserId, bearerOwner);
			assert.equal(
				cookieReads,
				readsBeforeBearer,
				"valid bearer must not consult the conflicting cookie",
			);
			assert.equal(resolved.at(-1), bearerOwner);
			const calls = resolved.length;
			const mismatch = await handler(
				request({
					authorization: `Bearer ${bearer}`,
					"x-anidachi-history-owner": owner,
				}),
			);
			assert.equal(mismatch.status, 409);
			assert.equal(
				resolved.length,
				calls,
				"owner-intent mismatch fails before entitlement resolution",
			);
			for (const headers of fallbackHeaders) {
				const fallback = await handler(request(headers));
				assert.equal(fallback.status, 200);
				assert.equal((await fallback.json()).ownerUserId, owner);
			}
		}
		assert.equal(cookieReads, 6);
		cookiePresent = false;
		resolved = [];
		for (const handler of [handlers.getAccess, handlers.getEntitlements]) {
			for (const headers of fallbackHeaders.slice(0, 2)) {
				assert.equal((await handler(request(headers))).status, 401);
			}
		}
		assert.deepEqual(resolved, []);
	} finally {
		if (oldSecret === undefined) delete process.env.ANIDACHI_JWT_SECRET;
		else process.env.ANIDACHI_JWT_SECRET = oldSecret;
	}
});
