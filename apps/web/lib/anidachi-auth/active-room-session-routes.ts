import {
  InternalRoomDepartureCommandSchema,
  RoomDepartureCallbackSchema,
  RoomDepartureRequestSchema,
  type ActiveRoomRole,
  type InternalRoomDepartureCommand,
  type RoomDepartureAcknowledgement,
} from "@anidachi/protocol";

type RouteResult =
  | { status: 200; body: RoomDepartureAcknowledgement }
  | {
      status: 400 | 401 | 403 | 502;
      body: { error: string; retryable?: true };
    };

type ExactAssignment = {
  userId: string;
  roomId: string;
  participantSessionId: string;
};

type PublicDepartureDependencies = {
  syncWorker(
    command: InternalRoomDepartureCommand,
  ): Promise<RoomDepartureAcknowledgement>;
  releaseGuest(
    command: ExactAssignment,
  ): Promise<{ outcome: "released" | "stale" }>;
  endHostLobby(
    command: ExactAssignment & { endedAt: string },
  ): Promise<{ outcome: "room_ended" | "stale" }>;
};

export async function handlePublicRoomDeparture(params: {
  userId: string | null;
  roomId: string;
  role: ActiveRoomRole | null;
  value: unknown;
  requestedAt: number;
  dependencies: PublicDepartureDependencies;
}): Promise<RouteResult> {
  if (!params.userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const request = RoomDepartureRequestSchema.safeParse(params.value);
  if (!request.success) {
    return { status: 400, body: { error: "Invalid departure request" } };
  }
  if (!params.role) {
    return { status: 403, body: { error: "Not a room participant" } };
  }
  const command = InternalRoomDepartureCommandSchema.safeParse({
    roomId: params.roomId,
    userId: params.userId,
    participantSessionId: request.data.participantSessionId,
    requestedAt: params.requestedAt,
  });
  if (!command.success) {
    return { status: 400, body: { error: "Invalid departure request" } };
  }

  let worker: RoomDepartureAcknowledgement;
  try {
    worker = await params.dependencies.syncWorker(command.data);
  } catch {
    return {
      status: 502,
      body: { error: "Room departure sync failed", retryable: true },
    };
  }
  if (worker.outcome !== "stale") {
    return { status: 200, body: worker };
  }

  const exact = {
    userId: command.data.userId,
    roomId: command.data.roomId,
    participantSessionId: command.data.participantSessionId,
  };
  if (params.role === "member") {
    const fallback = await params.dependencies.releaseGuest(exact);
    return {
      status: 200,
      body: {
        ok: true,
        outcome: fallback.outcome === "released" ? "departed" : "stale",
      },
    };
  }

  const fallback = await params.dependencies.endHostLobby({
    ...exact,
    endedAt: new Date(command.data.requestedAt).toISOString(),
  });
  return {
    status: 200,
    body: { ok: true, outcome: fallback.outcome },
  };
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
  return {
    status: 200,
    body: {
      ok: true,
      outcome: released.outcome === "released" ? "departed" : "stale",
    },
  };
}
