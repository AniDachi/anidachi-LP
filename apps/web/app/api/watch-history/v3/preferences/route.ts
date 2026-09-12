import {
  handleWatchHistoryV3PreferencesGet,
  handleWatchHistoryV3PreferencesPatch,
} from "@/lib/anidachi-auth/watch-history-v3-routes";

export const dynamic = "force-dynamic";
export const GET = handleWatchHistoryV3PreferencesGet;
export const PATCH = handleWatchHistoryV3PreferencesPatch;
