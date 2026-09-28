import { type NextRequest, NextResponse } from "next/server";
import { RoomSessionAdmissionInputSchema } from "@anidachi/protocol";
import { activeRoomConflictResponse } from "@/lib/anidachi-auth/active-room-session";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  claimActiveRoomSession,
  getRoomById,
  getUserById,
  isRoomMember,
  roomCapabilitiesFromRoom,
  updateRoom,
} from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { resolveAccountEntitlements } from "@/lib/anidachi-auth/account-entitlements";
import { hostingDeniedResponse } from "@/lib/anidachi-auth/hosting-denial";
import {
  clientMediaProtocolVersion,
  negotiateRoomMediaLease,
} from "@/lib/anidachi-auth/room-media-negotiation";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "@/lib/anidachi-auth/room-usage";
import {
  ROOM_TOKEN_TTL_SECONDS,
  canStartHostSession,
  hostRoomTokenTtlSeconds,
  isMeteredPlan,
} from "@/lib/room-quota";

export const dynamic = "force-dynamic";
// Keep this literal statically analyzable by Next/Vercel. A Web source test
// fences it to the shared client-side settlement horizon constant.
export const maxDuration = 60;

/**
 * Issues a room token for the extension to open a WebSocket connection.
 * Role is determined by whether the caller is the room host or a member.
 *
 * Lifecycle side effects (Block 2 of the 2026-06-12 execution plan):
 *   - every connect bumps `last_active_at`;
 *   - the first host connect promotes `lobby -> live`;
 *   - Worker snapshots own open-room metering across reconnects;
 *   - free-plan hosts with no remaining daily quota get QUOTA_EXHAUSTED.
 */
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
	const session =
		cookieSession ??
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

  const admissionInput = RoomSessionAdmissionInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!admissionInput.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
			{ status: 403 },
    );
  }

  const now = new Date();
  const user = await getUserById(session.userId);
	let accountAccess;
	try {
		accountAccess = await resolveAccountEntitlements(session.userId, now);
	} catch {
		return NextResponse.json(
			{ code: "ROOM_AUTHORITY_UNAVAILABLE" },
			{ status: 503 },
		);
	}
	// A room's Free capacity is frozen even if its host has since upgraded.
	// After T, its denial takes precedence over the retired daily quota while
	// cutover delivery catches up. SQL admission still rechecks under locks.
	const activationAt = accountAccess.hosting?.hostingActivationAt;
	if (room.host_plan_code === "free" && activationAt &&
		Date.parse(activationAt) <= Date.parse(accountAccess.history.serverTime)) {
		return NextResponse.json(
			hostingDeniedResponse(new URL("/pricing", request.nextUrl.origin).toString(), isHost),
			{ status: 403 },
		);
	}
	const mediaProtocolVersion = clientMediaProtocolVersion(request.headers.get("x-anidachi-media-protocol"));
  if (mediaProtocolVersion === null)
    return NextResponse.json({ code: "ROOM_UPDATE_REQUIRED" }, { status: 426 });
  let mediaLease;
  try {
    mediaLease = negotiateRoomMediaLease(room.media_lease, mediaProtocolVersion);
  } catch {
    return NextResponse.json({ code: "ROOM_UPDATE_REQUIRED" }, { status: 426 });
  }
	const userPlan = room.host_plan_code;
  const capabilities = roomCapabilitiesFromRoom(room);
  let tokenTtlSeconds = ROOM_TOKEN_TTL_SECONDS;
  let quotaSummary: { remainingSeconds: number; resetAt: string } | null = null;

  if (isHost) {
    if (isMeteredPlan(userPlan)) {
      const quota = await getHostQuotaView(session.userId, userPlan, now);
      if (!canStartHostSession(quota)) {
        return NextResponse.json(quotaExhaustedResponseBody(quota), {
          status: 403,
        });
      }
      tokenTtlSeconds = hostRoomTokenTtlSeconds(quota);
      quotaSummary = quotaSummaryForResponse(userPlan, quota);
    }
  }

  const role = isHost ? "host" : "member";
  let admission;
  try {
    admission = await claimActiveRoomSession({
      userId: session.userId,
      mediaProtocolVersion,
      roomId,
      role,
      participantSessionId: admissionInput.data.participantSessionId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HOST_SUBSCRIPTION_REQUIRED")
      return NextResponse.json(
        hostingDeniedResponse(new URL("/pricing", request.nextUrl.origin).toString(), isHost),
        { status: 403 },
      );
    if (error instanceof Error && error.message === "ROOM_AUTHORITY_UNAVAILABLE")
      return NextResponse.json({ code: "ROOM_AUTHORITY_UNAVAILABLE" }, { status: 503 });
    if (error instanceof Error && error.message === "ROOM_UPDATE_REQUIRED")
      return NextResponse.json({ code: "ROOM_UPDATE_REQUIRED" }, { status: 426 });
    throw error;
  }
  if (admission.outcome === "conflict") {
		return NextResponse.json(activeRoomConflictResponse(admission.activeRoom), {
			status: 409,
		});
  }
  const touched = isHost
    ? await updateRoom(roomId, {
      host_connected_at: now.toISOString(),
      last_active_at: now.toISOString(),
      ...(room.status === "lobby" ? { status: "live" as const } : {}),
    })
    : await updateRoom(roomId, { last_active_at: now.toISOString() });
  if (!touched) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  const roomToken = await signRoomToken(
    {
      sub: session.userId,
      roomId,
      role,
      participantSessionId: admissionInput.data.participantSessionId,
      capabilities,
			mediaLease,
			hostUserId: room.host_user_id,
      displayName: user?.display_name ?? session.email,
      avatarUrl: user?.avatar_url ?? null,
    },
		tokenTtlSeconds,
  );

	return NextResponse.json({
		roomToken,
		capabilities,
		mediaCapabilities: mediaLease?.capabilities,
		quota: quotaSummary,
	});
}
