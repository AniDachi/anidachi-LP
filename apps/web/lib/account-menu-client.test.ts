import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AccountEntryLink, UserMenu } from "../components/account-menu";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "http://localhost/account/watch-library" });
for (const [key, value] of Object.entries({ window: dom, self: dom, document: dom.document,
  navigator: dom.navigator, Node: dom.Node, HTMLElement: dom.HTMLElement, Event: dom.Event, CustomEvent: dom.CustomEvent })) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
const user = { displayName: "Alex Morgan", email: "alex@example.com", plan: "plus", avatarUrl: null };
let root: Root | null = null;
let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
async function mount() {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(React.createElement(PathnameContext.Provider, { value: "/account/watch-library" },
    React.createElement(AccountEntryLink), React.createElement(UserMenu, { user }))));
}
function trigger() { return container.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!; }
async function open() { await act(async () => trigger().click()); }
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; globalThis.fetch = originalFetch; });

test("account entry and shortcuts point to existing account destinations", async () => {
  await mount(); await open();
  assert.equal(container.querySelector("a")?.getAttribute("href"), "/account");
  const links = [...container.querySelectorAll("nav a")];
  assert.deepEqual(links.map(a => [a.textContent, a.getAttribute("href")]), [
    ["Watch Library", "/account/watch-library"], ["Friends & Groups", "/account/friends"],
    ["Subscription", "/account/billing"], ["Profile", "/account/profile"], ["Help", "/account/help"],
  ]);
  assert.equal(links[0].getAttribute("aria-current"), "page");
  assert.equal(trigger().getAttribute("aria-controls"), container.querySelector("nav")?.id);
});

test("Escape closes the disclosure and returns focus to the avatar", async () => {
  await mount(); await open();
  await act(async () => container.querySelector<HTMLAnchorElement>("nav a")!.focus());
  await act(async () => dom.document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  assert.equal(container.querySelector("nav"), null); assert.equal(document.activeElement, trigger());
});

test("moving focus or tapping outside closes the disclosure", async () => {
  await mount(); await open();
  await act(async () => dom.document.dispatchEvent(new dom.PointerEvent("pointerdown", { bubbles: true })));
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  await open();
  await act(async () => container.querySelector<HTMLAnchorElement>("a")!.focus());
  assert.equal(container.querySelector("nav"), null);
});

test("a canceled account navigation keeps the current menu and editor mounted", async () => {
  await mount(); await open();
  const protect = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  document.addEventListener("click", protect, true);
  try {
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/account/profile"]')!.click());
    assert.ok(container.querySelector("nav"));
  } finally { document.removeEventListener("click", protect, true); }
});

test("sign out retains the editor's cancelable Save / Discard / Stay contract", async () => {
  await mount(); await open(); let calls = 0; let proceed: unknown;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  const protect = (e: Event) => { e.preventDefault(); proceed = (e as CustomEvent).detail; };
  window.addEventListener("anidachi:before-sign-out", protect);
  try {
    await act(async () => container.querySelector<HTMLButtonElement>("nav button")!.click());
    assert.equal(calls, 0); assert.equal(typeof proceed, "function");
  } finally { window.removeEventListener("anidachi:before-sign-out", protect); }
});

test("a failed logout retains the account and offers retry", async () => {
  await mount(); await open();
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await act(async () => container.querySelector<HTMLButtonElement>("nav button")!.click());
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /Could not sign out/);
  assert.equal(container.querySelector<HTMLButtonElement>("nav button")!.disabled, false);
});
