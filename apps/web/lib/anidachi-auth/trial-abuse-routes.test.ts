import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createTrialContextHandler } from "./trial-abuse-routes";
import { createTrialAbuseTokens, trialBrowserCookieName } from "./trial-abuse";
const origin = "https://staging.anidachi.app";
const user = "ab000000-0000-4000-8000-000000000001";
const requestId = "ac000000-0000-4000-8000-000000000001";
const tokens = createTrialAbuseTokens("test-only-secret", origin);
const req = (headers: Record<string, string> = {}) =>
	new NextRequest(origin + "/api/billing/trial/context", {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
			"X-Anidachi-Billing-Owner": user,
			...headers,
		},
		body: JSON.stringify({ requestId }),
	});
test("authenticated context issues host-only secure HttpOnly cookie and a bound challenge, preserving it on account changes", async () => {
	const handler = createTrialContextHandler({
		getUser: async () => ({ id: user }),
		allowRequest: async () => true,
		tokens: () => tokens,
		extensionId: () => null,
	});
	const first = await handler(req());
	assert.equal(first.status, 200);
	const cookie = first.cookies.get(trialBrowserCookieName(origin))!;
	assert.ok(cookie.httpOnly);
	assert.ok(cookie.secure);
	assert.equal(cookie.sameSite, "lax");
	assert.equal(cookie.path, "/");
	assert.equal(cookie.domain, undefined);
	assert.ok(tokens.readCookie(cookie.value));
	const payload = await first.json();
	assert.equal(payload.ownerUserId, user);
	assert.equal(payload.state, "ready");
	assert.equal(payload.extensionId, null);
	assert.equal(first.headers.get("cache-control"), "private, no-store");
	const reused = await handler(
		req({ cookie: cookie.name + "=" + cookie.value }),
	);
	assert.equal(reused.headers.get("set-cookie"), null);
	assert.equal(
		(await handler(req({ origin: "https://evil.test" }))).status,
		403,
	);
	assert.equal(
		(await handler(req({ "X-Anidachi-Billing-Owner": "different" }))).status,
		409,
	);
});
test("anonymous and limited requests do not mint marker cookies", async () => {
	for (const [getUser, allowRequest, status] of [
		[async () => null, async () => true, 401],
		[async () => ({ id: user }), async () => false, 429],
	] as const) {
		const r = await createTrialContextHandler({
			getUser,
			allowRequest,
			tokens: () => tokens,
		})(req());
		assert.equal(r.status, status);
		assert.equal(r.headers.get("set-cookie"), null);
	}
});
