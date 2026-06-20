import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { sendFriendRequest } from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    const requestItem = await sendFriendRequest({
      requesterUserId: session.userId,
      addresseeUserId: userId.trim(),
    });
    return NextResponse.json({ request: requestItem });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
