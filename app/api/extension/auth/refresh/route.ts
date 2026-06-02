import { NextRequest, NextResponse } from "next/server";
import { refreshExtensionAccessToken } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    refreshToken?: string;
  } | null;

  if (!body?.refreshToken) {
    return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
  }

  const accessToken = await refreshExtensionAccessToken(body.refreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  return NextResponse.json({ accessToken });
}
