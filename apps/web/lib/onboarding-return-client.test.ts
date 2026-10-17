import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OnboardingReturn } from "../components/onboarding-return";
import {
	rememberOnboardingCheckout,
	readOnboardingCheckout,
	requestOnboardingReturn,
} from "./onboarding-return-client";
import { onboardingRuntime } from "./test-helpers/onboarding-runtime";
const token = "cbe6173e-b4fb-4e1c-9df9-8c77e73016b1";
const extensionId = "a".repeat(32);
const originalFetch = globalThis.fetch;
let root: Root | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	globalThis.fetch = originalFetch;
	delete (globalThis as { chrome?: unknown }).chrome;
	window.sessionStorage.clear();
	document.body.innerHTML = "";
});
test("checkout receipt cannot return another session or another account", () => {
	rememberOnboardingCheckout(token, "owner-a", "cs_one");
	assert.equal(readOnboardingCheckout("owner-a", "cs_two"), null);
	assert.equal(readOnboardingCheckout("owner-a", "cs_one")?.token, token);
	assert.equal(readOnboardingCheckout("owner-b", "cs_one"), null);
	assert.equal(readOnboardingCheckout("owner-a", "cs_one"), null);
});
test("expired receipts and ordinary website purchases never inherit a return", (t) => {
	t.mock.timers.enable({ apis: ["Date"] });
	rememberOnboardingCheckout(token, "owner-a", "cs_one");
	t.mock.timers.tick(3_600_001);
	assert.equal(readOnboardingCheckout("owner-a", "cs_one"), null);
	rememberOnboardingCheckout(token, "owner-a", "cs_one");
	rememberOnboardingCheckout(undefined, "owner-a", "cs_two");
	assert.equal(readOnboardingCheckout("owner-a"), null);
});
test("unavailable extensions and malformed destinations fail softly", async () => {
	assert.equal(
		await requestOnboardingReturn(
			extensionId,
			token,
			"owner-a",
			new AbortController().signal,
		),
		false,
	);
	let sent = 0;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: onboardingRuntime(() => {
			sent++;
		}),
	};
	assert.equal(
		await requestOnboardingReturn(
			"https://evil.test",
			token,
			"owner-a",
			new AbortController().signal,
		),
		false,
	);
	assert.equal(
		await requestOnboardingReturn(
			extensionId,
			"https://evil.test",
			"owner-a",
			new AbortController().signal,
		),
		false,
	);
	assert.equal(sent, 0);
});
test("successful return verifies current owner once, consumes receipt, and does not repeat on focus", async () => {
	let checks = 0,
		sends = 0;
	globalThis.fetch = async () => {
		checks++;
		return Response.json({ ownerUserId: "owner-a", action: "manage" });
	};
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: onboardingRuntime((id, message, reply) => {
			assert.equal(id, extensionId);
			assert.deepEqual(message, {
				type: "anidachi:onboarding-return:v1",
				token,
				ownerUserId: "owner-a",
			});
			sends++;
			reply({ returned: true });
		}),
	};
	rememberOnboardingCheckout(token, "owner-a", "cs_one");
	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () =>
		root!.render(
			React.createElement(
				React.StrictMode,
				null,
				React.createElement(OnboardingReturn, {
					token,
					owner: "owner-a",
					extensionId,
				}),
			),
		),
	);
	await act(async () => new Promise((r) => setTimeout(r, 20)));
	assert.equal(sends, 1);
	assert.equal(checks, 1);
	assert.equal(readOnboardingCheckout("owner-a"), null);
	await act(async () => window.dispatchEvent(new Event("focus")));
	assert.equal(sends, 1);
	assert.match(el.textContent!, /Continue the tour/);
});
test("changed account never receives an automatic return", async () => {
	globalThis.fetch = async () =>
		Response.json({ ownerUserId: "owner-b", action: "manage" });
	let sent = 0;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: onboardingRuntime(() => {
			sent++;
		}),
	};
	const el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () =>
		root!.render(
			React.createElement(OnboardingReturn, {
				token,
				owner: "owner-a",
				extensionId,
			}),
		),
	);
	await act(async () => new Promise((r) => setTimeout(r, 20)));
	assert.equal(sent, 0);
	assert.match(el.textContent!, /account changed/);
});
test("unmount or page navigation disconnects the request in the extension", async () => {
	const runtime = onboardingRuntime(() => {});
	(globalThis as { chrome?: unknown }).chrome = { runtime };
	const abort = new AbortController();
	const first = requestOnboardingReturn(
		extensionId,
		token,
		"owner-a",
		abort.signal,
	);
	abort.abort();
	assert.equal(await first, false);
	assert.equal(runtime.disconnected, 1);
	const second = requestOnboardingReturn(
		extensionId,
		token,
		"owner-a",
		new AbortController().signal,
	);
	window.dispatchEvent(new Event("pagehide"));
	assert.equal(await second, false);
	assert.equal(runtime.disconnected, 2);
});
