import "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ExtensionWelcomeHero } from "../components/extension-welcome-hero";
import { MobileInstallProvider } from "../components/mobile-install-panel";
import type { ExtensionWelcome } from "./extension-welcome";

let root: Root | undefined;
let el: HTMLDivElement;
let refreshes = 0;
const originalFetch = globalThis.fetch;
const originalUserAgent = navigator.userAgent;
const trial: ExtensionWelcome = {
	kind: "trial",
	plan: "plus",
	endsAt: "2030-01-04T00:00:00Z",
	expiresInMs: 100000,
	cardlessWithoutRenewal: true,
};
const router = {
	back() {},
	forward() {},
	push() {},
	replace() {},
	prefetch: async () => {},
	refresh() {
		refreshes++;
	},
};
beforeEach((t) => {
	if ("mock" in t) t.mock.method(performance, "now", () => 0);
});
async function mount(welcome: ExtensionWelcome) {
	el = document.createElement("div");
	document.body.append(el);
	root = createRoot(el);
	globalThis.fetch = async () => {
		throw Error("Welcome must not start trials or poll APIs");
	};
	await act(async () =>
		root!.render(
			React.createElement(
				AppRouterContext.Provider,
				{ value: router },
				React.createElement(
					MobileInstallProvider,
					null,
					React.createElement(ExtensionWelcomeHero, {
						welcome,
						extensionId: "a".repeat(32),
					}),
				),
			),
		),
	);
}
afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	document.body.innerHTML = "";
	delete (globalThis as { chrome?: unknown }).chrome;
	globalThis.fetch = originalFetch;
	refreshes = 0;
	Object.defineProperty(navigator, "userAgent", {
		value: originalUserAgent,
		configurable: true,
	});
});
test("verified trial waits for installation detection, then shows all three platform links", async () => {
	let reply!: (value: unknown) => void;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: {
			sendMessage: (_id: string, message: unknown, done: typeof reply) => {
				assert.deepEqual(message, { type: "anidachi:website-presence:v1" });
				reply = done;
			},
		},
	};
	await mount(trial);
	assert.match(el.textContent!, /3-day trial is active/);
	assert.equal(el.querySelector('a[href*="chromewebstore"]'), null);
	await act(async () =>
		reply({ type: "anidachi:website-presence:v1", installed: true }),
	);
	assert.match(el.textContent!, /Extension ready/);
	for (const provider of ["youtube", "crunchyroll", "netflix"])
		assert.ok(el.querySelector(`a[href="https://www.${provider}.com"]`));
	assert.equal(el.querySelector('a[href*="chromewebstore"]'), null);
	assert.ok(el.querySelector('a[href="/account/billing"]'));
});
test("unavailable or older extension keeps install and manual platform choices usable", async () => {
	await mount(trial);
	assert.ok(el.querySelector('a[href*="chromewebstore"]'));
	assert.ok(el.querySelector('a[href="https://www.youtube.com"]'));
	assert.doesNotMatch(el.textContent!, /Extension ready/);
});
test("inactive and failed verification never show a successful trial or paid plan", async () => {
	for (const kind of ["inactive", "error", "sign_in"] as const) {
		await mount({ kind });
		assert.doesNotMatch(
			el.textContent!,
			/trial is active|plan is active|No automatic charge/,
		);
		assert.equal(el.querySelector('a[href="https://www.youtube.com"]'), null);
		await act(async () => root!.unmount());
		root = undefined;
		el.remove();
	}
});
test("paid and renewing trial do not promise no automatic charge", async () => {
	await mount({ kind: "paid", plan: "pro" });
	assert.match(el.textContent!, /Pro plan is active/);
	assert.doesNotMatch(el.textContent!, /3-day|No automatic charge/);
});
test("expiry retires successful copy without a recurring API poll", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	t.mock.method(performance, "now", () => now);
	await mount({ ...trial, expiresInMs: 500 } as ExtensionWelcome);
	now = 500;
	await act(async () => t.mock.timers.tick(500));
	assert.doesNotMatch(el.textContent!, /3-day trial is active/);
	assert.equal(refreshes, 1);
	await act(async () => t.mock.timers.tick(60000));
	assert.equal(refreshes, 1);
});

test("focus and visibility events coalesce and keep the last installation presentation", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	t.mock.timers.setTime(10000);
	let probes = 0;
	let reply!: (value: unknown) => void;
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: {
			sendMessage: (_id: string, _message: unknown, done: typeof reply) => {
				probes++;
				reply = done;
			},
		},
	};
	await mount(trial);
	await act(async () =>
		reply({ type: "anidachi:website-presence:v1", installed: true }),
	);
	await act(async () => {
		window.dispatchEvent(new Event("focus"));
		document.dispatchEvent(new Event("visibilitychange"));
		t.mock.timers.tick(150);
	});
	assert.equal(probes, 2);
	assert.equal(refreshes, 1);
	assert.match(el.textContent!, /Extension ready/);
	await act(async () =>
		reply({ type: "anidachi:website-presence:v1", installed: true }),
	);
	await act(async () => t.mock.timers.tick(60000));
	assert.equal(probes, 2);
	assert.equal(refreshes, 1);
});

test("mobile opens the install panel without starting another trial or exposing player links", async () => {
	Object.defineProperty(navigator, "userAgent", {
		value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile",
		configurable: true,
	});
	await mount(trial);
	assert.match(el.textContent!, /Install AniDachi/);
	assert.equal(el.querySelector("dialog[open]"), null);
	await act(async () =>
		el.querySelector<HTMLAnchorElement>('a[href*="chromewebstore"]')!.click(),
	);
	assert.ok(el.querySelector("dialog[open]"));
	assert.equal(el.querySelector('a[href="https://www.netflix.com"]'), null);
	assert.match(el.textContent!, /3-day trial is active/);
	const originalShare = navigator.share;
	const originalClipboard = navigator.clipboard;
	const copied: string[] = [];
	Object.defineProperty(navigator, "share", {
		configurable: true,
		value: undefined,
	});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (url: string) => {
				copied.push(url);
			},
		},
	});
	try {
		const button = [
			...el.querySelectorAll<HTMLButtonElement>("dialog button"),
		].find((item) => item.textContent?.includes("Share link"))!;
		await act(async () => button.click());
		assert.deepEqual(copied, ["http://localhost/extension?welcome=1"]);
	} finally {
		Object.defineProperty(navigator, "share", {
			configurable: true,
			value: originalShare,
		});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: originalClipboard,
		});
	}
});

test("delayed hydration cannot extend a trial that has already ended", async (t) => {
	t.mock.method(performance, "now", () => 2000);
	await mount({ ...trial, expiresInMs: 1000 } as ExtensionWelcome);
	assert.doesNotMatch(el.textContent!, /3-day trial is active/);
	assert.equal(refreshes, 1);
});

test("refreshed snapshots age from their request, not the original document", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	t.mock.method(performance, "now", () => now);
	await mount(trial);
	now = 60000;
	await act(async () => {
		window.dispatchEvent(new Event("focus"));
		t.mock.timers.tick(150);
	});
	now += 200;
	await act(async () =>
		root!.render(
			React.createElement(
				AppRouterContext.Provider,
				{ value: router },
				React.createElement(
					MobileInstallProvider,
					null,
					React.createElement(ExtensionWelcomeHero, {
						welcome: { ...trial, expiresInMs: 1000 } as ExtensionWelcome,
						extensionId: "a".repeat(32),
					}),
				),
			),
		),
	);
	assert.match(el.textContent!, /3-day trial is active/);
	assert.equal(refreshes, 1);
	now += 800;
	await act(async () => t.mock.timers.tick(800));
	assert.doesNotMatch(el.textContent!, /3-day trial is active/);
	assert.equal(refreshes, 2);
});

test("long paid access keeps a local expiry timer across browser timeout limits", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	t.mock.method(performance, "now", () => now);
	const max = 2_147_483_647;
	await mount({ kind: "paid", plan: "plus", expiresInMs: max + 1000 });
	now = max;
	await act(async () => t.mock.timers.tick(max));
	assert.match(el.textContent!, /plan is active/);
	assert.equal(refreshes, 0);
	now += 1000;
	await act(async () => t.mock.timers.tick(1000));
	assert.doesNotMatch(el.textContent!, /plan is active/);
	assert.equal(refreshes, 1);
});

test("Free20 exhausted and manual welcome keep install and platform next steps", async () => {
	for (const welcome of [
		{
			kind: "free20",
			remainingSeconds: 0,
			resetAt: 1893542400000,
			activeRoom: false,
			expiresInMs: 60_000,
		},
		{ kind: "manual", plan: "plus", expiresInMs: 60_000 },
	] as ExtensionWelcome[]) {
		await mount(welcome);
		assert.ok(el.querySelector('a[href*="chromewebstore"]'));
		assert.ok(el.querySelector('a[href="https://www.youtube.com"]'));
		assert.doesNotMatch(el.textContent!, /trial is active|plan is active/);
		if (welcome.kind === "free20") assert.match(el.textContent!, /00:00 UTC/);
		await act(async () => root!.unmount());
		root = undefined;
		el.remove();
	}
});

test("Free20 retires on departure and new snapshots do not create expiry polling", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	t.mock.method(performance, "now", () => now);
	const welcome: ExtensionWelcome = {
		kind: "free20",
		remainingSeconds: 10,
		activeRoom: false,
		resetAt: 1893542400000,
		expiresInMs: 500,
	};
	await mount(welcome);
	now = 500;
	await act(async () => t.mock.timers.tick(500));
	assert.equal(refreshes, 1);
	await act(async () =>
		root!.render(
			React.createElement(
				AppRouterContext.Provider,
				{ value: router },
				React.createElement(
					MobileInstallProvider,
					null,
					React.createElement(ExtensionWelcomeHero, {
						welcome: { ...welcome },
						extensionId: "a".repeat(32),
					}),
				),
			),
		),
	);
	now = 1000;
	await act(async () => t.mock.timers.tick(500));
	assert.equal(refreshes, 1, "one expiry recovery per visible activation");
	await act(async () => window.dispatchEvent(new Event("blur")));
	assert.equal(el.querySelector('a[href="https://www.youtube.com"]'), null);
});

const shortHostingWelcome: ExtensionWelcome = {
	kind: "free20",
	remainingSeconds: 600,
	activeRoom: false,
	resetAt: 1893542400000,
	resetInMs: 700,
	expiresInMs: 500,
};
async function rerenderWelcome(welcome: ExtensionWelcome) {
	await act(async () =>
		root!.render(
			React.createElement(
				AppRouterContext.Provider,
				{ value: router },
				React.createElement(
					MobileInstallProvider,
					null,
					React.createElement(ExtensionWelcomeHero, {
						welcome,
						extensionId: "a".repeat(32),
					}),
				),
			),
		),
	);
}
for (const departure of [
	"blur",
	"pagehide",
	"hidden",
	"anidachi:before-sign-out",
]) {
	test(`${departure} cancels pending expiry, UTC and delayed-focus recovery`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
		t.mock.timers.setTime(10_000);
		let now = 0;
		t.mock.method(performance, "now", () => now);
		await mount(shortHostingWelcome);
		await act(async () => window.dispatchEvent(new Event("focus")));
		const descriptor = Object.getOwnPropertyDescriptor(
			document,
			"visibilityState",
		);
		try {
			await act(async () => {
				if (departure === "hidden") {
					Object.defineProperty(document, "visibilityState", {
						value: "hidden",
						configurable: true,
					});
					document.dispatchEvent(new Event("visibilitychange"));
				} else window.dispatchEvent(new Event(departure));
			});
			now = 1000;
			await act(async () => t.mock.timers.tick(1000));
			assert.equal(
				refreshes,
				0,
				"retired activation cannot reopen server reads",
			);
			assert.equal(el.querySelector('a[href="https://www.youtube.com"]'), null);
			assert.doesNotMatch(el.textContent!, /Checking your access/);
		} finally {
			if (descriptor)
				Object.defineProperty(document, "visibilityState", descriptor);
			else Reflect.deleteProperty(document, "visibilityState");
		}
	});
}
test("a valid return fences the prior activation’s expiry and UTC callbacks", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	t.mock.timers.setTime(10_000);
	let now = 0;
	t.mock.method(performance, "now", () => now);
	await mount(shortHostingWelcome);
	await act(async () => window.dispatchEvent(new Event("blur")));
	await act(async () => window.dispatchEvent(new Event("focus")));
	now = 150;
	await act(async () => t.mock.timers.tick(150));
	assert.equal(refreshes, 1);
	now = 1000;
	await act(async () => t.mock.timers.tick(850));
	assert.equal(
		refreshes,
		1,
		"prior timers cannot spend the return activation’s budget",
	);
});
test("bounded expiry leaves an idle retry and explicit retry shows pending copy only while reading", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	t.mock.method(performance, "now", () => now);
	const welcome = { ...shortHostingWelcome, resetInMs: undefined };
	await mount(welcome);
	now = 500;
	await act(async () => t.mock.timers.tick(500));
	assert.equal(refreshes, 1);
	assert.match(el.textContent!, /Checking your access/);
	await rerenderWelcome({ ...welcome });
	now = 1000;
	await act(async () => t.mock.timers.tick(500));
	assert.equal(refreshes, 1);
	assert.doesNotMatch(el.textContent!, /Checking your access/);
	const retry = [...el.querySelectorAll<HTMLButtonElement>("button")].find(
		(button) => /Try again|Refresh|Check access/i.test(button.textContent!),
	);
	assert.ok(retry, "an idle expired observation needs explicit retry");
	await act(async () => retry.click());
	assert.equal(refreshes, 2);
	assert.match(el.textContent!, /Checking your access/);
	await act(async () => retry.click());
	assert.equal(refreshes, 2, "pending retry is deduplicated");
	await rerenderWelcome({ kind: "error" });
	assert.doesNotMatch(el.textContent!, /Checking your access/);
	assert.ok(
		[...el.querySelectorAll("button")].find((button) =>
			/Try again/.test(button.textContent!),
		),
	);
});

function retryButton() {
	return [...el.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
		/Try again|Checking access/.test(button.textContent!),
	)!;
}
for (const entry of ["automatic", "manual"] as const) {
	test(`${entry} refresh without replacement props restores retry after the 10-second presentation deadline`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		let now = 0;
		t.mock.method(performance, "now", () => now);
		await mount(
			entry === "automatic"
				? { ...shortHostingWelcome, resetInMs: undefined }
				: { kind: "error" },
		);
		if (entry === "automatic") {
			now = 500;
			await act(async () => t.mock.timers.tick(500));
		} else await act(async () => retryButton().click());
		assert.equal(refreshes, 1);
		assert.equal(retryButton().disabled, true);
		now += 9999;
		await act(async () => t.mock.timers.tick(9999));
		assert.equal(retryButton().disabled, true);
		now++;
		await act(async () => t.mock.timers.tick(1));
		assert.equal(retryButton().disabled, false);
		assert.doesNotMatch(el.textContent!, /Checking your access/);
		now += 120000;
		await act(async () => t.mock.timers.tick(120000));
		assert.equal(refreshes, 1, "deadline cannot create a refresh loop");
		await act(async () => retryButton().click());
		assert.equal(refreshes, 2);
		assert.equal(retryButton().disabled, true);
	});
}
for (const outcome of ["error", "success"] as const) {
	test(`replacement ${outcome} retires the previous pending deadline`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		let now = 0;
		t.mock.method(performance, "now", () => now);
		await mount({ ...shortHostingWelcome, resetInMs: undefined });
		now = 500;
		await act(async () => t.mock.timers.tick(500));
		assert.equal(refreshes, 1);
		now = 1000;
		await act(async () => t.mock.timers.tick(500));
		await rerenderWelcome(
			outcome === "error"
				? { kind: "error" }
				: { ...shortHostingWelcome, resetInMs: undefined, expiresInMs: 60000 },
		);
		now = 10500;
		await act(async () => t.mock.timers.tick(9500));
		assert.equal(refreshes, 1);
		assert.doesNotMatch(
			el.textContent!,
			/This access check has expired|Checking your access/,
		);
		if (outcome === "success")
			assert.ok(el.querySelector('a[href="https://www.youtube.com"]'));
		else assert.equal(retryButton().disabled, false);
	});
}
test("an already queued stale deadline cannot unlock a newer manual attempt", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.mock.method(performance, "now", () => 0);
	const deadlines: Array<() => void> = [],
		schedule = globalThis.setTimeout;
	t.mock.method(globalThis, "setTimeout", ((
		callback: () => void,
		delay?: number,
	) => {
		if (delay === 10000) deadlines.push(callback);
		return schedule(callback, delay);
	}) as typeof setTimeout);
	await mount({ kind: "error" });
	await act(async () => retryButton().click());
	assert.equal(deadlines.length, 1);
	await rerenderWelcome({ kind: "error" });
	await act(async () => retryButton().click());
	assert.equal(deadlines.length, 2);
	await act(async () => deadlines[0]());
	assert.equal(retryButton().disabled, true);
	assert.equal(refreshes, 2);
	await act(async () => deadlines[1]());
	assert.equal(retryButton().disabled, false);
});
test("departure and unmount clear pending deadlines without claiming to cancel router work", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	t.mock.method(performance, "now", () => 0);
	const deadlines: Array<{
			callback: () => void;
			timer: ReturnType<typeof setTimeout>;
		}> = [],
		cleared: unknown[] = [];
	const schedule = globalThis.setTimeout,
		cancel = globalThis.clearTimeout;
	t.mock.method(globalThis, "setTimeout", ((
		callback: () => void,
		delay?: number,
	) => {
		const timer = schedule(callback, delay);
		if (delay === 10000) deadlines.push({ callback, timer });
		return timer;
	}) as typeof setTimeout);
	t.mock.method(globalThis, "clearTimeout", ((timer) => {
		cleared.push(timer);
		cancel(timer);
	}) as typeof clearTimeout);
	await mount({ ...shortHostingWelcome, resetInMs: undefined, expiresInMs: 0 });
	assert.equal(refreshes, 1);
	await act(async () => window.dispatchEvent(new Event("blur")));
	assert.ok(cleared.includes(deadlines[0].timer));
	await act(async () => deadlines[0].callback());
	assert.equal(retryButton().disabled, false);
	assert.equal(refreshes, 1);
	await act(async () => retryButton().click());
	assert.equal(refreshes, 2);
	const pending = deadlines.at(-1)!;
	await act(async () => root!.unmount());
	root = undefined;
	assert.ok(cleared.includes(pending.timer));
	await act(async () => pending.callback());
	assert.equal(refreshes, 2);
});
