import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, updateRoom } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { settleHostSegment } from "@/lib/anidachi-auth/room-usage";

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

  if (room.status === "ended") {
    return NextResponse.json({
      ok: true,
      alreadyEnded: true,
      endedAt: room.ended_at,
    });
  }

  const now = new Date();
  await settleHostSegment(room, session.plan, now);
  await updateRoom(roomId, {
    status: "ended",
    ended_at: now.toISOString(),
    host_connected_at: null,
    last_active_at: now.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    alreadyEnded: false,
    endedAt: now.toISOString(),
  });
}
