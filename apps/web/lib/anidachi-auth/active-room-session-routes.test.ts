import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	handleActiveRoomRecoveryDeparture,
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

test("explicit recovery resolves and departs only the authenticated guest's current assignment", async () => {
	const calls: string[] = [];
	let lookups = 0;
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => {
				lookups += 1;
				return lookups === 1
					? {
							userId: USER_ID,
							roomId: ROOM_ID,
							role: "member" as const,
							participantSessionId: "server-current-session",
						}
					: null;
			},
			syncWorker: async (command) => {
				calls.push(`worker:${command.participantSessionId}`);
				return { ok: true, outcome: "stale" };
			},
			releaseGuest: async (command) => {
				calls.push(`release:${command.participantSessionId}`);
				return { outcome: "released" };
			},
			endHostLobby: async () => {
				throw new Error("guest recovery must not end the room");
			},
		},
	});

	assert.deepEqual(result, {
		status: 200,
		body: { ok: true, outcome: "departed" },
	});
	assert.deepEqual(calls, [
		"worker:server-current-session",
		"release:server-current-session",
	]);
	assert.equal(lookups, 2);
});

test("explicit recovery cannot clear a newer assignment in another room", async () => {
	let departureCalls = 0;
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => ({
				userId: USER_ID,
				roomId: "newer-room",
				role: "member",
				participantSessionId: "newer-session",
			}),
			syncWorker: async () => {
				departureCalls += 1;
				return { ok: true, outcome: "departed" };
			},
			releaseGuest: async () => {
				departureCalls += 1;
				return { outcome: "released" };
			},
			endHostLobby: async () => {
				departureCalls += 1;
				return { outcome: "room_ended" };
			},
		},
	});

	assert.deepEqual(result, {
		status: 409,
		body: { error: "Active room changed. Try again." },
	});
	assert.equal(departureCalls, 0);
});

test("explicit recovery is idempotent when the account has no active assignment", async () => {
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => null,
			syncWorker: async () => {
				throw new Error("no assignment must not reach Worker");
			},
			releaseGuest: async () => {
				throw new Error("no assignment must not release anything");
			},
			endHostLobby: async () => {
				throw new Error("no assignment must not end anything");
			},
		},
	});

	assert.deepEqual(result, {
		status: 200,
		body: { ok: true, outcome: "stale" },
	});
});

test("explicit recovery reports a concurrent same-room takeover instead of claiming success", async () => {
	let lookups = 0;
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => {
				lookups += 1;
				return {
					userId: USER_ID,
					roomId: ROOM_ID,
					role: "member" as const,
					participantSessionId:
						lookups === 1
							? "session-before-takeover"
							: "session-after-takeover",
				};
			},
			syncWorker: async () => ({ ok: true, outcome: "stale" }),
			releaseGuest: async () => ({ outcome: "stale" }),
			endHostLobby: async () => {
				throw new Error("guest recovery must not end the room");
			},
		},
	});

	assert.deepEqual(result, {
		status: 409,
		body: { error: "Active room changed. Try again." },
	});
	assert.equal(lookups, 2);
});

test("explicit recovery rechecks authority after Worker departure before claiming success", async () => {
	let lookups = 0;
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => {
				lookups += 1;
				return lookups === 1
					? {
							userId: USER_ID,
							roomId: ROOM_ID,
							role: "member" as const,
							participantSessionId: "session-before-takeover",
						}
					: {
							userId: USER_ID,
							roomId: ROOM_ID,
							role: "member" as const,
							participantSessionId: "session-after-takeover",
						};
			},
			syncWorker: async () => ({ ok: true, outcome: "departed" }),
			releaseGuest: async () => {
				throw new Error("Worker departure must not use the fallback");
			},
			endHostLobby: async () => {
				throw new Error("guest recovery must not end the room");
			},
		},
	});

	assert.deepEqual(result, {
		status: 409,
		body: { error: "Active room changed. Try again." },
	});
	assert.equal(lookups, 2);
});

test("explicit recovery stays retryable when the departed assignment remains authoritative", async () => {
	const assignment = {
		userId: USER_ID,
		roomId: ROOM_ID,
		role: "member" as const,
		participantSessionId: SESSION_ID,
	};
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => assignment,
			syncWorker: async () => ({ ok: true, outcome: "departed" }),
			releaseGuest: async () => {
				throw new Error("Worker departure must not use the fallback");
			},
			endHostLobby: async () => {
				throw new Error("guest recovery must not end the room");
			},
		},
	});

	assert.deepEqual(result, {
		status: 502,
		body: {
			error: "Room departure was not confirmed. Try again.",
			retryable: true,
		},
	});
});

test("explicit host recovery ends the host room without releasing a guest", async () => {
	let lookups = 0;
	const calls: string[] = [];
	const result = await handleActiveRoomRecoveryDeparture({
		userId: USER_ID,
		value: { roomId: ROOM_ID },
		requestedAt: 1_000,
		dependencies: {
			getActiveAssignment: async () => {
				lookups += 1;
				return lookups === 1
					? {
							userId: USER_ID,
							roomId: ROOM_ID,
							role: "host" as const,
							participantSessionId: SESSION_ID,
						}
					: null;
			},
			syncWorker: async () => {
				calls.push("worker");
				return { ok: true, outcome: "stale" };
			},
			releaseGuest: async () => {
				throw new Error("host recovery must not release a guest");
			},
			endHostLobby: async (command) => {
				calls.push(`end:${command.participantSessionId}`);
				return { outcome: "room_ended" };
			},
		},
	});

	assert.deepEqual(result, {
		status: 200,
		body: { ok: true, outcome: "room_ended" },
	});
	assert.equal(lookups, 2);
	assert.deepEqual(calls, ["worker", `end:${SESSION_ID}`]);
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
	const recoveryRoute = readFileSync(
		new URL(
			"../../app/api/rooms/active-session/depart/route.ts",
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
	assert.match(recoveryRoute, /getExtensionSessionFromAuthorization/);
	assert.match(recoveryRoute, /getActiveRoomSessionAssignment/);
	assert.match(recoveryRoute, /handleActiveRoomRecoveryDeparture/);
	assert.doesNotMatch(
		recoveryRoute,
		/participantSessionId:\s*(body|value|requestBody)\./,
	);

  assert.match(internalRoute, /hasValidInternalServiceAuthorization/);
  assert.match(internalRoute, /handleInternalRoomDepartureCallback/);
  assert.match(internalRoute, /releaseActiveRoomSession/);
});
