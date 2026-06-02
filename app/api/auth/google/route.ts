import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/anidachi-auth/oauth/google";
import { sanitizeAuthReturnTo } from "@/lib/anidachi-auth/return-to";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "";
  const safeReturnTo = sanitizeAuthReturnTo(returnTo);

  const state = Buffer.from(
    JSON.stringify({ provider: "google", returnTo: safeReturnTo })
  ).toString("base64url");

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state, request.nextUrl.origin);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("anidachi_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
