import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import {
  createYouTubeOAuth2,
  getYouTubeRedirectUri,
  isYouTubeOAuthConfigured,
  youtubeAuthUrl,
} from "@/lib/youtube/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  if (!isYouTubeOAuthConfigured()) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET are not configured" },
      { status: 500 },
    );
  }

  const origin = request.nextUrl.origin;
  const redirectUri = getYouTubeRedirectUri(origin);
  const oauth2 = createYouTubeOAuth2(redirectUri);
  if (!oauth2) {
    return NextResponse.json(
      { error: "YouTube OAuth is not configured" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const url = youtubeAuthUrl(oauth2, state);
  const isSecure = origin.startsWith("https://");
  const response = NextResponse.json({ url });

  response.cookies.set("youtube_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}
