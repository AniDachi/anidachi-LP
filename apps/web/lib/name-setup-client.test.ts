import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NameSetupScreen } from "../app/login/name/name-setup-screen";
import { PROFILE_OWNER_HEADER } from "./profile-owner";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "https://staging.anidachi.app/login/name" });
for (const [key, value] of Object.entries({
	window: dom, self: dom, document: dom.document, navigator: dom.navigator,
	HTMLElement: dom.HTMLElement, HTMLInputElement: dom.HTMLInputElement,
	Node: dom.Node, Element: dom.Element, Event: dom.Event,
})) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });

const owner = "11111111-1111-4111-8111-111111111111";
const destination = "/extension/connect?handoff=opaque%2Fvalue";
const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;

async function render() {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => { root!.render(React.createElement(NameSetupScreen, { ownerUserId: owner, returnTo: destination })); });
}
async function typeName(value: string) {
	const input = container.querySelector("input")!;
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}
async function submit() {
	await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
	globalThis.fetch = originalFetch;
	dom.happyDOM.setURL("https://staging.anidachi.app/login/name");
});

test("choosing a name saves only that field for the current owner and continues the original handoff", async () => {
	let calls = 0;
	globalThis.fetch = async (path, init) => {
		calls++;
		assert.equal(path, "/api/me/profile");
		assert.equal(new Headers(init?.headers).get(PROFILE_OWNER_HEADER), owner);
		assert.deepEqual(JSON.parse(String(init?.body)), { displayName: "Alex Chen" });
		return Response.json({ profile: { userId: owner, displayName: "Alex Chen" } });
	};
	await render();
	await typeName("  Alex   Chen  ");
	await submit();
	assert.equal(calls, 1);
	assert.equal(window.location.pathname + window.location.search, destination);
});

test("blank and placeholder names cannot complete setup", async () => {
	globalThis.fetch = async () => { assert.fail("Should not save invalid name"); };
	await render();
	for (const name of ["   ", "AniDachi user"]) {
		await typeName(name);
		await submit();
		assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Enter your name/);
		assert.equal(window.location.pathname, "/login/name");
	}
});

test("failed saves retain the draft; responses belonging to another account cannot continue", async () => {
	await render();
	await typeName("Maya");
	for (const response of [
		Response.json({ error: "Unavailable" }, { status: 503 }),
		Response.json({ profile: { userId: "another-owner", displayName: "Maya" } }),
	]) {
		globalThis.fetch = async () => response;
		await submit();
		assert.equal(container.querySelector("input")?.value, "Maya");
		assert.equal(window.location.pathname, "/login/name");
		assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Couldn't save/);
		assert.equal(container.querySelector("button")?.disabled, false);
	}
});
