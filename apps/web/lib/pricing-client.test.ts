import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Pricing } from "../components/pricing";
let root: Root | null = null;
const originalFetch = globalThis.fetch;
const offer = {
	ownerUserId: "owner",
	paidHostingActive: true,
	trialAvailable: true,
	action: "trial",
	validForMs: 60000,
	prices: {
		plus: { unitAmount: 799, currency: "usd" },
		pro: { unitAmount: 1499, currency: "usd" },
	},
};
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
});
test("an open pricing tab retires pre-cutover hosting at the server deadline", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	let requests = 0;
	globalThis.fetch = async () =>
		Response.json({
			...offer,
			paidHostingActive: ++requests > 1,
			validForMs: 1000,
		});
	const el = await mount();
	assert.match(el.textContent!, /30 min/);
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(requests, 2);
	assert.doesNotMatch(el.textContent!, /30 min|4 people/);
});
async function mount() {
	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () => root!.render(React.createElement(Pricing)));
	return el;
}
test("eligible Free sees card-required trial and cannot mistake Free for hosting", async () => {
	globalThis.fetch = async () => Response.json(offer);
	const el = await mount();
	assert.equal(
		[...el.querySelectorAll("button")].filter((b) =>
			b.textContent?.includes("Start 3-day free trial"),
		).length,
		2,
	);
	assert.match(el.textContent!, /Card required/);
	assert.doesNotMatch(el.textContent!, /30 min|4 people/);
});
test("used trial and current subscribers get paid or management actions", async () => {
	for (const action of ["subscribe", "manage"]) {
		globalThis.fetch = async () =>
			Response.json({ ...offer, action, trialAvailable: false });
		const el = await mount();
		assert.doesNotMatch(el.textContent!, /Start 3-day free trial/);
		assert.match(
			el.textContent!,
			action === "manage" ? /Manage subscription/ : /Subscribe to Plus/,
		);
		await act(async () => root?.unmount());
		root = null;
		el.remove();
	}
});
test("authority outage does not invent trial eligibility", async () => {
	globalThis.fetch = async () =>
		Response.json({ error: "unavailable" }, { status: 503 });
	const el = await mount();
	assert.doesNotMatch(el.textContent!, /Start 3-day free trial|30 min/);
	assert.ok([...el.querySelectorAll("button")].some((b) => b.disabled));
	assert.match(el.textContent!, /try again/i);
});
