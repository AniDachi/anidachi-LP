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
const trial: ExtensionWelcome = { kind: "trial", plan: "plus", endsAt: "2030-01-04T00:00:00Z", expiresInMs: 100000, cardlessWithoutRenewal: true };
const router = { back() {}, forward() {}, push() {}, replace() {}, prefetch: async () => {}, refresh() { refreshes++; } };
beforeEach(t => { if ("mock" in t) t.mock.method(performance, "now", () => 0); });
async function mount(welcome: ExtensionWelcome) {
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  globalThis.fetch = async () => { throw Error("Welcome must not start trials or poll APIs"); };
  await act(async () => root!.render(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(MobileInstallProvider, null,
      React.createElement(ExtensionWelcomeHero, { welcome, extensionId: "a".repeat(32) })))));
}
afterEach(async () => {
  await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = "";
  delete (globalThis as { chrome?: unknown }).chrome; globalThis.fetch = originalFetch; refreshes = 0;
  Object.defineProperty(navigator, "userAgent", { value: originalUserAgent, configurable: true });
});
test("verified trial waits for installation detection, then shows all three platform links", async () => {
  let reply!: (value: unknown) => void;
  (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage: (_id: string, message: unknown, done: typeof reply) => {
    assert.deepEqual(message, { type: "anidachi:website-presence:v1" }); reply = done;
  } } };
  await mount(trial);
  assert.match(el.textContent!, /3-day trial is active/);
  assert.equal(el.querySelector('a[href*="chromewebstore"]'), null);
  await act(async () => reply({ type: "anidachi:website-presence:v1", installed: true }));
  assert.match(el.textContent!, /Extension ready/);
  for (const provider of ["youtube", "crunchyroll", "netflix"]) assert.ok(el.querySelector(`a[href="https://www.${provider}.com"]`));
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
    assert.doesNotMatch(el.textContent!, /trial is active|plan is active|No automatic charge/);
    assert.equal(el.querySelector('a[href="https://www.youtube.com"]'), null);
    await act(async () => root!.unmount()); root = undefined; el.remove();
  }
});
test("paid and renewing trial do not promise no automatic charge", async () => {
  await mount({ kind: "paid", plan: "pro" });
  assert.match(el.textContent!, /Pro plan is active/);
  assert.doesNotMatch(el.textContent!, /3-day|No automatic charge/);
});
test("expiry retires successful copy without a recurring API poll", async t => {
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

test("focus and visibility events coalesce and keep the last installation presentation", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  t.mock.timers.setTime(10000);
  let probes = 0;
  let reply!: (value: unknown) => void;
  (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage: (_id: string, _message: unknown, done: typeof reply) => {
    probes++; reply = done;
  } } };
  await mount(trial);
  await act(async () => reply({ type: "anidachi:website-presence:v1", installed: true }));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    t.mock.timers.tick(150);
  });
  assert.equal(probes, 2);
  assert.equal(refreshes, 1);
  assert.match(el.textContent!, /Extension ready/);
  await act(async () => reply({ type: "anidachi:website-presence:v1", installed: true }));
  await act(async () => t.mock.timers.tick(60000));
  assert.equal(probes, 2);
  assert.equal(refreshes, 1);
});

test("mobile opens the install panel without starting another trial or exposing player links", async () => {
  Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile", configurable: true });
  await mount(trial);
  assert.match(el.textContent!, /Install AniDachi/);
  assert.equal(el.querySelector("dialog[open]"), null);
  await act(async () => el.querySelector<HTMLAnchorElement>('a[href*="chromewebstore"]')!.click());
  assert.ok(el.querySelector("dialog[open]"));
  assert.equal(el.querySelector('a[href="https://www.netflix.com"]'), null);
  assert.match(el.textContent!, /3-day trial is active/);
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;
  const copied: string[] = [];
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (url: string) => { copied.push(url); } } });
  try {
    const button = [...el.querySelectorAll<HTMLButtonElement>("dialog button")].find(item => item.textContent?.includes("Share link"))!;
    await act(async () => button.click());
    assert.deepEqual(copied, ["http://localhost/extension?welcome=1"]);
  } finally {
    Object.defineProperty(navigator, "share", { configurable: true, value: originalShare });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
  }
});

test("delayed hydration cannot extend a trial that has already ended", async t => {
  t.mock.method(performance, "now", () => 2000);
  await mount({ ...trial, expiresInMs: 1000 } as ExtensionWelcome);
  assert.doesNotMatch(el.textContent!, /3-day trial is active/);
  assert.equal(refreshes, 1);
});

test("refreshed snapshots age from their request, not the original document", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 0;
  t.mock.method(performance, "now", () => now);
  await mount(trial);
  now = 60000;
  await act(async () => { window.dispatchEvent(new Event("focus")); t.mock.timers.tick(150); });
  now += 200;
  await act(async () => root!.render(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(MobileInstallProvider, null,
      React.createElement(ExtensionWelcomeHero, { welcome: { ...trial, expiresInMs: 1000 } as ExtensionWelcome, extensionId: "a".repeat(32) })))));
  assert.match(el.textContent!, /3-day trial is active/);
  assert.equal(refreshes, 1);
  now += 800;
  await act(async () => t.mock.timers.tick(800));
  assert.doesNotMatch(el.textContent!, /3-day trial is active/);
  assert.equal(refreshes, 2);
});

test("long paid access keeps a local expiry timer across browser timeout limits", async t => {
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
