import type { NextRequest } from "next/server";
import { handleWatchHistoryV2Get } from "@/lib/anidachi-auth/watch-history-v2-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleWatchHistoryV2Get(request);
}
