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
	assert.match(container.textContent ?? "", /Renews: February 1, 2030/);
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
	assert.match(
		container.textContent ?? "",
		/Subscription ends: February 1, 2030/,
	);
	assert.doesNotMatch(container.textContent ?? "", /Cancel subscription/);
});

test("Free account without billing has no cancellation action", async () => {
	globalThis.fetch = async () =>
		Response.json({
			ownerUserId: "owner",
			planCode: "free",
			subscriptions: [],
		});
	await mount();
	assert.match(container.textContent ?? "", /No recurring subscription/);
	assert.equal(
		container.querySelector('a[href="/pricing"]')?.textContent,
		"View plans",
	);
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
