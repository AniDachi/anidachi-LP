import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { createFriendInviteLink } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const inviteLink = await createFriendInviteLink({
      senderUserId: session.userId,
      origin: request.nextUrl.origin,
    });
    return NextResponse.json({ inviteLink });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
