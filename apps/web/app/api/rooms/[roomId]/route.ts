import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  getRoomMemberCount,
} from "@/lib/anidachi-auth/db";
import { deriveDurableRoomSource } from "@/lib/anidachi-auth/room-source";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
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

  const [host, memberCount] = await Promise.all([
    getUserById(room.host_user_id),
    getRoomMemberCount(roomId),
  ]);
  const source = deriveDurableRoomSource(room);

  return NextResponse.json({
    roomId: room.room_id,
    status: room.status,
    showId: room.show_id,
    episodeId: room.episode_id,
    sourceUrl: source?.source.sourceUrl ?? null,
    videoFingerprint: source?.source.videoFingerprint ?? null,
    sourceProvider: source?.source.provider ?? null,
    sourceGeneration: source?.sourceGeneration ?? null,
    title: room.title,
    hostDisplayName: host?.display_name ?? "Unknown",
    memberCount,
  });
}
