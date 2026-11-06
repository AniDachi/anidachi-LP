import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChromeExtensionFriendsDemo } from "../components/chrome-extension-friends-demo";
import type { RoomDemoPhase } from "./use-room-demo";

let root: Root | null = null;
let container: HTMLDivElement;
async function render(phase: RoomDemoPhase, open = true) {
	if (!root) {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	}
	await act(async () =>
		root!.render(
			React.createElement(ChromeExtensionFriendsDemo, { phase, open }),
		),
	);
}
const emma = () => container.querySelector<HTMLButtonElement>(".cf-invite")!;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.replaceChildren();
});

test("the homepage uses the real Friends window and only shows membership after the join scene", async (context) => {
	const fetch = context.mock.method(globalThis, "fetch", async () => {
		throw Error("The demo must stay local");
	});
	await render("friends");
	assert.equal(container.querySelectorAll(".cf-row").length, 3);
	assert.ok(
		container.querySelector(".cf-frame"),
		"the attached window uses the real curved frame",
	);
	assert.equal(emma().textContent, "Invite");
	assert.equal(emma().disabled, false);
	await render("inviting");
	assert.equal(emma().getAttribute("aria-busy"), "true");
	assert.equal(emma().disabled, true);
	await render("invited");
	assert.equal(emma().textContent, "Sent");
	assert.equal(emma().getAttribute("data-state"), "sent");
	await render("accepted");
	assert.equal(emma().textContent, "In room");
	assert.equal(emma().getAttribute("data-state"), "in-room");
	assert.equal(
		container.querySelectorAll('.cf-invite[data-state="in-room"]').length,
		1,
	);
	assert.equal(fetch.mock.callCount(), 0);
});

test("the window stays mounted for closing motion, resets on replay, and is never interactive", async () => {
	await render("open", false);
	const window = container.querySelector(".cf-reveal")!;
	assert.equal(window.getAttribute("data-open"), "false");
	assert.ok(
		container.querySelector(".demo-friends-preview[inert][aria-hidden=true]"),
	);
	await render("friends");
	assert.equal(container.querySelector(".cf-reveal"), window);
	assert.equal(window.getAttribute("data-open"), "true");
	await render("accepted");
	await render("together", false);
	assert.equal(container.querySelector(".cf-reveal"), window);
	assert.equal(window.getAttribute("aria-hidden"), "true");
	assert.ok(window.hasAttribute("inert"));
	assert.equal(emma().textContent, "In room");
	await render("open", false);
	await render("friends");
	assert.equal(emma().textContent, "Invite");
	assert.equal(emma().disabled, false);
});
