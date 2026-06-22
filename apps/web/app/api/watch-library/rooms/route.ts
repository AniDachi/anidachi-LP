import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { getUserById, roomCapabilitiesFromRoom } from "@/lib/anidachi-auth/db";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "@/lib/anidachi-auth/room-usage";
import {
  createRoomFromWatchSession,
  WatchLibraryApiError,
} from "@/lib/anidachi-auth/watch-library";
import { watchLibraryErrorResponse } from "@/lib/anidachi-auth/watch-library-routes";
import { canStartHostSession, hostRoomTokenTtlSeconds } from "@/lib/room-quota";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = cleanString((body as { sessionId?: unknown }).sessionId, 120);
    const clientRequestId = cleanString(
      (body as { clientRequestId?: unknown }).clientRequestId,
      120
    );
    if (!sessionId) throw new WatchLibraryApiError(400, "Missing watch session");

    const user = await getUserById(session.userId);
    const hostPlan = user?.plan ?? session.plan;
    const now = new Date();
    const quota = await getHostQuotaView(session.userId, hostPlan, now);
    if (!canStartHostSession(quota)) {
      return NextResponse.json(quotaExhaustedResponseBody(quota), { status: 403 });
    }

    const { room, reused } = await createRoomFromWatchSession({
      userId: session.userId,
      sessionId,
      clientRequestId,
    });
    const capabilities = roomCapabilitiesFromRoom(room);
    const roomToken = await signRoomToken(
      {
        sub: session.userId,
        roomId: room.room_id,
        role: "host",
        capabilities,
        displayName: user?.display_name ?? session.email,
        avatarUrl: user?.avatar_url ?? null,
      },
      hostRoomTokenTtlSeconds(quota)
    );

    return NextResponse.json({
      roomId: room.room_id,
      roomToken,
      shareableLink: `${request.nextUrl.origin}/room/${room.room_id}`,
      reused,
      capabilities,
      quota: quotaSummaryForResponse(hostPlan, quota),
    });
  } catch (error) {
    return watchLibraryErrorResponse(error);
  }
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}
