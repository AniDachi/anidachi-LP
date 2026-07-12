import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_ROOM_TIMEOUT_MS,
  createEmptyRoomEndEventId,
} from "@anidachi/protocol";
import * as roomLifecycle from "./room-lifecycle";
import { completeHostRoomEnd, syncRoomEndToWorker } from "./room-lifecycle";

const lifecycleApi = roomLifecycle as typeof roomLifecycle & {
  completeInternalRoomEnd?: (params: {
    alreadyEnded: boolean;
    command: {
      endedAt: number;
      eventId?: string;
      reason: string;
      usage?: { day: string; seconds: number };
    };
    dependencies: {
      finalize: (usage?: { day: string; seconds: number }) => Promise<void>;
    };
  }) => Promise<{ alreadyEnded: boolean; eventId?: string }>;
  parseInternalRoomEndCommand?: (
    roomId: string,
    value: unknown,
  ) => Promise<{
    endedAt: number;
    eventId?: string;
    reason: string;
    usage?: { day: string; seconds: number };
  } | null>;
};

test("trusts a new Worker's confirmed Web finalization without writing twice", async () => {
  const calls: string[] = [];
  const dependencies = {
    finalize: async (usage?: { day: string; seconds: number }) => {
      calls.push(`finalize:${usage?.seconds ?? "legacy"}`);
    },
    syncWorker: async () => {
      calls.push("sync");
      return {
        usage: { day: "2026-07-12", seconds: 125 },
        webFinalized: true,
      };
    },
  };

  await completeHostRoomEnd({ alreadyEnded: false, dependencies });
  await completeHostRoomEnd({ alreadyEnded: true, dependencies });
  assert.deepEqual(calls, ["sync", "sync"]);
});

test("uses one fallback write when an older Worker has no callback acknowledgement", async () => {
  const calls: string[] = [];
  await completeHostRoomEnd({
    alreadyEnded: false,
    dependencies: {
      finalize: async (usage) => {
        calls.push(`finalize:${usage?.seconds ?? "legacy"}`);
      },
      syncWorker: async () => {
        calls.push("sync");
        return {};
      },
    },
  });
  assert.deepEqual(calls, ["sync", "finalize:legacy"]);
});

test("does not finalize when Worker synchronization fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    completeHostRoomEnd({
      alreadyEnded: false,
      dependencies: {
        finalize: async () => { calls.push("finalize"); },
        syncWorker: async () => {
          calls.push("sync");
          throw new Error("offline");
        },
      },
    }),
    (error: unknown) =>
      error instanceof Error && error.name === "RoomLifecycleSyncError" &&
      (error as Error & { status?: number }).status === 502,
  );
  assert.deepEqual(calls, ["sync"]);
});

test("sends the internal secret and end command to the configured Worker", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const result = await syncRoomEndToWorker(
    "room 1",
    { endedAt: 1_000, reason: "host_ended" },
    {
      baseUrl: "https://api.example.com",
      secret: "internal-secret",
      fetch: async (input, init) => {
        calls.push({ input: String(input), init });
        return Response.json({
          ok: true,
          webFinalized: true,
          usage: { day: "2026-07-12", seconds: 125 },
        });
      },
    },
  );
  assert.equal(calls[0]?.input, "https://api.example.com/internal/rooms/room%201/end");
  assert.equal(new Headers(calls[0]?.init?.headers).get("Authorization"), "Bearer internal-secret");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({ endedAt: 1_000, reason: "host_ended" }),
  );
  assert.deepEqual(result, {
    webFinalized: true,
    usage: { day: "2026-07-12", seconds: 125 },
  });
});

test("validates a privacy-safe deterministic event identity for empty-timeout callbacks", async () => {
  assert.equal(typeof lifecycleApi.parseInternalRoomEndCommand, "function");
  if (!lifecycleApi.parseInternalRoomEndCommand) return;

  const roomId = "room 1";
  const emptySince = 10_000;
  const endedAt = emptySince + EMPTY_ROOM_TIMEOUT_MS;
  const eventId = await createEmptyRoomEndEventId(roomId, emptySince);
  assert.match(eventId, /^empty_timeout:[a-f0-9]{64}$/);
  assert.equal(eventId.includes(roomId), false);
  assert.deepEqual(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt,
      eventId,
      reason: "empty_timeout",
      usage: { day: "2026-07-12", seconds: 125 },
    }),
    {
      endedAt,
      eventId,
      reason: "empty_timeout",
      usage: { day: "2026-07-12", seconds: 125 },
    },
  );
  assert.equal(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt,
      reason: "empty_timeout",
    }),
    null,
  );
  assert.equal(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt,
      eventId: `${eventId}:tampered`,
      reason: "empty_timeout",
    }),
    null,
  );
  assert.equal(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt,
      eventId,
      reason: "empty_timeout",
      usage: { day: "2026-07-12", seconds: -1 },
    }),
    null,
  );
  assert.deepEqual(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt: 1_000,
      reason: "host_ended",
    }),
    { endedAt: 1_000, reason: "host_ended" },
  );
});

test("settles an internal callback once and echoes the same event identity on duplicate", async () => {
  assert.equal(typeof lifecycleApi.completeInternalRoomEnd, "function");
  if (!lifecycleApi.completeInternalRoomEnd) return;

  const eventId = await createEmptyRoomEndEventId("room-1", 1_000);
  const command = {
    endedAt: 1_000 + EMPTY_ROOM_TIMEOUT_MS,
    eventId,
    reason: "empty_timeout",
    usage: { day: "2026-07-12", seconds: 125 },
  };
  const calls: string[] = [];
  const dependencies = {
    finalize: async (usage?: { day: string; seconds: number }) => {
      calls.push(`finalize:${usage?.seconds ?? "legacy"}`);
    },
  };

  assert.deepEqual(
    await lifecycleApi.completeInternalRoomEnd({
      alreadyEnded: false,
      command,
      dependencies,
    }),
    { alreadyEnded: false, eventId },
  );
  assert.deepEqual(
    await lifecycleApi.completeInternalRoomEnd({
      alreadyEnded: true,
      command,
      dependencies,
    }),
    { alreadyEnded: true, eventId },
  );
  assert.deepEqual(calls, ["finalize:125"]);
});
