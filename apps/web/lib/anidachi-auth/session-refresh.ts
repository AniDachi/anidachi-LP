export const AUTH_REFRESH_PATH = "/api/auth/refresh";

function isStaticOrInternalAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$/i.test(
      pathname,
    )
  );
}

export function shouldAutoRefreshWebsiteSession(params: {
  method: string;
  pathname: string;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}): boolean {
  if (params.method !== "GET") return false;
  if (params.hasAccessToken || !params.hasRefreshToken) return false;
  if (params.pathname === AUTH_REFRESH_PATH) return false;
  if (params.pathname.startsWith("/api/")) return false;
  if (params.pathname.startsWith("/__anidachi/")) return false;
  if (isStaticOrInternalAssetPath(params.pathname)) return false;
  return true;
}
