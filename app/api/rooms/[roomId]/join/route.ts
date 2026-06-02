import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, addRoomMember, getUserById } from "@/lib/anidachi-auth/db";
import { signRoomToken } from "@/lib/anidachi-auth/jwt";

export const dynamic = "force-dynamic";

function wantsJson(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.get("format") === "json" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

function buildLaunchUrl(sourceUrl: string, roomId: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(
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

  await addRoomMember(roomId, session.userId);

  const user = await getUserById(session.userId);
  const roomToken = await signRoomToken({
    sub: session.userId,
    roomId,
    role: "member",
    displayName: user?.display_name ?? session.email,
    avatarUrl: user?.avatar_url ?? null,
  });

  if (wantsJson(request)) {
    return NextResponse.json({ roomToken });
  }

  const launchUrl = room.source_url ? buildLaunchUrl(room.source_url, roomId) : null;
  return NextResponse.redirect(
    launchUrl ?? new URL(`/room/${encodeURIComponent(roomId)}?joined=1`, request.url),
    303
  );
}
