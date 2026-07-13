import { type NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { resolveWebsiteSession } from "@/lib/anidachi-auth/website-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const user = await resolveWebsiteSession(refreshToken);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}
