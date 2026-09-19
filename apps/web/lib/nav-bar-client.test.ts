import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { NavBarClient } from "../components/nav-bar-client";

const user = { displayName: "Alex With A Very Long Account Display Name", email: "alex@example.com", plan: "plus", avatarUrl: null };
const navigations: string[] = [];
const router = { push: (href: string) => navigations.push(href), replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
let root: Root | null = null;
let container: HTMLDivElement;
let width = 390;
const media = new Set<{ query: string; matches: boolean; listeners: Set<() => void> }>();
function matches(query: string) {
  const minimum = /min-width:\s*(\d+)px/.exec(query);
  const maximum = /max-width:\s*(\d+)px/.exec(query);
  return (!minimum || width >= Number(minimum[1])) && (!maximum || width <= Number(maximum[1]));
}
Object.defineProperty(dom, "matchMedia", { configurable: true, value: (query: string) => {
  const entry = { query, matches: matches(query), listeners: new Set<() => void>() };
  media.add(entry);
  return { get matches() { return matches(query); }, media: query,
    addEventListener: (_: string, listener: () => void) => entry.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => entry.listeners.delete(listener),
  };
} });
async function resize(nextWidth: number) {
  await act(async () => {
    width = nextWidth; dom.happyDOM.setWindowSize({ width: nextWidth, height: 900 });
    for (const entry of media) {
      const next = matches(entry.query);
      if (next !== entry.matches) { entry.matches = next; for (const listener of entry.listeners) listener(); }
    }
  });
}
function visible(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (window.getComputedStyle(node).display === "none") return false;
  }
  return true;
}
function render(pathname: string, signedIn = true) {
  return React.createElement(RouterContext.Provider, { value: router as unknown as React.ContextType<typeof RouterContext> },
    React.createElement(PathnameContext.Provider, { value: pathname }, React.createElement(NavBarClient, { user: signedIn ? user : null })));
}
async function mount(nextWidth = 390, signedIn = true) {
  await resize(nextWidth);
  // The standard Tailwind display utilities used by this header. Layout geometry
  // and the unchanged production account stylesheet are checked in a browser.
  const style = document.createElement("style");
  style.textContent = `.hidden { display: none; }
    @media (min-width: 640px) { .sm\\:hidden { display: none; } .sm\\:flex { display: flex; } .sm\\:block { display: block; } }
    @media (min-width: 768px) { .md\\:hidden { display: none; } .md\\:flex { display: flex; } }
    @media (min-width: 1280px) { .xl\\:hidden { display: none; } .xl\\:flex { display: flex; } .xl\\:block { display: block; } }`;
  document.head.append(style);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(render("/", signedIn)));
}
function toggle() { return container.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-menu"]')!; }
function drawer() { return container.querySelector<HTMLDivElement>('[aria-label="Mobile navigation menu"]'); }
function accountTrigger() {
  return [...container.querySelectorAll<HTMLButtonElement>('button[aria-label="Account menu"]')].find(visible);
}
async function openDrawer() { await act(async () => toggle().click()); assert.ok(drawer()); }
function assertScrollLocked(expected: boolean) {
  for (const event of [new dom.WheelEvent("wheel", { cancelable: true, bubbles: true }),
    new dom.Event("touchmove", { cancelable: true, bubbles: true }),
    new dom.KeyboardEvent("keydown", { key: "PageDown", cancelable: true, bubbles: true })]) {
    dom.document.body.dispatchEvent(event);
    assert.equal(event.defaultPrevented, expected, `${event.type} scroll prevention`);
  }
}
afterEach(async () => {
  await act(async () => root?.unmount()); root = null;
  document.body.innerHTML = ""; document.head.innerHTML = ""; navigations.length = 0;
  for (const entry of media) assert.equal(entry.listeners.size, 0, "media listeners are removed on unmount");
  media.clear();
});

for (const viewport of [390, 639, 640, 700, 767, 768, 1280]) {
  test(`signed-in account shortcuts are reachable without a duplicate account entry at ${viewport}px`, async () => {
    await mount(viewport);
    const trigger = accountTrigger();
    assert.ok(trigger, "A visible account control is required at every supported width");
    await act(async () => trigger.click());
    for (const href of ["/account/watch-library", "/account/friends", "/account/billing", "/account/profile", "/account/help"]) {
      assert.ok([...container.querySelectorAll<HTMLAnchorElement>(`a[href="${href}"]`)].some(visible), `Visible shortcut ${href}`);
    }
    await act(async () => dom.document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    if (viewport < 1280) await openDrawer();
    assert.equal(container.querySelector('a[href="/account"]'), null);
  });
}

test("390 to 700 to 768 keeps the drawer reachable; the desktop breakpoint releases all scroll locks", async () => {
  await mount(); await openDrawer(); assertScrollLocked(true);
  for (const nextWidth of [700, 768]) {
    await resize(nextWidth);
    assert.ok(drawer() && visible(drawer()!), "An open drawer must not become hidden while retaining a lock");
    assertScrollLocked(true);
  }
  await resize(1280);
  assert.ok(drawer() === null, "Drawer is closed"); assertScrollLocked(false);
  await resize(390);
  assert.ok(drawer() === null, "Drawer is closed"); assertScrollLocked(false);
});

test("Escape releases the drawer lock and returns focus to its toggle", async () => {
  await mount(); await openDrawer();
  await act(async () => drawer()!.querySelector<HTMLAnchorElement>("a")!.focus());
  await act(async () => dom.document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  assert.ok(drawer() === null, "Drawer is closed"); assertScrollLocked(false);
  assert.ok(document.activeElement === toggle(), "Escape restores focus to the toggle");
});

test("a successful drawer link and an external route change both release scroll locks", async () => {
  await mount(); await openDrawer();
  await act(async () => drawer()!.querySelector<HTMLAnchorElement>('a[href="/pricing"]')!.click());
  assert.deepEqual(navigations, ["/pricing"]); assert.ok(drawer() === null, "Drawer is closed"); assertScrollLocked(false);
  await openDrawer();
  await act(async () => root!.render(render("/contact")));
  assert.ok(drawer() === null, "Drawer is closed"); assertScrollLocked(false);
});

test("a canceled navigation keeps the drawer open and does not change the route", async () => {
  await mount(); await openDrawer();
  const protect = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
  document.addEventListener("click", protect, true);
  try {
    await act(async () => drawer()!.querySelector<HTMLAnchorElement>('a[href="/pricing"]')!.click());
    assert.deepEqual(navigations, []); assert.ok(drawer()); assertScrollLocked(true);
  } finally { document.removeEventListener("click", protect, true); }
});

test("account shortcuts and the hamburger drawer replace one another without leaving a scroll lock", async () => {
  await mount(); await openDrawer();
  const trigger = accountTrigger(); assert.ok(trigger);
  await act(async () => { trigger.focus(); trigger.click(); });
  assert.ok(drawer() === null, "Drawer is closed"); assert.ok(container.querySelector('[aria-label="Account shortcuts"]'));
  assertScrollLocked(false);
  await openDrawer();
  assert.ok(container.querySelector('[aria-label="Account shortcuts"]') === null, "Account shortcuts are closed");
  assertScrollLocked(true);
});

for (const control of ["account", "hamburger"] as const) {
  test(`Space preserves native activation of the ${control} button while the drawer locks page scrolling`, async () => {
    await mount(); await openDrawer();
    const target = control === "account" ? accountTrigger()! : toggle();
    await act(async () => target.focus());
    for (const key of [" ", "Enter"]) {
      const event = new dom.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      await act(async () => target.dispatchEvent(event as unknown as Event));
      // happy-dom does not synthesize native button activation from key events.
      // Canceling keydown would suppress that activation in the real browser.
      assert.equal(event.defaultPrevented, false, `${key === " " ? "Space" : key} must remain available for native button activation`);
    }
    for (const event of [new dom.WheelEvent("wheel", { bubbles: true, cancelable: true }),
      new dom.Event("touchmove", { bubbles: true, cancelable: true }),
      new dom.KeyboardEvent("keydown", { key: "PageDown", bubbles: true, cancelable: true })]) {
      target.dispatchEvent(event as unknown as Event);
      assert.equal(event.defaultPrevented, true, `${event.type} on the header must not scroll the page`);
    }
    const pageSpace = new dom.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    dom.document.body.dispatchEvent(pageSpace);
    assert.equal(pageSpace.defaultPrevented, true, "Space outside a header button must still be locked");
    const installLink = [...container.querySelectorAll<HTMLAnchorElement>('a[href="/extension"]')].find(visible)!;
    const linkSpace = new dom.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    await act(async () => { installLink.focus(); installLink.dispatchEvent(linkSpace as unknown as Event); });
    assert.equal(linkSpace.defaultPrevented, true, "Space on a header link must still be locked");
    await act(async () => target.focus());
    await act(async () => target.dispatchEvent(new dom.KeyboardEvent("keydown", {
      key: "Escape", bubbles: true, cancelable: true,
    }) as unknown as Event));
    assert.ok(drawer() === null, "Escape still closes the drawer");
    assert.ok(document.activeElement === toggle(), "Escape still returns focus to the toggle");
    assertScrollLocked(false);
  });
}

test("unmounting an open drawer removes wheel, touch and keyboard prevention", async () => {
  await mount(); await openDrawer(); assertScrollLocked(true);
  await act(async () => root!.unmount()); root = null;
  assertScrollLocked(false);
});

for (const control of ["Account menu", "Close menu"]) {
  test(`Space is not canceled for ${control} when React delegates events at document`, async () => {
    // Next's app router mounts its React root at document. A fresh DOM is needed:
    // React keeps a listener marker on the document of earlier element roots.
    const page = new Window({ url: "http://localhost/", width: 390 });
    const previous = new Map<string, PropertyDescriptor | undefined>();
    for (const [key, value] of Object.entries({ window: page, self: page, document: page.document,
      navigator: page.navigator, Node: page.Node, Element: page.Element, HTMLElement: page.HTMLElement,
      Event: page.Event, CustomEvent: page.CustomEvent })) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    }
    const documentRoot = createRoot(document);
    try {
      await act(async () => documentRoot.render(React.createElement("html", null,
        React.createElement("head"), React.createElement("body", null, render("/")))));
      const hamburger = document.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav-menu"]')!;
      await act(async () => { hamburger.focus(); hamburger.click(); });
      const target = control === "Close menu" ? hamburger
        : document.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!;
      await act(async () => target.focus());
      const space = new page.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
      await act(async () => target.dispatchEvent(space as unknown as Event));
      assert.equal(space.defaultPrevented, false, "A later document scroll-lock listener must not cancel native activation");
      const wheel = new page.WheelEvent("wheel", { bubbles: true, cancelable: true });
      target.dispatchEvent(wheel as unknown as Event);
      assert.equal(wheel.defaultPrevented, true, "Header wheel scrolling stays locked");
    } finally {
      await act(async () => documentRoot.unmount());
      for (const [key, descriptor] of previous) Object.defineProperty(globalThis, key, descriptor!);
      await page.happyDOM.abort();
    }
  });
}
