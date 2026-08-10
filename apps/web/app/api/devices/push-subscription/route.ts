import {
  DevicePushSubscriptionResponseSchema,
  ExtensionPushSubscriptionRequestSchema,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  registerDevicePushSubscription,
  devicePushErrorResponse,
} from "@/lib/anidachi-auth/device-push";
import { readJsonBody } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.source !== "extension") {
    return NextResponse.json({ error: "Extension authentication required" }, { status: 403 });
  }

  const payload = ExtensionPushSubscriptionRequestSchema.safeParse(
    await readJsonBody(request),
  );
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  try {
    const response = await registerDevicePushSubscription({
      ownerUserId: session.userId,
      subscription: payload.data,
    });
    return NextResponse.json(DevicePushSubscriptionResponseSchema.parse(response));
  } catch (error) {
    return devicePushErrorResponse(error);
  }
}
