import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, addRoomMember } from "@/lib/anidachi-auth/db";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await getRoomById(roomId);

  if (!room || room.status === "ended") {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  await addRoomMember(roomId, session.userId);

  const roomToken = await signRoomToken({
    sub: session.userId,
    roomId,
    role: "member",
  });

  return NextResponse.json({ roomToken });
}
