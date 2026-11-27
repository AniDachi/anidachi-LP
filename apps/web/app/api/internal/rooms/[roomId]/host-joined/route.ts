import { type NextRequest, NextResponse } from "next/server";
import { RoomHostJoinConfirmationSchema } from "@anidachi/protocol";
import { db } from "@/lib/anidachi-auth/db";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  if (!hasValidInternalServiceAuthorization(request.headers.get("authorization")))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomId } = await params;
  const body = RoomHostJoinConfirmationSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !roomId || roomId.length > 128)
    return NextResponse.json({ error: "Invalid host JOIN" }, { status: 400 });
  const { data, error } = await db().rpc("confirm_reserved_host_join_v1", {
    p_user_id: body.data.userId, p_room_id: roomId, p_participant_session_id: body.data.participantSessionId,
  }).abortSignal(AbortSignal.timeout(2000));
  if (error || typeof data !== "boolean")
    return NextResponse.json({ error: "ROOM_AUTHORITY_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json({ confirmed: data });
}
