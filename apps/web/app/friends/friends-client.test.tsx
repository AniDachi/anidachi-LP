import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  AccountWorkspaceProvider,
  useAccountViewState,
} from "@/components/account/account-workspace-state";
import { FriendsClient } from "./friends-client";

(globalThis as { React?: typeof React }).React = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dom = new Window({ url: "https://staging.anidachi.app/account/friends" });
for (const [key, value] of Object.entries({
  window: dom,
  self: dom,
  document: dom.document,
  navigator: dom.navigator,
  HTMLElement: dom.HTMLElement,
  HTMLDialogElement: dom.HTMLDialogElement,
  HTMLInputElement: dom.HTMLInputElement,
  Node: dom.Node,
  Event: dom.Event,
  CustomEvent: dom.CustomEvent,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}

const originalFetch = globalThis.fetch;
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const peerA = "33333333-3333-4333-8333-333333333333";
const peerB = "44444444-4444-4444-8444-444444444444";
const groupId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-10T00:00:00.000Z";
const profile = (userId: string, displayName: string) => ({
  userId,
  displayName,
  handle: displayName.toLowerCase(),
  avatarUrl: null,
});
const friendship = (userId: string, displayName: string, direction = "mutual") => ({
  friendshipId: userId,
  user: profile(userId, displayName),
  status: direction === "mutual" ? "accepted" : "pending",
  direction,
  requestedAt: now,
  respondedAt: direction === "mutual" ? now : null,
  updatedAt: now,
});
const directory = (name: string) => ({
  friends: [friendship(peerA, name)],
  incomingRequests: [friendship(peerB, `${name} Request`, "incoming")],
  outgoingRequests: [friendship(peerB, `${name} Pending`, "outgoing")],
  blocked: [],
});
const recent = (name: string) => ({
  meta: { schemaVersion: 1, serverTime: now },
  people: [{ user: profile(peerB, `${name} Recent`), lastWatchedAt: now }],
});

let root: Root | null = null;
let container: HTMLDivElement;
async function render(ownerUserId = ownerA) {
  const element = React.createElement(
    PathnameContext.Provider,
    { value: "/account/friends" },
    React.createElement(FriendsClient, {
      currentUser: { userId: ownerUserId, displayName: "Alex", email: "alex@example.invalid", plan: "plus" },
    }),
  );
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => { root?.render(element); });
}
function button(name: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => (item.getAttribute("aria-label") ?? item.textContent?.trim()) === name,
  );
  assert.ok(found, `Missing button: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => { button(name).click(); });
}

function accountClient(ownerUserId = ownerA) {
  return React.createElement(
    PathnameContext.Provider,
    { value: "/account/friends" },
    React.createElement(FriendsClient, {
      currentUser: {
        userId: ownerUserId,
        displayName: "Alex",
        email: "alex@example.invalid",
        plan: "plus",
      },
    }),
  );
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
});

test("account social keeps two switches and opens invite link plus recent people in Add friend", async () => {
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/groups") return Response.json({ groups: [] });
    if (String(input) === "/api/recent-people") return Response.json(recent("Maya"));
    return Response.json(directory("Maya"));
  };
  await render();

  const switches = [...container.querySelectorAll('[aria-label="People view"] button')];
  assert.deepEqual(switches.map((item) => item.textContent?.trim()), ["Friends 1", "Groups 0"]);
  const requestHeading = [...container.querySelectorAll("h2")].find((item) => item.textContent === "Friend requests");
  const friendHeading = [...container.querySelectorAll("h2")].find((item) => item.textContent === "Friends");
  assert.ok(requestHeading && friendHeading);
  assert.equal(Boolean(requestHeading.compareDocumentPosition(friendHeading) & Node.DOCUMENT_POSITION_FOLLOWING), true);
  assert.equal(
    container.querySelector<HTMLDetailsElement>("details.social-outgoing")?.open,
    false,
  );
  assert.equal(container.querySelector<HTMLDialogElement>("dialog")?.open, false);

  await click("Invite a friend");
  const dialog = container.querySelector<HTMLDialogElement>("dialog");
  assert.ok(dialog?.open);
  assert.match(dialog.textContent ?? "", /Friend invite link/);
  assert.match(dialog.textContent ?? "", /Maya Recent/);
});

test("owner changes discard the previous owner's late refresh", async () => {
  let resolveOldFriends: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "/api/friends" && !resolveOldFriends) {
      return new Promise<Response>((resolve) => { resolveOldFriends = resolve; });
    }
    if (url === "/api/groups") return Response.json({ groups: [] });
    if (url === "/api/recent-people") return Response.json(recent("New"));
    return Response.json(directory("New"));
  };
  await act(async () => {
    void render(ownerA);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await render(ownerB);
  assert.match(container.textContent ?? "", /New/);

  await act(async () => { resolveOldFriends?.(Response.json(directory("Old"))); });
  assert.doesNotMatch(container.textContent ?? "", /Old/);
  assert.match(container.textContent ?? "", /New/);
});

test("a newest quiet refresh settles an initial loading indicator", async () => {
  let initialCalls = 3;
  const held: Array<(response: Response) => void> = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (initialCalls-- > 0) {
      return new Promise<Response>((resolve) => held.push(resolve));
    }
    if (url === "/api/groups") return Response.json({ groups: [] });
    if (url === "/api/recent-people") return Response.json(recent("Quiet"));
    return Response.json(directory("Quiet"));
  };
  await act(async () => {
    void render();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(container.querySelector('[aria-busy="true"]') !== null, true);

  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("anidachi:account-social-changed", {
        detail: { ownerUserId: ownerA, source: "inbox" },
      }),
    );
  });
  assert.equal(container.querySelector('[aria-busy="true"]'), null);
  assert.match(container.textContent ?? "", /Quiet/);

  await act(async () => {
    held[0]?.(Response.json(directory("Initial")));
    held[1]?.(Response.json({ groups: [] }));
    held[2]?.(Response.json(recent("Initial")));
  });
  assert.doesNotMatch(container.textContent ?? "", /Initial/);
});

test("successful request broadcasts once and ignores its own reconciliation event", async () => {
  let friendReads = 0;
  const events: Event[] = [];
  window.addEventListener("anidachi:account-social-changed", (event) => events.push(event), { once: true });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") { friendReads++; return Response.json(directory("Maya")); }
    if (url === "/api/groups") return Response.json({ groups: [] });
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url.includes("/accept") && init?.method === "POST") return Response.json({ friendship: friendship(peerB, "Maya", "mutual") });
    throw new Error(`Unexpected request: ${url}`);
  };
  await render();
  await click("Accept request");

  assert.equal(friendReads, 2);
  assert.equal(events.length, 1);
  assert.deepEqual((events[0] as CustomEvent).detail, {
    ownerUserId: ownerA,
    source: "friends",
  });

  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("anidachi:account-social-changed", {
        detail: { ownerUserId: ownerA, source: "inbox" },
      }),
    );
  });
  assert.equal(friendReads, 3);
});

test("quiet refresh failure keeps the loaded directory and reports the error", async () => {
  let fail = false;
  globalThis.fetch = async (input) => {
    if (fail) return Response.json({ error: "Directory unavailable" }, { status: 503 });
    if (String(input) === "/api/groups") return Response.json({ groups: [] });
    if (String(input) === "/api/recent-people") return Response.json(recent("Maya"));
    return Response.json(directory("Maya"));
  };
  await render();
  assert.match(container.textContent ?? "", /Maya/);
  fail = true;
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("anidachi:account-social-changed", {
        detail: { ownerUserId: ownerA, source: "inbox" },
      }),
    );
  });

  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Directory unavailable/);
  assert.match(container.textContent ?? "", /Maya/);
});

test("a pre-mutation refresh cannot overwrite a completed group rename", async () => {
  const oldGroup = { id: groupId, name: "Friday anime", archivedAt: null, createdAt: now, updatedAt: now, members: [] };
  const newGroup = { ...oldGroup, name: "Saturday anime", updatedAt: "2026-09-10T01:00:00.000Z" };
  let groupReads = 0;
  let releaseStale: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") return Response.json(directory("Maya"));
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url === "/api/groups" && !init?.method) {
      groupReads++;
      if (groupReads === 1) return Response.json({ groups: [oldGroup] });
      if (groupReads === 2) return new Promise<Response>((resolve) => { releaseStale = resolve; });
      return Response.json({ groups: [newGroup] });
    }
    if (url === `/api/groups/${groupId}` && init?.method === "PATCH") {
      return Response.json({ group: newGroup });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  await render();
  await click("Groups 1");
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("anidachi:account-social-changed", {
        detail: { ownerUserId: ownerA, source: "inbox" },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await click("Rename group");
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Group name"]');
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save group name");
  await act(async () => { releaseStale?.(Response.json({ groups: [oldGroup] })); });

  assert.match(container.textContent ?? "", /Saturday anime/);
  assert.doesNotMatch(container.textContent ?? "", /Friday anime/);
});

test("a local mutation replaces an in-flight inbox refresh with a current directory read", async () => {
  const oldGroup = { id: groupId, name: "Friday anime", archivedAt: null, createdAt: now, updatedAt: now, members: [] };
  const newGroup = { ...oldGroup, name: "Saturday anime", updatedAt: "2026-09-10T01:00:00.000Z" };
  let friendReads = 0;
  let releaseOldFriends: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") {
      friendReads++;
      if (friendReads === 1) return Response.json(directory("Initial"));
      if (friendReads === 2) {
        return new Promise<Response>((resolve) => { releaseOldFriends = resolve; });
      }
      return Response.json(directory("Accepted"));
    }
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url === "/api/groups" && !init?.method) {
      return Response.json({ groups: [friendReads >= 3 ? newGroup : oldGroup] });
    }
    if (url === `/api/groups/${groupId}` && init?.method === "PATCH") {
      return Response.json({ group: newGroup });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  await render();
  await click("Groups 1");
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("anidachi:account-social-changed", {
        detail: { ownerUserId: ownerA, source: "inbox" },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await click("Rename group");
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Group name"]');
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save group name");
  await act(async () => {
    releaseOldFriends?.(Response.json(directory("Stale")));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(friendReads, 3);
  assert.match(container.textContent ?? "", /Saturday anime/);
  await click("Friends 1");
  assert.match(container.textContent ?? "", /Accepted/);
  assert.doesNotMatch(container.textContent ?? "", /Stale/);
});

test("account view and search return after route unmount while groups hash wins on deep link", async () => {
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/groups") return Response.json({ groups: [] });
    if (String(input) === "/api/recent-people") return Response.json(recent("Maya"));
    return Response.json(directory("Maya"));
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  function SeedSearch() {
    useAccountViewState(`${ownerA}:social-search`, "maya");
    return null;
  }
  const workspace = (shown: boolean) => React.createElement(
    AccountWorkspaceProvider,
    null,
    shown ? accountClient() : React.createElement("p", null, "Away"),
  );
  await act(async () => {
    root?.render(
      React.createElement(
        AccountWorkspaceProvider,
        null,
        React.createElement(SeedSearch),
      ),
    );
  });
  await act(async () => { root?.render(workspace(true)); });
  const search = container.querySelector<HTMLInputElement>('[aria-label="Search friends"]');
  assert.ok(search);
  assert.equal(search.value, "maya");
  await click("Groups 0");
  await act(async () => { root?.render(workspace(false)); });
  await act(async () => { root?.render(workspace(true)); });
  assert.equal(button("Groups 0").getAttribute("aria-pressed"), "true");
  await click("Friends 1");
  assert.equal(container.querySelector<HTMLInputElement>('[aria-label="Search friends"]')?.value, "maya");

  window.history.replaceState({}, "", "/account/friends#groups");
  await act(async () => { root?.render(workspace(false)); });
  await act(async () => { root?.render(workspace(true)); });
  assert.equal(button("Groups 0").getAttribute("aria-pressed"), "true");
  window.history.replaceState({}, "", "/account/friends");
});

test("failed optimistic group rename restores the row and keeps expanded members", async () => {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") return Response.json(directory("Maya"));
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url === "/api/groups" && !init?.method) return Response.json({ groups: [{ id: groupId, name: "Friday anime", archivedAt: null, createdAt: now, updatedAt: now, members: [{ user: profile(peerA, "Maya"), addedAt: now }] }] });
    if (url === `/api/groups/${groupId}` && init?.method === "PATCH") return Response.json({ error: "Rename unavailable" }, { status: 503 });
    throw new Error(`Unexpected request: ${url}`);
  };
  await render();
  await click("Groups 1");
  const details = container.querySelector<HTMLDetailsElement>(".social-group-members");
  assert.ok(details);
  details.open = true;
  await click("Rename group");
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Group name"]');
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save group name");

  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Rename unavailable/);
  await click("Cancel rename");
  assert.match(container.textContent ?? "", /Friday anime/);
  assert.equal(container.querySelector<HTMLDetailsElement>(".social-group-members")?.open, true);
});
