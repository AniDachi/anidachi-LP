import { internalServiceAuthorization } from "@/lib/internal-service-auth";

export type RoomEndReason = "host_ended" | "empty_timeout" | "quota_exhausted";
export interface EndRoomCommand { endedAt: number; reason: RoomEndReason }

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
