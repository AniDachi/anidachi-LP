import { type NextRequest, NextResponse } from "next/server";
import { getRoomById, updateRoom } from "@/lib/anidachi-auth/db";
import {
  completeInternalRoomEnd,
  parseInternalRoomEndCommand,
} from "@/lib/anidachi-auth/room-lifecycle";
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
  const { roomId } = await params;
  const command = await parseInternalRoomEndCommand(
    roomId,
    await request.json().catch(() => null),
  );
  if (!command) {
    return NextResponse.json({ error: "Invalid room end command" }, { status: 400 });
  }
  const room = await getRoomById(roomId);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const endedAt = new Date(command.endedAt);
  const result = await completeInternalRoomEnd({
    alreadyEnded: room.status === "ended",
    command,
    dependencies: {
      settle: () => settleHostSegment(room, room.host_plan_code, endedAt),
      transition: () => updateRoom(roomId, {
        status: "ended",
        ended_at: endedAt.toISOString(),
        host_connected_at: null,
        last_active_at: endedAt.toISOString(),
      }),
    },
  });
  return NextResponse.json({ ok: true, ...result });
}
