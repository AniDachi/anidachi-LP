import { type NextRequest, NextResponse } from "next/server";
import {
  getExtensionSessionFromAuthorization,
  getExtensionUserProfile,
} from "@/lib/anidachi-auth/extension-session";
import { getPlanEntitlements } from "@/lib/anidachi-auth/plan-entitlements";
import { getSession } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const extensionSession = await getExtensionSessionFromAuthorization(
    request.headers.get("authorization")
  );
  const cookieSession = extensionSession ? null : await getSession();
  const userId = extensionSession?.sub ?? cookieSession?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getExtensionUserProfile(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    planCode: user.plan,
    entitlements: getPlanEntitlements(user.plan),
  });
}
