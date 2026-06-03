import { NextRequest, NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";
import { clearCredentials } from "@/lib/instagram/storage";

export async function POST(request: NextRequest) {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  let igUserId: string | undefined;
  try {
    const body = await request.json();
    igUserId = body.igUserId;
  } catch {
    // No body or invalid JSON — disconnect all (backwards-compat)
  }

  await clearCredentials(igUserId);
  return NextResponse.json({ ok: true });
}
