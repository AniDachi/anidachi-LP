import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SOCIAL_OWNER_HEADER } from "@/lib/social-editor-contracts";
import { FriendInviteClient } from "./friend-invite-client";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "https://staging.anidachi.app/friend/invite/example-token" });
for (const [key, value] of Object.entries({ window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Node: dom.Node })) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
const originalFetch = globalThis.fetch;
let root: Root | undefined;
let container: HTMLDivElement;
const props = {
  ownerUserId: "recipient-id",
  token: "example-token",
  sender: { userId: "sender-id", displayName: "Alex", handle: null, avatarUrl: null },
};
async function render(alreadyFriends = false) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(<FriendInviteClient {...props} alreadyFriends={alreadyFriends} />); });
}
async function accept() {
  await act(async () => { container.querySelector("button")!.click(); });
}
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
});

test("accepts once with the displayed account, then replaces the action with a focused confirmation", async () => {
  let requests = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, "/api/friends/invite-links/example-token/accept");
    assert.equal(options?.method, "POST");
    assert.equal(new Headers(options?.headers).get(SOCIAL_OWNER_HEADER), props.ownerUserId);
    return new Promise<Response>((done) => { resolve = done; });
  };
  await render();
  const button = container.querySelector("button")!;
  await act(async () => { button.click(); button.click(); });
  assert.equal(requests, 1);
  assert.equal(button.disabled, true);
  assert.equal(container.querySelectorAll("a").length, 0);
  await act(async () => resolve(reply(200, { friendship: { status: "accepted" } })));
  assert.match(container.textContent!, /You’re now friends/);
  assert.doesNotMatch(container.textContent!, /Invites you|Already friends|Open friends|AniDachi user/);
  assert.equal(container.querySelectorAll("button, a").length, 0);
  assert.equal(document.activeElement, container.querySelector('[role="status"]'));
});

test("an existing friendship opens directly in the completed state without another request", async () => {
  globalThis.fetch = async () => { throw new Error("Unexpected request"); };
  await render(true);
  assert.match(container.textContent!, /You’re now friends/);
  assert.equal(container.querySelectorAll("button, a").length, 0);
});

test("an expired login keeps the same invitation in the sign-in return path", async () => {
  globalThis.fetch = async () => reply(401, { error: "Unauthorized" });
  await render();
  await accept();
  const link = container.querySelector("a")!;
  assert.equal(link.textContent, "Sign in");
  assert.equal(new URL(link.href).searchParams.get("next"), "/friend/invite/example-token");
  assert.doesNotMatch(container.textContent!, /Unauthorized|Add friend/);
});

test("used or expired invitations cannot keep presenting a working accept action", async () => {
  globalThis.fetch = async () => reply(409, { error: "This invite has already been used. Ask for a new link." });
  await render();
  await accept();
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /already been used/);
  assert.equal(container.querySelectorAll("button, a").length, 0);
  assert.doesNotMatch(container.textContent!, /You’re now friends/);
});

test("temporary failures remain retryable and a malformed success response cannot claim friendship", async () => {
  let attempts = 0;
  globalThis.fetch = async () => ++attempts === 1 ? reply(500, { error: "Internal server error" }) : reply(200, {});
  await render();
  await accept();
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /Please try again/);
  assert.equal(container.querySelector("button")!.disabled, false);
  await accept();
  assert.equal(attempts, 2);
  assert.doesNotMatch(container.textContent!, /You’re now friends|Internal server error/);
});
