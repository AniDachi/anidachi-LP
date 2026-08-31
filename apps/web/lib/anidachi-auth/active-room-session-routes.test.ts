import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS } from "@anidachi/protocol";
import { activeRoomConflictResponse } from "./active-room-session";
import {
  handleActiveRoomRecoveryDeparture,
  handleInternalRoomDepartureCallback,
  handlePublicRoomDeparture,
  type RoomDepartureTelemetry,
} from "./active-room-session-routes";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ROOM_ID = "room-one";
const SESSION_ID = "participant-session-one";

type TestAssignment = {
  userId: string;
  roomId: string;
  role: "host" | "member";
  participantSessionId: string;
};

type TestDependencies = {
  getActiveAssignment(userId: string): Promise<TestAssignment | null>;
  releaseGuest(assignment: {
    userId: string;
    roomId: string;
    participantSessionId: string;
  }): Promise<{ outcome: "released" | "stale" }>;
  detachGuest(command: {
    userId: string;
    roomId: string;
    participantSessionId: string;
    requestedAt: number;
  }): Promise<{ ok: true; outcome: "detached" | "stale" }>;
  syncHostDeparture(command: {
    userId: string;
    roomId: string;
    participantSessionId: string;
    requestedAt: number;
  }): Promise<{
    ok: true;
    outcome: "departed" | "room_ended" | "already_departed" | "stale";
  }>;
  endHostLobby(assignment: {
    userId: string;
    roomId: string;
    participantSessionId: string;
    endedAt: string;
  }): Promise<{ outcome: "room_ended" | "stale" }>;
  report(event: RoomDepartureTelemetry): void;
};

const MEMBER_ASSIGNMENT = {
  userId: USER_ID,
  roomId: ROOM_ID,
  role: "member" as const,
  participantSessionId: SESSION_ID,
};

function departureDependencies(overrides: Partial<TestDependencies> = {}) {
  const calls: string[] = [];
  const events: RoomDepartureTelemetry[] = [];
  let current: TestAssignment | null = MEMBER_ASSIGNMENT;
  const dependencies: TestDependencies = {
    getActiveAssignment: async () => {
      calls.push("read");
      return current;
    },
    releaseGuest: async () => {
      calls.push("release");
      current = null;
      return { outcome: "released" };
    },
    detachGuest: async () => {
      calls.push("detach");
      return { ok: true, outcome: "detached" };
    },
    syncHostDeparture: async () => {
      calls.push("host-worker");
      return { ok: true, outcome: "room_ended" };
    },
    endHostLobby: async () => {
      calls.push("host-fallback");
      return { outcome: "room_ended" };
    },
    report: (event) => {
      events.push(event);
      calls.push(
        `report:${event.mode}:${event.durable}:${event.cleanup ?? "none"}`,
      );
    },
    ...overrides,
  };
  return { calls, events, dependencies };
}

function okResult(
  outcome: "departed" | "room_ended" | "already_departed" | "stale",
) {
  return { status: 200 as const, body: { ok: true as const, outcome } };
}

function unavailableResult() {
  return {
    status: 503 as const,
    body: {
      code: "ROOM_DEPARTURE_UNAVAILABLE" as const,
      message: "Could not leave right now. Please try again.",
      retryable: true as const,
    },
  };
}

async function depart(fixture: ReturnType<typeof departureDependencies>) {
  return handlePublicRoomDeparture({
    userId: USER_ID,
    roomId: ROOM_ID,
    value: { participantSessionId: SESSION_ID },
    requestedAt: 1_000,
    dependencies: fixture.dependencies,
  });
}

async function recover(params: {
  current: typeof MEMBER_ASSIGNMENT | null;
  requestedRoomId?: string;
}) {
  const fixture = departureDependencies({
    getActiveAssignment: async () => params.current,
  });
  return handleActiveRoomRecoveryDeparture({
    userId: USER_ID,
    value: { roomId: params.requestedRoomId ?? ROOM_ID },
    requestedAt: 1_000,
    dependencies: fixture.dependencies,
  });
}

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

test("public departure rejects missing auth and malformed exact-session bodies before dependencies", async () => {
  const fixture = departureDependencies();
  assert.deepEqual(
    await handlePublicRoomDeparture({
      userId: null,
      roomId: ROOM_ID,
      value: { participantSessionId: SESSION_ID },
      requestedAt: 1_000,
      dependencies: fixture.dependencies,
    }),
    {
      status: 401,
      body: {
        code: "AUTH_REQUIRED",
        message: "Sign in again before leaving.",
      },
    },
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
        value,
        requestedAt: 1_000,
        dependencies: fixture.dependencies,
      }),
      { status: 400, body: { error: "Invalid departure request" } },
    );
  }
  assert.deepEqual(fixture.calls, []);
});

test("exact guest departure commits durable release before bounded live detach", async () => {
  const fixture = departureDependencies();
  assert.deepEqual(await depart(fixture), okResult("departed"));
  assert.deepEqual(fixture.calls, [
    "read",
    "release",
    "detach",
    "report:exact:departed:detached",
  ]);
  assert.deepEqual(fixture.events, [
    { mode: "exact", durable: "departed", cleanup: "detached" },
  ]);
});

test("a retry after the first departure response is lost uses legacy-compatible stale", async () => {
  const fixture = departureDependencies();

  assert.deepEqual(await depart(fixture), okResult("departed"));
  assert.deepEqual(await depart(fixture), okResult("stale"));
  assert.equal(fixture.calls.filter((call) => call === "release").length, 1);
  assert.equal(fixture.calls.filter((call) => call === "detach").length, 1);
});

test("exact departure uses legacy-compatible stale for no assignment and stale exact identifiers", async () => {
  const noAssignment = departureDependencies({
    getActiveAssignment: async () => null,
  });
  assert.deepEqual(await depart(noAssignment), okResult("stale"));
  assert.deepEqual(noAssignment.events, [
    { mode: "exact", durable: "already_departed" },
  ]);

  for (const current of [
    { ...MEMBER_ASSIGNMENT, roomId: "new-room" },
    { ...MEMBER_ASSIGNMENT, participantSessionId: "new-session" },
  ]) {
    const staleExact = departureDependencies({
      getActiveAssignment: async () => current,
    });
    assert.deepEqual(await depart(staleExact), okResult("stale"));
    assert.deepEqual(staleExact.events, [
      { mode: "exact", durable: "stale" },
    ]);
    assert.equal(staleExact.calls.includes("detach"), false);
  }
});

test("every post-commit detach result stays departed and reports privacy-safe cleanup once", async () => {
  const cases: Array<{
    name: string;
    detachGuest: TestDependencies["detachGuest"];
    cleanup: "detached" | "stale" | "timeout" | "failed";
  }> = [
    {
      name: "detached",
      detachGuest: async () => ({ ok: true, outcome: "detached" }),
      cleanup: "detached",
    },
    {
      name: "stale",
      detachGuest: async () => ({ ok: true, outcome: "stale" }),
      cleanup: "stale",
    },
    {
      name: "timeout",
      detachGuest: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
      cleanup: "timeout",
    },
    {
      name: "failure",
      detachGuest: async () => {
        throw new Error("offline");
      },
      cleanup: "failed",
    },
  ];

  for (const current of cases) {
    const fixture = departureDependencies({ detachGuest: current.detachGuest });
    assert.deepEqual(await depart(fixture), okResult("departed"), current.name);
    assert.deepEqual(fixture.events, [
      { mode: "exact", durable: "departed", cleanup: current.cleanup },
    ]);
    const serialized = JSON.stringify(fixture.events);
    assert.equal(serialized.includes(USER_ID), false);
    assert.equal(serialized.includes(ROOM_ID), false);
    assert.equal(serialized.includes(SESSION_ID), false);
  }
});

test("a stale release rereads exactly once and never authorizes cleanup", async () => {
  const run = async (currentAfter: TestAssignment | null) => {
    let reads = 0;
    let detachCalls = 0;
    const fixture = departureDependencies({
      getActiveAssignment: async () => {
        reads += 1;
        return reads === 1 ? MEMBER_ASSIGNMENT : currentAfter;
      },
      releaseGuest: async () => ({ outcome: "stale" }),
      detachGuest: async () => {
        detachCalls += 1;
        return { ok: true, outcome: "detached" };
      },
    });
    return { result: await depart(fixture), reads, detachCalls, fixture };
  };

  const noAssignmentAfterMiss = await run(null);
  const changedAfterMiss = await run({
    ...MEMBER_ASSIGNMENT,
    participantSessionId: "replacement-session",
  });
  const identicalAfterMiss = await run(MEMBER_ASSIGNMENT);

  assert.deepEqual(noAssignmentAfterMiss.result, okResult("stale"));
  assert.deepEqual(changedAfterMiss.result, okResult("stale"));
  assert.deepEqual(identicalAfterMiss.result, unavailableResult());
  for (const current of [
    noAssignmentAfterMiss,
    changedAfterMiss,
    identicalAfterMiss,
  ]) {
    assert.equal(current.reads, 2);
    assert.equal(current.detachCalls, 0);
    assert.equal(current.fixture.events.length, 1);
  }
});

test("database read and release failures are typed retryable failures and skip cleanup", async () => {
  let readDetachCalls = 0;
  const readFailure = departureDependencies({
    getActiveAssignment: async () => {
      throw new Error("read failed");
    },
    detachGuest: async () => {
      readDetachCalls += 1;
      return { ok: true, outcome: "detached" };
    },
  });
  assert.deepEqual(await depart(readFailure), unavailableResult());
  assert.equal(readDetachCalls, 0);
  assert.deepEqual(readFailure.events, [{ mode: "exact", durable: "failed" }]);

  let releaseDetachCalls = 0;
  const releaseFailure = departureDependencies({
    releaseGuest: async () => {
      throw new Error("release failed");
    },
    detachGuest: async () => {
      releaseDetachCalls += 1;
      return { ok: true, outcome: "detached" };
    },
  });
  assert.deepEqual(await depart(releaseFailure), unavailableResult());
  assert.equal(releaseDetachCalls, 0);
  assert.deepEqual(releaseFailure.events, [
    { mode: "exact", durable: "failed" },
  ]);
});

test("host departure keeps the legacy Worker lifecycle isolated from guest mutation and telemetry", async () => {
  const hostWorkerSuccess = departureDependencies();
  hostWorkerSuccess.dependencies.getActiveAssignment = async () => {
    hostWorkerSuccess.calls.push("read");
    return { ...MEMBER_ASSIGNMENT, role: "host" };
  };
  assert.deepEqual(await depart(hostWorkerSuccess), okResult("room_ended"));
  assert.deepEqual(hostWorkerSuccess.calls, ["read", "host-worker"]);
  assert.deepEqual(hostWorkerSuccess.events, []);

  const hostWorkerStale = departureDependencies();
  hostWorkerStale.dependencies.getActiveAssignment = async () => {
    hostWorkerStale.calls.push("read");
    return { ...MEMBER_ASSIGNMENT, role: "host" };
  };
  hostWorkerStale.dependencies.syncHostDeparture = async () => {
    hostWorkerStale.calls.push("host-worker");
    return { ok: true, outcome: "stale" };
  };
  assert.deepEqual(await depart(hostWorkerStale), okResult("room_ended"));
  assert.deepEqual(hostWorkerStale.calls, [
    "read",
    "host-worker",
    "host-fallback",
  ]);
  assert.deepEqual(hostWorkerStale.events, []);
});

test("recovery is idempotent with legacy-compatible stale and refuses a different current room", async () => {
  assert.deepEqual(await recover({ current: null }), okResult("stale"));
  assert.deepEqual(
    await recover({
      requestedRoomId: ROOM_ID,
      current: { ...MEMBER_ASSIGNMENT, roomId: "new-room" },
    }),
    {
      status: 409,
      body: {
        code: "ACTIVE_ROOM_CHANGED",
        message: "Your active room changed. Nothing was removed.",
      },
    },
  );
});

test("recovery selects the session server-side and uses the shared durable-first resolver", async () => {
  const calls: string[] = [];
  const fixture = departureDependencies({
    getActiveAssignment: async () => ({
      ...MEMBER_ASSIGNMENT,
      participantSessionId: "server-selected-session",
    }),
    releaseGuest: async (assignment) => {
      calls.push(`release:${assignment.participantSessionId}`);
      return { outcome: "released" };
    },
    detachGuest: async (command) => {
      calls.push(`detach:${command.participantSessionId}`);
      return { ok: true, outcome: "detached" };
    },
  });
  assert.deepEqual(
    await handleActiveRoomRecoveryDeparture({
      userId: USER_ID,
      value: { roomId: ROOM_ID },
      requestedAt: 1_000,
      dependencies: fixture.dependencies,
    }),
    okResult("departed"),
  );
  assert.deepEqual(calls, [
    "release:server-selected-session",
    "detach:server-selected-session",
  ]);
  assert.deepEqual(fixture.events, [
    { mode: "confirmed_recovery", durable: "departed", cleanup: "detached" },
  ]);
});

test("a release race is stale for exact mode and a typed conflict for recovery mode", async () => {
  const run = async (mode: "exact" | "confirmed_recovery") => {
    let reads = 0;
    const fixture = departureDependencies({
      getActiveAssignment: async () => {
        reads += 1;
        return reads === 1
          ? MEMBER_ASSIGNMENT
          : { ...MEMBER_ASSIGNMENT, participantSessionId: "new-session" };
      },
      releaseGuest: async () => ({ outcome: "stale" }),
    });
    const result = mode === "exact"
      ? await depart(fixture)
      : await handleActiveRoomRecoveryDeparture({
          userId: USER_ID,
          value: { roomId: ROOM_ID },
          requestedAt: 1_000,
          dependencies: fixture.dependencies,
        });
    return { result, fixture };
  };
  const recoveryRace = await run("confirmed_recovery");
  const exactRace = await run("exact");
  assert.deepEqual(recoveryRace.result, {
    status: 409,
    body: {
      code: "ACTIVE_ROOM_CHANGED",
      message: "Your active room changed. Nothing was removed.",
    },
  });
  assert.deepEqual(exactRace.result, okResult("stale"));
  assert.deepEqual(recoveryRace.fixture.events, [
    { mode: "confirmed_recovery", durable: "stale" },
  ]);
  assert.deepEqual(exactRace.fixture.events, [
    { mode: "exact", durable: "stale" },
  ]);
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
      calls.push(
        `${command.userId}:${command.roomId}:${command.participantSessionId}`,
      );
      return { outcome: "released" };
    },
  });
  const stale = await handleInternalRoomDepartureCallback({
    ...base,
    release: async () => ({ outcome: "stale" }),
  });
  assert.deepEqual(departed, okResult("departed"));
  assert.deepEqual(stale, okResult("stale"));
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
  const admissionDuration = connect.match(
    /export const maxDuration = (\d+);/,
  );
  assert.equal(
    Number(admissionDuration?.[1]),
    ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS,
  );
  assert.match(connect, /claimActiveRoomSession\(\{/);
  assert.match(connect, /activeRoomConflictResponse\([\s\S]*activeRoom/);
  assert.match(connect, /status:\s*409/);
  assert.match(connect, /signRoomToken\([\s\S]*participantSessionId/);
});

test("production departure routes derive identity and role from active assignment state", () => {
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
  const recoveryRoute = readFileSync(
    new URL(
      "../../app/api/rooms/active-session/depart/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(publicRoute, /getExtensionSessionFromAuthorization/);
  assert.match(publicRoute, /userId:\s*session\.userId/);
  assert.match(publicRoute, /getActiveRoomSessionAssignment/);
  assert.match(publicRoute, /syncParticipantDetachToWorker/);
  assert.match(publicRoute, /syncParticipantDepartureToWorker/);
  assert.match(publicRoute, /releaseActiveRoomSession/);
  assert.match(publicRoute, /endHostLobbyForActiveSession/);
  assert.doesNotMatch(publicRoute, /getRoomById|isRoomMember/);
  assert.doesNotMatch(publicRoute, /userId:\s*(body|value|requestBody)\./);
  assert.match(recoveryRoute, /getExtensionSessionFromAuthorization/);
  assert.match(recoveryRoute, /getActiveRoomSessionAssignment/);
  assert.match(recoveryRoute, /handleActiveRoomRecoveryDeparture/);
  assert.match(recoveryRoute, /syncParticipantDetachToWorker/);
  assert.doesNotMatch(
    recoveryRoute,
    /participantSessionId:\s*(body|value|requestBody)\./,
  );
  assert.match(internalRoute, /hasValidInternalServiceAuthorization/);
  assert.match(internalRoute, /handleInternalRoomDepartureCallback/);
  assert.match(internalRoute, /releaseActiveRoomSession/);
});
