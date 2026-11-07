import fs from "node:fs";
import path from "node:path";

/**
 * Real `<lastmod>` dates for sitemap.xml, read from the content date each page already declares
 * (`dateModified` on SeoPageLayout, `updated` on MarketingArticle). Never a build time, file mtime
 * or "today": a rolling date teaches Google to ignore lastmod. A page with no declared date, or
 * with more than one, gets no lastmod.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `dateModified="2026-10-01"`, `dateModified = "2026-10-19"` (prop default) or `dateModified: "…"`. */
const DATE_MODIFIED_LITERAL = /dateModified\s*(?:=|:)\s*\{?\s*["'](\d{4}-\d{2}-\d{2})["']/g;

/** `<MarketingArticle … updated="October 17, 2026">` on trust and legal pages. */
const MARKETING_ARTICLE_UPDATED = /<MarketingArticle\b[^>]*\bupdated=["']([A-Z][a-z]+ \d{1,2}, \d{4})["']/;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Shared page components whose source holds the date for pages that only render them.
 * Paths are relative to the web app root.
 */
const DELEGATED_DATE_SOURCES: { component: string; file: string }[] = [
  { component: "PseoGuidePage", file: "lib/pseo-new-guides.tsx" },
  { component: "PseoListiclePage", file: "lib/pseo-new-guides.tsx" },
  { component: "SectionIndexPage", file: "components/section-index-page.tsx" },
];

export function isTrustworthyIsoDate(value: string, now: Date = new Date()): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== value) return false;
  // A future date is a typo, not a content date.
  return parsed.getTime() <= now.getTime();
}

/** "October 17, 2026" → "2026-10-17"; null for anything else. */
export function longDateToIso(value: string): string | null {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]);
  if (month < 0) return null;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/** The single `dateModified` literal in a source file, or null when there is none or they disagree. */
export function extractDateModifiedLiteral(source: string): string | null {
  const dates = new Set<string>();
  for (const match of source.matchAll(DATE_MODIFIED_LITERAL)) {
    dates.add(match[1]);
  }
  return dates.size === 1 ? [...dates][0] : null;
}

/**
 * The content date a page's source declares. Looks at the page file first, then at the shared
 * component it renders. Returns null when no single trustworthy date is found.
 */
export function extractPageContentDate(
  pageSource: string,
  readDelegate: (relativeFile: string) => string | null,
  now: Date = new Date()
): string | null {
  const candidates: string[] = [];

  const own = extractDateModifiedLiteral(pageSource);
  if (own) candidates.push(own);

  const article = MARKETING_ARTICLE_UPDATED.exec(pageSource);
  if (article) {
    const iso = longDateToIso(article[1]);
    if (iso) candidates.push(iso);
  }

  if (candidates.length === 0) {
    for (const { component, file } of DELEGATED_DATE_SOURCES) {
      if (!new RegExp(`<${component}\\b`).test(pageSource)) continue;
      // A page that passes its own dateModified prop and failed the literal check above stays undated.
      if (/\bdateModified\s*=/.test(pageSource)) break;
      const delegateSource = readDelegate(file);
      const delegated = delegateSource ? extractDateModifiedLiteral(delegateSource) : null;
      if (delegated) candidates.push(delegated);
      break;
    }
  }

  const unique = new Set(candidates);
  if (unique.size !== 1) return null;
  const [date] = unique;
  return isTrustworthyIsoDate(date, now) ? date : null;
}

const WEB_ROOT = process.cwd();
const APP_DIR = path.join(WEB_ROOT, "app");

function readFileOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function pageSourceForUrlPath(urlPath: string): string | null {
  const segments = urlPath.split("/").filter(Boolean);
  for (const name of ["page.tsx", "page.ts", "page.mdx"]) {
    const source = readFileOrNull(path.join(APP_DIR, ...segments, name));
    if (source != null) return source;
  }
  return null;
}

/** Content date for a static route, read from its `app/**\/page.tsx`. */
export function getStaticPageContentDate(urlPath: string, now: Date = new Date()): string | null {
  const source = pageSourceForUrlPath(urlPath);
  if (source == null) return null;
  const cache = new Map<string, string | null>();
  return extractPageContentDate(
    source,
    (relativeFile) => {
      if (!cache.has(relativeFile)) {
        cache.set(relativeFile, readFileOrNull(path.join(WEB_ROOT, relativeFile)));
      }
      return cache.get(relativeFile) ?? null;
    },
    now
  );
}
