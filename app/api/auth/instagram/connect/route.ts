import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";

// Ensure env is read at request time (not at build time)
export const dynamic = "force-dynamic";

// Instagram API with *Instagram* Login (no Facebook Page required).
// We request the minimum scopes needed for reading profile info and publishing content.
const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

export async function GET(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  // Prefer dedicated Instagram app credentials; fall back to META_* if the user reused the same values.
  const appId =
    process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || "";
  const redirectEnv = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  const origin = request.nextUrl.origin;

  if (!appId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID or META_APP_ID is not configured" },
      { status: 500 }
    );
  }

  const callbackUrl =
    redirectEnv || `${origin}/api/auth/instagram/callback`;
  const state = crypto.randomUUID();

  const switchAccount =
    request.nextUrl.searchParams.get("switch_account") === "1";

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: callbackUrl,
    scope: INSTAGRAM_SCOPES,
    state,
    response_type: "code",
  });

  if (switchAccount) {
    params.set("force_reauth", "true");
  }

  // Business Login for Instagram uses the instagram.com OAuth endpoint.
  const url = `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  const isSecure = origin.startsWith("https://");
  const response = NextResponse.json({ url });
  response.cookies.set("instagram_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60, // 10 minutes
    path: "/",
  });
  return response;
}
