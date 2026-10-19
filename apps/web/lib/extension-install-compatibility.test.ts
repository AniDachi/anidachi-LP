import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ExtensionInstallHub } from "../components/extension-install-hub";
import { MobileInstallProvider } from "../components/mobile-install-panel";
import { ExtensionCheck } from "../app/room/[roomId]/extension-check";
import type { PublicExtensionArtifact } from "./extension-artifact";
import { CHROME_WEB_STORE_URL } from "./install-cta";

dom.history.replaceState(null, "", "/room/test-room");

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
    React.createElement(MobileInstallProvider, null, React.createElement(ExtensionInstallHub, { artifact: value })),
  )));
}

async function sendPresenceReply() {
  await act(async () => dom.dispatchEvent(new dom.MessageEvent("message", {
    data: { type: "ANIDACHI_EXTENSION_PRESENT" }, source: dom,
  })));
}

function storeLink() {
  return container.querySelector<HTMLAnchorElement>(`a[href="${CHROME_WEB_STORE_URL}"]`);
}

test("mobile installation shares a room return link without collecting an email address", async () => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
  });
  window.history.replaceState(null, "", "/extension?next=%2Froom%2Ftest-room");
  try {
    await renderHub();
    assert.equal(container.querySelector("dialog[open]"), null, "no panel before the user taps Install");
    await act(async () => storeLink()!.click());
    const panel = container.querySelector("dialog[open]");
    assert.ok(panel);
    assert.match(panel.textContent!, /Continue onyour computer/);
    assert.match(panel.textContent!, /Add to Desktop/);
    const button = [...panel.querySelectorAll("button")].find((item) => item.textContent?.includes("Share link"))!;
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

test("mobile install can be dismissed and reopened, without remembering a copied status", async () => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android Mobile" });
  await renderHub();
  await act(async () => storeLink()!.click());
  const share = [...container.querySelectorAll("dialog button")].find((button) => button.textContent?.includes("Share link"))!;
  await act(async () => (share as HTMLButtonElement).click());
  assert.match(container.querySelector("dialog")!.textContent!, /Link copied/);
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close install panel"]')!.click());
  assert.equal(container.querySelector("dialog[open]"), null);
  await act(async () => storeLink()!.click());
  assert.ok(container.querySelector("dialog[open]"));
  assert.doesNotMatch(container.querySelector("dialog")!.textContent!, /Link copied/);
  await act(async () => container.querySelector("dialog")!.dispatchEvent(new dom.Event("cancel", { cancelable: true }) as unknown as Event));
  assert.equal(container.querySelector("dialog[open]"), null);
});

test("cancelling native sharing does not copy or claim success", async () => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android Mobile" });
  Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw Object.assign(new Error("Cancelled"), { name: "AbortError" }); } });
  await renderHub();
  await act(async () => storeLink()!.click());
  const share = [...container.querySelectorAll<HTMLButtonElement>("dialog button")].find((button) => button.textContent?.includes("Share link"))!;
  await act(async () => share.click());
  assert.deepEqual(copied, []);
  assert.equal(share.disabled, false);
  assert.equal(container.querySelector("dialog input"), null);
  assert.doesNotMatch(container.querySelector("dialog")!.textContent!, /Link copied/);
});

test("a late clipboard result cannot update a newly reopened install panel", async () => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android Mobile" });
  let finish!: () => void;
  let writes = 0;
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: () => { writes++; return new Promise<void>(resolve => { finish = resolve; }); },
  } });
  await renderHub();
  await act(async () => storeLink()!.click());
  const share = [...container.querySelectorAll<HTMLButtonElement>("dialog button")].find((button) => button.textContent?.includes("Share link"))!;
  await act(async () => { share.click(); share.click(); });
  assert.equal(writes, 1, "rapid taps coalesce into a single clipboard operation");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close install panel"]')!.click());
  await act(async () => storeLink()!.click());
  await act(async () => finish());
  assert.ok(container.querySelector("dialog[open]"));
  assert.doesNotMatch(container.querySelector("dialog")!.textContent!, /Link copied/);
  assert.equal(share.disabled, false);
});

test("unavailable sharing and clipboard leave a selectable safe install link", async () => {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android Mobile" });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  window.history.replaceState(null, "", "/extension?next=https%3A%2F%2Funtrusted.example");
  try {
    await renderHub(artifact, "https://untrusted.example");
    await act(async () => storeLink()!.click());
    const share = [...container.querySelectorAll<HTMLButtonElement>("dialog button")].find((button) => button.textContent?.includes("Share link"))!;
    await act(async () => share.click());
    assert.equal(container.querySelector<HTMLInputElement>("dialog input")!.value, "http://localhost/extension");
    assert.equal(share.disabled, false);
  } finally { window.history.replaceState(null, "", "/room/test-room"); }
});

test("desktop and modified install clicks retain native navigation", async () => {
  await renderHub();
  // Prevent actual navigation in HappyDOM, after React receives the event.
  const prevent = (event: Event) => event.preventDefault();
  document.addEventListener("click", prevent);
  try {
    await act(async () => storeLink()!.click());
    assert.equal(container.querySelector("dialog[open]"), null);
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android Mobile" });
    await act(async () => storeLink()!.dispatchEvent(new dom.MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }) as unknown as MouseEvent));
    assert.equal(container.querySelector("dialog[open]"), null);
  } finally { document.removeEventListener("click", prevent); }
});

test("the Chrome Web Store install link and room return work without querying the installed extension", async () => {
  await renderHub();
  const link = storeLink();
  assert.ok(link);
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.ok(container.querySelector('a[href="/room/test-room"]'));
  assert.match(container.textContent!, /Add to Chrome/);
  assert.doesNotMatch(container.textContent!, /Load unpacked/);
  assert.deepEqual(messages, []);
});

test("a presence reply cannot replace the guide or hide the Store install link", async () => {
  await renderHub();
  await sendPresenceReply();
  assert.ok(storeLink());
  assert.ok(container.querySelector('a[href="/room/test-room"]'));
  assert.match(container.textContent!, /Add to Chrome/);
  assert.doesNotMatch(container.textContent!, /AniDachi is installed/);
  assert.equal(analytics.some((event) => event[1] === "extension_detected"), false);
});

test("the Store install link remains available when ZIP metadata is missing", async () => {
  await renderHub({ ...artifact, available: false });
  await sendPresenceReply();
  assert.ok(storeLink());
  assert.equal([...container.querySelectorAll("button")].some((button) => button.disabled), false);
  assert.doesNotMatch(container.textContent!, /AniDachi is installed/);
});

test("the retained room return does not accept an external destination", async () => {
  await renderHub(artifact, "//untrusted.example/room/test-room");
  assert.ok(storeLink());
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
