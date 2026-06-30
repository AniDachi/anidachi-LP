import { type NextRequest, NextResponse } from "next/server";
import { waitlistLeadSummary } from "@/lib/kreatli-crm/survey-lead-shared";
import { readContacts } from "@/lib/kreatli-crm/store";
import { isValidEmail, normalizeEmail } from "@/lib/kreatli-crm/validation";
import { getResolvedSiteOrigin } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim() ?? "";
  const normalized = normalizeEmail(email);

  if (!isValidEmail(normalized)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    const contacts = await readContacts();
    const summary = waitlistLeadSummary(
      contacts,
      normalized,
      getResolvedSiteOrigin(),
    );
    return NextResponse.json(
      {
        waitlistPosition: summary.waitlistPosition,
        referralLink: summary.referralLink,
        referralCount: summary.referralCount,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (e) {
    console.error("[waitlist-position] Failed to read position:", e);
    return NextResponse.json(
      { waitlistPosition: null, referralLink: null, referralCount: 0 },
      { status: 500 },
    );
  }
}
