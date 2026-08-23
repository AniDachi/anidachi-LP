import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  handleInternalRoomDepartureCallback,
  handlePublicRoomDeparture,
} from "./active-room-session-routes";
import { activeRoomConflictResponse } from "./active-room-session";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "room-one";
const SESSION_ID = "participant-session-one";

test("the conflict response is the shared minimal safe shape", () => {
  assert.deepEqual(
    activeRoomConflictResponse({
      roomId: ROOM_ID,
      role: "host",
      provider: "crunchyroll",
      title: "Series One",
    }),
    {
      code: "ACTIVE_ROOM_CONFLICT",
      message: "You already have an active watch room.",
      activeRoom: {
        roomId: ROOM_ID,
        role: "host",
        provider: "crunchyroll",
        title: "Series One",
      },
    },
  );
});

test("public departure rejects missing auth and malformed exact-session bodies", async () => {
  let calls = 0;
  const dependencies = {
    syncWorker: async () => {
      calls += 1;
      return { ok: true as const, outcome: "departed" as const };
    },
    releaseGuest: async () => {
      calls += 1;
      return { outcome: "released" as const };
    },
    endHostLobby: async () => {
      calls += 1;
      return { outcome: "room_ended" as const };
    },
  };

  assert.deepEqual(
    await handlePublicRoomDeparture({
      userId: null,
      roomId: ROOM_ID,
      role: null,
      value: { participantSessionId: SESSION_ID },
      requestedAt: 1_000,
      dependencies,
    }),
    { status: 401, body: { error: "Unauthorized" } },
  );

  for (const value of [
    {},
    { participantSessionId: "" },
    { participantSessionId: "x".repeat(129) },
    { participantSessionId: SESSION_ID, userId: "attacker-selected-user" },
  ]) {
    assert.deepEqual(
      await handlePublicRoomDeparture({
        userId: USER_ID,
        roomId: ROOM_ID,
        role: "member",
        value,
        requestedAt: 1_000,
        dependencies,
      }),
      { status: 400, body: { error: "Invalid departure request" } },
    );
  }
  assert.equal(calls, 0);
});

test("public departure derives the user from auth and consults Worker before durable state", async () => {
  const calls: string[] = [];
  const result = await handlePublicRoomDeparture({
    userId: USER_ID,
    roomId: ROOM_ID,
    role: "member",
    value: { participantSessionId: SESSION_ID },
    requestedAt: 1_000,
    dependencies: {
      syncWorker: async (command) => {
        calls.push(`worker:${command.userId}:${command.participantSessionId}`);
        return { ok: true, outcome: "departed" };
      },
      releaseGuest: async () => {
        calls.push("release");
        return { outcome: "released" };
      },
      endHostLobby: async () => {
        calls.push("end");
        return { outcome: "room_ended" };
      },
    },
  });

  assert.deepEqual(result, {
    status: 200,
    body: { ok: true, outcome: "departed" },
  });
  assert.deepEqual(calls, [`worker:${USER_ID}:${SESSION_ID}`]);
});

test("a Worker miss uses only the exact safe guest or host fallback", async () => {
  const guestCalls: string[] = [];
  const guest = await handlePublicRoomDeparture({
    userId: USER_ID,
    roomId: ROOM_ID,
    role: "member",
    value: { participantSessionId: SESSION_ID },
    requestedAt: 1_000,
    dependencies: {
      syncWorker: async () => {
        guestCalls.push("worker");
        return { ok: true, outcome: "stale" };
      },
      releaseGuest: async (command) => {
        guestCalls.push(`release:${command.participantSessionId}`);
        return { outcome: "released" };
      },
      endHostLobby: async () => {
        throw new Error("host fallback must not run");
      },
    },
  });
  assert.deepEqual(guest, {
    status: 200,
    body: { ok: true, outcome: "departed" },
  });
  assert.deepEqual(guestCalls, ["worker", `release:${SESSION_ID}`]);

  const hostCalls: string[] = [];
  const host = await handlePublicRoomDeparture({
    userId: USER_ID,
    roomId: ROOM_ID,
    role: "host",
    value: { participantSessionId: SESSION_ID },
    requestedAt: 1_000,
    dependencies: {
      syncWorker: async () => {
        hostCalls.push("worker");
        return { ok: true, outcome: "stale" };
      },
      releaseGuest: async () => {
        throw new Error("guest fallback must not run");
      },
      endHostLobby: async (command) => {
        hostCalls.push(`end:${command.participantSessionId}`);
        return { outcome: "room_ended" };
      },
    },
  });
  assert.deepEqual(host, {
    status: 200,
    body: { ok: true, outcome: "room_ended" },
  });
  assert.deepEqual(hostCalls, ["worker", `end:${SESSION_ID}`]);
});

test("internal guest callback requires service auth and exact path/body identity", async () => {
  let releases = 0;
  const release = async () => {
    releases += 1;
    return { outcome: "released" as const };
  };
  const value = {
    roomId: ROOM_ID,
    userId: USER_ID,
    participantSessionId: SESSION_ID,
    departedAt: 1_000,
  };

  assert.deepEqual(
    await handleInternalRoomDepartureCallback({
      authorized: false,
      roomId: ROOM_ID,
      userId: USER_ID,
      value,
      release,
    }),
    { status: 401, body: { error: "Unauthorized" } },
  );
  assert.deepEqual(
    await handleInternalRoomDepartureCallback({
      authorized: true,
      roomId: "different-room",
      userId: USER_ID,
      value,
      release,
    }),
    { status: 400, body: { error: "Invalid departure callback" } },
  );
  assert.equal(releases, 0);
});

test("internal guest callback compare-deletes once and stays idempotent", async () => {
  const calls: string[] = [];
  const base = {
    authorized: true,
    roomId: ROOM_ID,
    userId: USER_ID,
    value: {
      roomId: ROOM_ID,
      userId: USER_ID,
      participantSessionId: SESSION_ID,
      departedAt: 1_000,
    },
  };
  const departed = await handleInternalRoomDepartureCallback({
    ...base,
    release: async (command) => {
      calls.push(`${command.userId}:${command.roomId}:${command.participantSessionId}`);
      return { outcome: "released" };
    },
  });
  const stale = await handleInternalRoomDepartureCallback({
    ...base,
    release: async () => ({ outcome: "stale" }),
  });

  assert.deepEqual(departed, {
    status: 200,
    body: { ok: true, outcome: "departed" },
  });
  assert.deepEqual(stale, {
    status: 200,
    body: { ok: true, outcome: "stale" },
  });
  assert.deepEqual(calls, [`${USER_ID}:${ROOM_ID}:${SESSION_ID}`]);
});

test("production create and connect routes admit only through the atomic assignment RPCs", () => {
  const main = readFileSync(
    new URL("../../app/api/rooms/route.ts", import.meta.url),
    "utf8",
  );
  const connect = readFileSync(
    new URL("../../app/api/rooms/[roomId]/connect/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(main, /createRoomWithActiveSession\(\{/);
  assert.match(main, /activeRoomConflictResponse\([\s\S]*activeRoom/);
  assert.match(main, /status:\s*409/);
  assert.match(main, /const \{ participantSessionId, \.\.\.roomInput \} = input/);
  assert.match(main, /signRoomToken\([\s\S]*participantSessionId/);
  assert.doesNotMatch(main, /createRoom\(\{/);

  assert.match(connect, /RoomSessionAdmissionInputSchema\.safeParse/);
  assert.match(connect, /claimActiveRoomSession\(\{/);
  assert.match(connect, /activeRoomConflictResponse\([\s\S]*activeRoom/);
  assert.match(connect, /status:\s*409/);
  assert.match(connect, /signRoomToken\([\s\S]*participantSessionId/);
});

test("production departure routes keep identity server-derived and callbacks internal", () => {
  const publicRoute = readFileSync(
    new URL("../../app/api/rooms/[roomId]/depart/route.ts", import.meta.url),
    "utf8",
  );
  const internalRoute = readFileSync(
    new URL(
      "../../app/api/internal/rooms/[roomId]/participants/[userId]/departed/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(publicRoute, /getExtensionSessionFromAuthorization/);
  assert.match(publicRoute, /userId:\s*session\.userId/);
  assert.match(publicRoute, /syncParticipantDepartureToWorker/);
  assert.match(publicRoute, /releaseActiveRoomSession/);
  assert.match(publicRoute, /endHostLobbyForActiveSession/);
  assert.doesNotMatch(publicRoute, /userId:\s*(body|value|requestBody)\./);

  assert.match(internalRoute, /hasValidInternalServiceAuthorization/);
  assert.match(internalRoute, /handleInternalRoomDepartureCallback/);
  assert.match(internalRoute, /releaseActiveRoomSession/);
});
