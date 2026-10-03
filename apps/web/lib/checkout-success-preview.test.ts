import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import CheckoutSuccessPreviewPage from "../app/dev/checkout-success/page";

const originalMode = process.env.NODE_ENV;
const originalFetch = globalThis.fetch;
let root: Root | null = null;
const env = process.env as Record<string, string | undefined>;

afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	if (originalMode === undefined) delete env.NODE_ENV;
	else env.NODE_ENV = originalMode;
});

for (const mode of ["production", "test", undefined]) {
	test(`checkout design preview is unavailable in ${mode ?? "unset"} mode`, () => {
		if (mode === undefined) delete env.NODE_ENV;
		else env.NODE_ENV = mode;
		assert.throws(CheckoutSuccessPreviewPage, /NEXT_HTTP_ERROR_FALLBACK;404/);
	});
}

test("local preview switches paid and trial UI without account or payment requests", async () => {
	env.NODE_ENV = "development";
	let requests = 0;
	globalThis.fetch = async () => {
		requests++;
		throw new Error("Preview must not use the network");
	};
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root!.render(CheckoutSuccessPreviewPage()));
	assert.equal(
		container.querySelector("h1")?.textContent,
		"Subscription confirmed",
	);
	assert.match(container.textContent!, /active on Plus/);
	assert.match(container.textContent!, /sample data/);
	const buttons = () => [...container.querySelectorAll("button")];
	await act(async () =>
		buttons()
			.find((b) => b.textContent === "3-day trial")!
			.click(),
	);
	assert.equal(
		container.querySelector("h1")?.textContent,
		"Your free trial has started",
	);
	assert.match(container.textContent!, /Your Plus trial ends/);
	await act(async () =>
		buttons()
			.find((b) => b.textContent === "Paid Plus")!
			.click(),
	);
	assert.equal(
		container.querySelector("h1")?.textContent,
		"Subscription confirmed",
	);
	assert.equal(container.querySelector("input"), null);
	assert.ok(container.querySelector('a[href="/account"]'));
	assert.ok(container.querySelector('a[href="/account/billing"]'));
	assert.ok(container.querySelector('a[href="/contact"]'));
	assert.equal(requests, 0);
});
