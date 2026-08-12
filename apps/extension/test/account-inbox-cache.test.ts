import type { AccountInboxResponse } from "@anidachi/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageState = vi.hoisted(() => ({
  beforeSet: null as ((key: string) => Promise<void>) | null,
  map: new Map<string, unknown>(),
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
  },
}));

import {
  accountInboxCacheKeyForUser,
  clearCachedAccountInboxForUser,
  getCachedAccountInboxForUser,
  setCachedAccountInboxForUser,
} from "../src/account-inbox-cache";
import { AUTH_TOKENS_KEY } from "../src/auth-tokens";

const NOW = "2026-08-09T12:00:00.000Z";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  storageState.beforeSet = null;
  storageState.map.clear();
  setActiveAccount(USER_A);
});

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
    await clearCachedAccountInboxForUser(USER_A);
    releaseWrite();

    await expect(pendingWrite).resolves.toBe(false);
    expect(await getCachedAccountInboxForUser(USER_A)).toBeNull();
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
