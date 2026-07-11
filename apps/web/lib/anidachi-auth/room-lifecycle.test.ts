import assert from "node:assert/strict";
import test from "node:test";
import { completeHostRoomEnd, syncRoomEndToWorker } from "./room-lifecycle";

test("settles and transitions once but syncs Worker on every end request", async () => {
  const calls: string[] = [];
  const dependencies = {
    settle: async () => { calls.push("settle"); },
    transition: async () => { calls.push("transition"); },
    syncWorker: async () => { calls.push("sync"); },
  };

  await completeHostRoomEnd({ alreadyEnded: false, dependencies });
  await completeHostRoomEnd({ alreadyEnded: true, dependencies });
  assert.deepEqual(calls, ["settle", "transition", "sync", "sync"]);
});

test("returns a retryable Worker sync error after legacy settlement", async () => {
  const calls: string[] = [];
  await assert.rejects(
    completeHostRoomEnd({
      alreadyEnded: false,
      dependencies: {
        settle: async () => { calls.push("settle"); },
        transition: async () => { calls.push("transition"); },
        syncWorker: async () => { calls.push("sync"); throw new Error("offline"); },
      },
    }),
    (error: unknown) =>
      error instanceof Error && error.name === "RoomLifecycleSyncError" &&
      (error as Error & { status?: number }).status === 502,
  );
  assert.deepEqual(calls, ["settle", "transition", "sync"]);
});

test("sends the internal secret and end command to the configured Worker", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  await syncRoomEndToWorker(
    "room 1",
    { endedAt: 1_000, reason: "host_ended" },
    {
      baseUrl: "https://api.example.com",
      secret: "internal-secret",
      fetch: async (input, init) => {
        calls.push({ input: String(input), init });
        return Response.json({ ok: true });
      },
    },
  );
  assert.equal(calls[0]?.input, "https://api.example.com/internal/rooms/room%201/end");
  assert.equal(new Headers(calls[0]?.init?.headers).get("Authorization"), "Bearer internal-secret");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ endedAt: 1_000, reason: "host_ended" }));
});
