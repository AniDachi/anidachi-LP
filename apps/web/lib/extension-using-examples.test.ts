import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import {
	OverlayInterfaceMock,
	OverlayRoomMock,
} from "../components/overlay-using-mocks";

const dom = new Window({ url: "https://example.test/extension" });
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
for (const key of [
	"window",
	"document",
	"HTMLElement",
	"Element",
	"Node",
	"Event",
	"ResizeObserver",
	"IntersectionObserver",
] as const) {
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: key === "window" ? dom : dom[key],
	});
}
const host = document.createElement("div");
document.body.append(host);
let root = createRoot(host);
afterEach(async () => {
	await act(async () => root.unmount());
	root = createRoot(host);
});

function exampleRoot(): ParentNode {
	return host.querySelector("[data-extension-example]")?.shadowRoot ?? host;
}

test("installation interface controls remain accessible and update only the example", async () => {
	const fetchBefore = globalThis.fetch;
	let requests = 0;
	globalThis.fetch = async () => {
		requests++;
		throw new Error("Example must stay local");
	};
	try {
		await act(async () =>
			root.render(React.createElement(OverlayInterfaceMock)),
		);
		const buttons = [
			...exampleRoot().querySelectorAll<HTMLButtonElement>("button"),
		];
		const option = buttons.find(
			(button) => button.textContent?.trim() === "Auto hide",
		);
		assert.ok(option);
		assert.ok(
			!option.closest('[aria-hidden="true"]'),
			"Interactive choices must not be hidden from assistive technology",
		);
		await act(async () => option.click());
		assert.equal(option.getAttribute("aria-checked"), "true");
		assert.equal(requests, 0);
		assert.equal(dom.localStorage.length, 0);
	} finally {
		globalThis.fetch = fetchBefore;
	}
});

test("room-default example can change a choice without persisting it after remount", async () => {
	await act(async () => root.render(React.createElement(OverlayRoomMock)));
	const option = [
		...exampleRoot().querySelectorAll<HTMLButtonElement>("button"),
	].find((button) => button.textContent?.trim() === "Open mic");
	assert.ok(
		option,
		"Room default choices should use the real interactive control",
	);
	await act(async () => option.click());
	assert.equal(option.getAttribute("aria-checked"), "true");
	await act(async () => root.render(null));
	await act(async () => root.render(React.createElement(OverlayRoomMock)));
	const resetOption = [
		...exampleRoot().querySelectorAll<HTMLButtonElement>("button"),
	].find((button) => button.textContent?.trim() === "Open mic");
	assert.equal(resetOption?.getAttribute("aria-checked"), "false");
	assert.equal(dom.localStorage.length, 0);
});
