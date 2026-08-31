import { describe, expect, it } from "vitest";
import {
  ActiveRoomConflictResponseSchema,
	ActiveRoomRecoveryRequestSchema,
	InternalRoomDetachCommandSchema,
  InternalRoomDepartureCommandSchema,
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_SESSION_ID_CHARS,
  ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS,
  ROOM_CONNECT_REQUEST_TIMEOUT_MS,
  ROOM_DISCONNECT_GRACE_MS,
  RoomDepartureAcknowledgementSchema,
	RoomDepartureErrorResponseSchema,
  RoomDepartureCallbackSchema,
  RoomDepartureRequestSchema,
	RoomDetachAcknowledgementSchema,
  RoomSessionAdmissionInputSchema,
} from "../src";

describe("active room session contracts", () => {
  it("publishes the bounded Web admission duration used by durable cancellation intent", () => {
    expect(ROOM_CONNECT_ROUTE_MAX_DURATION_SECONDS).toBe(60);
    expect(ROOM_CONNECT_REQUEST_TIMEOUT_MS).toBe(60_000);
  });

  // Break caught: create/connect could omit or substitute the tab session that
  // must be bound through database admission, token issuance, and JOIN.
  it("requires one bounded participant session for room admission", () => {
    expect(RoomSessionAdmissionInputSchema.parse({ participantSessionId: "session-1" })).toEqual({
      participantSessionId: "session-1",
    });
    expect(() => RoomSessionAdmissionInputSchema.parse({})).toThrow();
    expect(() =>
      RoomSessionAdmissionInputSchema.parse({ participantSessionId: "s".repeat(MAX_SESSION_ID_CHARS + 1) }),
    ).toThrow();
    expect(() =>
      RoomSessionAdmissionInputSchema.parse({ participantSessionId: "session-1", userId: "spoofed-user" }),
    ).toThrow();
  });

  // Break caught: callers could treat a generic 409 body as permission to
  // continue, or expose unbounded/raw room metadata in a conflict response.
  it("defines one strict active-room conflict response", () => {
    const conflict = {
      code: "ACTIVE_ROOM_CONFLICT",
      message: "You already have an active watch room.",
      activeRoom: {
        roomId: "room-1",
        role: "host",
        provider: "youtube",
        title: "Episode 1",
      },
    } as const;

    expect(ActiveRoomConflictResponseSchema.parse(conflict)).toEqual(conflict);
    expect(() =>
      ActiveRoomConflictResponseSchema.parse({
        ...conflict,
        activeRoom: {
          ...conflict.activeRoom,
          roomId: "r".repeat(MAX_ROOM_ID_CHARS + 1),
        },
      }),
    ).toThrow();
    expect(() =>
      ActiveRoomConflictResponseSchema.parse({
        ...conflict,
        activeRoom: { ...conflict.activeRoom, sourceUrl: "https://private.invalid" },
      }),
    ).toThrow();
    expect(() => ActiveRoomConflictResponseSchema.parse({ ...conflict, code: "ROOM_FULL" })).toThrow();
  });

  // Break caught: a tab could ask the Worker to remove a different user or a
  // stale tab could clear the winning session without exact identifiers.
  it("binds departure commands and callbacks to exact user, room, and session ids", () => {
    expect(RoomDepartureRequestSchema.parse({ participantSessionId: "session-1" })).toEqual({
      participantSessionId: "session-1",
    });
    expect(() =>
      RoomDepartureRequestSchema.parse({ participantSessionId: "session-1", userId: "spoofed-user" }),
    ).toThrow();

    const command = {
      roomId: "room-1",
      userId: "user-1",
      participantSessionId: "session-1",
      requestedAt: 1_000,
    } as const;
    expect(InternalRoomDepartureCommandSchema.parse(command)).toEqual(command);
    expect(() =>
      InternalRoomDepartureCommandSchema.parse({
        ...command,
        userId: "u".repeat(MAX_PARTICIPANT_ID_CHARS + 1),
      }),
    ).toThrow();

    const callback = {
      roomId: "room-1",
      userId: "user-1",
      participantSessionId: "session-1",
      departedAt: 61_000,
    } as const;
    expect(RoomDepartureCallbackSchema.parse(callback)).toEqual(callback);
    expect(() => RoomDepartureCallbackSchema.parse({ ...callback, departedAt: -1 })).toThrow();
  });

	// Break caught: a recovery request could accept a client-selected session
	// identifier and release a different assignment instead of resolving the
	// authenticated account's current assignment on the server.
	it("keeps active-room recovery limited to one bounded room selector", () => {
		expect(ActiveRoomRecoveryRequestSchema.parse({ roomId: "room-1" })).toEqual(
			{
				roomId: "room-1",
			},
		);
		expect(() =>
			ActiveRoomRecoveryRequestSchema.parse({
				roomId: "room-1",
				participantSessionId: "client-selected-session",
			}),
		).toThrow();
		expect(() =>
			ActiveRoomRecoveryRequestSchema.parse({
				roomId: "r".repeat(MAX_ROOM_ID_CHARS + 1),
			}),
		).toThrow();
	});

  // Break caught: duplicate/already-stale departures could be mistaken for a
  // retryable failure and trigger loops or duplicate room finalization.
  it("uses bounded idempotent departure outcomes and canonical reconnect grace", () => {
    expect(ROOM_DISCONNECT_GRACE_MS).toBe(60_000);
		for (const outcome of ["departed", "room_ended", "already_departed", "stale"] as const) {
			expect(
				RoomDepartureAcknowledgementSchema.parse({ ok: true, outcome }),
			).toEqual({ ok: true, outcome });
		}
		expect(() =>
			RoomDepartureAcknowledgementSchema.parse({
				ok: true,
				outcome: "unknown",
			}),
		).toThrow();
		expect(() =>
			RoomDepartureAcknowledgementSchema.parse({
				ok: true,
				outcome: "stale",
				retry: true,
			}),
		).toThrow();
	});

	it("defines strict live-detach and public departure error contracts", () => {
		const detach = {
			roomId: "room-1",
			userId: "user-1",
			participantSessionId: "session-1",
			requestedAt: 1_000,
		} as const;

		expect(InternalRoomDetachCommandSchema.parse(detach)).toEqual(detach);
		expect(() =>
			InternalRoomDetachCommandSchema.parse({ ...detach, extra: true }),
		).toThrow();
		expect(() =>
			InternalRoomDetachCommandSchema.parse({
				...detach,
				participantSessionId: "s".repeat(MAX_SESSION_ID_CHARS + 1),
			}),
		).toThrow();

		for (const outcome of ["detached", "stale"] as const) {
			expect(RoomDetachAcknowledgementSchema.parse({ ok: true, outcome })).toEqual({
				ok: true,
				outcome,
			});
		}

		for (const response of [
			{ code: "AUTH_REQUIRED", message: "Sign in again." },
			{
				code: "ACTIVE_ROOM_CHANGED",
				message: "Your active room changed.",
			},
			{
				code: "ROOM_DEPARTURE_UNAVAILABLE",
				message: "Could not leave right now.",
				retryable: true,
			},
		] as const) {
			expect(RoomDepartureErrorResponseSchema.parse(response)).toEqual(response);
		}

		expect(() =>
			RoomDepartureErrorResponseSchema.parse({
				code: "AUTH_REQUIRED",
				message: "Sign in again.",
				retryable: true,
			}),
		).toThrow();
		expect(() =>
			RoomDepartureErrorResponseSchema.parse({
				code: "ROOM_DEPARTURE_UNAVAILABLE",
				message: "Could not leave right now.",
			}),
		).toThrow();
	});
});
