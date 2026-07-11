import { type NextRequest, NextResponse } from "next/server";
import { getRoomById, updateRoom } from "@/lib/anidachi-auth/db";
import { settleHostSegment } from "@/lib/anidachi-auth/room-usage";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  if (!hasValidInternalServiceAuthorization(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (
    !body || !Number.isInteger(body.endedAt) || (body.endedAt as number) < 0 ||
    !["host_ended", "empty_timeout", "quota_exhausted"].includes(String(body.reason))
  ) {
    return NextResponse.json({ error: "Invalid room end command" }, { status: 400 });
  }
  const { roomId } = await params;
  const room = await getRoomById(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "ended") {
    const endedAt = new Date(body.endedAt as number);
    await settleHostSegment(room, room.host_plan_code, endedAt);
    await updateRoom(roomId, {
      status: "ended",
      ended_at: endedAt.toISOString(),
      host_connected_at: null,
      last_active_at: endedAt.toISOString(),
    });
  }
  return NextResponse.json({ ok: true, alreadyEnded: room.status === "ended" });
}
