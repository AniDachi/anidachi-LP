import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { clearCredentials } from "@/lib/youtube/storage";

export async function POST(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  let channelId: string | undefined;
  try {
    const body = await request.json();
    channelId = body.channelId;
  } catch {
    // No body — disconnect all
  }

  await clearCredentials(channelId);
  return NextResponse.json({ ok: true });
}
