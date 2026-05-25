import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { createRoom, countActiveRoomsForHost } from "@/lib/anidachi-auth/db";

export const dynamic = "force-dynamic";

// Plan room limits: watcher gets 1 active room, nakama/junkie get unlimited
const ROOM_LIMITS: Record<string, number> = {
  watcher: 1,
  nakama: Infinity,
  junkie: Infinity,
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = ROOM_LIMITS[session.plan] ?? 1;
  if (isFinite(limit)) {
    const activeCount = await countActiveRoomsForHost(session.userId);
    if (activeCount >= limit) {
      return NextResponse.json(
        {
          error: "Room limit reached for your plan",
          code: "ROOM_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
  }

  let showId: string | undefined;
  let episodeId: string | undefined;
  try {
    const body = await request.json();
    showId = body.showId;
    episodeId = body.episodeId;
  } catch {
    // body is optional
  }

  const room = await createRoom({
    hostUserId: session.userId,
    showId,
    episodeId,
  });

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    roomId: room.room_id,
    shareableLink: `${origin}/room/${room.room_id}`,
  });
}
