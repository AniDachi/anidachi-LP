/**
 * Routes that need session refresh / JWT work in middleware.
 * All other app paths are public marketing (SEO) and skip auth middleware on production.
 */
export function needsSessionMiddleware(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/account")) return true;
  if (pathname.startsWith("/room/")) return true;
  if (pathname === "/login") return true;
  if (pathname === "/friends") return true;
  if (pathname.startsWith("/friend/")) return true;
  if (pathname.startsWith("/extension/")) return true;
  if (pathname === "/success") return true;
  if (pathname.startsWith("/blou")) return true;
  if (pathname.startsWith("/kreatli-email-crm")) return true;
  if (pathname.startsWith("/__anidachi/")) return true;
  return false;
}

export function isPublicMarketingPath(pathname: string): boolean {
  return !needsSessionMiddleware(pathname);
}
