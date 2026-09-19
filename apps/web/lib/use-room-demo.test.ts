import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	DEMO_MESSAGE,
	type RoomDemoPhase,
	useDemoTyping,
	useRoomDemo,
} from "./use-room-demo";

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

test("demonstrates creation, both invites, cameras, voice, chat and reaction and layout customization in under 28 seconds", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	assert.equal(phase(), "pill");
	const steps = [
		[1200, "open"],
		[1700, "creating"],
		[450, "ready"],
		[650, "copy-link"],
		[750, "link-copied"],
		[900, "open-invites"],
		[650, "friends"],
		[1050, "inviting"],
		[300, "invited"],
		[500, "accepted"],
		[1200, "together"],
		[500, "camera"],
		[700, "camera-on"],
		[450, "watching"],
		[600, "speaking"],
		[900, "compose"],
		[500, "typing"],
		[1800, "send"],
		[650, "chat"],
		[800, "reaction"],
		[2600, "layout-open"],
		[600, "layout-tab"],
		[700, "layout-preview"],
		[800, "layout-size"],
		[850, "layout-move-camera"],
		[1000, "layout-select-chat"],
		[650, "layout-move-chat"],
		[1000, "layout-apply"],
		[700, "layout-done"],
		[1800, "pill"],
	] as const;
	assert.ok(steps.reduce((duration, [delay]) => duration + delay, 0) <= 28000);
	for (const [delay, expected] of steps) {
		const before = phase();
		await act(async () => context.mock.timers.tick(delay - 1));
		assert.equal(phase(), before);
		await act(async () => context.mock.timers.tick(1));
		assert.equal(phase(), expected);
	}
});

test("typing pauses offscreen, completes before send and resets for another loop", async (context) => {
	context.mock.timers.enable({ apis: ["setInterval"] });
	function Composer({
		phase,
		playing,
	}: {
		phase: RoomDemoPhase;
		playing: boolean;
	}) {
		return React.createElement("output", null, useDemoTyping(phase, playing));
	}
	await render();
	const show = async (phase: RoomDemoPhase, playing = true) => {
		await act(async () =>
			root!.render(React.createElement(Composer, { phase, playing })),
		);
	};
	await show("typing");
	await act(async () => context.mock.timers.tick(300));
	assert.equal(phase(), "That");
	await show("typing", false);
	await act(async () => context.mock.timers.tick(10000));
	assert.equal(phase(), "That");
	await show("typing");
	await act(async () => context.mock.timers.tick(1500));
	assert.equal(phase(), DEMO_MESSAGE);
	await show("send");
	assert.equal(phase(), DEMO_MESSAGE);
	await show("chat");
	assert.equal(phase(), "");
	await show("typing");
	assert.equal(phase(), "");
	await act(async () => context.mock.timers.tick(75));
	assert.equal(phase(), "T");
});

test("scrolling out cancels the phase timer without advancing through hidden steps", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	await act(async () => context.mock.timers.tick(1200));
	await render(false);
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "open");
	await render(true);
	await act(async () => context.mock.timers.tick(1700));
	assert.equal(phase(), "creating");
});

test("waits for motion preference and shows a stable complete scene with reduced motion", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render(true, null);
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "pill");
	await render(true, true);
	assert.equal(phase(), "reaction");
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "reaction");
});

test("switching away during creation cancels the old scene on unmount", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	await act(async () => context.mock.timers.tick(1200));
	await act(async () => context.mock.timers.tick(1700));
	assert.equal(phase(), "creating");
	await act(async () => root!.unmount());
	root = null;
	await render();
	await act(async () => context.mock.timers.tick(450));
	assert.equal(phase(), "pill");
});

test("switching modes during a pending invitation cannot join a friend in a fresh demo", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	await render();
	for (const delay of [1200, 1700, 450, 650, 750, 900, 650, 1050, 300]) {
		await act(async () => context.mock.timers.tick(delay));
	}
	assert.equal(phase(), "invited");
	await render(false);
	await act(async () => context.mock.timers.tick(60000));
	assert.equal(phase(), "invited");
	await act(async () => root!.unmount());
	root = null;
	await render();
	await act(async () => context.mock.timers.tick(1500));
	assert.equal(phase(), "open");
});
