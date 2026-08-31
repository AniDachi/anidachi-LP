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
  syncParticipantDepartureToWorker?: (
    command: {
      roomId: string;
      userId: string;
      participantSessionId: string;
      requestedAt: number;
    },
    options?: { baseUrl?: string; secret?: string; fetch?: typeof fetch },
  ) => Promise<{ ok: true; outcome: "departed" | "room_ended" | "stale" }>;
  syncParticipantDetachToWorker?: (
    command: {
      roomId: string;
      userId: string;
      participantSessionId: string;
      requestedAt: number;
    },
    options?: {
      baseUrl?: string;
      secret?: string;
      fetch?: typeof fetch;
      timeoutMs?: number;
    },
  ) => Promise<{ ok: true; outcome: "detached" | "stale" }>;
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
  assert.deepEqual(
    await lifecycleApi.parseInternalRoomEndCommand(roomId, {
      endedAt: 1_000,
      reason: "host_disconnected",
    }),
    { endedAt: 1_000, reason: "host_disconnected" },
  );
});

test("sends an exact signed participant departure command to the Worker", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDepartureToWorker, "function");
  if (!lifecycleApi.syncParticipantDepartureToWorker) return;
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const command = {
    roomId: "room 1",
    userId: "user/one",
    participantSessionId: "participant-session-one",
    requestedAt: 1_000,
  };
  const result = await lifecycleApi.syncParticipantDepartureToWorker(command, {
    baseUrl: "https://api.example.com",
    secret: "internal-secret",
    fetch: async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json({ ok: true, outcome: "departed" });
    },
  });

  assert.equal(
    calls[0]?.input,
    "https://api.example.com/internal/rooms/room%201/participants/user%2Fone/depart",
  );
  assert.equal(
    new Headers(calls[0]?.init?.headers).get("Authorization"),
    "Bearer internal-secret",
  );
  assert.equal(calls[0]?.init?.body, JSON.stringify(command));
  assert.deepEqual(result, { ok: true, outcome: "departed" });
});

test("participant departure sync fails closed on a malformed Worker acknowledgement", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDepartureToWorker, "function");
  if (!lifecycleApi.syncParticipantDepartureToWorker) return;
  await assert.rejects(
    lifecycleApi.syncParticipantDepartureToWorker(
      {
        roomId: "room-one",
        userId: "user-one",
        participantSessionId: "participant-session-one",
        requestedAt: 1_000,
      },
      {
        baseUrl: "https://api.example.com",
        secret: "internal-secret",
        fetch: async () => Response.json({ ok: true, outcome: "unknown" }),
      },
    ),
    /invalid response/,
  );
});

test("sends a bounded exact participant detach command to the Worker", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDetachToWorker, "function");
  if (!lifecycleApi.syncParticipantDetachToWorker) return;
  const command = {
    roomId: "room-1",
    userId: "user-1",
    participantSessionId: "session-1",
    requestedAt: 1_000,
  };
  const acknowledgement = await lifecycleApi.syncParticipantDetachToWorker(
    command,
    {
      baseUrl: "https://worker.test",
      secret: "internal-secret",
      timeoutMs: 25,
      fetch: async (input, init) => {
        assert.equal(
          input.toString(),
          "https://worker.test/internal/rooms/room-1/participants/user-1/detach",
        );
        assert.equal(init?.method, "POST");
        assert.equal(
          new Headers(init?.headers).get("Authorization"),
          "Bearer internal-secret",
        );
        assert.equal(init?.body, JSON.stringify(command));
        assert.ok(init?.signal);
        return Response.json({ ok: true, outcome: "detached" });
      },
    },
  );
  assert.deepEqual(acknowledgement, { ok: true, outcome: "detached" });
});

test("participant detach rejects an invalid Worker acknowledgement", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDetachToWorker, "function");
  if (!lifecycleApi.syncParticipantDetachToWorker) return;
  await assert.rejects(
    lifecycleApi.syncParticipantDetachToWorker(
      {
        roomId: "room-1",
        userId: "user-1",
        participantSessionId: "session-1",
        requestedAt: 1_000,
      },
      {
        baseUrl: "https://worker.test",
        secret: "internal-secret",
        fetch: async () => Response.json({ ok: true, outcome: "departed" }),
      },
    ),
    /invalid response/i,
  );
});

test("participant detach rejects a non-success Worker response", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDetachToWorker, "function");
  if (!lifecycleApi.syncParticipantDetachToWorker) return;
  await assert.rejects(
    lifecycleApi.syncParticipantDetachToWorker(
      {
        roomId: "room-1",
        userId: "user-1",
        participantSessionId: "session-1",
        requestedAt: 1_000,
      },
      {
        baseUrl: "https://worker.test",
        secret: "internal-secret",
        fetch: async () => new Response(null, { status: 500 }),
      },
    ),
    /failed \(500\)/i,
  );
});

test("participant detach aborts its fetch at the configured timeout", async () => {
  assert.equal(typeof lifecycleApi.syncParticipantDetachToWorker, "function");
  if (!lifecycleApi.syncParticipantDetachToWorker) return;
  let aborted = false;
  await assert.rejects(
    lifecycleApi.syncParticipantDetachToWorker(
      {
        roomId: "room-1",
        userId: "user-1",
        participantSessionId: "session-1",
        requestedAt: 1_000,
      },
      {
        baseUrl: "https://worker.test",
        secret: "internal-secret",
        timeoutMs: 25,
        fetch: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          }),
      },
    ),
    /aborted/i,
  );
  assert.equal(aborted, true);
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
