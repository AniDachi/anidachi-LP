import { type NextRequest, NextResponse } from "next/server";
import { isSafeExtensionRedirectUri } from "@/lib/anidachi-auth/extension-codes";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/anidachi-auth/session";
import { revokeRefreshToken } from "@/lib/anidachi-auth/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const redirectUri = request.nextUrl.searchParams.get("redirect_uri") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";

  if (!redirectUri || !state || !isSafeExtensionRedirectUri(redirectUri)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  const callback = new URL(redirectUri);
  callback.searchParams.set("signed_out", "1");
  callback.searchParams.set("state", state);

  const response = NextResponse.redirect(callback.toString(), 303);
  clearAuthCookies(response);
  return response;
}
