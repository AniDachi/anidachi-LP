import { type NextRequest, NextResponse } from "next/server";
import { emitServerEvent } from "@/lib/analytics-server-events";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  addRoomMember,
  isRoomMember,
  getRoomById,
  roomCapabilitiesFromRoom,
  updateRoom,
} from "@/lib/anidachi-auth/db";
import {
  buildRoomSourceLaunchUrl,
  deriveDurableRoomSource,
} from "@/lib/anidachi-auth/room-source";

export const dynamic = "force-dynamic";

function wantsJson(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await getRoomById(roomId);

  if (!room || room.status === "ended") {
    // Browser form posts get the friendly "ended" landing page; API callers
    // still get a machine-readable 404.
    if (!wantsJson(request)) {
      return NextResponse.redirect(
        new URL(`/room/${encodeURIComponent(roomId)}`, request.url),
        303,
      );
    }
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const firstJoin =
    room.host_user_id !== session.userId &&
    !(await isRoomMember(roomId, session.userId));
  await addRoomMember(roomId, session.userId);
  if (firstJoin) {
    emitServerEvent({
      eventType: "room_joined",
      userId: session.userId,
      request,
      insertSeed: `room_joined:${roomId}:${session.userId}`,
      properties: { via: wantsJson(request) ? "api" : "invite_page" },
    });
  }
  await updateRoom(roomId, { last_active_at: new Date().toISOString() });

  const capabilities = roomCapabilitiesFromRoom(room);

  if (wantsJson(request)) {
    return NextResponse.json({ joined: true, capabilities });
  }

  const source = deriveDurableRoomSource(room);
  const launchUrl = source
    ? buildRoomSourceLaunchUrl(source.source, roomId)
    : null;
  return NextResponse.redirect(
    launchUrl ?? new URL(`/room/${encodeURIComponent(roomId)}?joined=1`, request.url),
    303
  );
}
