import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  isRoomMember,
  updateRoom,
} from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
  settleHostSegment,
} from "@/lib/anidachi-auth/room-usage";
import {
  ROOM_TOKEN_TTL_SECONDS,
  canStartHostSession,
  hostRoomTokenTtlSeconds,
  isMeteredPlan,
} from "@/lib/room-quota";

export const dynamic = "force-dynamic";

/**
 * Issues a room token for the extension to open a WebSocket connection.
 * Role is determined by whether the caller is the room host or a member.
 *
 * Lifecycle side effects (Block 2 of the 2026-06-12 execution plan):
 *   - every connect bumps `last_active_at`;
 *   - the first host connect promotes `lobby -> live`;
 *   - host connects settle the previous metering segment and start a new one;
 *   - free-plan hosts with no remaining daily quota get QUOTA_EXHAUSTED.
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

  const now = new Date();
  let tokenTtlSeconds = ROOM_TOKEN_TTL_SECONDS;
  let quotaSummary: { remainingSeconds: number; resetAt: string } | null = null;

  if (isHost) {
    if (isMeteredPlan(session.plan)) {
      // Close the previous segment before recomputing the quota so a
      // reconnect never double-counts the same span.
      await settleHostSegment(room, session.plan, now);
      await updateRoom(roomId, { host_connected_at: null });

      const quota = await getHostQuotaView(session.userId, session.plan, now);
      if (!canStartHostSession(quota)) {
        return NextResponse.json(quotaExhaustedResponseBody(quota), {
          status: 403,
        });
      }
      tokenTtlSeconds = hostRoomTokenTtlSeconds(quota);
      quotaSummary = quotaSummaryForResponse(session.plan, quota);
    }

    await updateRoom(roomId, {
      host_connected_at: now.toISOString(),
      last_active_at: now.toISOString(),
      ...(room.status === "lobby" ? { status: "live" as const } : {}),
    });
  } else {
    await updateRoom(roomId, { last_active_at: now.toISOString() });
  }

  const role = isHost ? "host" : "member";
  const user = await getUserById(session.userId);
  const roomToken = await signRoomToken(
    {
      sub: session.userId,
      roomId,
      role,
      displayName: user?.display_name ?? session.email,
      avatarUrl: user?.avatar_url ?? null,
    },
    tokenTtlSeconds
  );

  return NextResponse.json({ roomToken, quota: quotaSummary });
}
