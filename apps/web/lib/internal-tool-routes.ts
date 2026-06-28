/**
 * Internal tools (Blou manager, Kreatli CRM) must never be indexed or listed in the sitemap.
 * Keep `robots.ts`, `sitemap-discovery.ts`, and `middleware.ts` in sync via this module.
 */

/** Top-level `app/` segments omitted from static sitemap discovery. */
export const INTERNAL_TOOL_APP_SEGMENTS = [
  "blou",
  "kreatli-email-crm",
  "api",
] as const;

/** `robots.txt` Disallow prefixes (paths and descendants). */
export const INTERNAL_TOOL_ROBOTS_DISALLOW = [
  "/blou",
  "/kreatli-email-crm",
  "/api/blou",
  "/api/kreatli-crm",
] as const;

export function isInternalToolPath(pathname: string): boolean {
  return INTERNAL_TOOL_ROBOTS_DISALLOW.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
