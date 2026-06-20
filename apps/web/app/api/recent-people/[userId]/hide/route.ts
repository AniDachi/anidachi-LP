import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { hideRecentPerson } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId } = await params;
    await hideRecentPerson(session.userId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
