import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import {
	createTrialRenewalHandler,
	type RenewalAction,
} from "./trial-renewal-routes";

const USER = "a1000000-0000-4000-8000-000000000001",
	OP = "a2000000-0000-4000-8000-000000000001";
const bodies = {
	preview: {},
	quote: { planCode: "plus", billingPeriod: "yearly" },
	setup: { quoteId: OP, requestId: OP },
	complete: { operationId: OP },
	cancel: { requestId: OP },
};
function request(
	action: RenewalAction,
	headers: Record<string, string> = {},
	body: unknown = bodies[action],
) {
	return new NextRequest(
		`https://staging.anidachi.app/api/billing/trial/renewal/${action}`,
		{
			method: "POST",
			headers: {
				origin: "https://staging.anidachi.app",
				"sec-fetch-site": "same-origin",
				"content-type": "application/json",
				[BILLING_OWNER_HEADER]: USER,
				...headers,
			},
			body: JSON.stringify(body),
		},
	);
}
for (const action of [
	"preview",
	"quote",
	"setup",
	"complete",
	"cancel",
] as const) {
	test(`${action} fences CSRF, account, input and quota before the billing service`, async () => {
		let calls = 0,
			allowed = true;
		const handler = createTrialRenewalHandler(action, {
			getUser: async () => ({ id: USER }),
			allowRequest: async () => allowed,
			execute: async () => {
				calls++;
				return { state: "pending" };
			},
		});
		for (const h of [
			{ origin: "https://evil.test" },
			{ "sec-fetch-site": "cross-site" },
			{ "content-type": "text/plain" },
		] as Record<string, string>[])
			assert.equal((await handler(request(action, h))).status, 403);
		assert.equal(
			(await handler(request(action, { [BILLING_OWNER_HEADER]: "other" })))
				.status,
			409,
		);
		assert.equal(
			(
				await handler(
					request(action, {}, action === "preview" ? { foreign: true } : {}),
				)
			).status,
			400,
		);
		allowed = false;
		const limited = await handler(request(action));
		assert.equal(limited.status, 429);
		assert.equal(limited.headers.get("retry-after"), "60");
		assert.equal(calls, 0);
	});
	test(`${action} returns private owner-bound state and uses the verified origin`, async () => {
		const handler = createTrialRenewalHandler(action, {
			getUser: async () => ({ id: USER }),
			allowRequest: async () => true,
			execute: async (user, body, origin) => {
				assert.equal(user, USER);
				assert.deepEqual(body, bodies[action]);
				assert.equal(origin, "https://staging.anidachi.app");
				return { state: "pending" };
			},
		});
		const response = await handler(request(action));
		assert.equal(response.status, 202);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.equal((await response.json()).ownerUserId, USER);
	});
}

test("an obsolete cancel response is a conflict, never a successful cancellation", async () => {
	const handler = createTrialRenewalHandler("cancel", {
		getUser: async () => ({ id: USER }),
		allowRequest: async () => true,
		execute: async () => ({ state: "superseded" }),
	});
	const response = await handler(request("cancel"));
	assert.equal(response.status, 409);
	assert.deepEqual(await response.json(), {
		state: "superseded",
		ownerUserId: USER,
	});
});
