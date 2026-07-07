import { NextRequest, NextResponse } from "next/server";
import {
  createYouTubeOAuth2,
  exchangeYouTubeCode,
  fetchChannelInfo,
  getYouTubeRedirectUri,
} from "@/lib/youtube/oauth";
import { getAllCredentials, setCredentials } from "@/lib/youtube/storage";
import { MAX_YOUTUBE_ACCOUNTS } from "@/lib/social-account-limits";

export const dynamic = "force-dynamic";

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

function clearStateCookie(response: NextResponse, isSecure: boolean) {
  response.cookies.set("youtube_oauth_state", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const stateCookie = request.cookies.get("youtube_oauth_state")?.value;
  const origin = getOrigin(request);
  const isSecure = origin.startsWith("https://");
  const redirectUri = getYouTubeRedirectUri(origin);
  const oauth2 = createYouTubeOAuth2(redirectUri);

  if (!oauth2) {
    return NextResponse.redirect(
      new URL("/blou/manager?error=youtube_config", origin),
    );
  }

  if (error) {
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=youtube_${encodeURIComponent(error)}`, origin),
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const redirect = NextResponse.redirect(
      new URL("/blou/manager?error=youtube_invalid_state", origin),
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }

  try {
    const tokens = await exchangeYouTubeCode(oauth2, code);
    if (!tokens.access_token || !tokens.refresh_token) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=youtube_missing_refresh_token", origin),
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    const channel = await fetchChannelInfo(tokens.access_token);
    if (!channel) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=youtube_no_channel", origin),
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    const existing = await getAllCredentials();
    const isExistingAccount = existing.some(
      (c) => c.channelId === channel.channelId,
    );
    if (!isExistingAccount && existing.length >= MAX_YOUTUBE_ACCOUNTS) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=max_youtube_accounts", origin),
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    await setCredentials({
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      tokenExpiry: tokens.expiry_date ?? Date.now() + 3600 * 1000,
      thumbnailUrl: channel.thumbnailUrl,
    });

    const redirect = NextResponse.redirect(
      new URL("/blou/manager?youtube_connected=1", origin),
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  } catch (err) {
    console.error("YouTube callback error:", err);
    const msg = err instanceof Error ? err.message : "server_error";
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=youtube_${encodeURIComponent(msg)}`, origin),
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }
}
