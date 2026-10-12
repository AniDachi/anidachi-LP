/**
 * Deployment origin for runtime consumers, plus a separate public SEO identity.
 * SEO normalization must not alter OAuth/email callback fallback addresses.
 */

/** Production primary host (Vercel redirects apex → www). */
const DEFAULT_ORIGIN = "https://www.anidachi.app";

function normalizeToOrigin(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_ORIGIN;
  s = s.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return DEFAULT_ORIGIN;
  }
}

/**
 * Resolved origin for this deployment.
 * - Uses `NEXT_PUBLIC_SITE_URL` when set (trimmed, trailing slashes stripped, protocol added if missing).
 * - Else uses `VERCEL_URL` on Vercel (preview/production hostname).
 * - Else production default `https://www.anidachi.app`.
 */
export function getResolvedSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalizeToOrigin(explicit);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return normalizeToOrigin(
      vercel.startsWith("http") ? vercel : `https://${vercel}`,
    );
  }

  return DEFAULT_ORIGIN;
}

/**
 * Search-engine identity only. Keep the existing www primary host even when an
 * older public env value still names the apex. Runtime consumers retain their
 * configured origin; staging, previews and local origins remain independent.
 */
export function getSeoSiteOrigin(): string {
  const origin = getResolvedSiteOrigin();
  if (isRobotsIndexingDisabled()) return origin;
  if (!process.env.NEXT_PUBLIC_SITE_URL?.trim() && process.env.VERCEL_ENV === "production") {
    return DEFAULT_ORIGIN;
  }
  const hostname = new URL(origin).hostname;
  return hostname === "anidachi.app" || hostname === "www.anidachi.app"
    ? DEFAULT_ORIGIN
    : origin;
}

/**
 * When true, this host should not be indexed: `robots.txt` is `Disallow: /` and the sitemap is empty.
 * - `VERCEL_ENV` is `preview` or `development` (Vercel).
 * - Or `NEXT_PUBLIC_ROBOTS_NOINDEX=true` (any host, e.g. custom staging).
 */
export function isRobotsIndexingDisabled(): boolean {
  if (process.env.NEXT_PUBLIC_ROBOTS_NOINDEX === "true") return true;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "production") return true;
  return false;
}

/**
 * Opt-in: block common crawlers used for AI / training corpora (`Disallow: /` per bot).
 * Set `NEXT_PUBLIC_DISALLOW_AI_TRAINING_BOTS=true` when product/legal wants that policy.
 */
export function isAiTrainingCrawlerBlockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DISALLOW_AI_TRAINING_BOTS === "true";
}
