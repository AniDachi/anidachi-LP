import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { AccountNav } from "../app/account/account-nav";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "http://localhost/account/watch-library" });
for (const [key, value] of Object.entries({ window: dom, self: dom, document: dom.document,
  navigator: dom.navigator, Node: dom.Node, HTMLElement: dom.HTMLElement, Event: dom.Event, CustomEvent: dom.CustomEvent })) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
dom.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
dom.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
let resize: (() => void) | undefined;
let wide = false;
Object.defineProperty(dom, "matchMedia", { value: () => ({
  get matches() { return wide; },
  addEventListener: (_: string, listener: () => void) => { resize = listener; },
  removeEventListener: () => { resize = undefined; },
}) });
const navigations: string[] = [];
const router = { push: (href: string) => navigations.push(href), replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
let root: Root | null = null;
let container: HTMLDivElement;
function render(pathname: string) {
  // Node resolves next/link to its Pages entry; the browser suite exercises
  // the same component through Next's App Router compilation.
  return React.createElement(RouterContext.Provider, { value: router as unknown as React.ContextType<typeof RouterContext> },
    React.createElement(PathnameContext.Provider, { value: pathname }, React.createElement(AccountNav)));
}
async function mount(pathname = "/account/watch-library") {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(render(pathname)));
}
function dialog() { return container.querySelector("dialog")!; }
function trigger() { return container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!; }
async function open() { await act(async () => trigger().click()); assert.equal(dialog().open, true); }
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; wide = false; navigations.length = 0; });

test("drawer section navigation closes the modal and uses the existing account route", async () => {
  await mount(); await open();
  assert.equal(trigger().getAttribute("aria-controls"), dialog().id);
  await act(async () => dialog().querySelector<HTMLAnchorElement>('a[href="/account/friends"]')!.click());
  assert.deepEqual(navigations, ["/account/friends"]);
  assert.equal(dialog().open, false);
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
});

test("the existing capture-phase unsaved-progress guard retains the menu and current route", async () => {
  await mount(); await open();
  const protect = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  document.addEventListener("click", protect, true);
  try {
    await act(async () => dialog().querySelector<HTMLAnchorElement>('a[href="/account/friends"]')!.click());
    assert.deepEqual(navigations, []);
    assert.equal(dialog().open, true);
  } finally { document.removeEventListener("click", protect, true); }
});

test("Escape dismisses the drawer and it can be reopened", async () => {
  await mount(); await open();
  await act(async () => dialog().dispatchEvent(new Event("cancel", { cancelable: true })));
  assert.equal(dialog().open, false);
  await open();
  await act(async () => dialog().querySelector<HTMLButtonElement>('button[aria-label="Close account navigation"]')!.click());
  assert.equal(dialog().open, false);
});

test("a route change updates the section label and dismisses an open drawer", async () => {
  await mount(); await open();
  await act(async () => root!.render(render("/account/profile")));
  assert.equal(dialog().open, false);
  assert.equal(container.querySelector(".account-current-section")?.textContent, "Profile");
});

test("returning to desktop closes the modal and focuses the active desktop destination", async () => {
  await mount("/account/billing"); await open();
  await act(async () => { wide = true; resize?.(); });
  assert.equal(dialog().open, false);
  assert.equal(document.activeElement?.getAttribute("href"), "/account/billing");
  assert.equal(document.activeElement?.closest(".account-desktop-nav") !== null, true);
});
