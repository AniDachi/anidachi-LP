import { NextResponse } from "next/server";
import { countSurveyLeads } from "@/lib/kreatli-crm/survey-lead-shared";
import { readContacts } from "@/lib/kreatli-crm/store";

export async function GET() {
  try {
    const contacts = await readContacts();
    const count = countSurveyLeads(contacts);
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    console.error("[waitlist-stats] Failed to read survey lead count:", e);
    return NextResponse.json({ count: null }, { status: 500 });
  }
}
