import { internalServiceAuthorization } from "@/lib/internal-service-auth";
import {
  EMPTY_ROOM_TIMEOUT_MS,
  InternalRoomDepartureCommandSchema,
  RoomDepartureAcknowledgementSchema,
  RoomUsageSummarySchema,
  createEmptyRoomEndEventId,
  type RoomEndReason,
  type InternalRoomDepartureCommand,
  type RoomDepartureAcknowledgement,
  type RoomUsageSummary,
} from "@anidachi/protocol";

export interface EndRoomCommand { endedAt: number; reason: RoomEndReason }
export interface InternalRoomEndCommand extends EndRoomCommand {
  eventId?: string;
  usage?: RoomUsageSummary;
}

export interface RoomEndSyncResult {
  usage?: RoomUsageSummary;
  webFinalized?: boolean;
}

export class RoomLifecycleSyncError extends Error {
  readonly status = 502;
  constructor(message = "Room Worker synchronization failed; the room was not finalized") {
    super(message);
    this.name = "RoomLifecycleSyncError";
  }
}

interface EndDependencies {
  finalize: (usage?: RoomUsageSummary) => Promise<void>;
  syncWorker: () => Promise<RoomEndSyncResult>;
}

export async function completeHostRoomEnd(params: {
  alreadyEnded: boolean;
  dependencies: EndDependencies;
}): Promise<RoomEndSyncResult> {
  let synced: RoomEndSyncResult;
  try {
    synced = await params.dependencies.syncWorker();
  } catch {
    throw new RoomLifecycleSyncError();
  }
  if (!params.alreadyEnded && synced.webFinalized !== true) {
    await params.dependencies.finalize(synced.usage);
  }
  return synced;
}

export async function completeInternalRoomEnd(params: {
  alreadyEnded: boolean;
  command: InternalRoomEndCommand;
  dependencies: Pick<EndDependencies, "finalize">;
}): Promise<{ alreadyEnded: boolean; eventId?: string }> {
  if (!params.alreadyEnded) {
    await params.dependencies.finalize(params.command.usage);
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
  const usage =
    value.usage === undefined
      ? undefined
      : RoomUsageSummarySchema.safeParse(value.usage);
  if (usage !== undefined && !usage.success) return null;
  const usageField = usage?.success ? { usage: usage.data } : {};

  if (value.reason === "empty_timeout") {
    const emptySince = value.endedAt - EMPTY_ROOM_TIMEOUT_MS;
    if (!isTimestamp(emptySince) || typeof value.eventId !== "string") return null;
    const expectedEventId = await createEmptyRoomEndEventId(roomId, emptySince);
    if (value.eventId !== expectedEventId) return null;
    return {
      endedAt: value.endedAt,
      eventId: expectedEventId,
      reason: "empty_timeout",
      ...usageField,
    };
  }

  if (value.eventId !== undefined) return null;
  return { endedAt: value.endedAt, reason: value.reason, ...usageField };
}

export async function syncRoomEndToWorker(
  roomId: string,
  command: EndRoomCommand,
  options: {
    baseUrl?: string;
    secret?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<RoomEndSyncResult> {
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
  const body = await response.json().catch(() => null);
  if (!isRecord(body) || body.ok !== true) {
    throw new Error("Worker room end returned an invalid response");
  }
  const webFinalized = body.webFinalized === true;
  if (body.usage === undefined) {
    return webFinalized ? { webFinalized: true } : {};
  }
  const usage = RoomUsageSummarySchema.safeParse(body.usage);
  if (!usage.success) {
    throw new Error("Worker room end returned invalid usage");
  }
  return {
    usage: usage.data,
    ...(webFinalized ? { webFinalized: true } : {}),
  };
}

export async function syncParticipantDepartureToWorker(
  command: InternalRoomDepartureCommand,
  options: {
    baseUrl?: string;
    secret?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<RoomDepartureAcknowledgement> {
  const parsed = InternalRoomDepartureCommandSchema.parse(command);
  const baseUrl = options.baseUrl ?? process.env.ANIDACHI_API_INTERNAL_BASE_URL;
  const secret = options.secret ?? process.env.ANIDACHI_INTERNAL_API_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("Participant departure Worker synchronization is not configured");
  }
  const response = await (options.fetch ?? fetch)(
    new URL(
      `/internal/rooms/${encodeURIComponent(parsed.roomId)}` +
        `/participants/${encodeURIComponent(parsed.userId)}/depart`,
      baseUrl,
    ),
    {
      method: "POST",
      headers: {
        Authorization: internalServiceAuthorization(secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed),
    },
  );
  if (!response.ok) {
    throw new Error(`Worker participant departure failed (${response.status})`);
  }
  const body = await response.json().catch(() => null);
  const acknowledgement = RoomDepartureAcknowledgementSchema.safeParse(body);
  if (!acknowledgement.success) {
    throw new Error("Worker participant departure returned an invalid response");
  }
  return acknowledgement.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRoomEndReason(value: unknown): value is RoomEndReason {
  return value === "host_ended" ||
    value === "host_disconnected" ||
    value === "empty_timeout" ||
    value === "quota_exhausted";
}
