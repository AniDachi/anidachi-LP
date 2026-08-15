import { describe, expect, it, vi } from "vitest";
import {
  createWatchHistoryStorage,
  watchHistoryPartitionKey,
  type WatchHistoryStorageRoot,
} from "../src/watch-history-storage";
import {
  createListWatchHistoryMessage,
  createWatchHistoryClient,
  isWatchHistoryMessage,
} from "../src/watch-history-client";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "alina@example.com",
    displayName: "Alina",
    avatarUrl: null,
    plan: "plus" as const,
  },
};

describe("watch history v2 client", () => {
  it("keeps credentials and account ownership in the background and maps retryable transport failure", async () => {
    let stored = { schemaVersion: 2 as const, partitions: {} };
    const fetchImpl = vi.fn(async () => new Response("offline", { status: 503 }));
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: fetchImpl,
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    const message = createListWatchHistoryMessage({ limit: 20 });
    expect(message).not.toHaveProperty("accessToken");
    expect(message).not.toHaveProperty("ownerUserId");
    await expect(client.handle(message)).resolves.toEqual({ ok: false, status: "retryable" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3003/api/watch-history/v2?limit=20",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });

  it("rejects caller-supplied access tokens before the background bridge runs", () => {
    expect(
      isWatchHistoryMessage({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "list",
        accessToken: "attacker-token",
      }),
    ).toBe(false);
  });

  it("rejects a stale generation response without replacing the newer local partition", async () => {
    const owner = session.user.id;
    let stored: WatchHistoryStorageRoot = {
      schemaVersion: 2 as const,
      partitions: {
        [watchHistoryPartitionKey(owner, 2)]: {
          ownerUserId: owner,
          accountGeneration: 2,
          cache: null,
          preferences: null,
          currentObservation: null,
          outbox: { ownerUserId: owner, accountGeneration: 2, entries: [] },
        },
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      fetch: async () =>
        new Response(
          JSON.stringify({
            meta: {
              serverTime: "2026-08-15T10:00:00.000Z",
              schemaVersion: 2,
              ownerUserId: owner,
              accountGeneration: 1,
            },
            generatedAt: "2026-08-15T10:00:00.000Z",
            totalTitleCount: 0,
            items: [],
            nextCursor: null,
          }),
        ),
      storage: createWatchHistoryStorage({
        item: {
          getValue: async () => stored,
          setValue: async (value) => {
            stored = value;
          },
        },
        getBytesInUse: async () => 0,
        quotaBytes: 1_000_000,
      }),
    });

    await expect(client.handle(createListWatchHistoryMessage())).resolves.toEqual({
      ok: false,
      status: "generation-mismatch",
    });
    expect(stored.partitions[watchHistoryPartitionKey(owner, 1)]).toBeUndefined();
  });
});
