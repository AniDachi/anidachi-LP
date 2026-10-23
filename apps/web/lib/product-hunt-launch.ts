export const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/anidachi?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-anidachi";

/** Launch-week upvote strip stops showing after this moment (launched Oct 23, 2026). */
export const PRODUCT_HUNT_LAUNCH_BAR_ENDS_AT = Date.parse("2026-10-30T23:59:59Z");

/** High-intent pages where the strip would distract from install or purchase. */
const HIDDEN_PREFIXES = ["/extension", "/pricing"];

export function isProductHuntLaunchOver(now: number): boolean {
  return now > PRODUCT_HUNT_LAUNCH_BAR_ENDS_AT;
}

export function isProductHuntLaunchBarPath(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
