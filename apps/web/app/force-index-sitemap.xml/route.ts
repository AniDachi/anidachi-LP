import { FORCE_INDEX_URL_PATHS } from "@/lib/force-index-urls";
import {
  getResolvedSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Temporary secondary sitemap for GSC discovery of the 2026-07-17
 * Discovered-not-indexed cohort. Keep advertised in robots.txt until Coverage
 * recovers — do not delete without owner approval.
 *
 * Intentionally omits <lastmod>: rewriting every URL to "today" on each request
 * is freshness theater and must not be restored.
 */
export function GET(): Response {
  if (isRobotsIndexingDisabled()) {
    return new Response("Not Found", { status: 404 });
  }

  const origin = getResolvedSiteOrigin();
  const urls = FORCE_INDEX_URL_PATHS.map((path) => {
    const loc = escapeXml(`${origin}${path}`);
    return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
