import { dom } from "./test-helpers/account-client-dom";
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { WEBSITE_PRESENCE } from "@anidachi/protocol";
import { RoomInviteExtensionStep } from "../components/room-invite-extension-step";
import { CHROME_WEB_STORE_URL } from "./install-cta";

const extensionId = new URL(CHROME_WEB_STORE_URL).pathname.split("/").at(-1)!;
const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
afterEach(() => {
  if (originalChrome) Object.defineProperty(globalThis, "chrome", originalChrome);
  else Reflect.deleteProperty(globalThis, "chrome");
});

test("a desktop guest can install in another tab and return to the original join action", async () => {
  let enabled = false;
  const runtime = { sendMessage(id: string, message: unknown, reply: (result: unknown) => void) {
    assert.equal(id, extensionId);
    assert.deepEqual(message, {type: WEBSITE_PRESENCE});
    reply(enabled ? {type: WEBSITE_PRESENCE, installed: true} : undefined);
  } };
  Object.defineProperty(globalThis, "chrome", {configurable: true, value: {runtime}});
  dom.history.replaceState(null, "", "/room/example?lobby=youtube");
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    const action = "/api/rooms/example/join?lobby=youtube";
    await act(async () => root.render(createElement(RoomInviteExtensionStep, {extensionId, initialMobile: false},
      createElement("form", {method: "POST", action}, createElement("button", null, "Join room")))));
    const install = container.querySelector("a")!;
    assert.equal(install.textContent, "Install extension");
    assert.equal(install.href, CHROME_WEB_STORE_URL);
    assert.equal(install.target, "_blank");
    assert.equal(install.nextElementSibling?.textContent, "Return here after installation to join the room.");
    assert.equal(container.querySelectorAll("a,button,summary,input").length, 1);
    assert.equal(container.querySelector("form"), null);
    enabled = true;
    await act(async () => window.dispatchEvent(new Event("focus")));
    assert.equal(container.querySelector("a"), null);
    assert.equal(container.querySelector("form")?.getAttribute("action"), action);
    assert.equal(dom.location.search, "?lobby=youtube");
    enabled = false;
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    assert.ok(container.querySelector("a"));
  } finally { await act(async () => root.unmount()); }
});

test("both channels show the same install prompt and mobile keeps its existing handoff", async () => {
  Object.defineProperty(globalThis, "chrome", {configurable: true, value: {}});
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    const render = (id: string, initialMobile: boolean) => act(async () => root.render(createElement(RoomInviteExtensionStep,
      {extensionId: id, initialMobile}, "Continue on desktop")));
    await render(extensionId, false);
    const publicPrompt = container.innerHTML;
    const stagingId = "a".repeat(32);
    await render(stagingId, false);
    assert.equal(container.innerHTML, publicPrompt);
    assert.equal(container.querySelector("h1,h2,details"), null);
    assert.equal(container.querySelector("a")?.href, CHROME_WEB_STORE_URL);
    await render(stagingId, true);
    assert.equal(container.textContent, "Continue on desktop");
  } finally { await act(async () => root.unmount()); }
});
