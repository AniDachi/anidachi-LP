import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Window } from "happy-dom";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ExtensionInstallHub } from "../components/extension-install-hub";
import { ExtensionCheck } from "../app/room/[roomId]/extension-check";
import type { PublicExtensionArtifact } from "./extension-artifact";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "http://localhost/room/test-room" });
for (const [key, value] of Object.entries({
  window: dom, self: dom, document: dom.document, navigator: dom.navigator,
  Node: dom.Node, Element: dom.Element, HTMLElement: dom.HTMLElement,
  Event: dom.Event, CustomEvent: dom.CustomEvent,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}

const artifact: PublicExtensionArtifact = {
  available: true, version: "0.1.0", bytes: 1_000_000,
  sha256: "a".repeat(64), filename: "anidachi-chrome-extension-0.1.0.zip",
};
let root: Root | null = null;
let container: HTMLDivElement;
let messages: unknown[] = [];
let analytics: unknown[][] = [];
let copied: string[] = [];
const originalPostMessage = window.postMessage;
const originalFetch = globalThis.fetch;
const originalGtag = window.gtag;
const originalAmplitudeKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

beforeEach(() => {
  messages = []; analytics = []; copied = [];
  process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "";
  Object.defineProperty(navigator, "userAgent", {
    configurable: true, value: "Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36",
  });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { writeText: async (value: string) => { copied.push(value); } },
  });
  window.postMessage = ((value: unknown) => { messages.push(value); }) as typeof window.postMessage;
  window.gtag = (...args: unknown[]) => { analytics.push(args); };
  globalThis.fetch = async () => { throw new Error("Unexpected network request in installation UI test"); };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  window.postMessage = originalPostMessage;
  globalThis.fetch = originalFetch;
  window.gtag = originalGtag;
  if (originalAmplitudeKey === undefined) delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  else process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = originalAmplitudeKey;
});

async function renderHub(value = artifact, next = "/room/test-room") {
  await act(async () => root!.render(React.createElement(
    SearchParamsContext.Provider,
    { value: new URLSearchParams({ next }) },
    React.createElement(ExtensionInstallHub, { artifact: value }),
  )));
}

async function sendPresenceReply() {
  await act(async () => dom.dispatchEvent(new dom.MessageEvent("message", {
    data: { type: "ANIDACHI_EXTENSION_PRESENT" }, source: dom,
  })));
}

function downloadLink() {
  return container.querySelector<HTMLAnchorElement>('a[href="/api/extension/download"]');
}

test("mobile installation shares a room return link without collecting an email address", async () => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
  });
  window.history.replaceState(null, "", "/extension?next=%2Froom%2Ftest-room");
  try {
    await renderHub();
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent?.includes("Copy desktop install link"),
    );
    assert.ok(button);
    await act(async () => button.click());
    assert.deepEqual(copied, ["http://localhost/extension?next=%2Froom%2Ftest-room"]);
    assert.match(button.textContent!, /Link copied/);
    assert.equal(Boolean(container.querySelector('input[type="email"]')), false);
    assert.equal(Boolean(container.querySelector("form")), false);
    assert.doesNotMatch(container.textContent!, /Email me|Send install link/);
  } finally {
    window.history.replaceState(null, "", "/room/test-room");
  }
});

test("the install guide and room return work without querying the installed extension", async () => {
  await renderHub();
  assert.ok(downloadLink());
  assert.ok(container.querySelector('a[href="/room/test-room"]'));
  assert.match(container.textContent!, /Load unpacked/);
  assert.deepEqual(messages, []);
});

test("a presence reply cannot replace the guide or hide the ZIP download", async () => {
  await renderHub();
  await sendPresenceReply();
  assert.ok(downloadLink());
  assert.ok(container.querySelector('a[href="/room/test-room"]'));
  assert.match(container.textContent!, /Load unpacked/);
  assert.doesNotMatch(container.textContent!, /AniDachi is installed/);
  assert.equal(analytics.some((event) => event[1] === "extension_detected"), false);
});

test("missing ZIP remains unavailable regardless of a claimed extension installation", async () => {
  await renderHub({ ...artifact, available: false });
  await sendPresenceReply();
  assert.equal(downloadLink(), null);
  assert.ok([...container.querySelectorAll("button")].some(
    (button) => button.disabled && button.textContent?.includes("Zip publishing"),
  ));
  assert.doesNotMatch(container.textContent!, /AniDachi is installed/);
});

test("the retained room return does not accept an external destination", async () => {
  await renderHub(artifact, "//untrusted.example/room/test-room");
  assert.ok(downloadLink());
  assert.equal(container.querySelector('a[href*="untrusted.example"]'), null);
  assert.equal(container.querySelector('a[href="/room/test-room"]'), null);
});

test("room help is immediate, neutral and independent from the join action", async () => {
  await act(async () => root!.render(React.createElement(React.Fragment, null,
    React.createElement("form", { action: "/api/rooms/test-room/join", method: "POST" },
      React.createElement("button", { type: "submit" }, "Open watchroom")),
    React.createElement(ExtensionCheck),
  )));
  const link = container.querySelector<HTMLAnchorElement>('a[href^="/extension"]');
  assert.ok(link);
  assert.equal(new URL(link.href).searchParams.get("next"), "/room/test-room");
  assert.deepEqual(messages, []);
  assert.equal(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled, false);
  const help = container.textContent;
  await sendPresenceReply();
  assert.equal(container.textContent, help);
  assert.doesNotMatch(container.textContent!, /Extension detected|You need the AniDachi extension to join/);
});

test("mobile room help keeps the copy-to-desktop action without an extension handshake", async () => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
  });
  await act(async () => root!.render(React.createElement(ExtensionCheck)));
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.includes("Copy link for desktop"),
  );
  assert.ok(button);
  await act(async () => button.click());
  assert.deepEqual(copied, ["http://localhost/room/test-room"]);
  assert.match(button.textContent!, /Link copied/);
  assert.deepEqual(messages, []);
});
