import { RECRAWL_REDIRECT_PATHS } from "@/lib/recrawl-redirects";
import { getSeoSiteOrigin, isRobotsIndexingDisabled } from "@/lib/site-url";

/** Temporary sitemap of redirected URLs so Google recrawls them (ANI-38). See lib/recrawl-redirects.ts. */
export function GET() {
  if (isRobotsIndexingDisabled()) {
    return new Response("Not found", { status: 404 });
  }
  const origin = getSeoSiteOrigin();
  const urls = RECRAWL_REDIRECT_PATHS.map(
    (path) => `  <url>\n    <loc>${origin}${path}</loc>\n    <lastmod>2026-11-20</lastmod>\n  </url>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
