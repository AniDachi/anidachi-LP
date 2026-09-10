import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { FriendsClient } from "../app/friends/friends-client";
import { InvitesClient } from "../app/account/invites/invites-client";
import { FeatureRequestForm } from "../components/feature-request-form";

(globalThis as { React?: typeof React }).React = React;
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const dom = new Window({ url: "https://staging.anidachi.app/account/friends" });
for (const [key, value] of Object.entries({
  window: dom,
  self: dom,
  document: dom.document,
  navigator: dom.navigator,
  HTMLElement: dom.HTMLElement,
  Node: dom.Node,
  Event: dom.Event,
})) {
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
  });
}
const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;
const owner = "11111111-1111-4111-8111-111111111111";
const peer = "22222222-2222-4222-8222-222222222222";
const groupId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-10T00:00:00.000Z";
const meta = { schemaVersion: 1, serverTime: now };
const user = {
  userId: peer,
  displayName: "Maya Thompson",
  handle: "maya",
  avatarUrl: null,
};
const counts = {
  unseen: 0,
  actionable: 0,
  activeRoomInvites: 0,
  pendingFriendRequests: 0,
};
async function mount(element: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}
function button(name: string) {
  const element = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      !item.closest("[hidden]") &&
      (item.getAttribute("aria-label") ?? item.textContent?.trim()) === name,
  );
  assert.ok(element, `Missing button: ${name}`);
  return element;
}
async function click(name: string) {
  await act(async () => {
    button(name).click();
  });
}
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
});

test("people section changes preserve expanded group members and do not reload the directory", async () => {
  let reads = 0;
  globalThis.fetch = async (input) => {
    reads++;
    if (String(input) === "/api/groups")
      return Response.json({
        groups: [
          {
            id: groupId,
            name: "Friday anime",
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
            members: [{ user, addedAt: now }],
          },
        ],
      });
    if (String(input) === "/api/recent-people")
      return Response.json({ meta, people: [] });
    return Response.json({
      friends: [
        {
          friendshipId: peer,
          user,
          status: "accepted",
          direction: "mutual",
          requestedAt: now,
          updatedAt: now,
          respondedAt: now,
        },
      ],
      incomingRequests: [],
      outgoingRequests: [],
      blocked: [],
    });
  };
  await mount(
    React.createElement(
      PathnameContext.Provider,
      { value: "/account/friends" },
      React.createElement(FriendsClient, {
        currentUser: {
          userId: owner,
          displayName: "Alex",
          email: "alex@example.invalid",
          plan: "plus",
        },
      }),
    ),
  );
  assert.equal(reads, 3);
  await click("Groups 1");
  const groupPanel = container.querySelector("#groups");
  assert.ok(groupPanel);
  assert.equal(groupPanel.parentElement?.hidden, false);
  const details = groupPanel.querySelector("details");
  assert.ok(details);
  details.open = true;
  await click("Friends 1");
  assert.equal(groupPanel.parentElement?.hidden, true);
  await click("Groups 1");
  assert.equal(details.open, true);
  assert.equal(reads, 3);
});

test("failed initial friends load does not claim the user has no friends", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "Directory unavailable" }, { status: 503 });
  await mount(
    React.createElement(
      PathnameContext.Provider,
      { value: "/account/friends" },
      React.createElement(FriendsClient, {
        currentUser: {
          userId: owner,
          displayName: "Alex",
          email: "alex@example.invalid",
          plan: "plus",
        },
      }),
    ),
  );
  assert.match(
    container.querySelector('[role="alert"]')?.textContent ?? "",
    /Directory unavailable/,
  );
  assert.doesNotMatch(
    container.textContent ?? "",
    /Your people belong here|No groups yet/,
  );
  assert.equal(button("Refresh").disabled, false);
});

test("inbox retains the received list during refresh and disables actions", async () => {
  const request = {
    kind: "friend-request",
    friendshipId: peer,
    sender: user,
    state: "pending",
    createdAt: now,
    activityAt: now,
    seenAt: now,
  };
  const response = {
    meta: { ...meta, ownerUserId: owner },
    items: [request],
    counts: { ...counts, actionable: 1, pendingFriendRequests: 1 },
    nextCursor: null,
  };
  let hold = false;
  let release: ((value: Response) => void) | undefined;
  globalThis.fetch = async (input) =>
    String(input).startsWith("/api/account/inbox")
      ? hold
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Response.json(response)
      : Response.json({ meta, inbox: [], sent: [] });
  await mount(React.createElement(InvitesClient, { ownerUserId: owner }));
  assert.match(container.textContent ?? "", /Maya Thompson/);
  await click("Sent");
  assert.match(container.textContent ?? "", /No sent invitations yet/);
  await click("Incoming 1");
  hold = true;
  await click("Refresh");
  assert.match(container.textContent ?? "", /Maya Thompson/);
  assert.equal(button("Accept friend request").disabled, true);
  await act(async () => {
    release?.(Response.json(response));
  });
  assert.equal(button("Accept friend request").disabled, false);
});

test("an unloaded page with actionable counts offers more invitations instead of claiming all clear", async () => {
  globalThis.fetch = async (input) =>
    String(input).startsWith("/api/account/inbox")
      ? Response.json({
          meta: { ...meta, ownerUserId: owner },
          items: [],
          counts: { ...counts, actionable: 1, pendingFriendRequests: 1 },
          nextCursor: "next-page",
        })
      : Response.json({ meta, inbox: [], sent: [] });
  await mount(React.createElement(InvitesClient, { ownerUserId: owner }));
  assert.match(container.textContent ?? "", /More invitations available/);
  assert.equal(button("Load more invitations").disabled, false);
  assert.doesNotMatch(
    container.textContent ?? "",
    /Nothing waiting for a reply/,
  );
});

test("account suggestions use the supplied contact and keep it for the next idea", async () => {
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ ok: true });
  };
  await mount(
    React.createElement(FeatureRequestForm, {
      variant: "account",
      initialContact: { name: "Alex Morgan", email: "alex@example.invalid" },
    }),
  );
  assert.equal(
    container.querySelector<HTMLInputElement>('input[autocomplete="name"]')
      ?.value,
    "Alex Morgan",
  );
  assert.equal(
    container.querySelector<HTMLInputElement>('input[type="email"]')?.value,
    "alex@example.invalid",
  );
  assert.equal(container.querySelector("form")?.noValidate, false);
  // Dispatching submit bypasses native required validation in this transport test.
  await act(async () => {
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(
    (body as unknown as Record<string, unknown>).email,
    "alex@example.invalid",
  );
  assert.match(container.textContent ?? "", /we got your request/);
  await click("Submit another idea");
  assert.equal(
    container.querySelector<HTMLInputElement>('input[type="email"]')?.value,
    "alex@example.invalid",
  );
});
