import { NextResponse } from "next/server";
import { readContacts } from "@/lib/kreatli-crm/store";
import { countSurveyLeads } from "@/lib/kreatli-crm/survey-lead-shared";

export async function GET() {
  try {
    const contacts = await readContacts();
    const count = countSurveyLeads(contacts);
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    console.error("[waitlist-stats] Failed to read survey lead count:", e);
    return NextResponse.json(
      { count: null },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }
}
