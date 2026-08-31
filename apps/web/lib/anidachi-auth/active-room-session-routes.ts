import {
  ActiveRoomRecoveryRequestSchema,
  InternalRoomDepartureCommandSchema,
  InternalRoomDetachCommandSchema,
  RoomDepartureCallbackSchema,
  RoomDepartureRequestSchema,
  type ActiveRoomRole,
  type InternalRoomDepartureCommand,
  type InternalRoomDetachCommand,
  type RoomDepartureAcknowledgement,
  type RoomDepartureErrorResponse,
  type RoomDetachAcknowledgement,
} from "@anidachi/protocol";

type RouteResult =
  | { status: 200; body: RoomDepartureAcknowledgement }
  | { status: 400 | 401; body: { error: string } }
  | { status: 401 | 409 | 503; body: RoomDepartureErrorResponse };

type ExactAssignment = {
  userId: string;
  roomId: string;
  participantSessionId: string;
};

type CurrentAssignment = ExactAssignment & {
  role: ActiveRoomRole;
};

type DepartureMode = "exact" | "confirmed_recovery";

export type RoomDepartureTelemetry = {
  mode: DepartureMode;
  durable: "departed" | "already_departed" | "stale" | "failed";
  cleanup?: "detached" | "stale" | "timeout" | "failed";
};

type DepartureDependencies = {
  getActiveAssignment(userId: string): Promise<CurrentAssignment | null>;
  releaseGuest(
    assignment: ExactAssignment,
  ): Promise<{ outcome: "released" | "stale" }>;
  detachGuest(
    command: InternalRoomDetachCommand,
  ): Promise<RoomDetachAcknowledgement>;
  syncHostDeparture(
    command: InternalRoomDepartureCommand,
  ): Promise<RoomDepartureAcknowledgement>;
  endHostLobby(
    assignment: ExactAssignment & { endedAt: string },
  ): Promise<{ outcome: "room_ended" | "stale" }>;
  report(event: RoomDepartureTelemetry): void;
};

export function reportRoomDepartureOutcome(
  event: RoomDepartureTelemetry,
): void {
  console.info("[anidachi/room-departure]", JSON.stringify(event));
}

const ok = (
  outcome: RoomDepartureAcknowledgement["outcome"],
): RouteResult => ({
  status: 200,
  body: { ok: true, outcome },
});

const authRequired = (): RouteResult => ({
  status: 401,
  body: {
    code: "AUTH_REQUIRED",
    message: "Sign in again before leaving.",
  },
});

const activeRoomChanged = (): RouteResult => ({
  status: 409,
  body: {
    code: "ACTIVE_ROOM_CHANGED",
    message: "Your active room changed. Nothing was removed.",
  },
});

const unavailable = (): RouteResult => ({
  status: 503,
  body: {
    code: "ROOM_DEPARTURE_UNAVAILABLE",
    message: "Could not leave right now. Please try again.",
    retryable: true,
  },
});

function sameAssignment(
  current: CurrentAssignment,
  expected: CurrentAssignment,
): boolean {
  return current.userId === expected.userId &&
    current.roomId === expected.roomId &&
    current.role === expected.role &&
    current.participantSessionId === expected.participantSessionId;
}

function reportGuestResult(
  dependencies: DepartureDependencies,
  event: RoomDepartureTelemetry,
): void {
  dependencies.report(event);
}

async function departResolvedAssignment(params: {
  assignment: CurrentAssignment;
  requestedAt: number;
  mode: DepartureMode;
  dependencies: DepartureDependencies;
}): Promise<RouteResult> {
  const exact = {
    userId: params.assignment.userId,
    roomId: params.assignment.roomId,
    participantSessionId: params.assignment.participantSessionId,
  };

  if (params.assignment.role === "host") {
    try {
      const worker = await params.dependencies.syncHostDeparture(
        InternalRoomDepartureCommandSchema.parse({
          ...exact,
          requestedAt: params.requestedAt,
        }),
      );
      if (worker.outcome === "room_ended") {
        return { status: 200, body: worker };
      }
      if (worker.outcome !== "stale") return unavailable();
    } catch {
      return unavailable();
    }

    const ended = await params.dependencies
      .endHostLobby({
        ...exact,
        endedAt: new Date(params.requestedAt).toISOString(),
      })
      .catch(() => null);
    return ended ? ok(ended.outcome) : unavailable();
  }

  const released = await params.dependencies.releaseGuest(exact).catch(() => null);
  if (!released) {
    reportGuestResult(params.dependencies, {
      mode: params.mode,
      durable: "failed",
    });
    return unavailable();
  }

  if (released.outcome === "released") {
    const command = InternalRoomDetachCommandSchema.parse({
      ...exact,
      requestedAt: params.requestedAt,
    });
    let cleanup: RoomDepartureTelemetry["cleanup"];
    try {
      cleanup = (await params.dependencies.detachGuest(command)).outcome;
    } catch (error) {
      cleanup = error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : "failed";
    }
    reportGuestResult(params.dependencies, {
      mode: params.mode,
      durable: "departed",
      cleanup,
    });
    return ok("departed");
  }

  const current = await params.dependencies
    .getActiveAssignment(params.assignment.userId)
    .catch(() => undefined);
  if (current === undefined) {
    reportGuestResult(params.dependencies, {
      mode: params.mode,
      durable: "failed",
    });
    return unavailable();
  }
  if (!current) {
    reportGuestResult(params.dependencies, {
      mode: params.mode,
      durable: "already_departed",
    });
    return ok("already_departed");
  }
  if (!sameAssignment(current, params.assignment)) {
    reportGuestResult(params.dependencies, {
      mode: params.mode,
      durable: "stale",
    });
    return params.mode === "confirmed_recovery"
      ? activeRoomChanged()
      : ok("stale");
  }
  reportGuestResult(params.dependencies, {
    mode: params.mode,
    durable: "failed",
  });
  return unavailable();
}

export async function handlePublicRoomDeparture(params: {
  userId: string | null;
  roomId: string;
  value: unknown;
  requestedAt: number;
  dependencies: DepartureDependencies;
}): Promise<RouteResult> {
  if (!params.userId) return authRequired();
  const request = RoomDepartureRequestSchema.safeParse(params.value);
  if (!request.success) {
    return { status: 400, body: { error: "Invalid departure request" } };
  }

  const assignment = await params.dependencies
    .getActiveAssignment(params.userId)
    .catch(() => undefined);
  if (assignment === undefined) {
    reportGuestResult(params.dependencies, { mode: "exact", durable: "failed" });
    return unavailable();
  }
  if (!assignment) {
    reportGuestResult(params.dependencies, {
      mode: "exact",
      durable: "already_departed",
    });
    return ok("already_departed");
  }
  if (
    assignment.userId !== params.userId ||
    assignment.roomId !== params.roomId ||
    assignment.participantSessionId !== request.data.participantSessionId
  ) {
    if (assignment.role === "member") {
      reportGuestResult(params.dependencies, {
        mode: "exact",
        durable: "stale",
      });
    }
    return ok("stale");
  }
  return departResolvedAssignment({
    assignment,
    requestedAt: params.requestedAt,
    mode: "exact",
    dependencies: params.dependencies,
  });
}

export async function handleActiveRoomRecoveryDeparture(params: {
  userId: string | null;
  value: unknown;
  requestedAt: number;
  dependencies: DepartureDependencies;
}): Promise<RouteResult> {
  if (!params.userId) return authRequired();
  const request = ActiveRoomRecoveryRequestSchema.safeParse(params.value);
  if (!request.success) {
    return {
      status: 400,
      body: { error: "Invalid active room departure request" },
    };
  }

  const assignment = await params.dependencies
    .getActiveAssignment(params.userId)
    .catch(() => undefined);
  if (assignment === undefined) {
    reportGuestResult(params.dependencies, {
      mode: "confirmed_recovery",
      durable: "failed",
    });
    return unavailable();
  }
  if (!assignment) {
    reportGuestResult(params.dependencies, {
      mode: "confirmed_recovery",
      durable: "already_departed",
    });
    return ok("already_departed");
  }
  if (
    assignment.userId !== params.userId ||
    assignment.roomId !== request.data.roomId
  ) {
    if (assignment.role === "member") {
      reportGuestResult(params.dependencies, {
        mode: "confirmed_recovery",
        durable: "stale",
      });
    }
    return activeRoomChanged();
  }
  return departResolvedAssignment({
    assignment,
    requestedAt: params.requestedAt,
    mode: "confirmed_recovery",
    dependencies: params.dependencies,
  });
}

export async function handleInternalRoomDepartureCallback(params: {
  authorized: boolean;
  roomId: string;
  userId: string;
  value: unknown;
  release(
    command: ExactAssignment,
  ): Promise<{ outcome: "released" | "stale" }>;
}): Promise<RouteResult> {
  if (!params.authorized) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const callback = RoomDepartureCallbackSchema.safeParse(params.value);
  if (
    !callback.success ||
    callback.data.roomId !== params.roomId ||
    callback.data.userId !== params.userId
  ) {
    return { status: 400, body: { error: "Invalid departure callback" } };
  }
  const released = await params.release({
    roomId: callback.data.roomId,
    userId: callback.data.userId,
    participantSessionId: callback.data.participantSessionId,
  });
  return ok(released.outcome === "released" ? "departed" : "stale");
}
