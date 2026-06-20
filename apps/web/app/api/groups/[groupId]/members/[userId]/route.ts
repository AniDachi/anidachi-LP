import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { removeFriendGroupMember } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { groupId, userId } = await params;
    const group = await removeFriendGroupMember({
      ownerUserId: session.userId,
      groupId,
      friendUserId: userId,
    });
    return NextResponse.json({ group });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
