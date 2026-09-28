import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CheckoutSessionSync } from "../app/success/checkout-session-sync";

const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;
let refreshes = 0;
const router = {
	back() {},
	forward() {},
	push() {},
	replace() {},
	prefetch: async () => undefined,
	refresh() {
		refreshes += 1;
	},
};
function view(sessionId?: string, initialPlanCode = "free") {
	return React.createElement(
		AppRouterContext.Provider,
		{ value: router },
		React.createElement(CheckoutSessionSync, { sessionId, initialPlanCode }),
	);
}
async function mount(sessionId?: string, initialPlanCode = "free") {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root!.render(view(sessionId, initialPlanCode)));
}
function title() {
	return container.querySelector("h1")?.textContent;
}
function deferredResponse() {
	let resolve!: (response: Response) => void;
	const promise = new Promise<Response>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	refreshes = 0;
});
test("trial success uses the checkout plan and rechecks at its original end", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let requests = 0;
	globalThis.fetch = async () =>
		Response.json({
			ok: true,
			planCode: "pro",
			billing: {
				ownerUserId: "owner",
				planCode: "pro",
				serverTime: "2030-01-01T00:00:00Z",
				subscriptions: [],
			},
			checkoutSubscription: {
				planCode: "plus",
				trial: {
					stage: ++requests === 1 ? "trial" : "ended",
					endsAt: "2030-01-01T00:00:01Z",
					pendingUntil: "2030-01-01T02:00:01Z",
				},
			},
		});
	await mount("cs_trial");
	assert.match(container.textContent!, /Your Plus trial/);
	assert.doesNotMatch(container.textContent!, /Your Pro trial/);
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(requests, 2);
	assert.equal(title(), "Your trial has ended");
});

for (const stage of [
	"trial",
	"processing",
	"payment_required",
	"ended",
	"paid",
] as const) {
	test(`checkout return distinguishes ${stage} from a paid subscription`, async () => {
		globalThis.fetch = async () =>
			Response.json({
				checkoutSubscription: {
					id: "local",
					planCode: "plus",
					status: "active",
					cancelAtPeriodEnd: false,
					canCancel: true,
					currentPeriodEnd: "2030-01-04T00:00:00Z",
					trial: {
						stage,
						endsAt: "2030-01-04T00:00:00Z",
						pendingUntil: "2030-01-04T02:00:00Z",
					},
				},
				ok: true,
				planCode: stage === "ended" ? "free" : "plus",
				billing: {
					ownerUserId: "owner",
					planCode: "plus",
					subscriptions: [
						{
							id: "local",
							planCode: "plus",
							status: "active",
							cancelAtPeriodEnd: false,
							canCancel: true,
							currentPeriodEnd: "2030-01-04T00:00:00Z",
							trial: {
								stage,
								endsAt: "2030-01-04T00:00:00Z",
								pendingUntil: "2030-01-04T02:00:00Z",
							},
						},
					],
				},
			});
		await mount("cs_trial");
		const expected = {
			trial: "Your free trial has started",
			processing: "First payment processing",
			payment_required: "Payment needs attention",
			ended: "Your trial has ended",
			paid: "Subscription confirmed",
		};
		assert.equal(title(), expected[stage]);
	});
}

test("server render waits for verification instead of declaring success or showing the old plan", () => {
	const html = renderToString(view("cs_pending", "free"));
	assert.match(html, /Checking your subscription/);
	assert.doesNotMatch(
		html,
		/Subscription confirmed|updated to Free|checkout is complete/,
	);
});

test("opening without checkout stays neutral even for an existing paid account and sends no request", async () => {
	let requests = 0;
	globalThis.fetch = async () => {
		requests += 1;
		throw new Error("unexpected request");
	};
	await mount(undefined, "plus");
	assert.equal(title(), "Your subscription");
	assert.match(container.textContent ?? "", /current AniDachi plan is Plus/);
	assert.doesNotMatch(container.textContent ?? "", /Subscription confirmed/);
	assert.equal(requests, 0);
	assert.equal(refreshes, 0);
});

for (const planCode of ["plus", "pro"]) {
	test(`only a successful server response confirms ${planCode} and preserves the request and links`, async () => {
		const pending = deferredResponse();
		const requests: { url: string; init?: RequestInit }[] = [];
		globalThis.fetch = async (url, init) => {
			requests.push({ url: String(url), init });
			return pending.promise;
		};
		await mount("cs_valid");
		assert.equal(title(), "Checking your subscription");
		assert.equal(refreshes, 0);
		assert.equal(requests.length, 1);
		assert.equal(requests[0].url, "/api/billing/sync-checkout-session");
		assert.equal(requests[0].init?.method, "POST");
		assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
			sessionId: "cs_valid",
			next: "/account",
		});
		await act(async () =>
			pending.resolve(Response.json({ ok: true, planCode })),
		);
		assert.equal(title(), "Subscription confirmed");
		assert.match(
			container.textContent ?? "",
			new RegExp(`active on ${planCode === "plus" ? "Plus" : "Pro"}`),
		);
		assert.equal(refreshes, 1);
		assert.ok(container.querySelector('a[href="/extension"]'));
		assert.ok(container.querySelector('a[href="/account"]'));
	});
}

test("a completed sync returning Free does not claim an active paid subscription", async () => {
	globalThis.fetch = async () =>
		Response.json({ ok: true, planCode: "free", status: "incomplete" });
	await mount("cs_unpaid", "plus");
	assert.equal(title(), "Subscription status");
	assert.match(container.textContent ?? "", /current AniDachi plan is Free/);
	assert.doesNotMatch(container.textContent ?? "", /Subscription confirmed/);
	assert.equal(refreshes, 1);
});

for (const failure of [
	"http",
	"invalid-json",
	"network",
	"missing-plan",
] as const) {
	test(`${failure} failure never displays payment success`, async () => {
		globalThis.fetch = async () => {
			if (failure === "network") throw new Error("offline");
			if (failure === "invalid-json") return new Response("not json");
			if (failure === "missing-plan") return Response.json({ ok: true });
			return Response.json(
				{ error: "Checkout is not ready yet." },
				{ status: 409 },
			);
		};
		await mount("cs_error");
		assert.equal(title(), "Could not confirm your subscription");
		assert.ok(container.querySelector('[role="alert"]'));
		assert.doesNotMatch(
			container.textContent ?? "",
			/Subscription confirmed|Stripe confirmed the payment/,
		);
		assert.equal(refreshes, 0);
	});
}

test("leaving before the response arrives still ignores the late result", async () => {
	const pending = deferredResponse();
	globalThis.fetch = async () => pending.promise;
	await mount("cs_late");
	await act(async () => root!.unmount());
	root = null;
	await act(async () =>
		pending.resolve(Response.json({ ok: true, planCode: "pro" })),
	);
	assert.equal(refreshes, 0);
	assert.equal(container.textContent, "");
});
