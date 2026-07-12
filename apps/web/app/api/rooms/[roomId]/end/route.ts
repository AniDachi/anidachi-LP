import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { finalizeRoomUsage, getRoomById } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import {
  completeHostRoomEnd,
  RoomLifecycleSyncError,
  syncRoomEndToWorker,
} from "@/lib/anidachi-auth/room-lifecycle";

export const dynamic = "force-dynamic";

/**
 * Host-only explicit room end (Block 2.4 of the 2026-06-12 execution plan).
 * Settles the host's open metering segment and marks the room ended.
 * Idempotent: ending an already-ended room succeeds without side effects.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const cookieSession = await getSession();
  const extensionSession = cookieSession
    ? null
    : await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
  const session = cookieSession ?? (extensionSession
    ? {
        userId: extensionSession.sub,
        email: extensionSession.email,
        plan: extensionSession.plan,
      }
    : null);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await getRoomById(roomId);

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.host_user_id !== session.userId) {
    return NextResponse.json(
      { error: "Only the room host can end the room" },
      { status: 403 }
    );
  }

  const now = new Date();
  const alreadyEnded = room.status === "ended";
  const endedAt = alreadyEnded && room.ended_at ? room.ended_at : now.toISOString();
  let finalization = { alreadyEnded, finalizedAt: endedAt };
  try {
    await completeHostRoomEnd({
      alreadyEnded,
      dependencies: {
        finalize: async (usage) => {
          finalization = await finalizeRoomUsage(roomId, endedAt, usage);
        },
        syncWorker: () => syncRoomEndToWorker(roomId, {
          endedAt: Date.parse(endedAt),
          reason: "host_ended",
        }),
      },
    });
  } catch (error) {
    if (error instanceof RoomLifecycleSyncError) {
      return NextResponse.json(
        { error: "ROOM_END_SYNC_FAILED", message: error.message, retryable: true },
        { status: error.status },
      );
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    alreadyEnded: finalization.alreadyEnded,
    endedAt: finalization.finalizedAt,
  });
}
