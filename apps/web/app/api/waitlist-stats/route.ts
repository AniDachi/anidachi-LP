import { NextResponse } from "next/server";
import { getPublicSignupCount } from "@/lib/kreatli-crm/public-signup-count";

export async function GET() {
  try {
    const count = await getPublicSignupCount();
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
