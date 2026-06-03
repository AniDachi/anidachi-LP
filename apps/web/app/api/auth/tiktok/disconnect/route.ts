import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { clearCredentials } from "@/lib/tiktok/storage";

export async function POST(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  let openId: string | undefined;
  try {
    const body = await request.json();
    openId = body.openId;
  } catch {
    // No body — disconnect all
  }

  await clearCredentials(openId);
  return NextResponse.json({ ok: true });
}
