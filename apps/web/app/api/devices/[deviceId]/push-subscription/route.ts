import { type NextRequest, NextResponse } from "next/server";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
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
  const session = await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deviceId = (await context.params).deviceId;
  if (!isUuid(deviceId)) {
    return NextResponse.json({ error: "Invalid device id" }, { status: 400 });
  }

  try {
    await revokeDevicePushSubscription({
      ownerUserId: session.sub,
      deviceId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return devicePushErrorResponse(error);
  }
}
