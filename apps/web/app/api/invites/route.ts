import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  cleanInviteMessage,
  createRoomInvite,
  listRoomInvites,
} from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await listRoomInvites(session.userId));
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const roomId = typeof payload.roomId === "string" ? payload.roomId.trim() : "";
  const groupId = typeof payload.groupId === "string" ? payload.groupId.trim() : undefined;
  const recipientUserIds = Array.isArray(payload.recipientUserIds)
    ? payload.recipientUserIds.filter((value): value is string => typeof value === "string")
    : undefined;
  const message = cleanInviteMessage(payload.message);

  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  try {
    const invite = await createRoomInvite({
      senderUserId: session.userId,
      roomId,
      groupId,
      recipientUserIds,
      message,
    });
    return NextResponse.json({ invite });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
