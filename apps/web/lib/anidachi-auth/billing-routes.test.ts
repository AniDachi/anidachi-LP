import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import type { BillingService } from "./billing";
import { createBillingHandlers } from "./billing-routes";

function fixture(user: { id: string } | null = { id: "owner" }, fail = false) {
	const calls: string[] = [];
	const service: BillingService = {
		overview: async (id) => {
			calls.push(`overview:${id}`);
			return { ownerUserId: id, planCode: "free", subscriptions: [] };
		},
		refresh: async (id) => {
			calls.push(`refresh:${id}`);
		},
		cancellationPortal: async (id, row, returnUrl) => {
			calls.push(`cancel:${id}:${row}`);
			assert.equal(
				returnUrl,
				"https://staging.anidachi.app/account/billing?billing=return",
			);
			if (fail) throw new Error("secret_upstream_payload");
			return "https://billing.stripe.com/p/session/test_fixture";
		},
	};
	return {
		calls,
		handlers: createBillingHandlers({ service, getUser: async () => user }),
	};
}
function request(
	headers: Record<string, string> = {},
	body: unknown = { subscriptionId: "local-id" },
) {
	return new NextRequest(
		"https://staging.anidachi.app/api/billing/cancellation-portal",
		{
			method: "POST",
			headers: {
				origin: "https://staging.anidachi.app",
				"content-type": "application/json",
				[BILLING_OWNER_HEADER]: "owner",
				...headers,
			},
			body: JSON.stringify(body),
		},
	);
}

test("cookie billing mutations reject cross-site, sibling origins, missing Origin and non-JSON bodies", async () => {
	const invalidHeaders: Record<string, string>[] = [
		{ origin: "https://evil.example" },
		{ origin: "https://www.anidachi.app" },
		{ origin: "" },
		{ "sec-fetch-site": "cross-site" },
		{ "content-type": "text/plain" },
	];
	for (const headers of invalidHeaders) {
		const f = fixture();
		const response = await f.handlers.cancellationPortal(request(headers));
		assert.equal(response.status, 403);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		assert.deepEqual(f.calls, []);
		assert.equal((await f.handlers.refresh(request(headers))).status, 403);
	}
});

test("revoked sessions and changed account tabs cannot read, sync, or open cancellation", async () => {
	for (const user of [null, { id: "other-owner" }]) {
		const f = fixture(user);
		for (const handler of [
			f.handlers.cancellationPortal,
			f.handlers.refresh,
			f.handlers.getOverview,
		]) {
			assert.equal((await handler(request())).status, user ? 409 : 401);
		}
		assert.deepEqual(f.calls, []);
	}
});

test("valid cancellation selects only authenticated owner and server-fixed return URL", async () => {
	const f = fixture();
	const response = await f.handlers.cancellationPortal(
		request(
			{},
			{
				subscriptionId: "local-id",
				customerId: "cus_foreign",
				returnUrl: "https://evil.example",
			},
		),
	);
	assert.equal(response.status, 200);
	assert.deepEqual(f.calls, ["cancel:owner:local-id"]);
	assert.equal((await response.json()).ownerUserId, "owner");
});

test("invalid selection fails before billing access and unexpected errors omit upstream detail", async () => {
	for (const body of [
		null,
		{},
		{ subscriptionId: 42 },
		{ subscriptionId: "x".repeat(101) },
	]) {
		const f = fixture();
		assert.equal(
			(await f.handlers.cancellationPortal(request({}, body))).status,
			400,
		);
		assert.deepEqual(f.calls, []);
	}
	const response = await fixture(
		{ id: "owner" },
		true,
	).handlers.cancellationPortal(request());
	assert.equal(response.status, 503);
	assert.doesNotMatch(await response.text(), /secret_upstream_payload/);
});

test("portal return refreshes authority before returning overview and never assumes cancellation", async () => {
	const f = fixture();
	const response = await f.handlers.refresh(request());
	assert.equal(response.status, 200);
	assert.deepEqual(f.calls, ["refresh:owner", "overview:owner"]);
	assert.deepEqual(await response.json(), {
		ownerUserId: "owner",
		planCode: "free",
		subscriptions: [],
	});
});
