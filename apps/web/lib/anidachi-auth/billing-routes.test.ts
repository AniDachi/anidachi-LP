import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import type { BillingService } from "./billing";
import { createBillingHandlers } from "./billing-routes";
import type { TrialPlanChangeService } from "./trial-plan-change";

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
		renewalPortal: async (id, row, returnUrl) => {
			calls.push(`restore:${id}:${row}`);
			assert.equal(
				returnUrl,
				"https://staging.anidachi.app/account/billing?billing=return",
			);
			if (fail) throw new Error("secret_upstream_payload");
			return "https://billing.stripe.com/p/session/test_fixture";
		},
	};
	const trialPlans: TrialPlanChangeService = {
		quote: async (userId, rowId, plan) => {
			calls.push(`quote:${userId}:${rowId}:${plan}`);
			return {
				planCode: plan,
				currentPlanCode: "plus",
				unitAmount: 1499,
				currency: "usd",
				trialEndsAt: "2030-01-01T00:00:00.000Z",
				renewalCanceled: false,
			};
		},
		confirm: async (userId, rowId, plan) => {
			calls.push(`confirm:${userId}:${rowId}:${plan}`);
			return {
				ownerUserId: userId,
				planCode: plan,
				trialEndsAt: "2030-01-01T00:00:00.000Z",
			};
		},
	};
	return {
		calls,
		handlers: createBillingHandlers({
			service,
			trialPlans,
			getUser: async () => user,
			paymentLink: async (userId: string, rowId: string) => {
				calls.push(`payment:${userId}:${rowId}`);
				return "https://invoice.stripe.com/i/test";
			},
		}),
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
		assert.equal((await f.handlers.trialPlan(request(headers))).status, 403);
		assert.equal((await f.handlers.paymentLink(request(headers))).status, 403);
		assert.equal(
			(await f.handlers.renewalPortal(request(headers))).status,
			403,
		);
	}
});

test("payment link uses only owner-bound local subscription selection", async () => {
	const f = fixture();
	assert.equal(
		(
			await f.handlers.paymentLink(
				request({ [BILLING_OWNER_HEADER]: "foreign" }),
			)
		).status,
		409,
	);
	assert.deepEqual(f.calls, []);
	const response = await f.handlers.paymentLink(request());
	assert.deepEqual(await response.json(), {
		ownerUserId: "owner",
		url: "https://invoice.stripe.com/i/test",
	});
	assert.deepEqual(f.calls, ["payment:owner:local-id"]);
});

test("revoked sessions and changed account tabs cannot read, sync, or open cancellation", async () => {
	for (const user of [null, { id: "other-owner" }]) {
		const f = fixture(user);
		for (const handler of [
			f.handlers.cancellationPortal,
			f.handlers.renewalPortal,
			f.handlers.refresh,
			f.handlers.getOverview,
			f.handlers.trialPlan,
		]) {
			assert.equal((await handler(request())).status, user ? 409 : 401);
		}
		assert.deepEqual(f.calls, []);
	}
});

test("trial plan quote and confirmation require valid plan and owner-scoped local row", async () => {
	const f = fixture();
	const quoted = await f.handlers.trialPlan(
		request(
			{},
			{ action: "quote", subscriptionId: "local-id", planCode: "pro" },
		),
	);
	assert.equal(quoted.status, 200);
	const payload = await quoted.json();
	assert.equal(payload.ownerUserId, "owner");
	assert.equal(payload.quote.unitAmount, 1499);
	const confirmed = await f.handlers.trialPlan(
		request(
			{},
			{
				action: "confirm",
				subscriptionId: "local-id",
				planCode: "pro",
				quote: payload.quote,
				requestId: "11111111-1111-4111-8111-111111111111",
			},
		),
	);
	assert.equal(confirmed.status, 200);
	assert.deepEqual(f.calls, [
		"quote:owner:local-id:pro",
		"confirm:owner:local-id:pro",
	]);
	for (const body of [
		null,
		{},
		{ action: "quote", subscriptionId: "local-id", planCode: "free" },
		{ action: "confirm", subscriptionId: "local-id", planCode: "pro" },
	]) {
		assert.equal(
			(await fixture().handlers.trialPlan(request({}, body))).status,
			400,
		);
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

test("renewal portal uses an authenticated local selection and fixed return URL", async () => {
	const f = fixture();
	const response = await f.handlers.renewalPortal(
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
	assert.equal(response.headers.get("cache-control"), "private, no-store");
	assert.deepEqual(f.calls, ["restore:owner:local-id"]);
	assert.equal((await response.json()).ownerUserId, "owner");
	for (const body of [
		null,
		{},
		{ subscriptionId: 42 },
		{ subscriptionId: "x".repeat(101) },
	]) {
		const invalid = fixture();
		assert.equal(
			(await invalid.handlers.renewalPortal(request({}, body))).status,
			400,
		);
		assert.deepEqual(invalid.calls, []);
	}
	const failure = await fixture({ id: "owner" }, true).handlers.renewalPortal(
		request(),
	);
	assert.equal(failure.status, 503);
	assert.doesNotMatch(await failure.text(), /secret_upstream_payload/);
});
