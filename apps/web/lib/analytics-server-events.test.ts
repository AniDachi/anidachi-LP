import assert from "node:assert/strict";
import test from "node:test";
import { isAmplitudeInsertId } from "./amplitude-ids";
import {
	deterministicInsertId,
	emitServerEvent,
	FIRST_TOUCH_COOKIE,
	readFirstTouch,
	serverAnalyticsEnabled,
} from "./analytics-server-events";

test("server events run only on the production deployment of main", () => {
	assert.equal(serverAnalyticsEnabled({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }), true);
	assert.equal(serverAnalyticsEnabled({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "staging" }), false);
	assert.equal(serverAnalyticsEnabled({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "staging" }), false);
	assert.equal(serverAnalyticsEnabled({}), false);
});

test("deterministic insert ids are stable valid UUIDs", () => {
	const a = deterministicInsertId("purchase:cs_test_1");
	assert.equal(a, deterministicInsertId("purchase:cs_test_1"));
	assert.notEqual(a, deterministicInsertId("purchase:cs_test_2"));
	for (let i = 0; i < 50; i++) assert.ok(isAmplitudeInsertId(deterministicInsertId(`seed:${i}`)));
});

test("first-touch cookie is parsed defensively", () => {
	const value = encodeURIComponent(JSON.stringify({ p: "/guides/x", r: "www.google.com", u: "utm_source=a" }));
	assert.deepEqual(readFirstTouch(`a=b; ${FIRST_TOUCH_COOKIE}=${value}; c=d`), {
		first_landing_path: "/guides/x",
		first_referrer_host: "www.google.com",
		first_utm: "utm_source=a",
	});
	assert.deepEqual(readFirstTouch(`${FIRST_TOUCH_COOKIE}=%7Bnot-json`), {});
	assert.deepEqual(readFirstTouch(`${FIRST_TOUCH_COOKIE}=${encodeURIComponent(JSON.stringify({ p: "javascript:1" }))}`), {});
	assert.deepEqual(readFirstTouch(null), {});
});

test("emitting outside production never sends or throws", () => {
	const originalFetch = globalThis.fetch;
	let called = false;
	globalThis.fetch = (async () => {
		called = true;
		return Response.json({});
	}) as typeof fetch;
	try {
		emitServerEvent({ eventType: "sign_up", userId: "a1000000-0000-4000-8000-000000000001" });
		assert.equal(called, false);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
