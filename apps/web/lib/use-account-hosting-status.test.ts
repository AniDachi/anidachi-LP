import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAccountHostingStatus } from "./use-account-hosting-status";
import type { AccountHostingRead } from "./account-hosting-status-client";
const owner = "f6250000-0000-4000-8000-000000000001",
	at = Date.parse("2030-01-01T23:59:58Z");
const status = {
	accountHostingVersion: 1 as const,
	ownerUserId: owner,
	planCode: "free" as const,
	serverTime: at,
	validUntil: at + 1000,
	period: { utcDay: "2030-01-01", resetAt: at + 2000 },
	activeRoom: null,
	canCreateRoom: true,
	access: {
		kind: "daily_free" as const,
		budgetSeconds: 1200 as const,
		usedSeconds: 0,
		remainingSeconds: 1200,
		metering: false,
	},
};
let root: Root | undefined, el: HTMLDivElement;
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.innerHTML = "";
});
function View({
	ownerUserId = owner,
	request,
}: {
	ownerUserId?: string;
	request: (owner: string, signal?: AbortSignal) => Promise<AccountHostingRead>;
}) {
	const value = useAccountHostingStatus(ownerUserId, request);
	return React.createElement(
		"div",
		null,
		value.status
			? String(value.remainingSeconds)
			: value.busy
				? "loading"
				: "unknown",
	);
}
async function mount(request: Parameters<typeof View>[0]["request"]) {
	el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	await act(async () => root!.render(React.createElement(View, { request })));
}
test("departure, signout and owner switch fence pending account results", async () => {
	let reply!: (v: AccountHostingRead) => void;
	const request = () =>
		new Promise<AccountHostingRead>((resolve) => {
			reply = resolve;
		});
	await mount(request);
	await act(async () => window.dispatchEvent(new Event("blur")));
	await act(async () => reply({ mode: "free20", status }));
	assert.equal(el.textContent, "unknown");
	await act(async () => window.dispatchEvent(new Event("focus")));
	await act(async () =>
		window.dispatchEvent(new Event("anidachi:before-sign-out")),
	);
	await act(async () => reply({ mode: "free20", status }));
	assert.equal(el.textContent, "unknown");
	await act(async () =>
		root!.render(
			React.createElement(View, {
				ownerUserId: "other",
				request: async () => ({ mode: "free20" as const, status }),
			}),
		),
	);
	assert.equal(el.textContent, "unknown");
});
test("expiry and UTC each allow one recovery, failed reads do not poll", async (t) => {
	t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
	let now = 0,
		reads = 0;
	t.mock.method(performance, "now", () => now);
	await mount(async () => {
		reads++;
		if (reads > 1) throw Error("down");
		return { mode: "free20", status };
	});
	assert.equal(el.textContent, "1200");
	now = 1000;
	await act(async () => t.mock.timers.tick(1000));
	assert.equal(el.textContent, "unknown");
	now = 5000;
	await act(async () => t.mock.timers.tick(4000));
	assert.equal(reads, 2, "expiry and UTC recoveries coalesce; failures stop");
	now = 120000;
	await act(async () => t.mock.timers.tick(115000));
	assert.equal(reads, 2, "expiry and UTC recoveries coalesce; failures stop");
});
