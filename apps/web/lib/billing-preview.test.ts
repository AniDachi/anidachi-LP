import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, createElement } from "react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { createRoot, type Root } from "react-dom/client";
import BillingPreviewPage from "../app/dev/billing/page";
const originalMode = process.env.NODE_ENV;
const originalFetch = globalThis.fetch;
const env = process.env as Record<string, string | undefined>;
let root: Root | null = null;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	if (originalMode === undefined) delete env.NODE_ENV;
	else env.NODE_ENV = originalMode;
});
for (const mode of ["production", "test", undefined]) {
	test(`billing preview is unavailable in ${mode ?? "unset"} mode`, () => {
		if (mode === undefined) delete env.NODE_ENV;
		else env.NODE_ENV = mode;
		assert.throws(BillingPreviewPage, /NEXT_HTTP_ERROR_FALLBACK;404/);
	});
}
test("billing preview and its actions cannot contact billing services", async () => {
	env.NODE_ENV = "development";
	let requests = 0;
	globalThis.fetch = async () => {
		requests++;
		throw new Error("No preview requests allowed");
	};
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root!.render(createElement(PathnameContext.Provider, { value: "/dev/billing" }, BillingPreviewPage())));
	assert.match(container.textContent!, /sample subscription/);
	assert.match(container.textContent!, /76.70/);
	for (const label of ["Refresh status", "Cancel renewal"]) {
		const button = [...container.querySelectorAll("button")].find((b) =>
			b.textContent?.includes(label),
		);
		assert.ok(button);
		await act(async () => button.click());
	}
	assert.match(container.textContent!, /No subscription changes were made/);
	assert.equal(requests, 0);
});
