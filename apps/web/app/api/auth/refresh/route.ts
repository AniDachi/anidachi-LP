import { NextRequest, NextResponse } from "next/server";
import { sanitizeAuthReturnTo } from "@/lib/anidachi-auth/return-to";
import { clearAuthCookies, setAuthCookies } from "@/lib/anidachi-auth/session";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { refreshTokenPair } from "@/lib/anidachi-auth/tokens";

export const dynamic = "force-dynamic";

async function refreshSessionFromCookie(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  return refreshTokenPair(refreshToken);
}

function loginRedirectUrl(request: NextRequest, nextPath: string): URL {
  const loginUrl = new URL("/login", request.url);
  if (nextPath && nextPath !== "/login" && !nextPath.startsWith("/login?")) {
    loginUrl.searchParams.set("next", nextPath);
  }
  return loginUrl;
}

export async function GET(request: NextRequest) {
  const nextPath =
    sanitizeAuthReturnTo(request.nextUrl.searchParams.get("next")) || "/account";
  const tokens = await refreshSessionFromCookie(request);
  if (!tokens) {
    const response = NextResponse.redirect(loginRedirectUrl(request, nextPath), 303);
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
  return response;
}

export async function POST(request: NextRequest) {
  const tokens = await refreshSessionFromCookie(request);
  if (!tokens) {
    const response = NextResponse.json(
      { error: "Invalid or expired refresh token" },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
  return response;
}
