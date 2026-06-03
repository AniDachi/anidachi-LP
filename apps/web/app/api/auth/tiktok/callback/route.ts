import { NextRequest, NextResponse } from "next/server";
import { getAllCredentials, setCredentials } from "@/lib/tiktok/storage";
import { MAX_TIKTOK_ACCOUNTS } from "@/lib/social-account-limits";

export const dynamic = "force-dynamic";

const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

function clearCookies(response: NextResponse, isSecure: boolean) {
  for (const name of ["tiktok_oauth_state", "tiktok_csrf_token"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const stateCookie = request.cookies.get("tiktok_oauth_state")?.value;
  const origin = getOrigin(request);
  const isSecure = origin.startsWith("https://");

  const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    `${origin}/api/auth/tiktok/callback`;

  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      new URL("/blou/manager?error=tiktok_config", origin),
    );
  }

  if (error) {
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=tiktok_${encodeURIComponent(error)}`, origin),
    );
    clearCookies(redirect, isSecure);
    return redirect;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const redirect = NextResponse.redirect(
      new URL("/blou/manager?error=tiktok_invalid_state", origin),
    );
    clearCookies(redirect, isSecure);
    return redirect;
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      open_id?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token || !tokenData.open_id) {
      const msg = tokenData.error_description || tokenData.error || "Token exchange failed";
      const redirect = NextResponse.redirect(
        new URL(`/blou/manager?error=tiktok_${encodeURIComponent(msg)}`, origin),
      );
      clearCookies(redirect, isSecure);
      return redirect;
    }

    // Fetch user info (username + avatar)
    const userRes = await fetch(
      `${TIKTOK_USERINFO_URL}?fields=open_id,display_name,avatar_url,username`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const userData = (await userRes.json()) as {
      data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string; username?: string } };
    };

    const username =
      userData.data?.user?.username ||
      userData.data?.user?.display_name ||
      tokenData.open_id;
    const avatarUrl = userData.data?.user?.avatar_url;

    const existingTt = await getAllCredentials();
    const isExistingAccount = existingTt.some(
      (c) => c.openId === tokenData.open_id,
    );
    if (
      !isExistingAccount &&
      existingTt.length >= MAX_TIKTOK_ACCOUNTS
    ) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=max_tiktok_accounts", origin),
      );
      clearCookies(redirect, isSecure);
      return redirect;
    }

    await setCredentials({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
      accessTokenExpiry: Date.now() + (tokenData.expires_in ?? 86400) * 1000,
      refreshTokenExpiry: Date.now() + (tokenData.refresh_expires_in ?? 31536000) * 1000,
      openId: tokenData.open_id,
      username,
      avatarUrl,
    });

    const redirect = NextResponse.redirect(
      new URL("/blou/manager?tiktok_connected=1", origin),
    );
    clearCookies(redirect, isSecure);
    return redirect;
  } catch (err) {
    console.error("TikTok callback error:", err);
    const msg = err instanceof Error ? err.message : "server_error";
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=tiktok_${encodeURIComponent(msg)}`, origin),
    );
    clearCookies(redirect, isSecure);
    return redirect;
  }
}
