import type { NextRequest } from "next/server";
import { handleWatchHistoryV2DeletePost } from "@/lib/anidachi-auth/watch-history-v2-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleWatchHistoryV2DeletePost(request);
}
