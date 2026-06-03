import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/anidachi-auth/tokens";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
