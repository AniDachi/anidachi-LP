import { createWatchHistoryEditorHandlers } from "@/lib/anidachi-auth/watch-history-editor";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const { GET, POST } = createWatchHistoryEditorHandlers();
