import { type NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/anidachi-auth/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    refreshToken?: string;
  } | null;

  if (body?.refreshToken) {
    await revokeRefreshToken(body.refreshToken);
  }

  return NextResponse.json({ ok: true });
}
