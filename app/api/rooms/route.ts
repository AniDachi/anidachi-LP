import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { createRoom, countActiveRoomsForHost, getUserById } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";

export const dynamic = "force-dynamic";

// Plan room limits: watcher gets 1 active room, nakama/junkie get unlimited
const ROOM_LIMITS: Record<string, number> = {
  watcher: 1,
  nakama: Infinity,
  junkie: Infinity,
};

export async function POST(request: NextRequest) {
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

  const limit = ROOM_LIMITS[session.plan] ?? 1;
  if (Number.isFinite(limit)) {
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
  const user = await getUserById(session.userId);
  const roomToken = await signRoomToken({
    sub: session.userId,
    roomId: room.room_id,
    role: "host",
    displayName: user?.display_name ?? session.email,
    avatarUrl: user?.avatar_url ?? null,
  });

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    roomId: room.room_id,
    roomToken,
    shareableLink: `${origin}/room/${room.room_id}`,
  });
}
