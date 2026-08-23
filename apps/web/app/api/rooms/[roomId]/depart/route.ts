import { type NextRequest, NextResponse } from "next/server";
import {
  endHostLobbyForActiveSession,
  getRoomById,
  isRoomMember,
  releaseActiveRoomSession,
} from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { handlePublicRoomDeparture } from "@/lib/anidachi-auth/active-room-session-routes";
import { syncParticipantDepartureToWorker } from "@/lib/anidachi-auth/room-lifecycle";
import { getSession } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const cookieSession = await getSession();
  const extensionSession = cookieSession
    ? null
    : await getExtensionSessionFromAuthorization(
        request.headers.get("authorization"),
      );
  const session = cookieSession ??
    (extensionSession
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
  const role = room.host_user_id === session.userId
    ? "host"
    : (await isRoomMember(roomId, session.userId) ? "member" : null);
  const response = await handlePublicRoomDeparture({
    userId: session.userId,
    roomId,
    role,
    value: await request.json().catch(() => null),
    requestedAt: Date.now(),
    dependencies: {
      syncWorker: syncParticipantDepartureToWorker,
      releaseGuest: releaseActiveRoomSession,
      endHostLobby: endHostLobbyForActiveSession,
    },
  });
  return NextResponse.json(response.body, { status: response.status });
}
