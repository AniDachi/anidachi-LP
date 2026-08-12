import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  revokeDevicePushSubscription,
  devicePushErrorResponse,
} from "@/lib/anidachi-auth/device-push";
import { isUuid } from "@/lib/anidachi-auth/social";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> },
) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.source !== "extension") {
    return NextResponse.json({ error: "Extension authentication required" }, { status: 403 });
  }

  const deviceId = (await context.params).deviceId;
  if (!isUuid(deviceId)) {
    return NextResponse.json({ error: "Invalid device id" }, { status: 400 });
  }

  try {
    await revokeDevicePushSubscription({
      ownerUserId: session.userId,
      deviceId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return devicePushErrorResponse(error);
  }
}
