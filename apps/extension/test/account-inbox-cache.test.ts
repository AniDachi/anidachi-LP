import type { AccountInboxResponse } from "@anidachi/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  beforeSet: null as ((key: string) => Promise<void>) | null,
  map: new Map<string, unknown>(),
  watchers: new Map<string, (value: unknown) => void>(),
}));

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: vi.fn(async (key: string) => storageState.map.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      await storageState.beforeSet?.(key);
      storageState.map.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageState.map.delete(key);
    }),
    watch: (key: string, listener: (value: unknown) => void) => {
      storageState.watchers.set(key, listener);
      return () => storageState.watchers.delete(key);
    },
  },
}));

import {
  accountInboxCacheKeyForUser,
  clearCachedAccountInboxForUser,
  getCachedAccountInboxForUser,
  setCachedAccountInboxForUser,
  subscribeToAccountInboxForUser,
  publishAccountInboxForUser,
} from "../src/account-inbox-cache";
import { AUTH_TOKENS_KEY } from "../src/auth-tokens";

const NOW = "2026-08-09T12:00:00.000Z";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  storageState.beforeSet = null;
  storageState.map.clear();
  storageState.watchers.clear();
  setActiveAccount(USER_A);
});
afterEach(() => vi.unstubAllGlobals());

describe("account inbox cache", () => {
  it("uses an account-specific key and returns only the requested owner's response", async () => {
    await setCachedAccountInboxForUser(USER_A, inbox(USER_A));

    expect(accountInboxCacheKeyForUser(USER_A)).not.toBe(accountInboxCacheKeyForUser(USER_B));
    expect((await getCachedAccountInboxForUser(USER_A))?.data.meta.ownerUserId).toBe(USER_A);
    expect(await getCachedAccountInboxForUser(USER_B)).toBeNull();
  });

  it("removes a valid response whose envelope or metadata belongs to another account", async () => {
    const key = accountInboxCacheKeyForUser(USER_B);
    storageState.map.set(key, {
      schemaVersion: 1,
      userId: USER_A,
      cachedAt: NOW,
      data: inbox(USER_A),
    });

    expect(await getCachedAccountInboxForUser(USER_B)).toBeNull();
    expect(storageState.map.has(key)).toBe(false);
  });

  it("removes malformed cache data without surfacing contract details", async () => {
    const key = accountInboxCacheKeyForUser(USER_A);
    storageState.map.set(key, {
      schemaVersion: 1,
      userId: USER_A,
      cachedAt: NOW,
      data: { items: [], counts: {} },
    });

    await expect(getCachedAccountInboxForUser(USER_A)).resolves.toBeNull();
    expect(storageState.map.has(key)).toBe(false);
  });

  it("clears only the requested account cache on explicit sign out", async () => {
    await setCachedAccountInboxForUser(USER_A, inbox(USER_A));
    setActiveAccount(USER_B);
    await setCachedAccountInboxForUser(USER_B, inbox(USER_B));

    await clearCachedAccountInboxForUser(USER_A);

    expect(await getCachedAccountInboxForUser(USER_A)).toBeNull();
    expect(await getCachedAccountInboxForUser(USER_B)).not.toBeNull();
  });

  it("removes a late write when the account signs out while storage is pending", async () => {
    let releaseWrite: () => void = () => {};
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let markWriteStarted: () => void = () => {};
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    storageState.beforeSet = async (key) => {
      if (key !== accountInboxCacheKeyForUser(USER_A)) return;
      markWriteStarted();
      await writeReleased;
    };

    const pendingWrite = setCachedAccountInboxForUser(USER_A, inbox(USER_A));
    await writeStarted;
    storageState.map.delete(AUTH_TOKENS_KEY);
    const clearing = clearCachedAccountInboxForUser(USER_A);
    releaseWrite();

    await expect(pendingWrite).resolves.toBeNull();
    await clearing;
    expect(await getCachedAccountInboxForUser(USER_A)).toBeNull();
  });

  it("validates subscription ownership, schema and timestamps, and ignores queued events after disposal", () => {
    const received: unknown[] = [];
    const stop = subscribeToAccountInboxForUser(USER_A, (value) => received.push(value));
    const listener = storageState.watchers.get(accountInboxCacheKeyForUser(USER_A))!;
    const valid = { schemaVersion: 1, userId: USER_A, cachedAt: NOW, data: inbox(USER_A) };
    listener({ ...valid, userId: USER_B });
    listener({ ...valid, data: inbox(USER_B) });
    listener({ ...valid, schemaVersion: 2 });
    listener({ ...valid, data: { ...valid.data, meta: { ...valid.data.meta, serverTime: "invalid" } } });
    listener(null);
    expect(received).toHaveLength(0);
    listener(valid);
    expect(received).toHaveLength(1);
    stop(); listener(valid);
    expect(received).toHaveLength(1);
  });

  it("preserves newer structural data, merging older seen acknowledgements without recounting a partial page", async () => {
    const recent = withRequest("2026-08-09T12:00:03.000Z");
    recent.counts.unseen = 150;
    recent.counts.pendingFriendRequests = 150;
    recent.counts.actionable = 150;
    recent.nextCursor = "next-page";
    await setCachedAccountInboxForUser(USER_A, recent);
    const acknowledgement = withRequest(NOW, NOW);
    const published = await setCachedAccountInboxForUser(USER_A, acknowledgement);
    expect(published).toMatchObject({ meta: { serverTime: "2026-08-09T12:00:03.000Z" },
      counts: { unseen: 149, pendingFriendRequests: 150 }, nextCursor: "next-page" });
    expect((await getCachedAccountInboxForUser(USER_A))?.data.items[0]?.seenAt).toBe(NOW);
    await setCachedAccountInboxForUser(USER_A, recent);
    expect((await getCachedAccountInboxForUser(USER_A))?.data.counts.unseen).toBe(149);
  });

  it("does not transfer seen state to a new request using the same friendship ID", async () => {
    await setCachedAccountInboxForUser(USER_A, withRequest(NOW, NOW));
    const next = withRequest("2026-08-09T12:00:03.000Z");
    next.items[0]!.createdAt = "2026-08-09T12:00:02.000Z";
    next.items[0]!.activityAt = next.items[0]!.createdAt;
    await setCachedAccountInboxForUser(USER_A, next);
    expect((await getCachedAccountInboxForUser(USER_A))?.data.items[0]?.seenAt).toBeNull();
    expect((await getCachedAccountInboxForUser(USER_A))?.data.counts.unseen).toBe(1);
  });

  it("serializes read/merge/write across separate module instances with one account-specific Web Lock", async () => {
    const tails = new Map<string, Promise<unknown>>();
    const names: string[] = [];
    vi.stubGlobal("navigator", { locks: { request: (name: string, task: () => Promise<unknown>) => {
      names.push(name);
      const next = (tails.get(name) ?? Promise.resolve()).then(task);
      tails.set(name, next.catch(() => {}));
      return next;
    } } });
    vi.resetModules();
    const otherContext = await import("../src/account-inbox-cache");
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let writes = 0;
    storageState.beforeSet = async () => { if (++writes === 1) { entered(); await held; } };
    const older = setCachedAccountInboxForUser(USER_A, withRequest(NOW, NOW));
    await started;
    const newer = otherContext.setCachedAccountInboxForUser(USER_A, withRequest("2026-08-09T12:00:03.000Z"));
    release();
    await Promise.all([older, newer]);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toContain(USER_A);
    const stored = (await getCachedAccountInboxForUser(USER_A))!.data;
    expect(stored.meta.serverTime).toBe("2026-08-09T12:00:03.000Z");
    expect(stored.items[0]!.seenAt).toBe(NOW);
  });

  it("resolves equal-time structural changes with one reread, even if the reread has the same timestamp", async () => {
    await setCachedAccountInboxForUser(USER_A, withRequest(NOW));
    let reads = 0;
    const published = await publishAccountInboxForUser(USER_A, inbox(USER_A), {
      isCurrent: () => true,
      reread: async () => { reads++; return inbox(USER_A); },
    });
    expect(published?.items).toHaveLength(0);
    expect((await getCachedAccountInboxForUser(USER_A))?.data.items).toHaveLength(0);
    expect(reads).toBe(1);
  });

  it("does not force an equal-time reread over a publication made during that network call", async () => {
    await setCachedAccountInboxForUser(USER_A, withRequest(NOW));
    let release!: (value: AccountInboxResponse) => void;
    const pending = new Promise<AccountInboxResponse>((resolve) => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let reads = 0;
    const publishing = publishAccountInboxForUser(USER_A, inbox(USER_A), {
      isCurrent: () => true,
      reread: () => { reads++; entered(); return pending; },
    });
    await started;
    // A successful seen publication changes the expected cache snapshot.
    await setCachedAccountInboxForUser(USER_A, withRequest(NOW, NOW));
    release(inbox(USER_A));
    const published = await publishing;
    expect(published?.items).toHaveLength(1);
    expect(published?.items[0]?.seenAt).toBe(NOW);
    expect(reads).toBe(1);
  });

  it("resolves equal-time global unread changes outside an unchanged visible page", async () => {
    const original = withRequest(NOW, NOW);
    original.counts.unseen = 10;
    original.counts.pendingFriendRequests = 20;
    original.counts.actionable = 20;
    original.nextCursor = "next-page";
    await setCachedAccountInboxForUser(USER_A, original);
    const updated = { ...original, counts: { ...original.counts, unseen: 5 } };
    let reads = 0;
    const published = await publishAccountInboxForUser(USER_A, updated, {
      isCurrent: () => true,
      reread: async () => { reads++; return updated; },
    });
    expect(published?.counts.unseen).toBe(5);
    expect(reads).toBe(1);
  });

  it("rechecks the caller account generation after waiting for the storage lock", async () => {
    await setCachedAccountInboxForUser(USER_A, withRequest(NOW, NOW));
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let queued!: () => void;
    const waiting = new Promise<void>((resolve) => { queued = resolve; });
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, task: () => Promise<unknown>) => {
      queued(); await held; return task();
    } } });
    let current = true;
    const newer = inbox(USER_A);
    newer.meta.serverTime = "2026-08-09T12:00:03.000Z";
    const pending = publishAccountInboxForUser(USER_A, newer, {
      isCurrent: () => current,
      reread: async () => { throw new Error("Obsolete work must not reread"); },
    });
    await waiting;
    current = false;
    release();
    expect(await pending).toBeNull();
    expect((await getCachedAccountInboxForUser(USER_A))?.data.items).toHaveLength(1);
  });
});

function setActiveAccount(userId: string): void {
  storageState.map.set(AUTH_TOKENS_KEY, {
    accessToken: `access-${userId}`,
    refreshToken: `refresh-${userId}`,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: userId,
      avatarUrl: null,
      plan: "free",
    },
  });
}

function inbox(ownerUserId: string): AccountInboxResponse {
  return {
    meta: { serverTime: NOW, schemaVersion: 1, ownerUserId },
    items: [],
    counts: {
      unseen: 0,
      actionable: 0,
      activeRoomInvites: 0,
      pendingFriendRequests: 0,
    },
    nextCursor: null,
  };
}

function withRequest(serverTime: string, seenAt: string | null = null): AccountInboxResponse {
  return { ...inbox(USER_A), meta: { ownerUserId: USER_A, schemaVersion: 1, serverTime },
    items: [{ kind: "friend-request", friendshipId: USER_B,
      sender: { userId: USER_B, displayName: "Friend", avatarUrl: null, handle: null },
      state: "pending", createdAt: NOW, activityAt: NOW, seenAt }],
    counts: { unseen: seenAt ? 0 : 1, actionable: 1, activeRoomInvites: 0, pendingFriendRequests: 1 } };
}
