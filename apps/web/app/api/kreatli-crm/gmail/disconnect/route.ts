import { NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import { clearGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearGmailTokens();
  return NextResponse.json({ ok: true });
}
