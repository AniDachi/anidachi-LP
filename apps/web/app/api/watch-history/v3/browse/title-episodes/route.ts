import { createWatchHistoryBrowseHandler } from "@/lib/anidachi-auth/watch-history-browse-routes";
export const dynamic = "force-dynamic";
export const GET = createWatchHistoryBrowseHandler("episodes");
