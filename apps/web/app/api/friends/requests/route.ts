import { after, type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { deferInboxPushOutboxDrain } from "@/lib/anidachi-auth/inbox-push-outbox";
import { sendFriendRequest } from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const userId = input.userId;
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const { request: requestItem, created } = await sendFriendRequest({
      requesterUserId: session.userId,
      addresseeUserId: userId.trim(),
    });
    if (created) {
      deferInboxPushOutboxDrain([userId.trim()], after);
    }
    return NextResponse.json({ request: requestItem });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
