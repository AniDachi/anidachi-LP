import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";

export const dynamic = "force-dynamic";

// Only request scopes enabled in your TikTok app sandbox (video.publish causes invalid_scope if not granted)
const TIKTOK_SCOPES = "user.info.basic,user.info.profile,video.upload";

export async function GET(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/auth/tiktok/callback`;

  if (!clientKey) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY is not configured" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const csrfToken = crypto.randomUUID();

  const switchAccount =
    request.nextUrl.searchParams.get("switch_account") === "1";

  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    scope: TIKTOK_SCOPES,
    state,
    response_type: "code",
  });

  if (switchAccount) {
    params.set("disable_auto_auth", "1");
  }

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  const isSecure = request.nextUrl.origin.startsWith("https://");
  const response = NextResponse.json({ url });

  response.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  response.cookies.set("tiktok_csrf_token", csrfToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
