import { INDEXNOW_KEY } from "@/lib/indexnow";
import { isRobotsIndexingDisabled } from "@/lib/site-url";

/**
 * IndexNow key file. Search engines fetch it to verify submissions from
 * `pnpm --filter @anidachi/web seo:indexnow`. The folder name must equal
 * INDEXNOW_KEY. Staging and previews return 404 so they can never be verified.
 */
export function GET(): Response {
  if (isRobotsIndexingDisabled()) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(INDEXNOW_KEY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
