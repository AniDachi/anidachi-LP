import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { UninstallError } from "./uninstall-offer";
import { createUninstallHandlers } from "./uninstall-routes";

const owner = "11111111-1111-4111-8111-111111111111";
const origin = "https://staging.anidachi.test";
const input = {
	submissionId: owner,
	reason: "technical_issues",
	note: "Video stopped",
};
function request(body: unknown, headers: Record<string, string> = {}) {
	return new NextRequest(origin + "/api/uninstall/feedback", {
		method: "POST",
		headers: { origin, "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}
test("anonymous GET requires no Stripe config and is private/noindex", async () => {
	const h = createUninstallHandlers({ getUser: async () => null });
	const r = await h.offer(new NextRequest(origin + "/api/uninstall/offer"));
	assert.equal(r.status, 200);
	assert.equal((await r.json()).ownerUserId, null);
	assert.match(r.headers.get("cache-control") ?? "", /no-store/);
	assert.match(r.headers.get("x-robots-tag") ?? "", /noindex/);
});
test("feedback is independent of login and offer state and returns verified storage result", async () => {
	let calls = 0;
	const h = createUninstallHandlers({
		getUser: async () => null,
		actorHash: () => "a".repeat(64),
		feedback: async (body, userId, hash) => {
			calls++;
			assert.deepEqual(body, input);
			assert.equal(userId, null);
			assert.equal(hash.length, 64);
			return { saved: true };
		},
	});
	assert.deepEqual(await (await h.feedback(request(input))).json(), {
		saved: true,
	});
	assert.equal(calls, 1);
});
test("foreign-origin, cross-site and invalid JSON content type cannot write feedback", async () => {
	let calls = 0;
	const h = createUninstallHandlers({
		getUser: async () => null,
		feedback: async () => {
			calls++;
			return { saved: true };
		},
	});
	const headerCases: Record<string, string>[] = [
		{ origin: "https://foreign.test" },
		{ "sec-fetch-site": "cross-site" },
		{ "content-type": "text/plain" },
	];
	for (const headers of headerCases)
		assert.equal((await h.feedback(request(input, headers))).status, 403);
	assert.equal(calls, 0);
});
test("oversize body, invalid UUID/reason/note and browser Stripe IDs rejected before storage", async () => {
	let calls = 0;
	const h = createUninstallHandlers({
		getUser: async () => null,
		feedback: async () => {
			calls++;
			return { saved: true };
		},
	});
	for (const invalid of [
		{ ...input, submissionId: "bad" },
		{ ...input, reason: "bad" },
		{ ...input, note: "x".repeat(501) },
		{ ...input, couponId: "coupon" },
	])
		assert.equal((await h.feedback(request(invalid))).status, 400);
	assert.equal(
		(await h.feedback(request({ ...input, note: "x".repeat(9000) }))).status,
		413,
	);
	assert.equal(calls, 0);
});
test("durable rate limit is 429; unknown storage error returns no success or upstream details", async () => {
	const h = (e: Error) =>
		createUninstallHandlers({
			getUser: async () => null,
			actorHash: () => "a".repeat(64),
			feedback: async () => {
				throw e;
			},
		});
	assert.equal(
		(await h(new UninstallError(429, "Try later")).feedback(request(input)))
			.status,
		429,
	);
	const r = await h(Error("secret SQL details")).feedback(request(input));
	assert.equal(r.status, 503);
	assert.ok(!JSON.stringify(await r.json()).includes("secret"));
});
test("financial routes reject anonymous and changed owner before creating service", async () => {
	const a = createUninstallHandlers({ getUser: async () => null });
	assert.equal(
		(await a.claim(request({ expectedOwnerUserId: owner, revision: "test" })))
			.status,
		401,
	);
	const b = createUninstallHandlers({ getUser: async () => ({ id: owner }) });
	assert.equal(
		(
			await b.checkout(
				request({ expectedOwnerUserId: "other", revision: "test" }),
			)
		).status,
		409,
	);
});
