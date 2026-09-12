import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ProfileClient } from "../app/account/profile/profile-client";
import { PROFILE_OWNER_HEADER } from "./profile-owner";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "https://staging.anidachi.app/account/profile" });
for (const [key, value] of Object.entries({
  window: dom,
  self: dom,
  document: dom.document,
  navigator: dom.navigator,
  HTMLElement: dom.HTMLElement,
  HTMLInputElement: dom.HTMLInputElement,
  Node: dom.Node,
  Element: dom.Element,
  Event: dom.Event,
  CustomEvent: dom.CustomEvent,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}

const owner = "11111111-1111-4111-8111-111111111111";
const otherOwner = "22222222-2222-4222-8222-222222222222";
const initial = { displayName: "Alex Chen", handle: "alex", avatarUrl: null };
const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;
let root: Root | null = null;
let container: HTMLDivElement;
let refreshes = 0;

function router() {
  return {
    back() {}, forward() {}, prefetch: async () => undefined, push() {}, replace() {},
    refresh() { refreshes += 1; },
  };
}

async function render(props: React.ComponentProps<typeof ProfileClient>) {
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(React.createElement(AppRouterContext.Provider, { value: router() }, React.createElement(ProfileClient, props)));
  });
}

function input(label: string) {
  const field = [...container.querySelectorAll<HTMLInputElement>("input")].find(
    (item) => item.labels?.[0]?.textContent?.includes(label),
  );
  assert.ok(field, `Missing input: ${label}`);
  return field;
}

async function change(label: string, value: string) {
  const field = input(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    container.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
  window.confirm = originalConfirm;
  refreshes = 0;
});

test("a successful save sends the explicit profile fields and refreshes account identity", async () => {
  let body: unknown;
  let ownerHeader: string | null = null;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    ownerHeader = new Headers(init?.headers).get(PROFILE_OWNER_HEADER);
    return Response.json({ profile: { userId: owner, displayName: "Alexandra Chen", handle: "alexandra", avatarUrl: "https://images.example/avatar.png" } });
  };
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "  Alexandra Chen  ");
  await change("Handle", "alexandra");
  await change("Avatar URL", "https://images.example/avatar.png");
  await submit();
  assert.deepEqual(body, { displayName: "Alexandra Chen", handle: "alexandra", avatarUrl: "https://images.example/avatar.png" });
  assert.equal(ownerHeader, owner);
  assert.equal(refreshes, 1);
  assert.match(container.textContent ?? "", /Profile saved/);
  let confirmations = 0;
  window.confirm = () => { confirmations += 1; return true; };
  assert.equal(window.dispatchEvent(new CustomEvent("anidachi:before-sign-out", { cancelable: true })), true);
  assert.equal(confirmations, 0);
});

test("a failed save keeps the edited draft available for retry", async () => {
  globalThis.fetch = async () => Response.json({ error: "Handle is already taken" }, { status: 409 });
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "A new draft");
  await submit();
  assert.equal(input("Display name").value, "A new draft");
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Handle is already taken/);
  assert.equal(refreshes, 0);
});

test("a late response for the previous owner cannot replace the next owner's profile", async () => {
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => new Promise<Response>((resolve) => { release = resolve; });
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Old owner draft");
  act(() => {
    container.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await render({ ownerUserId: otherOwner, email: "maya@example.com", initialProfile: { displayName: "Maya", handle: "maya", avatarUrl: null }, waitlist: null });
  await act(async () => {
    release?.(Response.json({ profile: { userId: owner, displayName: "Old saved", handle: "alex", avatarUrl: null } }));
  });
  assert.equal(input("Display name").value, "Maya");
  assert.equal(refreshes, 0);
  assert.doesNotMatch(container.textContent ?? "", /Profile saved/);
});

test("an owner-mismatched response is rejected and keeps the draft", async () => {
  globalThis.fetch = async () => Response.json({ profile: { userId: otherOwner, displayName: "Wrong", handle: "wrong", avatarUrl: null } });
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Safe draft");
  await submit();
  assert.equal(input("Display name").value, "Safe draft");
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /could not be verified/i);
  assert.equal(refreshes, 0);
});

test("dirty profile blocks sign out when the user chooses to stay", async () => {
  window.confirm = () => false;
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Unsaved Alex");
  const event = new CustomEvent("anidachi:before-sign-out", { cancelable: true, detail: async () => undefined });
  assert.equal(window.dispatchEvent(event), false);
  assert.equal(event.defaultPrevented, true);
});

test("dirty profile blocks programmatic account navigation when the user chooses to stay", async () => {
  window.confirm = () => false;
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Unsaved Alex");
  const event = new CustomEvent("anidachi:before-account-navigation", { cancelable: true, detail: async () => undefined });
  assert.equal(window.dispatchEvent(event), false);
  assert.equal(event.defaultPrevented, true);
});

test("a same-owner server refresh does not replace an unsaved draft", async () => {
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Unsaved Alex");
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: { ...initial, displayName: "Server Alex" }, waitlist: null });
  assert.equal(input("Display name").value, "Unsaved Alex");
});

test("an in-flight save cannot refresh or update after unmount", async () => {
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => new Promise<Response>((resolve) => { release = resolve; });
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Leaving now");
  act(() => {
    container.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => root?.unmount());
  root = null;
  await act(async () => {
    release?.(Response.json({ profile: { userId: owner, displayName: "Leaving now", handle: "alex", avatarUrl: null } }));
  });
  assert.equal(refreshes, 0);
});

test("profile save uses the shared session refresh behavior after a 401", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (String(input) === "/api/auth/refresh") return Response.json({ ok: true });
    return Response.json({ profile: { userId: owner, displayName: "Refreshed Alex", handle: "alex", avatarUrl: null } });
  };
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Refreshed Alex");
  await submit();
  assert.deepEqual(calls, ["/api/me/profile", "/api/auth/refresh", "/api/me/profile"]);
  assert.equal(refreshes, 1);
});

test("profile fields lock during save and unlock with the draft after an error", async () => {
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async () => new Promise<Response>((resolve) => { release = resolve; });
  await render({ ownerUserId: owner, email: "alex@example.com", initialProfile: initial, waitlist: null });
  await change("Display name", "Keep this draft");
  act(() => {
    container.querySelector<HTMLFormElement>("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  const fields = container.querySelector<HTMLFieldSetElement>("fieldset.profile-fields");
  assert.ok(fields);
  assert.equal(fields.disabled, true);
  await act(async () => {
    release?.(Response.json({ error: "Temporarily unavailable" }, { status: 503 }));
  });
  assert.equal(fields.disabled, false);
  assert.equal(input("Display name").value, "Keep this draft");
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Temporarily unavailable/);
});
