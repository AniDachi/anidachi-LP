import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { declineFriendRequest } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { requestId } = await params;
    const friendship = await declineFriendRequest(session.userId, requestId);
    return NextResponse.json({ friendship });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
