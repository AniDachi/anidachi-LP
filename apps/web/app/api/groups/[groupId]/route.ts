import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  archiveFriendGroup,
  cleanGroupName,
  updateFriendGroup,
} from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const rawName =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).name
      : undefined;
  const name = cleanGroupName(rawName);
  if (!name) {
    return NextResponse.json({ error: "Invalid group name" }, { status: 400 });
  }

  try {
    const { groupId } = await params;
    const group = await updateFriendGroup({
      ownerUserId: session.userId,
      groupId,
      name,
    });
    return NextResponse.json({ group });
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { groupId } = await params;
    await archiveFriendGroup(session.userId, groupId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
