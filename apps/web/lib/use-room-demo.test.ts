import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRoomDemo } from "./use-room-demo";

let root: Root | null = null;
let container: HTMLDivElement;
function Scene({
	visible,
	reducedMotion,
}: {
	visible: boolean;
	reducedMotion: boolean | null;
}) {
	return React.createElement(
		"output",
		null,
		useRoomDemo(visible, reducedMotion),
	);
}
async function render(visible = true, reducedMotion: boolean | null = false) {
	if (!root) {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	}
	await act(async () =>
		root!.render(React.createElement(Scene, { visible, reducedMotion })),
	);
}
const phase = () => container.textContent;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	document.body.innerHTML = "";
});

test("automatically opens, creates and shows the host room before repeating", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	assert.equal(phase(), "pill");
	await act(async () => context.mock.timers.tick(2200));
	assert.equal(phase(), "open");
	await act(async () => context.mock.timers.tick(2800));
	assert.equal(phase(), "creating");
	await act(async () => context.mock.timers.tick(800));
	assert.equal(phase(), "ready");
	await act(async () => context.mock.timers.tick(4199));
	assert.equal(phase(), "ready");
	await act(async () => context.mock.timers.tick(1));
	assert.equal(phase(), "pill");
});

test("scrolling out cancels the phase timer without advancing through hidden steps", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	await act(async () => context.mock.timers.tick(2200));
	await render(false);
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "open");
	await render(true);
	await act(async () => context.mock.timers.tick(2800));
	assert.equal(phase(), "creating");
});

test("waits for motion preference and shows a stable complete scene with reduced motion", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render(true, null);
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "pill");
	await render(true, true);
	assert.equal(phase(), "ready");
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "ready");
});

test("switching away during creation cancels the old scene on unmount", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	await act(async () => context.mock.timers.tick(2200));
	await act(async () => context.mock.timers.tick(2800));
	assert.equal(phase(), "creating");
	await act(async () => root!.unmount());
	root = null;
	await render();
	await act(async () => context.mock.timers.tick(800));
	assert.equal(phase(), "pill");
});
