import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, getUserById, isRoomMember } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";

export const dynamic = "force-dynamic";

/**
 * Issues a room token for the extension to open a WebSocket connection.
 * Role is determined by whether the caller is the room host or a member.
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
  const user = await getUserById(session.userId);
  const roomToken = await signRoomToken({
    sub: session.userId,
    roomId,
    role,
    displayName: user?.display_name ?? session.email,
    avatarUrl: user?.avatar_url ?? null,
  });

  return NextResponse.json({ roomToken });
}
