import assert from "node:assert/strict";
import { after, test } from "node:test";
import { NextRequest } from "next/server";
import {
	createEmailChallenge,
	emailLoginReturnTo,
	emailLoginHash,
	emailCookieName,
	normalizeLoginEmail,
} from "./email-login";
import { createEmailLoginRoutes } from "./email-login-routes";
import { emailCodeMessage, sendEmailLoginCode } from "./email-login-mail";

const oldSecret = process.env.ANIDACHI_EMAIL_OTP_SECRET;
process.env.ANIDACHI_EMAIL_OTP_SECRET = "local-test-secret-".repeat(3);
after(() => {
	if (oldSecret === undefined) delete process.env.ANIDACHI_EMAIL_OTP_SECRET;
	else process.env.ANIDACHI_EMAIL_OTP_SECRET = oldSecret;
});
const origin = "https://staging.anidachi.app";
const id = "11111111-1111-4111-8111-111111111111";
const browser = "b".repeat(43);
function request(
	data: unknown,
	headers: Record<string, string> = {},
	path = "send",
) {
	return new NextRequest(`${origin}/api/auth/email/${path}`, {
		method: "POST",
		headers: { origin, "content-type": "application/json", ...headers },
		body: JSON.stringify(data),
	});
}
function setup() {
	const calls: string[] = [];
	let sentCode = "";
	const deps = {
		enabled: () => true,
		reserve: async () => {
			calls.push("reserve");
			return 0;
		},
		send: async (_email: string, code: string) => {
			calls.push("send");
			sentCode = code;
		},
		sent: async () => {
			calls.push("sent");
		},
		consume: async () => {
			calls.push("consume");
			return {
				outcome: "verified" as const,
				user_id: "existing-paid-user",
				return_to: "/extension/connect?handoff=opaque",
				is_new: false,
			};
		},
		issueTokens: async (userId: string) => {
			calls.push(`tokens:${userId}`);
			return {
				accessToken: "existing-contract-access",
				refreshToken: "existing-contract-refresh",
			};
		},
	};
	return { deps, calls, getCode: () => sentCode };
}
const verifyRequest = (code = "123456", headers = {}) =>
	request(
		{ challengeId: id, code },
		{ cookie: `${emailCookieName(id)}=${browser}`, ...headers },
		"verify",
	);

test("email normalization preserves plus/dot identity, rejects malformed and oversized addresses", () => {
	assert.equal(
		normalizeLoginEmail(" Alex+room@Example.COM "),
		"alex+room@example.com",
	);
	assert.equal(normalizeLoginEmail("a.b@example.com"), "a.b@example.com");
	for (const value of [
		null,
		{},
		"a\nb@example.com",
		"a..b@example.com",
		"a@host",
		".a@example.com",
		"a".repeat(65) + "@example.com",
	])
		assert.equal(normalizeLoginEmail(value), null);
});
test("return destinations preserve invitation/checkout/handoff while blocking URL normalization attacks", () => {
	for (const value of [
		"/extension/connect?handoff=abc%2Fdef",
		"/checkout?plan=plus&billing=monthly",
		"/friend/invite/a",
	])
		assert.equal(emailLoginReturnTo(value), value);
	for (const value of [
		"https://evil.test",
		"//evil.test",
		"/\\evil.test",
		"/\nevil.test",
		"/api/auth/google",
		"/x/../api/auth/google",
		"/login",
		"/".repeat(5000),
	])
		assert.equal(emailLoginReturnTo(value), "");
});
test("random challenges store domain-separated keyed hashes, not six-digit secrets", () => {
	const one = createEmailChallenge("a@example.com", "/account"),
		two = createEmailChallenge("a@example.com", "//evil.test");
	assert.match(one.code, /^\d{6}$/);
	assert.notEqual(one.id, two.id);
	assert.notEqual(one.browserSecret, two.browserSecret);
	assert.equal(one.codeHash, emailLoginHash("code", `${one.id}:${one.code}`));
	assert.notEqual(
		one.codeHash,
		emailLoginHash("browser", `${one.id}:${one.code}`),
	);
	assert.equal(two.returnTo, "");
});
test("send reserves before mail and activates only after accepted delivery; response hides code", async () => {
	const f = setup(),
		response = await createEmailLoginRoutes(f.deps).send(
			request({ email: "A@example.com", returnTo: "/account" }),
		);
	assert.equal(response.status, 200);
	assert.deepEqual(f.calls, ["reserve", "send", "sent"]);
	const data = await response.json();
	assert.deepEqual(Object.keys(data).sort(), [
		"challengeId",
		"expiresAt",
		"retryAfter",
	]);
	assert.equal(data.retryAfter, 60);
	assert.ok(f.getCode());
	assert.equal(response.headers.get("cache-control"), "no-store");
	const cookie = response.cookies.get(emailCookieName(data.challengeId))!;
	assert.equal(cookie.httpOnly, true);
	assert.equal(cookie.sameSite, "strict");
	assert.equal(cookie.maxAge, 600);
});
test("cross-site, non-JSON, invalid email, excessive body and disabled endpoints cannot send or verify", async () => {
	for (const headers of [
		{ origin: "https://evil.test" },
		{ origin: "" },
		{ "sec-fetch-site": "cross-site" },
		{ "content-type": "text/plain" },
	] as Record<string, string>[]) {
		const f = setup(),
			routes = createEmailLoginRoutes(f.deps);
		assert.ok(
			(await routes.send(request({ email: "a@example.com" }, headers)))
				.status >= 400,
		);
		assert.ok(
			(await routes.verify(verifyRequest("123456", headers))).status >= 400,
		);
		assert.deepEqual(f.calls, []);
	}
	const f = setup();
	assert.equal(
		(await createEmailLoginRoutes(f.deps).send(request({ email: "invalid" })))
			.status,
		400,
	);
	assert.equal(
		(
			await createEmailLoginRoutes(f.deps).send(
				request({ email: "a@example.com", excess: "x".repeat(7000) }),
			)
		).status,
		400,
	);
	assert.equal(
		(
			await createEmailLoginRoutes({ ...f.deps, enabled: () => false }).send(
				request({ email: "a@example.com" }),
			)
		).status,
		503,
	);
	assert.deepEqual(f.calls, []);
});
test("durable throttling and delivery/database outages never claim success or create a session", async () => {
	const f = setup();
	const limited = await createEmailLoginRoutes({
		...f.deps,
		reserve: async () => 48,
	}).send(request({ email: "a@example.com" }));
	assert.equal(limited.status, 429);
	assert.equal(limited.headers.get("retry-after"), "48");
	assert.deepEqual(f.calls, []);
	for (const fail of ["reserve", "send", "sent"] as const) {
		const g = setup();
		const response = await createEmailLoginRoutes({
			...g.deps,
			[fail]: async () => {
				throw new Error("sensitive upstream error");
			},
		}).send(request({ email: "a@example.com" }));
		assert.equal(response.status, 503);
		assert.equal(response.headers.get("set-cookie"), null);
		assert.ok(!(await response.text()).includes("sensitive"));
	}
});
test("verification requires browser binding and atomic success, issues tokens for unchanged account ID", async () => {
	const f = setup(),
		routes = createEmailLoginRoutes(f.deps);
	assert.equal(
		(await routes.verify(verifyRequest("123456", { cookie: "" }))).status,
		400,
	);
	assert.deepEqual(f.calls, []);
	const response = await routes.verify(verifyRequest());
	assert.equal(response.status, 200);
	assert.deepEqual(f.calls, ["consume", "tokens:existing-paid-user"]);
	assert.equal(
		(await response.json()).redirectTo,
		"/extension/connect?handoff=opaque",
	);
	assert.equal(response.cookies.get(emailCookieName(id))?.maxAge, 0);
	assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
});
test("expired/replayed/wrong codes and unverified legacy identities cannot receive tokens", async () => {
	for (const outcome of ["invalid", "provider_required"] as const) {
		const f = setup(),
			response = await createEmailLoginRoutes({
				...f.deps,
				consume: async () => ({
					outcome,
					user_id: null,
					return_to: "",
					is_new: false,
				}),
			}).verify(verifyRequest());
		assert.equal(response.status, outcome === "invalid" ? 400 : 409);
		assert.deepEqual(f.calls, []);
	}
	const f = setup(),
		response = await createEmailLoginRoutes({
			...f.deps,
			issueTokens: async () => {
				throw new Error("unavailable");
			},
		}).verify(verifyRequest());
	assert.equal(response.status, 503);
	assert.equal(response.headers.get("set-cookie"), null);
});
test("email template is plain English, contains a code but no magic-link login", () => {
	const message = emailCodeMessage("012345");
	assert.ok(message.text.includes("012345"));
	assert.ok(message.html.includes("012345"));
	assert.ok(message.text.includes("10 minutes"));
	assert.ok(!message.html.includes("href="));
	assert.throws(() => emailCodeMessage("<img>"));
});
test("Resend sends to one recipient with idempotency; provider failures expose no message body", async () => {
	const fetch = globalThis.fetch,
		key = process.env.RESEND_API_KEY;
	process.env.RESEND_API_KEY = "local-test-key";
	try {
		globalThis.fetch = async (url, init) => {
			assert.equal(url, "https://api.resend.com/emails");
			assert.equal(
				(init!.headers as Record<string, string>)["Idempotency-Key"],
				`email-login/${id}`,
			);
			const data = JSON.parse(init!.body as string);
			assert.deepEqual(data.to, ["a@example.com"]);
			assert.equal(data.from, "AniDachi <notifications@anidachi.app>");
			return new Response(JSON.stringify({ id: "mail-id" }), { status: 200 });
		};
		await sendEmailLoginCode("a@example.com", "123456", id);
		globalThis.fetch = async () => new Response("secret body", { status: 429 });
		await assert.rejects(
			sendEmailLoginCode("a@example.com", "123456", id),
			/Email delivery unavailable/,
		);
	} finally {
		globalThis.fetch = fetch;
		if (key === undefined) delete process.env.RESEND_API_KEY;
		else process.env.RESEND_API_KEY = key;
	}
});
