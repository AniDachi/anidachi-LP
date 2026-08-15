import type { NextRequest } from "next/server";
import {
  handleWatchHistoryV2PreferencesGet,
  handleWatchHistoryV2PreferencesPatch,
} from "@/lib/anidachi-auth/watch-history-v2-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleWatchHistoryV2PreferencesGet(request);
}

export async function PATCH(request: NextRequest) {
  return handleWatchHistoryV2PreferencesPatch(request);
}
