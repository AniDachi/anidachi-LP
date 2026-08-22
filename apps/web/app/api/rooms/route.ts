import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { createRoom, getUserById } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import { roomCapabilitiesForPlan } from "@/lib/anidachi-auth/plan-entitlements";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "@/lib/anidachi-auth/room-usage";
import {
  canStartHostSession,
  hostRoomTokenTtlSeconds,
} from "@/lib/room-quota";
import { RoomSourcePersistenceError } from "@/lib/anidachi-auth/room-source";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

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

  const user = await getUserById(session.userId);
  const hostPlan = user?.plan ?? session.plan;
  const capabilities = roomCapabilitiesForPlan(hostPlan);

  // PD2: free plans get a daily host-minutes quota instead of a room-count limit.
  const now = new Date();
  const quota = await getHostQuotaView(session.userId, hostPlan, now);
  if (!canStartHostSession(quota)) {
    return NextResponse.json(quotaExhaustedResponseBody(quota), { status: 403 });
  }

  let showId: string | undefined;
  let episodeId: string | undefined;
  let sourceProvider: unknown;
  let sourceUrl: unknown;
  let videoFingerprint: unknown;
  let title: string | undefined;
  let clientRequestId: string | undefined;
  try {
    const body = await request.json();
    showId = cleanString(body.showId, 200);
    episodeId = cleanString(body.episodeId, 200);
    sourceProvider = body.sourceProvider;
    sourceUrl = body.sourceUrl;
    videoFingerprint = body.videoFingerprint;
    title = cleanString(body.title, 300);
    clientRequestId = cleanString(body.clientRequestId, 100);
  } catch {
    // body is optional
  }

  let created: Awaited<ReturnType<typeof createRoom>>;
  try {
    created = await createRoom({
      hostUserId: session.userId,
      capabilities,
      showId,
      episodeId,
      sourceProvider,
      sourceUrl,
      videoFingerprint,
      title,
      clientRequestId,
    });
  } catch (error) {
    if (error instanceof RoomSourcePersistenceError && error.kind === "invalid") {
      return NextResponse.json(
        { error: "Invalid room source", code: "INVALID_ROOM_SOURCE" },
        { status: 400 },
      );
    }
    throw error;
  }
  const { room, reused } = created;
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

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    roomId: room.room_id,
    roomToken,
    shareableLink: `${origin}/room/${room.room_id}`,
    reused,
    capabilities,
    quota: quotaSummaryForResponse(hostPlan, quota),
  });
}
