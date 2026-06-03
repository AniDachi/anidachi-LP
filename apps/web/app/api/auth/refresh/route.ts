import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/anidachi-auth/tokens";
import { REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const newAccessToken = await refreshAccessToken(refreshToken);
  if (!newAccessToken) {
    return NextResponse.json(
      { error: "Invalid or expired refresh token" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
