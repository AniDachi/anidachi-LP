import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_HOSTING_OWNER_HEADER } from "@anidachi/protocol";
import { NextRequest } from "next/server";
import {
	createFree20AbuseTokens,
	free20ContextCookieName,
} from "./free20-abuse";
import { signProof } from "./free20-abuse.test-support";
import { createFree20ContextHandler } from "./free20-abuse-routes";
import { createTrialAbuseTokens, trialBrowserCookieName } from "./trial-abuse";

const origin = "https://staging.anidachi.app",
	owner = "ab000000-0000-4000-8000-000000000001",
	requestId = "ac000000-0000-4000-8000-000000000001";
const tokens = createFree20AbuseTokens("test-only-secret", origin),
	browser = createTrialAbuseTokens("test-only-secret", origin);
const extensionId = "a".repeat(32);
const request = (body: unknown, headers: Record<string, string> = {}) =>
	new NextRequest(origin + "/api/me/free20-context", {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
			[ACCOUNT_HOSTING_OWNER_HEADER]: owner,
			...headers,
		},
		body: JSON.stringify(body),
	});
const options = {
	enabled: () => true,
	siteOrigin: () => origin,
	extensionId: () => extensionId,
	getSession: async () => ({
		userId: owner,
		email: "test@example.test",
		plan: "free" as const,
		source: "extension" as const,
	}),
	allowRequest: async () => true,
	tokens: () => tokens,
	browserTokens: () => browser,
};
test("cookie round trip is mandatory and completed context uses private HttpOnly cookie", async () => {
	const handler = createFree20ContextHandler(options);
	const first = await handler(
		request(
			{ action: "challenge", requestId },
			{ origin: `chrome-extension://${extensionId}` },
		),
	);
	assert.equal(first.status, 200);
	const cookie = first.cookies.get(trialBrowserCookieName(origin))!;
	assert.equal(cookie.httpOnly, true);
	assert.equal(cookie.secure, true);
	assert.equal(cookie.sameSite, "lax");
	assert.equal(cookie.domain, undefined);
	const proof = await signProof((await first.json()).challenge);
	const body = { action: "complete", requestId, proof };
	assert.equal((await handler(request(body))).status, 428);
	const completed = await handler(
		request(body, { cookie: `${cookie.name}=${cookie.value}` }),
	);
	assert.equal(completed.status, 200);
	const payload = await completed.json();
	assert.deepEqual(Object.keys(payload).sort(), [
		"action",
		"context",
		"expiresAt",
	]);
	assert.ok(tokens.readContext(payload.context, owner));
	assert.equal(
		completed.cookies.get(free20ContextCookieName(origin))?.httpOnly,
		true,
	);
	assert.equal(completed.headers.get("cache-control"), "private, no-store");
});
test("disabled, wrong-origin, wrong-owner, unauthenticated, malformed, rate-limited and infrastructure failure cannot enroll", async () => {
	const body = { action: "challenge", requestId };
	for (const [overrides, headers, status] of [
		[{ enabled: () => false }, {}, 404],
		[{}, { origin: "https://evil.test" }, 403],
		[{}, { [ACCOUNT_HOSTING_OWNER_HEADER]: "other" }, 409],
		[{ getSession: async () => null }, {}, 401],
		[{ allowRequest: async () => false }, {}, 429],
		[
			{
				allowRequest: async () => {
					throw new Error("private detail");
				},
			},
			{},
			503,
		],
	] as const) {
		const response = await createFree20ContextHandler({
			...options,
			...overrides,
		})(request(body, headers));
		assert.equal(response.status, status);
		assert.equal(response.headers.get("set-cookie"), null);
		assert.ok(!(await response.text()).includes("private detail"));
	}
	const handler = createFree20ContextHandler(options);
	assert.equal(
		(await handler(request({ ...body, browserHash: "a".repeat(64) }))).status,
		400,
	);
	assert.equal(
		(await handler(request({ action: "complete", requestId }))).status,
		428,
	);
	assert.equal(
		(
			await handler(
				request({ action: "challenge", requestId, padding: "x".repeat(5000) }),
			)
		).status,
		400,
	);
});
test("absent Origin is accepted only for actually verified extension bearer, never cookie fallback", async () => {
	for (const source of ["extension", "cookie"] as const) {
		const req = request({ action: "challenge", requestId });
		req.headers.delete("origin");
		req.headers.set("authorization", "Bearer supplied-but-not-authority");
		const response = await createFree20ContextHandler({
			...options,
			getSession: async () => ({ ...(await options.getSession()), source }),
		})(req);
		assert.equal(response.status, source === "extension" ? 200 : 403);
	}
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test("enrollment timeout cancels an incomplete request body and prevents late body/rate work", async (t) => {
	const reading = deferred<void>();
	let source!: ReadableStreamDefaultController<Uint8Array>;
	let cancelled = false,
		limited = 0;
	const stream = new ReadableStream<Uint8Array>(
		{
			start(controller) {
				source = controller;
			},
			pull() {
				reading.resolve();
			},
			cancel() {
				cancelled = true;
			},
		},
		{ highWaterMark: 0 },
	);
	const req = new NextRequest(`${origin}/api/me/free20-context`, {
		method: "POST",
		headers: {
			origin,
			"content-type": "application/json",
			[ACCOUNT_HOSTING_OWNER_HEADER]: owner,
		},
		body: stream,
		duplex: "half",
	} as NonNullable<ConstructorParameters<typeof NextRequest>[1]> & {
		duplex: "half";
	});
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const responsePromise = createFree20ContextHandler({
		...options,
		allowRequest: async () => {
			limited++;
			return true;
		},
	})(req);
	await reading.promise;
	t.mock.timers.tick(10_000);
	const response = await responsePromise;
	assert.equal(response.status, 503);
	assert.equal(response.headers.get("set-cookie"), null);
	await flush();
	assert.equal(cancelled, true);
	assert.equal(stream.locked, false);
	assert.throws(() =>
		source.enqueue(
			new TextEncoder().encode(
				JSON.stringify({ action: "challenge", requestId }),
			),
		),
	);
	assert.equal(limited, 0);
});
test("a session or rate decision that resolves after deadline cannot issue a challenge", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	for (const stage of ["session", "rate"] as const) {
		const entered = deferred<void>(),
			release = deferred<void>();
		let limited = 0,
			issued = 0;
		const handler = createFree20ContextHandler({
			...options,
			getSession: async () => {
				if (stage === "session") {
					entered.resolve();
					await release.promise;
				}
				return options.getSession();
			},
			allowRequest: async () => {
				limited++;
				if (stage === "rate") {
					entered.resolve();
					await release.promise;
				}
				return true;
			},
			tokens: () => ({
				...tokens,
				issueChallenge: (...args) => {
					issued++;
					return tokens.issueChallenge(...args);
				},
			}),
		});
		const responsePromise = handler(
			request({ action: "challenge", requestId }),
		);
		await entered.promise;
		t.mock.timers.tick(10_000);
		const response = await responsePromise;
		assert.equal(response.status, 503);
		release.resolve();
		await flush();
		assert.equal(issued, 0);
		assert.equal(limited, stage === "session" ? 0 : 1);
	}
});
test("late proof completion cannot assemble a context response or cookie after deadline", async (t) => {
	const cookie = browser.issueCookie();
	const proof = await signProof(
		tokens.issueChallenge(cookie, owner, requestId),
	);
	const result = await tokens.complete(cookie, owner, requestId, proof);
	const entered = deferred<void>(),
		release = deferred<void>();
	let resultReads = 0;
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const handler = createFree20ContextHandler({
		...options,
		tokens: () => ({
			...tokens,
			complete: async () => {
				entered.resolve();
				await release.promise;
				return {
					get context() {
						resultReads++;
						return result.context;
					},
					expiresAt: result.expiresAt,
				};
			},
		}),
	});
	const responsePromise = handler(
		request(
			{ action: "complete", requestId, proof },
			{ cookie: `${trialBrowserCookieName(origin)}=${cookie}` },
		),
	);
	await entered.promise;
	t.mock.timers.tick(10_000);
	const response = await responsePromise;
	assert.equal(response.status, 503);
	assert.equal(response.headers.get("set-cookie"), null);
	release.resolve();
	await flush();
	assert.equal(resultReads, 0);
});
