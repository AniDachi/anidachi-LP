import { type NextRequest, NextResponse } from "next/server";
import { releaseActiveRoomSession } from "@/lib/anidachi-auth/db";
import { handleInternalRoomDepartureCallback } from "@/lib/anidachi-auth/active-room-session-routes";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ roomId: string; userId: string }> },
) {
  const { roomId, userId } = await params;
  const response = await handleInternalRoomDepartureCallback({
    authorized: hasValidInternalServiceAuthorization(
      request.headers.get("authorization"),
    ),
    roomId,
    userId,
    value: await request.json().catch(() => null),
    release: releaseActiveRoomSession,
  });
  return NextResponse.json(response.body, { status: response.status });
}
