import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { acceptRoomInvite } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { inviteId } = await params;
    const invite = await acceptRoomInvite(session.userId, inviteId);
    return NextResponse.json({
      invite,
      roomId: invite.roomId,
      joinUrl: `${request.nextUrl.origin}/room/${encodeURIComponent(invite.roomId)}`,
    });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
