import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import {
	createCardlessTrialRecoveryHandler,
	createCardlessTrialStartHandler,
} from "./cardless-trial-routes";

const OWNER = "a1000000-0000-4000-8000-000000000001";
const body = {
	requestId: "a2000000-0000-4000-8000-000000000001",
	planCode: "plus",
	billingPeriod: "monthly",
	offerRevision: "7",
};
function request(
	headers: Record<string, string> = {},
	payload: unknown = body,
) {
	return new NextRequest(
		"https://staging.anidachi.app/api/billing/trial/start",
		{
			method: "POST",
			headers: {
				origin: "https://staging.anidachi.app",
				"sec-fetch-site": "same-origin",
				"content-type": "application/json",
				[BILLING_OWNER_HEADER]: OWNER,
				...headers,
			},
			body: JSON.stringify(payload),
		},
	);
}
test("trial start rejects CSRF, wrong account, invalid input and quota before Stripe work", async () => {
	let calls = 0,
		quota = true;
	const handler = createCardlessTrialStartHandler({
		getUser: async () => ({ id: OWNER }),
		allowRequest: async () => quota,
		start: async () => {
			calls++;
			return {
				state: "active",
				planCode: "plus",
				trialEndsAt: "2030-01-04T00:00:00Z",
			};
		},
	});
	for (const headers of [
		{ origin: "https://foreign.test" },
		{ "sec-fetch-site": "cross-site" },
		{ "content-type": "text/plain" },
	] as Record<string, string>[])
		assert.equal((await handler(request(headers))).status, 403);
	assert.equal(
		(await handler(request({ [BILLING_OWNER_HEADER]: "another" }))).status,
		409,
	);
	assert.equal(
		(await handler(request({}, { ...body, planCode: "junkie" }))).status,
		400,
	);
	quota = false;
	const limited = await handler(request());
	assert.equal(limited.status, 429);
	assert.equal(limited.headers.get("retry-after"), "60");
	assert.equal(calls, 0);
});
test("trial response is private, owner-bound and distinguishes pending, used and changed offer", async () => {
	for (const [state, status] of [
		["active", 200],
		["pending", 202],
		["ineligible", 409],
		["offer_changed", 409],
		["verification_required", 409],
		["unavailable", 503],
	] as const) {
		const handler = createCardlessTrialStartHandler({
			getUser: async () => ({ id: OWNER }),
			allowRequest: async () => true,
			start: async (userId, input) => {
				assert.equal(userId, OWNER);
				assert.deepEqual(input, body);
				return state === "active"
					? { state, planCode: "plus", trialEndsAt: "2030-01-04T00:00:00Z" }
					: state === "pending"
						? { state, kind: "activation", operationId: "operation" }
						: { state };
			},
		});
		const result = await handler(request());
		assert.equal(result.status, status);
		assert.match(
			result.headers.get("cache-control") ?? "",
			/private, no-store/,
		);
		assert.equal(result.headers.get("vary"), "Cookie");
		assert.equal((await result.json()).ownerUserId, OWNER);
	}
});
test("unauthenticated request cannot reach storage or Stripe and errors remain generic", async () => {
	const handler = createCardlessTrialStartHandler({
		getUser: async () => null,
		allowRequest: async () => {
			throw Error("must not run");
		},
		start: async () => {
			throw Error("must not run");
		},
	});
	assert.equal((await handler(request())).status, 401);
	const failing = createCardlessTrialStartHandler({
		getUser: async () => ({ id: OWNER }),
		allowRequest: async () => true,
		start: async () => {
			throw Error("secret upstream session URL");
		},
	});
	const response = await failing(request());
	assert.equal(response.status, 503);
	assert.ok(!(await response.text()).includes("upstream"));
});

test("recovery uses the same session, CSRF, owner and quota guards without trusting a body owner", async () => {
	let calls = 0,
		quota = true;
	const handler = createCardlessTrialRecoveryHandler({
		getUser: async () => ({ id: OWNER }),
		allowRequest: async () => quota,
		recover: async (user, operationId) => {
			calls++;
			assert.equal(user, OWNER);
			assert.equal(operationId, undefined);
			return {
				state: "pending",
				kind: "activation",
				operationId: body.requestId,
			};
		},
	});
	assert.equal(
		(await handler(request({ origin: "https://foreign.test" }, {}))).status,
		403,
	);
	assert.equal(
		(await handler(request({ [BILLING_OWNER_HEADER]: "other" }, {}))).status,
		409,
	);
	assert.equal(
		(await handler(request({}, { operationId: "not-a-uuid" }))).status,
		400,
	);
	quota = false;
	assert.equal((await handler(request({}, {}))).status, 429);
	assert.equal(calls, 0);
	quota = true;
	const r = await handler(request({}, { userId: "other" }));
	assert.equal(r.status, 202);
	assert.equal((await r.json()).ownerUserId, OWNER);
	assert.equal(r.headers.get("cache-control"), "private, no-store");
	const guest = createCardlessTrialRecoveryHandler({
		getUser: async () => null,
		recover: async () => {
			throw Error("must not run");
		},
	});
	assert.equal((await guest(request({}, {}))).status, 401);
});

test("recovery forwards only the optional validated activation ID", async () => {
	const handler = createCardlessTrialRecoveryHandler({
		getUser: async () => ({ id: OWNER }),
		allowRequest: async () => true,
		recover: async (user, id) => {
			assert.equal(user, OWNER);
			assert.equal(id, body.requestId);
			return { state: "ineligible" };
		},
	});
	const r = await handler(request({}, { operationId: body.requestId }));
	assert.equal(r.status, 409);
});
