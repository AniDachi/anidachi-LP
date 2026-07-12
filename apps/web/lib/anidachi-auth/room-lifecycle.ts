import { internalServiceAuthorization } from "@/lib/internal-service-auth";
import {
  EMPTY_ROOM_TIMEOUT_MS,
  createEmptyRoomEndEventId,
  type RoomEndReason,
} from "@anidachi/protocol";

export interface EndRoomCommand { endedAt: number; reason: RoomEndReason }
export interface InternalRoomEndCommand extends EndRoomCommand { eventId?: string }

export class RoomLifecycleSyncError extends Error {
  readonly status = 502;
  constructor(message = "Room ended in the database but Worker synchronization failed") {
    super(message);
    this.name = "RoomLifecycleSyncError";
  }
}

interface EndDependencies {
  settle: () => Promise<void>;
  transition: () => Promise<void>;
  syncWorker: () => Promise<void>;
}

export async function completeHostRoomEnd(params: {
  alreadyEnded: boolean;
  dependencies: EndDependencies;
}): Promise<void> {
  if (!params.alreadyEnded) {
    await params.dependencies.settle();
    await params.dependencies.transition();
  }
  try {
    await params.dependencies.syncWorker();
  } catch {
    throw new RoomLifecycleSyncError();
  }
}

/**
 * Makes sequential Worker retries idempotent against the room's ended status.
 * Task 7 replaces the settlement/transition pair with one atomic database RPC
 * so concurrent callbacks are covered without changing this public contract.
 */
export async function completeInternalRoomEnd(params: {
  alreadyEnded: boolean;
  command: InternalRoomEndCommand;
  dependencies: Pick<EndDependencies, "settle" | "transition">;
}): Promise<{ alreadyEnded: boolean; eventId?: string }> {
  if (!params.alreadyEnded) {
    await params.dependencies.settle();
    await params.dependencies.transition();
  }
  return {
    alreadyEnded: params.alreadyEnded,
    ...(params.command.eventId ? { eventId: params.command.eventId } : {}),
  };
}

export async function parseInternalRoomEndCommand(
  roomId: string,
  value: unknown,
): Promise<InternalRoomEndCommand | null> {
  if (!isRecord(value)) return null;
  if (!isTimestamp(value.endedAt)) return null;
  if (!isRoomEndReason(value.reason)) return null;

  if (value.reason === "empty_timeout") {
    const emptySince = value.endedAt - EMPTY_ROOM_TIMEOUT_MS;
    if (!isTimestamp(emptySince) || typeof value.eventId !== "string") return null;
    const expectedEventId = await createEmptyRoomEndEventId(roomId, emptySince);
    if (value.eventId !== expectedEventId) return null;
    return {
      endedAt: value.endedAt,
      eventId: expectedEventId,
      reason: "empty_timeout",
    };
  }

  if (value.eventId !== undefined) return null;
  return { endedAt: value.endedAt, reason: value.reason };
}

export async function syncRoomEndToWorker(
  roomId: string,
  command: EndRoomCommand,
  options: {
    baseUrl?: string;
    secret?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<void> {
  const baseUrl = options.baseUrl ?? process.env.ANIDACHI_API_INTERNAL_BASE_URL;
  const secret = options.secret ?? process.env.ANIDACHI_INTERNAL_API_SECRET;
  if (!baseUrl || !secret) throw new Error("Room lifecycle Worker synchronization is not configured");
  const response = await (options.fetch ?? fetch)(
    new URL(`/internal/rooms/${encodeURIComponent(roomId)}/end`, baseUrl),
    {
      method: "POST",
      headers: {
        Authorization: internalServiceAuthorization(secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) throw new Error(`Worker room end failed (${response.status})`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRoomEndReason(value: unknown): value is RoomEndReason {
  return value === "host_ended" || value === "empty_timeout" || value === "quota_exhausted";
}
