/**
 * First-touch SEO / acquisition landing path for conversion attribution.
 * Captured once per browser session; ignored for auth/product-only routes.
 */

const STORAGE_KEY = "anidachi_first_landing_path";
const REFERRER_KEY = "anidachi_first_referrer";
const UTM_KEY = "anidachi_first_utm";

const NON_MARKETING_PREFIXES = [
  "/account",
  "/login",
  "/join",
  "/friends",
  "/room/",
  "/api/",
  "/blou",
  "/kreatli-email-crm",
  "/success",
  "/extension/connect",
] as const;

export function isNonMarketingPath(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;
  return NON_MARKETING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

function safeSessionGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // private mode / quota — attribution is best-effort
  }
}

function readUtmFromSearch(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const parts: string[] = [];
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]) {
      const v = params.get(key);
      if (v) parts.push(`${key}=${v}`);
    }
    return parts.join("&").slice(0, 400);
  } catch {
    return "";
  }
}

/** Call once on marketing page mount. Idempotent within the session. */
export function captureFirstLandingPath(): void {
  if (typeof window === "undefined") return;
  if (safeSessionGet(STORAGE_KEY)) return;

  const path = window.location.pathname || "/";
  if (isNonMarketingPath(path)) return;

  safeSessionSet(STORAGE_KEY, path);

  const ref = document.referrer || "";
  if (ref) safeSessionSet(REFERRER_KEY, ref.slice(0, 500));

  const utm = readUtmFromSearch(window.location.search);
  if (utm) safeSessionSet(UTM_KEY, utm);
}

export function getFirstLandingPath(): string | null {
  return safeSessionGet(STORAGE_KEY);
}

export function getFirstLandingReferrer(): string | null {
  return safeSessionGet(REFERRER_KEY);
}

export function getFirstLandingUtm(): string | null {
  return safeSessionGet(UTM_KEY);
}

/** Fields to attach to GA4 conversion events and Stripe checkout metadata. */
export function getSeoAttributionFields(): {
  seo_landing_path: string;
  seo_referrer?: string;
  seo_utm?: string;
} {
  const landing =
    getFirstLandingPath() ??
    (typeof window !== "undefined" ? window.location.pathname || "/" : "/");
  const referrer = getFirstLandingReferrer();
  const utm = getFirstLandingUtm();
  return {
    seo_landing_path: landing,
    ...(referrer ? { seo_referrer: referrer } : {}),
    ...(utm ? { seo_utm: utm } : {}),
  };
}
