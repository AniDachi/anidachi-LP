import { buildLlmsTxt } from "@/lib/llms-txt";
import { getSeoSiteOrigin, isRobotsIndexingDisabled } from "@/lib/site-url";

export const dynamic = "force-static";

export function GET(): Response {
  if (isRobotsIndexingDisabled()) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(buildLlmsTxt(getSeoSiteOrigin()), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
