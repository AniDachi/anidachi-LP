import type { AccountInboxResponse } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  watchers: new Map<string, Set<(value: unknown) => void>>(),
  inboxWrites: 0,
}));
vi.mock("wxt/utils/storage", () => ({ storage: {
  getItem: async (key: string) => structuredClone(store.data.get(key) ?? null),
  setItem: async (key: string, value: unknown) => {
    if (key.startsWith("local:anidachi.accountInbox.v1.")) store.inboxWrites++;
    store.data.set(key, structuredClone(value));
    for (const listener of store.watchers.get(key) ?? []) listener(structuredClone(value));
  },
  removeItem: async (key: string) => { store.data.delete(key); },
  watch: (key: string, listener: (value: unknown) => void) => {
    const listeners = store.watchers.get(key) ?? new Set();
    store.watchers.set(key, listeners);
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
} }));
// History is an independent mounted panel with its own background lifecycle.
vi.mock("../src/popup-watch-history", () => ({ PopupWatchHistoryPanel: () => null }));

import { PopupApp } from "../src/popup-app";
import { accountInboxCacheKeyForUser, getCachedAccountInboxForUser, setCachedAccountInboxForUser } from "../src/account-inbox-cache";
import { AUTH_TOKENS_KEY, AUTH_TOKENS_STORAGE_KEY, type ExtensionAuthTokens } from "../src/auth-tokens";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const FIRST = "00000000-0000-4000-8000-000000000003";
const SECOND = "00000000-0000-4000-8000-000000000004";
const T1 = "2026-09-04T00:00:01.000Z";
const T2 = "2026-09-04T00:00:02.000Z";
const T3 = "2026-09-04T00:00:03.000Z";
const authListeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
let root: Root | undefined;
let container: HTMLDivElement;
let list: (owner: string) => Promise<AccountInboxResponse>;
let seen: (items: Array<{ id: string }>) => Promise<AccountInboxResponse>;
let lists: number;
let seenCalls: number;
let badge: string;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function tokens(id = A): ExtensionAuthTokens {
  return { accessToken: id, refreshToken: `refresh-${id}`, user: {
    id, email: "viewer@example.com", displayName: id === A ? "Account A" : "Account B",
    avatarUrl: null, plan: "free",
  } };
}
function inbox(owner = A, time = T1, ids: string[] = [], seenAt: string | null = null): AccountInboxResponse {
  return { meta: { ownerUserId: owner, schemaVersion: 1, serverTime: time },
    items: ids.map((id) => ({ kind: "friend-request", friendshipId: id,
      sender: { userId: id, displayName: id === FIRST ? "First sender" : "Second sender", avatarUrl: null, handle: null },
      state: "pending", createdAt: T1, activityAt: T1, seenAt })),
    counts: { unseen: seenAt ? 0 : ids.length, actionable: ids.length,
      activeRoomInvites: 0, pendingFriendRequests: ids.length }, nextCursor: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<PopupApp />));
  await settle();
}
async function openInbox() {
  const tab = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === "Inbox");
  expect(tab).toBeDefined();
  await act(async () => tab!.click());
  await settle();
}
async function publish(data: AccountInboxResponse) {
  await act(async () => { await setCachedAccountInboxForUser(data.meta.ownerUserId, data); });
  await settle();
}
function inboxText() { return container.querySelector(".popup-section")?.textContent; }

beforeEach(() => {
  store.data.clear(); store.watchers.clear(); authListeners.clear();
  store.inboxWrites = 0;
  store.data.set(AUTH_TOKENS_KEY, tokens());
  lists = 0; seenCalls = 0; badge = "";
  list = async (owner) => inbox(owner);
  seen = async (items) => inbox(A, T3, items.map((item) => item.id), T3);
  vi.stubGlobal("chrome", {
    storage: { onChanged: {
      addListener: (listener: typeof authListeners extends Set<infer T> ? T : never) => authListeners.add(listener),
      removeListener: (listener: typeof authListeners extends Set<infer T> ? T : never) => authListeners.delete(listener),
    } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ text }: { text: string }) => { badge = text; } },
    runtime: { sendMessage: async (message: { type: string; command: string; accessToken: string; items: Array<{ id: string }> }) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: store.data.get(AUTH_TOKENS_KEY) };
      if (message.type === "ANIDACHI_ACCOUNT_INBOX_HTTP") {
        if (message.command === "list") { lists++; return { ok: true, inbox: await list(message.accessToken) }; }
        seenCalls++; return { ok: true, inbox: await seen(message.items) };
      }
      if (message.command === "list-social-directory") return { ok: true, directory: { friends: [], incomingRequests: [], outgoingRequests: [], groups: [], recentPeople: [] } };
      if (message.command === "list-invites") return { ok: true, invites: { meta: { serverTime: T1, schemaVersion: 1 }, inbox: [], sent: [] } };
      throw new Error(`Unexpected message ${message.type}:${message.command}`);
    } },
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("open Popup inbox convergence", () => {
  it("renders a background publication without reopening or refetching and disposes its subscription", async () => {
    await mount(); await openInbox();
    await publish(inbox(A, T2, [FIRST], T2));
    expect(inboxText()).toContain("First sender");
    expect(lists).toBe(1);
    await act(async () => root!.unmount()); root = undefined;
    expect(store.watchers.get(accountInboxCacheKeyForUser(A))?.size).toBe(0);
  });

  it("rejects old-account queued cache events and a late HTTP response after switching accounts", async () => {
    const pending = deferred<AccountInboxResponse>();
    list = async (owner) => owner === A ? pending.promise : inbox(B, T2, [SECOND], T2);
    await mount(); await openInbox();
    const queued = [...(store.watchers.get(accountInboxCacheKeyForUser(A)) ?? [])];
    expect(queued.length).toBe(1);
    await act(async () => {
      store.data.set(AUTH_TOKENS_KEY, tokens(B));
      for (const listener of authListeners) listener({ [AUTH_TOKENS_STORAGE_KEY]: { newValue: tokens(B) } }, "local");
    });
    await settle();
    await act(async () => {
      for (const listener of queued) listener({ schemaVersion: 1, userId: A, cachedAt: T3, data: inbox(A, T3, [FIRST]) });
      pending.resolve(inbox(A, T3, [FIRST]));
    });
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(inboxText()).not.toContain("First sender");
    expect(await getCachedAccountInboxForUser(A)).toBeNull();
  });

  it("does not overwrite a newer background snapshot with the initial slow GET", async () => {
    const pending = deferred<AccountInboxResponse>();
    list = async () => pending.promise;
    await mount(); await openInbox();
    await publish(inbox(A, T3, [SECOND], T3));
    await act(async () => pending.resolve(inbox(A, T1, [FIRST], T1)));
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(inboxText()).not.toContain("First sender");
    expect((await getCachedAccountInboxForUser(A))?.data.meta.serverTime).toBe(T3);
  });

  it.each([T2, T3])("keeps a seen acknowledgement at %s while a newer GET is published, with bounded writes", async (ackTime) => {
    const acknowledgement = deferred<AccountInboxResponse>();
    list = async () => inbox(A, T1, [FIRST]);
    seen = async () => acknowledgement.promise;
    await mount(); await openInbox();
    expect(seenCalls).toBe(1);
    // The concurrent GET observed FIRST unread, but SECOND was already seen.
    const concurrent = inbox(A, T3, [FIRST, SECOND], T3);
    concurrent.items[0]!.seenAt = null; concurrent.counts.unseen = 1;
    await publish(concurrent);
    await act(async () => acknowledgement.resolve(inbox(A, ackTime, [FIRST], ackTime)));
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(badge).toBe("");
    const cached = (await getCachedAccountInboxForUser(A))!.data;
    expect(cached.meta.serverTime).toBe(T3);
    expect(cached.items).toHaveLength(2);
    expect(cached.items[0]!.seenAt).not.toBeNull();
    await publish(concurrent);
    expect(badge).toBe("");
    expect(seenCalls).toBe(1);
    expect(lists).toBe(ackTime === T3 ? 2 : 1);
    expect(store.inboxWrites).toBe(3);
  });

  it("marks a newly arriving unseen item once while the previous acknowledgement remains in flight", async () => {
    const firstAck = deferred<AccountInboxResponse>();
    const secondAck = deferred<AccountInboxResponse>();
    const marked: string[][] = [];
    list = async () => inbox(A, T1, [FIRST]);
    seen = async (items) => {
      marked.push(items.map((item) => item.id));
      return items.some((item) => item.id === SECOND) ? secondAck.promise : firstAck.promise;
    };
    await mount(); await openInbox();
    await publish(inbox(A, T3, [FIRST, SECOND]));
    expect(marked).toEqual([[FIRST], [SECOND]]);
    await act(async () => firstAck.resolve(inbox(A, T2, [FIRST], T2)));
    await settle();
    expect(badge).toBe("1");
    expect(seenCalls).toBe(2);
    await act(async () => secondAck.resolve(inbox(A, T3, [FIRST, SECOND], T3)));
    await settle();
    expect(badge).toBe("");
    expect(seenCalls).toBe(2);
    expect(lists).toBe(1);
  });

  it("does one canonical reread when seen items moved outside the newest page", async () => {
    const firstAck = deferred<AccountInboxResponse>();
    const latest = inbox(A, T3, [SECOND], T3);
    let initial = true;
    list = async () => {
      if (initial) { initial = false; return inbox(A, T1, [FIRST]); }
      return inbox(A, "2026-09-04T00:00:04.000Z", [SECOND], T3);
    };
    seen = async () => firstAck.promise;
    await mount(); await openInbox();
    latest.counts.unseen = 1; latest.counts.pendingFriendRequests = 2;
    latest.counts.actionable = 2; latest.nextCursor = "next-page";
    await publish(latest);
    await act(async () => firstAck.resolve(inbox(A, T2, [FIRST], T2)));
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(badge).toBe("");
    expect(lists).toBe(2);
    expect(seenCalls).toBe(1);
  });

  it("rereads when a successful seen response omits a requested instance still unread in the newer cache", async () => {
    const acknowledgement = deferred<AccountInboxResponse>();
    const initial = inbox(A, T1, [FIRST]);
    initial.counts = { unseen: 3, actionable: 151, pendingFriendRequests: 151, activeRoomInvites: 0 };
    initial.nextCursor = "next-page";
    const corrected = inbox(A, "2026-09-04T00:00:04.000Z", [SECOND], T2);
    corrected.counts = { unseen: 2, actionable: 150, pendingFriendRequests: 150, activeRoomInvites: 0 };
    corrected.nextCursor = "next-page";
    let firstList = true;
    list = async () => {
      if (firstList) { firstList = false; return initial; }
      return corrected;
    };
    seen = async () => acknowledgement.promise;
    await mount(); await openInbox();
    expect(seenCalls).toBe(1);
    const concurrent = { ...initial, meta: { ...initial.meta, serverTime: T3 } };
    await publish(concurrent);
    expect(badge).toBe("3");
    // The successful T2 mutation lists after FIRST left the page, although the
    // newer request-start T3 cache still contains FIRST with seenAt=null.
    await act(async () => acknowledgement.resolve({
      ...corrected, meta: { ...corrected.meta, serverTime: T2 },
    }));
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(inboxText()).not.toContain("First sender");
    expect(badge).toBe("2");
    const cached = (await getCachedAccountInboxForUser(A))!.data;
    expect(cached.counts).toEqual({ unseen: 2, actionable: 150, pendingFriendRequests: 150, activeRoomInvites: 0 });
    expect(cached.nextCursor).toBe("next-page");
    await publish(concurrent);
    expect(inboxText()).not.toContain("First sender");
    expect(badge).toBe("2");
    expect(lists).toBe(2);
    expect(seenCalls).toBe(1);
    expect(store.inboxWrites).toBe(3);
  });

  it("accepts equal-time additions and removals through one canonical reread per completed GET", async () => {
    const pending = deferred<AccountInboxResponse>();
    let requests = 0;
    list = async () => ++requests === 1 ? pending.promise : inbox(A, T1, [SECOND], T1);
    await mount(); await openInbox();
    await publish(inbox(A, T1, [FIRST], T1));
    await act(async () => pending.resolve(inbox(A, T1, [SECOND], T1)));
    await settle();
    expect(inboxText()).toContain("Second sender");
    expect(inboxText()).not.toContain("First sender");
    expect(lists).toBe(2);
    expect(seenCalls).toBe(0);
  });
});
