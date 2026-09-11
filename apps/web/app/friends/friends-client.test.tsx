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
  HTMLDialogElement: dom.HTMLDialogElement,
  HTMLInputElement: dom.HTMLInputElement,
  Node: dom.Node,
  Event: dom.Event,
  CustomEvent: dom.CustomEvent,
})) {
  Object.defineProperty(globalThis, key, {
    value,
    writable: true,
    configurable: true,
  });
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
const friendship = (
  userId: string,
  displayName: string,
  direction = "mutual",
) => ({
  friendshipId: userId,
  user: profile(userId, displayName),
  status: direction === "mutual" ? "accepted" : "pending",
  direction,
  requestedAt: now,
  respondedAt: direction === "mutual" ? now : null,
  updatedAt: now,
});
const directory = (name: string) => ({
  meta: { schemaVersion: 1, serverTime: now },
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
      currentUser: {
        userId: ownerUserId,
        displayName: "Alex",
        email: "alex@example.invalid",
        plan: "plus",
      },
    }),
  );
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root?.render(element);
  });
}
function button(name: string) {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      (item.getAttribute("aria-label") ?? item.textContent?.trim()) === name,
  );
  assert.ok(found, `Missing button: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => {
    button(name).click();
  });
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
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
});

test("account social keeps two switches and offers only a friend invite link", async () => {
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (String(input) === "/api/recent-people")
      return Response.json(recent("Maya"));
    return Response.json(directory("Maya"));
  };
  await render();

  const switches = [
    ...container.querySelectorAll('[aria-label="People view"] button'),
  ];
  assert.deepEqual(
    switches.map((item) => item.textContent?.trim()),
    ["Friends 1", "Groups 0"],
  );
  const requestHeading = [...container.querySelectorAll("h2")].find((item) =>
    item.textContent?.startsWith("Friend requests"),
  );
  const friendHeading = [...container.querySelectorAll("h2")].find((item) =>
    item.textContent?.startsWith("Friends "),
  );
  assert.ok(requestHeading && friendHeading);
  assert.equal(
    Boolean(
      requestHeading.compareDocumentPosition(friendHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ),
    true,
  );
  assert.equal(
    container.querySelector<HTMLDetailsElement>("details.social-outgoing")
      ?.open,
    false,
  );
  assert.equal(container.querySelector<HTMLDialogElement>("dialog"), null);

  await click("Invite a friend");
  const dialog = container.querySelector<HTMLDialogElement>("dialog");
  assert.ok(dialog?.open);
  assert.match(dialog.textContent ?? "", /Create invite link/);
  assert.doesNotMatch(dialog.textContent ?? "", /Maya Recent/);
});

test("owner changes discard the previous owner's late refresh", async () => {
  let resolveOldFriends: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "/api/friends" && !resolveOldFriends) {
      return new Promise<Response>((resolve) => {
        resolveOldFriends = resolve;
      });
    }
    if (url === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (url === "/api/recent-people") return Response.json(recent("New"));
    return Response.json(directory("New"));
  };
  await act(async () => {
    void render(ownerA);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await render(ownerB);
  assert.match(container.textContent ?? "", /New/);

  await act(async () => {
    resolveOldFriends?.(Response.json(directory("Old")));
  });
  assert.doesNotMatch(container.textContent ?? "", /Old/);
  assert.match(container.textContent ?? "", /New/);
});

test("a newest quiet refresh settles an initial loading indicator", async () => {
  let initialCalls = 2;
  const held: Array<(response: Response) => void> = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (initialCalls-- > 0) {
      return new Promise<Response>((resolve) => held.push(resolve));
    }
    if (url === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
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
    held[1]?.(
      Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      }),
    );
    held[2]?.(Response.json(recent("Initial")));
  });
  assert.doesNotMatch(container.textContent ?? "", /Initial/);
});

test("successful request broadcasts once and ignores its own reconciliation event", async () => {
  let friendReads = 0;
  const events: Event[] = [];
  window.addEventListener(
    "anidachi:account-social-changed",
    (event) => events.push(event),
    { once: true },
  );
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") {
      friendReads++;
      return Response.json(directory("Maya"));
    }
    if (url === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url.includes("/accept") && init?.method === "POST")
      return Response.json({ friendship: friendship(peerB, "Maya", "mutual") });
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
    if (fail)
      return Response.json({ error: "Directory unavailable" }, { status: 503 });
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (String(input) === "/api/recent-people")
      return Response.json(recent("Maya"));
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

  assert.match(
    container.querySelector('[role="alert"]')?.textContent ?? "",
    /Directory unavailable/,
  );
  assert.match(container.textContent ?? "", /Maya/);
});

test("a pre-mutation refresh cannot overwrite a completed group rename", async () => {
  const oldGroup = {
    id: groupId,
    name: "Friday anime",
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    members: [],
  };
  const newGroup = {
    ...oldGroup,
    name: "Saturday anime",
    updatedAt: "2026-09-10T01:00:00.000Z",
  };
  let groupReads = 0;
  let releaseStale: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") return Response.json(directory("Maya"));
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url === "/api/groups" && !init?.method) {
      groupReads++;
      if (groupReads === 1)
        return Response.json({
          meta: { schemaVersion: 1, serverTime: now },
          groups: [oldGroup],
        });
      if (groupReads === 2)
        return new Promise<Response>((resolve) => {
          releaseStale = resolve;
        });
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [newGroup],
      });
    }
    if (url === "/api/groups/editor" && init?.method === "POST") {
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
  await click("Edit Friday anime");
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Group name"]',
  );
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save changes");
  await act(async () => {
    releaseStale?.(
      Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [oldGroup],
      }),
    );
  });

  assert.match(container.textContent ?? "", /Saturday anime/);
  assert.doesNotMatch(container.textContent ?? "", /Friday anime/);
});

test("a local mutation replaces an in-flight inbox refresh with a current directory read", async () => {
  const oldGroup = {
    id: groupId,
    name: "Friday anime",
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    members: [],
  };
  const newGroup = {
    ...oldGroup,
    name: "Saturday anime",
    updatedAt: "2026-09-10T01:00:00.000Z",
  };
  let friendReads = 0;
  let releaseOldFriends: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") {
      friendReads++;
      if (friendReads === 1) return Response.json(directory("Initial"));
      if (friendReads === 2) {
        return new Promise<Response>((resolve) => {
          releaseOldFriends = resolve;
        });
      }
      return Response.json(directory("Accepted"));
    }
    if (url === "/api/recent-people") return Response.json(recent("Maya"));
    if (url === "/api/groups" && !init?.method) {
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [friendReads >= 3 ? newGroup : oldGroup],
      });
    }
    if (url === "/api/groups/editor" && init?.method === "POST") {
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
  await click("Edit Friday anime");
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Group name"]',
  );
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save changes");
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
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (String(input) === "/api/recent-people")
      return Response.json(recent("Maya"));
    return Response.json(directory("Maya"));
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  function SeedSearch() {
    useAccountViewState(`${ownerA}:social-search`, "maya");
    return null;
  }
  const workspace = (shown: boolean) =>
    React.createElement(
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
  await act(async () => {
    root?.render(workspace(true));
  });
  const search = container.querySelector<HTMLInputElement>(
    '[aria-label="Search friends"]',
  );
  assert.ok(search);
  assert.equal(search.value, "maya");
  await click("Groups 0");
  await act(async () => {
    root?.render(workspace(false));
  });
  await act(async () => {
    root?.render(workspace(true));
  });
  assert.equal(button("Groups 0").getAttribute("aria-pressed"), "true");
  await click("Friends 1");
  assert.equal(
    container.querySelector<HTMLInputElement>('[aria-label="Search friends"]')
      ?.value,
    "maya",
  );

  window.history.replaceState({}, "", "/account/friends#groups");
  await act(async () => {
    root?.render(workspace(false));
  });
  await act(async () => {
    root?.render(workspace(true));
  });
  assert.equal(button("Groups 0").getAttribute("aria-pressed"), "true");
  window.history.replaceState({}, "", "/account/friends");
});

test("failed group save keeps the draft and does not change the saved row", async () => {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "/api/friends") return Response.json(directory("Maya"));
    if (url === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [
          {
            id: groupId,
            name: "Friday anime",
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
            members: [{ user: profile(peerA, "Maya"), addedAt: now }],
          },
        ],
      });
    if (url === "/api/groups/editor" && init?.method === "POST")
      return Response.json({ error: "Save unavailable" }, { status: 503 });
    throw new Error(`Unexpected request: ${url}`);
  };
  await render();
  await click("Groups 1");
  await click("Edit Friday anime");
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Group name"]',
  );
  assert.ok(input);
  await act(async () => {
    input.value = "Saturday anime";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Save changes");
  assert.match(
    container.querySelector('dialog [role="alert"]')?.textContent ?? "",
    /Save unavailable/,
  );
  assert.equal(input.value, "Saturday anime");
  assert.equal(
    container.querySelector<HTMLDialogElement>("dialog")?.open,
    true,
  );
  assert.match(
    container.querySelector(".people-groups")?.textContent ?? "",
    /Friday anime/,
  );
});

async function typeName(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="Group name"]',
  );
  assert.ok(input);
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
test("creating a group sends the selected friends once and retries with the same identity", async () => {
  const writes: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/friends")
      return Response.json(directory("Maya"));
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    assert.equal(String(input), "/api/groups/editor");
    assert.equal(
      new Headers(init?.headers).get("x-anidachi-social-owner"),
      ownerA,
    );
    const body = JSON.parse(String(init?.body));
    writes.push(body);
    if (writes.length === 1)
      return Response.json({ error: "Try again" }, { status: 503 });
    return Response.json({
      group: {
        id: body.groupId,
        name: body.name,
        members: [{ user: profile(peerA, "Maya"), addedAt: now }],
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  };
  await render();
  await click("Groups 0");
  await click("Create group");
  await typeName("Anime night");
  const checkbox = container.querySelector<HTMLInputElement>(
    'dialog input[type="checkbox"]',
  );
  assert.ok(checkbox);
  await act(async () => {
    checkbox.click();
  });
  const submit = container.querySelector<HTMLButtonElement>(
    'dialog button[type="submit"]',
  );
  assert.ok(submit);
  await act(async () => {
    submit.click();
  });
  assert.match(
    container.querySelector('dialog [role="alert"]')?.textContent ?? "",
    /Try again/,
  );
  assert.equal(checkbox.checked, true);
  await act(async () => {
    submit.click();
  });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(writes[1].memberIds, [peerA]);
  assert.equal(writes[1].create, true);
  assert.equal(container.querySelector("dialog"), null);
  assert.match(container.textContent ?? "", /Anime night/);
});

test("Cancel and Escape keep a dirty group open when discarding is declined", async () => {
  let writes = 0;
  globalThis.fetch = async (input, init) => {
    if (init?.method) writes++;
    return String(input) === "/api/friends"
      ? Response.json(directory("Maya"))
      : Response.json({
          meta: { schemaVersion: 1, serverTime: now },
          groups: [],
        });
  };
  await render();
  await click("Groups 0");
  await click("Create group");
  await typeName("Unsaved circle");
  const previousConfirm = window.confirm;
  window.confirm = () => false;
  await click("Cancel");
  assert.ok(container.querySelector("dialog"));
  const event = new Event("cancel", { cancelable: true });
  await act(async () => {
    container.querySelector("dialog")?.dispatchEvent(event);
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(
    container.querySelector<HTMLInputElement>('[aria-label="Group name"]')
      ?.value,
    "Unsaved circle",
  );
  window.confirm = () => true;
  await click("Cancel");
  window.confirm = previousConfirm;
  assert.equal(container.querySelector("dialog"), null);
  assert.equal(writes, 0);
});

test("a link is generated only deliberately and survives clipboard failure and reopening", async () => {
  let links = 0;
  const urls: string[] = [];
  globalThis.fetch = async (input, init) => {
    urls.push(String(input));
    if (String(input) === "/api/friends")
      return Response.json(directory("Maya"));
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    if (
      String(input) === "/api/friends/invite-links" &&
      init?.method === "POST"
    ) {
      links++;
      return Response.json({
        inviteLink: {
          url: `https://staging.anidachi.app/friend/invite/fake-test-link-${links}`,
          expiresAt: "2026-10-11T00:00:00.000Z",
        },
      });
    }
    throw new Error("Unexpected endpoint");
  };
  await render();
  await click("Invite a friend");
  assert.equal(links, 0);
  await click("Create invite link");
  assert.equal(links, 1);
  const clipboard = navigator.clipboard;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("Denied");
      },
    },
  });
  await click("Copy link");
  assert.match(
    container.querySelector('dialog [role="alert"]')?.textContent ?? "",
    /Select and copy/,
  );
  await click("Close dialog");
  await click("Invite a friend");
  assert.match(
    container.querySelector<HTMLInputElement>(
      '[aria-label="Friend invite link"]',
    )?.value ?? "",
    /fake-test-link-1/,
  );
  assert.equal(links, 1);
  await click("Create another link");
  assert.equal(links, 2);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: clipboard,
  });
  assert.equal(urls.includes("/api/recent-people"), false);
});

test("double submit is fenced while a save is pending, including Escape", async () => {
  let writes = 0;
  let resolveSave: ((response: Response) => void) | undefined;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/friends")
      return Response.json(directory("Maya"));
    if (String(input) === "/api/groups")
      return Response.json({
        meta: { schemaVersion: 1, serverTime: now },
        groups: [],
      });
    writes++;
    return new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
  };
  await render();
  await click("Groups 0");
  await click("Create group");
  await typeName("Pending");
  const form = container.querySelector("dialog form");
  assert.ok(form);
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(writes, 1);
  await act(async () => {
    container
      .querySelector("dialog")
      ?.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
  assert.ok(container.querySelector("dialog"));
  await act(async () => {
    resolveSave?.(Response.json({ error: "Retry later" }, { status: 503 }));
  });
  assert.equal(
    container.querySelector<HTMLInputElement>('[aria-label="Group name"]')
      ?.value,
    "Pending",
  );
});
