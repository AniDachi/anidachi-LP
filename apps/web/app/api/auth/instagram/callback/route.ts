import { NextRequest, NextResponse } from "next/server";
import { getAllCredentials, setCredentials } from "@/lib/instagram/storage";
import { MAX_INSTAGRAM_ACCOUNTS } from "@/lib/social-account-limits";

export const dynamic = "force-dynamic";

const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com";

type ShortLivedTokenResponse =
  | {
      access_token?: string;
      user_id?: string | number;
      permissions?: string | string[];
      error_type?: string;
      error_message?: string;
    }
  | {
      data?: {
        access_token?: string;
        user_id?: string | number;
        permissions?: string | string[];
      }[];
      error_type?: string;
      error_message?: string;
    };

function clearStateCookie(response: NextResponse, isSecure: boolean) {
  response.cookies.set("instagram_oauth_state", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const stateCookie = request.cookies.get("instagram_oauth_state")?.value;
  const origin = getOrigin(request);
  const isSecure = origin.startsWith("https://");

  const appId =
    process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || "";
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || "";
  const redirectUri =
    process.env.INSTAGRAM_OAUTH_REDIRECT_URI ||
    `${request.nextUrl.origin}/api/auth/instagram/callback`;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      new URL("/blou/manager?error=config", origin)
    );
  }

  if (error) {
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=${encodeURIComponent(error)}`, origin)
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const redirect = NextResponse.redirect(
      new URL("/blou/manager?error=missing_or_invalid_state", origin)
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }

  try {
    // Step 1: exchange authorization code for a short-lived Instagram User access token.
    const tokenRes = await fetch(INSTAGRAM_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }).toString(),
    });

    const tokenJson = (await tokenRes.json()) as ShortLivedTokenResponse;

    const tokenPayload = (
      "data" in tokenJson && Array.isArray(tokenJson.data)
        ? tokenJson.data[0] || {}
        : tokenJson
    ) as {
      access_token?: string;
      user_id?: string | number;
      error_type?: string;
      error_message?: string;
    };

    const shortLivedToken = tokenPayload.access_token;
    const igUserIdFromToken = tokenPayload.user_id;

    if (!shortLivedToken) {
      const msg =
        tokenJson?.error_message ||
        tokenJson?.error_type ||
        "Token exchange failed";
      const redirect = NextResponse.redirect(
        new URL(`/blou/manager?error=${encodeURIComponent(msg)}`, origin)
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    // Step 2: exchange short-lived token for a long-lived token (valid for ~60 days).
    const longLivedUrl = new URL(
      `${INSTAGRAM_GRAPH_BASE}/access_token`
    );
    longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("access_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = (await longLivedRes.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message: string };
    };

    if (!longLivedData.access_token) {
      const msg =
        longLivedData.error?.message || "Long-lived token exchange failed";
      const redirect = NextResponse.redirect(
        new URL(`/blou/manager?error=${encodeURIComponent(msg)}`, origin)
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    const userToken = longLivedData.access_token;
    const expiresIn =
      longLivedData.expires_in ?? 60 * 24 * 60 * 60; // 60 days in seconds
    const tokenExpiry = Date.now() + expiresIn * 1000;

    // Step 3: fetch Instagram user id + username from the /me endpoint.
    const meUrl = new URL(`${INSTAGRAM_GRAPH_BASE}/v25.0/me`);
    meUrl.searchParams.set("fields", "user_id,username");
    meUrl.searchParams.set("access_token", userToken);

    const meRes = await fetch(meUrl.toString());
    const meData = (await meRes.json()) as
      | {
          user_id?: string;
          username?: string;
        }
      | {
          data?: {
            user_id?: string;
            username?: string;
          }[];
        };

    const mePayload = (
      "data" in meData && Array.isArray(meData.data)
        ? meData.data[0] || {}
        : meData
    ) as {
      user_id?: string;
      username?: string;
    };

    const igUserId =
      (mePayload.user_id as string | undefined) ??
      (typeof igUserIdFromToken === "string"
        ? igUserIdFromToken
        : igUserIdFromToken?.toString());
    const igUsername = mePayload.username ?? "unknown";

    if (!igUserId) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=no_instagram_account", origin)
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    const existingIg = await getAllCredentials();
    const isExistingAccount = existingIg.some((c) => c.igUserId === igUserId);
    if (
      !isExistingAccount &&
      existingIg.length >= MAX_INSTAGRAM_ACCOUNTS
    ) {
      const redirect = NextResponse.redirect(
        new URL("/blou/manager?error=max_instagram_accounts", origin)
      );
      clearStateCookie(redirect, isSecure);
      return redirect;
    }

    await setCredentials({
      accessToken: userToken,
      tokenExpiry,
      igUserId,
      igUsername,
    });

    const redirect = NextResponse.redirect(
      new URL("/blou/manager?connected=1", origin)
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  } catch (err) {
    console.error("Instagram callback error:", err);
    const msg = err instanceof Error ? err.message : "server_error";
    const redirect = NextResponse.redirect(
      new URL(`/blou/manager?error=${encodeURIComponent(msg)}`, origin)
    );
    clearStateCookie(redirect, isSecure);
    return redirect;
  }
}
