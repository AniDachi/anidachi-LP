import { NextResponse } from "next/server";
import { getPublicCommunityCount } from "@/lib/public-community-count";

export async function GET() {
  try {
    const count = await getPublicCommunityCount();
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    console.error("[community-stats] Signup count is unavailable");
    return NextResponse.json(
      { count: null },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
