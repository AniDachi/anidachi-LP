import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, isRoomMember } from "@/lib/anidachi-auth/db";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";

export const dynamic = "force-dynamic";

/**
 * Issues a room token for the extension to open a WebSocket connection.
 * Role is determined by whether the caller is the room host or a member.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await getRoomById(roomId);

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isHost = room.host_user_id === session.userId;
  const isMember = isHost ? false : await isRoomMember(roomId, session.userId);

  if (!isHost && !isMember) {
    return NextResponse.json(
      { error: "You are not a participant in this room" },
      { status: 403 }
    );
  }

  const role = isHost ? "host" : "member";
  const roomToken = await signRoomToken({
    sub: session.userId,
    roomId,
    role,
  });

  return NextResponse.json({ roomToken });
}
