import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { createRoom, getUserById } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "@/lib/anidachi-auth/room-usage";
import {
  canStartHostSession,
  hostRoomTokenTtlSeconds,
} from "@/lib/room-quota";

export const dynamic = "force-dynamic";

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

function cleanHttpUrl(value: unknown): string | undefined {
  const raw = cleanString(value, 2000);
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
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

  // PD2: free plans get a daily host-minutes quota instead of a room-count limit.
  const now = new Date();
  const quota = await getHostQuotaView(session.userId, session.plan, now);
  if (!canStartHostSession(quota)) {
    return NextResponse.json(quotaExhaustedResponseBody(quota), { status: 403 });
  }

  let showId: string | undefined;
  let episodeId: string | undefined;
  let sourceUrl: string | undefined;
  let videoFingerprint: string | undefined;
  let title: string | undefined;
  let clientRequestId: string | undefined;
  try {
    const body = await request.json();
    showId = cleanString(body.showId, 200);
    episodeId = cleanString(body.episodeId, 200);
    sourceUrl = cleanHttpUrl(body.sourceUrl);
    videoFingerprint = cleanString(body.videoFingerprint, 400);
    title = cleanString(body.title, 300);
    clientRequestId = cleanString(body.clientRequestId, 100);
  } catch {
    // body is optional
  }

  const { room, reused } = await createRoom({
    hostUserId: session.userId,
    showId,
    episodeId,
    sourceUrl,
    videoFingerprint,
    title,
    clientRequestId,
  });
  const user = await getUserById(session.userId);
  const roomToken = await signRoomToken(
    {
      sub: session.userId,
      roomId: room.room_id,
      role: "host",
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
    quota: quotaSummaryForResponse(session.plan, quota),
  });
}
