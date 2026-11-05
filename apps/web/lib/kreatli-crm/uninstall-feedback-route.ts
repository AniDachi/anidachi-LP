import { parseFeedbackCursor, type FeedbackCursor } from "./uninstall-feedback-page";
import type { FeedbackPage } from "./uninstall-feedback-shared";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow" };
export function createUninstallFeedbackGet(deps: {
  authorized: () => Promise<boolean>;
  read: (cursor: FeedbackCursor | null) => Promise<FeedbackPage>;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (!(await deps.authorized())) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
      let cursor: FeedbackCursor | null;
      try { cursor = parseFeedbackCursor(new URL(request.url).searchParams.get("cursor")); }
      catch { return Response.json({ error: "Invalid page cursor" }, { status: 400, headers }); }
      return Response.json(await deps.read(cursor), { headers });
    } catch {
      return Response.json({ error: "Couldn’t load responses. Please try again." }, { status: 503, headers });
    }
  };
}
