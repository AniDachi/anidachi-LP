import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import {
	OverlayInterfaceMock,
	OverlayMediaMock,
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

test("media example toggles the real controls without requests, capture or saved preferences", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const fetchBefore = globalThis.fetch;
	const navigatorBefore = Object.getOwnPropertyDescriptor(
		globalThis,
		"navigator",
	);
	let requests = 0;
	let captures = 0;
	globalThis.fetch = async () => {
		requests++;
		throw new Error("Example must stay local");
	};
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			mediaDevices: {
				getUserMedia: async () => {
					captures++;
					throw new Error("No capture in examples");
				},
			},
		},
	});
	try {
		await act(async () => root.render(React.createElement(OverlayMediaMock)));
		const mic =
			exampleRoot().querySelector<HTMLButtonElement>(".panel-media-mic")!;
		const camera = exampleRoot().querySelector<HTMLButtonElement>(
			".panel-media-camera",
		)!;
		const hint = exampleRoot().querySelector(".panel-media-mic-hint")!;
		assert.equal(mic.getAttribute("aria-pressed"), "false");
		assert.equal(camera.getAttribute("aria-checked"), "false");
		await act(async () => mic.click());
		assert.equal(mic.getAttribute("aria-pressed"), "true");
		assert.equal(hint.getAttribute("data-visible"), "true");
		assert.match(
			exampleRoot().querySelector('[role="tooltip"]')!.textContent!,
			/Mic is always on/,
		);
		await act(async () => context.mock.timers.tick(1000));
		assert.equal(hint.getAttribute("data-visible"), "false");
		await act(async () => camera.click());
		assert.equal(camera.getAttribute("aria-checked"), "true");
		await act(async () => mic.click());
		assert.equal(mic.getAttribute("aria-pressed"), "false");
		assert.match(
			exampleRoot().querySelector('[role="tooltip"]')!.textContent!,
			/Hold V to talk/,
		);
		await act(async () => root.render(null));
		await act(async () => root.render(React.createElement(OverlayMediaMock)));
		assert.equal(
			exampleRoot()
				.querySelector(".panel-media-camera")!
				.getAttribute("aria-checked"),
			"false",
		);
		assert.equal(requests, 0);
		assert.equal(captures, 0);
		assert.equal(dom.localStorage.length, 0);
	} finally {
		globalThis.fetch = fetchBefore;
		if (navigatorBefore)
			Object.defineProperty(globalThis, "navigator", navigatorBefore);
		else Reflect.deleteProperty(globalThis, "navigator");
	}
});
