import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  createRoomWithActiveSession,
  getUserById,
	roomCapabilitiesFromRoom,
	getPersonalHistoryPolicyActive,
} from "@/lib/anidachi-auth/db";
import { activeRoomConflictResponse } from "@/lib/anidachi-auth/active-room-session";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";
import { resolveAccountEntitlements } from "@/lib/anidachi-auth/account-entitlements";
import { roomMediaLease } from "@/lib/anidachi-auth/room-capability";
import { roomCapabilitiesForPlan } from "@/lib/anidachi-auth/plan-entitlements";
import { handleRoomCreateRequestBody } from "@/lib/anidachi-auth/room-create";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "@/lib/anidachi-auth/room-usage";
import { canStartHostSession, hostRoomTokenTtlSeconds } from "@/lib/room-quota";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  const user = await getUserById(session.userId);
	let hostPlan;
	try {
		hostPlan = (await resolveAccountEntitlements(session.userId, new Date()))
			.policy.planCode;
		if (
			(await getPersonalHistoryPolicyActive()) &&
			request.headers.get("x-anidachi-media-protocol") !== "2"
		)
			return NextResponse.json(
				{ code: "ROOM_UPDATE_REQUIRED" },
				{ status: 426 },
			);
	} catch {
		return NextResponse.json(
			{ code: "ROOM_AUTHORITY_UNAVAILABLE" },
			{ status: 503 },
		);
	}
  const capabilities = roomCapabilitiesForPlan(hostPlan);

  // PD2: free plans get a daily host-minutes quota instead of a room-count limit.
  const now = new Date();
  const quota = await getHostQuotaView(session.userId, hostPlan, now);
  if (!canStartHostSession(quota)) {
		return NextResponse.json(quotaExhaustedResponseBody(quota), {
			status: 403,
		});
  }

  const creation = await handleRoomCreateRequestBody({
    readBody: () => request.text(),
    create: async (input) => {
      const { participantSessionId, ...roomInput } = input;
      return {
        admission: await createRoomWithActiveSession({
          hostUserId: session.userId,
					mediaProtocolVersion:
						request.headers.get("x-anidachi-media-protocol") === "2" ? 2 : 1,
          participantSessionId,
          capabilities,
          ...roomInput,
        }),
        participantSessionId,
      };
    },
  });
  if (!creation.ok) {
    return NextResponse.json(creation.body, { status: creation.status });
  }
  const { admission, participantSessionId } = creation.value;
  if (admission.outcome === "conflict") {
		return NextResponse.json(activeRoomConflictResponse(admission.activeRoom), {
			status: 409,
		});
  }
  const { room } = admission;
  const reused = admission.outcome === "reused";
	const frozenQuota = await getHostQuotaView(
		session.userId,
		room.host_plan_code,
		new Date(),
	);
  const roomToken = await signRoomToken(
    {
      sub: session.userId,
      roomId: room.room_id,
      role: "host",
      participantSessionId,
			capabilities: roomCapabilitiesFromRoom(room),
			mediaLease: roomMediaLease(room),
			hostUserId: room.host_user_id,
      displayName: user?.display_name ?? session.email,
      avatarUrl: user?.avatar_url ?? null,
    },
		hostRoomTokenTtlSeconds(frozenQuota),
  );

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    roomId: room.room_id,
    roomToken,
    shareableLink: `${origin}/room/${room.room_id}`,
    reused,
		capabilities: roomCapabilitiesFromRoom(room),
		mediaCapabilities: roomMediaLease(room)?.capabilities,
		quota: quotaSummaryForResponse(room.host_plan_code, frozenQuota),
  });
}
