import {
  DevicePushSubscriptionResponseSchema,
  ExtensionPushSubscriptionRequestSchema,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import {
  registerDevicePushSubscription,
  devicePushErrorResponse,
} from "@/lib/anidachi-auth/device-push";
import { readJsonBody } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Chrome may attach website cookies; push ownership comes only from the extension.
  const session = await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = ExtensionPushSubscriptionRequestSchema.safeParse(
    await readJsonBody(request),
  );
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  try {
    const response = await registerDevicePushSubscription({
      ownerUserId: session.sub,
      subscription: payload.data,
    });
    return NextResponse.json(DevicePushSubscriptionResponseSchema.parse(response));
  } catch (error) {
    return devicePushErrorResponse(error);
  }
}
