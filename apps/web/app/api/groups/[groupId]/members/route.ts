import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { addFriendGroupMember } from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const userId =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).userId
      : undefined;
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const { groupId } = await params;
    const group = await addFriendGroupMember({
      ownerUserId: session.userId,
      groupId,
      friendUserId: userId.trim(),
    });
    return NextResponse.json({ group });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
