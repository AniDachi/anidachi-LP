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
  "/friend/",
  "/room/",
  "/api/",
  "/blou",
  "/kreatli-email-crm",
  "/success",
  "/extension/connect",
  "/uninstall",
] as const;

/** Routes whose last segment is a secret or private id (invite tokens, room ids). */
const TOKEN_PATH_PREFIXES = ["/friend/invite/", "/room/"] as const;

/** Drop invite tokens and room ids before a path leaves the browser in analytics or Stripe metadata. */
export function redactAttributionPath(pathname: string): string {
  const prefix = TOKEN_PATH_PREFIXES.find((p) => pathname.startsWith(p));
  return prefix ? prefix.slice(0, -1) : pathname;
}

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

const FIRST_TOUCH_COOKIE = "anidachi_first_touch";

/**
 * Mirrors the first marketing touch into a first-party cookie so the server can
 * attach it to sign-up and purchase events. Written once, kept for 90 days.
 */
function writeFirstTouchCookie(path: string, referrer: string, utm: string): void {
  try {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${FIRST_TOUCH_COOKIE}=`)))
      return;
    let referrerHost = "";
    try {
      referrerHost = referrer ? new URL(referrer).hostname : "";
    } catch {
      referrerHost = "";
    }
    const value = encodeURIComponent(
      JSON.stringify({ p: redactAttributionPath(path), r: referrerHost, u: utm }),
    );
    if (value.length > 900) return;
    document.cookie = `${FIRST_TOUCH_COOKIE}=${value}; Path=/; Max-Age=7776000; SameSite=Lax`;
  } catch {
    // Cookies blocked: attribution stays best-effort.
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
  writeFirstTouchCookie(path, ref, utm);
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
  const landing = redactAttributionPath(
    getFirstLandingPath() ??
      (typeof window !== "undefined" ? window.location.pathname || "/" : "/"),
  );
  const referrer = getFirstLandingReferrer();
  const utm = getFirstLandingUtm();
  return {
    seo_landing_path: landing,
    ...(referrer ? { seo_referrer: referrer } : {}),
    ...(utm ? { seo_utm: utm } : {}),
  };
}
