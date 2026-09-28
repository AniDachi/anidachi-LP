import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BillingClient } from "../app/account/billing/billing-client";
import { BILLING_OWNER_HEADER, type BillingOverview } from "./billing-view";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const testWindow = new Window({
	url: "https://staging.anidachi.app/account/billing",
});
for (const [name, value] of Object.entries({
	window: testWindow,
	self: testWindow,
	document: testWindow.document,
	navigator: testWindow.navigator,
	HTMLElement: testWindow.HTMLElement,
	Node: testWindow.Node,
	Event: testWindow.Event,
})) {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value,
		writable: true,
	});
}
const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;
const active: BillingOverview = {
	ownerUserId: "owner",
	planCode: "plus",
	serverTime: "2030-01-01T00:00:00Z",
	subscriptions: [
		{
			id: "local-sub",
			planCode: "plus",
			status: "active",
			currentPeriodEnd: "2030-02-01T12:00:00.000Z",
			cancelAtPeriodEnd: false,
			canCancel: true,
		},
	],
};
for (const stage of ["trial", "processing"] as const) {
	test(`a focused billing tab retires ${stage} claims at the server boundary`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
		let requests = 0;
		globalThis.fetch = async () =>
			Response.json(
				++requests === 1
					? {
							...active,
							selectedPlanExpiresAt: "2030-01-01T00:00:01Z",
							subscriptions: [
								{
									...active.subscriptions[0],
									canChangeTrialPlan: stage === "trial",
									trial: {
										stage,
										endsAt:
											stage === "trial"
												? "2030-01-01T00:00:01Z"
												: "2029-12-31T22:00:01Z",
										pendingUntil: "2030-01-01T00:00:01Z",
									},
								},
							],
						}
					: { ...active, planCode: "free", subscriptions: [] },
			);
		await mount();
		assert.match(
			container.textContent!,
			stage === "trial" ? /Free trial/ : /First payment processing/,
		);
		await act(async () => t.mock.timers.tick(1000));
		assert.equal(requests, 2);
		assert.doesNotMatch(
			container.textContent!,
			/Free trial|First payment processing|Switch to Pro/,
		);
	});
}
async function mount(returnedFromPortal = false) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => {
		root?.render(
			React.createElement(BillingClient, {
				ownerUserId: "owner",
				returnedFromPortal,
			}),
		);
	});
}
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
});

test("trial shows original deadline and reviewed plan change before confirming", async () => {
	const actions: string[] = [];
	globalThis.fetch = async (path, init) => {
		if (String(path).endsWith("trial-plan")) {
			const body = JSON.parse(String(init?.body));
			actions.push(body.action);
			assert.equal(
				new Headers(init?.headers).get(BILLING_OWNER_HEADER),
				"owner",
			);
			if (body.action === "quote")
				return Response.json({
					ownerUserId: "owner",
					quote: {
						planCode: "pro",
						currentPlanCode: "plus",
						unitAmount: 1499,
						currency: "usd",
						trialEndsAt: "2030-02-01T12:00:00.000Z",
						renewalCanceled: true,
					},
				});
			return Response.json({ ownerUserId: "owner", planCode: "pro" });
		}
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					cancelAtPeriodEnd: true,
					canCancel: false,
					canChangeTrialPlan: true,
					monthlyPrice: { unitAmount: 799, currency: "usd" },
					trial: {
						endsAt: "2030-02-01T12:00:00.000Z",
						stage: "trial",
						pendingUntil: "2030-02-01T14:00:00.000Z",
					},
				},
			],
		});
	};
	await mount();
	const change = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Switch to Pro"),
	);
	assert.ok(change);
	await act(async () => change.click());
	assert.deepEqual(actions, ["quote"]);
	assert.match(container.textContent!, /14.99/);
	assert.match(container.textContent!, /renewal stays canceled/i);
	const confirm = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Confirm plan change"),
	);
	assert.ok(confirm);
	await act(async () => confirm.click());
	assert.deepEqual(actions, ["quote", "confirm"]);
});
test("post-cutover Free and pending payment do not advertise free hosting or paid success", async () => {
	globalThis.fetch = async () =>
		Response.json({
			...active,
			planCode: "free",
			serverTime: "2030-02-01T13:00:00Z",
			hosting: {
				hostingActivationAt: "2029-01-01T00:00:00Z",
				trialEligibility: "used",
			},
			subscriptions: [
				{
					...active.subscriptions[0],
					trial: {
						stage: "processing",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
			],
		});
	await mount();
	assert.doesNotMatch(container.textContent!, /30 minutes|4 people/);
	assert.match(container.textContent!, /First payment processing/);
});

test("active subscription shows renewal date and explicit cancellation with owner-bound request", async () => {
	const requests: { path: string; init?: RequestInit }[] = [];
	globalThis.fetch = async (path, init) => {
		requests.push({ path: String(path), init });
		if (String(path).endsWith("cancellation-portal"))
			return Response.json(
				{ error: "Subscription cancellation is temporarily unavailable." },
				{ status: 503 },
			);
		return Response.json(active);
	};
	await mount();
	assert.match(container.textContent ?? "", /Plus subscription/);
	assert.equal(container.querySelector("dt")?.textContent, "Renews");
	assert.equal(container.querySelector("dd")?.textContent, "February 1, 2030");
	const button = [...container.querySelectorAll("button")].find((item) =>
		item.textContent?.includes("Cancel subscription"),
	);
	assert.ok(button);
	await act(async () => button.click());
	assert.equal(requests[1]?.path, "/api/billing/cancellation-portal");
	assert.equal(
		new Headers(requests[1]?.init?.headers).get(BILLING_OWNER_HEADER),
		"owner",
	);
	assert.equal(
		requests[1]?.init?.body,
		JSON.stringify({ subscriptionId: "local-sub" }),
	);
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/temporarily unavailable/,
	);
	assert.equal(button.disabled, false);
});

test("return from Stripe refreshes status and shows scheduled end without another cancellation button", async () => {
	let path: string | undefined;
	let method: string | undefined;
	globalThis.fetch = async (input, init) => {
		path = String(input);
		method = init?.method;
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
				},
			],
		});
	};
	await mount(true);
	assert.equal(path, "/api/billing/refresh");
	assert.equal(method, "POST");
	assert.match(container.textContent ?? "", /Renewal canceled/);
	assert.equal(container.querySelector("dt")?.textContent, "Subscription ends");
	assert.equal(container.querySelector("dd")?.textContent, "February 1, 2030");
	assert.doesNotMatch(container.textContent ?? "", /Cancel subscription/);
});

test("Free account without billing has no cancellation action", async () => {
	globalThis.fetch = async () =>
		Response.json({
			ownerUserId: "owner",
			planCode: "free",
			serverTime: "2030-01-01T00:00:00Z",
			hosting: { hostingActivationAt: null },
			subscriptions: [],
		});
	await mount();
	assert.match(container.textContent ?? "", /30 minutes a day/);
	assert.match(container.textContent ?? "", /Up to 4 people/);
	assert.equal(
		container.querySelector('a[href="/extension#using"]')?.textContent?.trim(),
		"Download for Chrome",
	);
	assert.equal(
		container.querySelector('a[href="/pricing"]')?.textContent?.trim(),
		"View plans",
	);
	assert.doesNotMatch(container.textContent ?? "", /Cancel subscription/);
});

test("Free account with a canceled subscription still shows host limits", async () => {
	globalThis.fetch = async () =>
		Response.json({
			ownerUserId: "owner",
			planCode: "free",
			serverTime: "2030-01-01T00:00:00Z",
			hosting: { hostingActivationAt: null },
			subscriptions: [
				{
					id: "ended-sub",
					planCode: "plus",
					status: "canceled",
					currentPeriodEnd: "2020-02-01T12:00:00.000Z",
					cancelAtPeriodEnd: true,
					canCancel: false,
				},
			],
		});
	await mount();
	assert.match(container.textContent ?? "", /30 minutes a day/);
	assert.match(container.textContent ?? "", /Plus subscription/);
	assert.doesNotMatch(container.textContent ?? "", /No recurring subscription/);
	assert.doesNotMatch(container.textContent ?? "", /Cancel subscription/);
});

test("response for another owner never displays their billing state", async () => {
	globalThis.fetch = async () =>
		Response.json({ ...active, ownerUserId: "another-owner" });
	await mount();
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/account changed/,
	);
	assert.doesNotMatch(container.textContent ?? "", /Plus subscription/);
});

test("canceled renewal offers restoration through an owner-bound request", async () => {
	const requests: { path: string; init?: RequestInit }[] = [];
	globalThis.fetch = async (path, init) => {
		requests.push({ path: String(path), init });
		if (String(path).endsWith("renewal-portal"))
			return Response.json(
				{ error: "Renewal management is temporarily unavailable." },
				{ status: 503 },
			);
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					cancelAtPeriodEnd: true,
					canCancel: false,
					canRestoreRenewal: true,
				},
			],
		});
	};
	await mount();
	const button = [...container.querySelectorAll("button")].find((b) =>
		b.textContent?.includes("Restore renewal"),
	);
	assert.ok(button);
	await act(async () => button.click());
	assert.equal(requests[1]?.path, "/api/billing/renewal-portal");
	assert.equal(
		new Headers(requests[1]?.init?.headers).get(BILLING_OWNER_HEADER),
		"owner",
	);
	assert.equal(
		requests[1]?.init?.body,
		JSON.stringify({ subscriptionId: "local-sub" }),
	);
	assert.match(
		container.querySelector('[role="alert"]')?.textContent ?? "",
		/temporarily unavailable/,
	);
	assert.equal(button.disabled, false);
});

test("restoration eligibility disappears at its own deadline even with another longer access grant", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let requests = 0;
	globalThis.fetch = async () =>
		Response.json(
			++requests === 1
				? {
						...active,
						selectedPlanExpiresAt: "2030-02-01T00:00:00Z",
						subscriptions: [
							{
								...active.subscriptions[0],
								currentPeriodEnd: "2030-01-01T00:00:01Z",
								cancelAtPeriodEnd: true,
								canCancel: false,
								canRestoreRenewal: true,
							},
						],
					}
				: { ...active, subscriptions: [] },
		);
	await mount();
	assert.match(container.textContent!, /Restore renewal/);
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(requests, 2);
	assert.doesNotMatch(container.textContent!, /Restore renewal/);
});

test("return from renewal restoration rereads Stripe and retains the original trial deadline", async () => {
	let requestedPath: string | undefined;
	let method: string | undefined;
	globalThis.fetch = async (path, init) => {
		requestedPath = String(path);
		method = init?.method;
		return Response.json({
			...active,
			subscriptions: [
				{
					...active.subscriptions[0],
					status: "trialing",
					canRestoreRenewal: false,
					trial: {
						stage: "trial",
						endsAt: "2030-02-01T12:00:00Z",
						pendingUntil: "2030-02-01T14:00:00Z",
					},
				},
			],
		});
	};
	await mount(true);
	assert.equal(requestedPath, "/api/billing/refresh");
	assert.equal(method, "POST");
	assert.match(container.textContent!, /Free trial/);
	assert.match(container.textContent!, /first monthly payment is scheduled/);
	assert.equal(container.querySelector("dd")?.textContent, "February 1, 2030");
	assert.doesNotMatch(
		container.textContent!,
		/Restore renewal|Renewal canceled/,
	);
});
