import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMap = vi.hoisted(() => new Map<string, unknown>());

vi.mock("wxt/utils/storage", () => ({
  storage: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      storageMap.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
  },
}));

import {
  getCachedSocialSnapshotForUser,
  isSocialSnapshotCacheFresh,
  setCachedSocialSnapshotForUser,
  socialSnapshotCacheKeyForUser,
} from "../src/social-snapshot-cache";

const NOW = "2026-08-06T12:00:00.000Z";
const socialSnapshotFixture = {
  directory: {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    groups: [],
    recentPeople: [],
  },
  invites: {
    meta: { serverTime: NOW, schemaVersion: 1 as const },
    inbox: [],
    sent: [],
  },
};

beforeEach(() => {
  storageMap.clear();
});

describe("social snapshot cache", () => {
  it("uses a different durable key for each account", () => {
    expect(socialSnapshotCacheKeyForUser("user-a")).not.toBe(
      socialSnapshotCacheKeyForUser("user-b"),
    );
  });

  it("returns only a valid snapshot owned by the requested account", async () => {
    await setCachedSocialSnapshotForUser("user-a", socialSnapshotFixture);

    expect((await getCachedSocialSnapshotForUser("user-a"))?.data).toEqual(
      socialSnapshotFixture,
    );
    expect(await getCachedSocialSnapshotForUser("user-b")).toBeNull();
  });

  it("hides the previous account snapshot immediately after an account switch", async () => {
    await setCachedSocialSnapshotForUser("user-a", socialSnapshotFixture);

    expect((await getCachedSocialSnapshotForUser("user-a"))?.userId).toBe("user-a");
    expect(await getCachedSocialSnapshotForUser("user-b")).toBeNull();
  });

  it("discards a valid snapshot whose envelope names another owner", async () => {
    const key = socialSnapshotCacheKeyForUser("user-b");
    storageMap.set(key, {
      schemaVersion: 1,
      userId: "user-a",
      cachedAt: NOW,
      data: socialSnapshotFixture,
    });

    expect(await getCachedSocialSnapshotForUser("user-b")).toBeNull();
    expect(storageMap.has(key)).toBe(false);
  });

  it("rejects and removes the legacy targets snapshot shape", async () => {
    const key = socialSnapshotCacheKeyForUser("user-a");
    storageMap.set(key, {
      schemaVersion: 1,
      userId: "user-a",
      cachedAt: NOW,
      data: {
        targets: { friends: [], groups: [] },
        invites: socialSnapshotFixture.invites,
      },
    });

    expect(await getCachedSocialSnapshotForUser("user-a")).toBeNull();
    expect(storageMap.has(key)).toBe(false);
  });

  it("rejects and removes invalid timestamps or account metadata without exposing validation errors", async () => {
    const invalidTimestampKey = socialSnapshotCacheKeyForUser("user-a");
    const missingMetadataKey = socialSnapshotCacheKeyForUser("user-b");
    storageMap.set(invalidTimestampKey, {
      schemaVersion: 1,
      userId: "user-a",
      cachedAt: "not-a-timestamp",
      data: socialSnapshotFixture,
    });
    storageMap.set(missingMetadataKey, {
      schemaVersion: 1,
      userId: "user-b",
      cachedAt: NOW,
      data: {
        directory: socialSnapshotFixture.directory,
        invites: { inbox: [], sent: [] },
      },
    });

    await expect(getCachedSocialSnapshotForUser("user-a")).resolves.toBeNull();
    await expect(getCachedSocialSnapshotForUser("user-b")).resolves.toBeNull();
    expect(storageMap.has(invalidTimestampKey)).toBe(false);
    expect(storageMap.has(missingMetadataKey)).toBe(false);
  });

  it("treats snapshots as fresh for no more than sixty seconds", async () => {
    await setCachedSocialSnapshotForUser("user-a", socialSnapshotFixture, new Date(NOW));
    const cached = await getCachedSocialSnapshotForUser("user-a");
    expect(cached).not.toBeNull();

    expect(isSocialSnapshotCacheFresh(cached!, Date.parse(NOW) + 60_000)).toBe(true);
    expect(isSocialSnapshotCacheFresh(cached!, Date.parse(NOW) + 60_001)).toBe(false);
  });
});
