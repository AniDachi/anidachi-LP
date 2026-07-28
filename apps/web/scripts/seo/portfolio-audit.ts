/**
 * SEO portfolio audit: inventory every public route, join GSC + GA4,
 * flag query cannibalization, and suggest Keep / Enrich / Merge / Review.
 *
 * Does NOT invent indexation status — GSC Coverage (Indexed vs Discovered)
 * must be reviewed in Search Console UI. This report uses Search Analytics
 * presence (impressions) as a proxy for "has earned search visibility."
 *
 * Prereqs: reconnect Google OAuth in CRM (Search Console + Analytics scopes).
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:portfolio
 *   pnpm --filter @anidachi/web seo:portfolio -- --days 28 --out ./tmp/seo-portfolio.json
 *
 * Publishing freeze: do not ship net-new SEO route batches until the current
 * cohort completes a 30/60/90-day review using this report + GSC Coverage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { animeList } from "../../lib/anime-data";
import { getGoogleMarketingAuthClient } from "../../lib/google-marketing/auth";
import {
  fetchGa4LandingByChannel,
  fetchGa4LandingConversions,
  fetchGa4TopPages,
  type Ga4LandingChannelRow,
  type Ga4LandingConversionRow,
  type Ga4PageRow,
} from "../../lib/google-marketing/ga4";
import {
  fetchGscPages,
  fetchGscQueryPagePairs,
  type GscPageRow,
  type GscQueryPageRow,
} from "../../lib/google-marketing/gsc";
import { discoverStaticSitemapUrlPaths } from "../../lib/sitemap-discovery";
import { inferPageTemplateFromPath } from "../../lib/conversion-events";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type PortfolioAction =
  | "Keep"
  | "Enrich"
  | "Merge/301"
  | "Noindex"
  | "Retire"
  | "Review";

type PortfolioRow = {
  path: string;
  template: string;
  cluster: string;
  gscClicks: number;
  gscImpressions: number;
  gscCtr: number;
  gscPosition: number | null;
  ga4Sessions: number;
  ga4EngagedSessions: number;
  ga4KeyEvents: number;
  organicSessions: number;
  topQueries: string[];
  cannibalizedWith: string[];
  suggestedAction: PortfolioAction;
  reason: string;
};

function loadEnvLocal() {
  for (const rel of ["../../.env.local", "../../../.env.local"]) {
    const envPath = path.join(__dirname, rel);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0 && process.env[t.slice(0, i)] === undefined) {
        process.env[t.slice(0, i)] = t.slice(i + 1);
      }
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 28;
  let out: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) days = Number(args[++i]);
    if (args[i] === "--out" && args[i + 1]) out = args[++i];
  }
  return { days, out };
}

function toPathname(urlOrPath: string): string {
  try {
    if (urlOrPath.startsWith("http")) {
      return new URL(urlOrPath).pathname || "/";
    }
  } catch {
    // keep as path
  }
  const q = urlOrPath.indexOf("?");
  return (q >= 0 ? urlOrPath.slice(0, q) : urlOrPath) || "/";
}

function inventoryPublicPaths(): string[] {
  const staticPaths = discoverStaticSitemapUrlPaths();
  const animePaths = animeList.map((a) => `/watch/${a.slug}-with-friends`);
  return [...new Set([...staticPaths, ...animePaths])].sort((a, b) =>
    a.localeCompare(b)
  );
}

function inferCluster(pathname: string): string {
  if (pathname.startsWith("/watch/") && pathname.includes("-with-friends")) {
    return "programmatic-anime";
  }
  if (
    pathname.includes("youtube") ||
    pathname === "/watch-youtube-together" ||
    pathname === "/watch-youtube-together-long-distance"
  ) {
    return "youtube";
  }
  if (
    pathname.includes("crunchyroll") ||
    pathname === "/watch-crunchyroll-together" ||
    pathname === "/watch-crunchyroll-together-long-distance"
  ) {
    return "crunchyroll";
  }
  if (
    pathname.includes("long-distance") ||
    pathname.includes("timezone") ||
    pathname.includes("boyfriend") ||
    pathname.includes("girlfriend")
  ) {
    return "long-distance";
  }
  if (pathname.startsWith("/compare/")) return "compare";
  if (pathname.startsWith("/glossary/")) return "glossary";
  if (pathname.startsWith("/guides/best-")) return "listicle";
  if (
    pathname === "/watch-anime-together" ||
    pathname === "/anime-watch-party" ||
    pathname === "/anime-watch-party-toolkit" ||
    pathname === "/watch-party-starter"
  ) {
    return "anime-pillar";
  }
  if (pathname.startsWith("/watch-") && pathname.includes("-anime-with-friends")) {
    return "genre-hub";
  }
  if (pathname.startsWith("/guides/")) return "guide";
  if (pathname === "/pricing" || pathname === "/") return "product";
  return "other";
}

function suggestAction(input: {
  impressions: number;
  clicks: number;
  sessions: number;
  keyEvents: number;
  cannibalizedWith: string[];
  cluster: string;
}): { action: PortfolioAction; reason: string } {
  const {
    impressions,
    clicks,
    sessions,
    keyEvents,
    cannibalizedWith,
    cluster,
  } = input;

  if (cannibalizedWith.length >= 2 && impressions > 0) {
    return {
      action: "Merge/301",
      reason: `Shares queries with ${cannibalizedWith.slice(0, 3).join(", ")} — confirm in GSC before merging.`,
    };
  }

  if (impressions === 0 && sessions === 0) {
    return {
      action: "Review",
      reason:
        "No Search Analytics impressions and no GA4 landing sessions in window — check Coverage + inbound links at 60/90 days.",
    };
  }

  if (impressions > 50 && clicks < 2 && cluster === "programmatic-anime") {
    return {
      action: "Enrich",
      reason: "Impressions without clicks on a templated title page — improve uniqueness/CTR.",
    };
  }

  if (impressions > 100 && clicks >= 5 && keyEvents === 0) {
    return {
      action: "Enrich",
      reason: "Search demand exists but no key events on landing path — improve conversion path.",
    };
  }

  if (clicks >= 10 || keyEvents > 0) {
    return {
      action: "Keep",
      reason: "Demonstrated search or conversion value in the window.",
    };
  }

  if (impressions > 0 && clicks === 0) {
    return {
      action: "Enrich",
      reason: "Visible in search but no clicks — title/meta/content differentiation needed.",
    };
  }

  return {
    action: "Review",
    reason: "Low signal — re-check at 30/60/90 days; do not expand this cluster yet.",
  };
}

function buildCannibalizationMap(
  pairs: GscQueryPageRow[],
  minImpressions = 10
): Map<string, string[]> {
  const byQuery = new Map<string, GscQueryPageRow[]>();
  for (const row of pairs) {
    if (row.impressions < minImpressions) continue;
    const list = byQuery.get(row.query) ?? [];
    list.push(row);
    byQuery.set(row.query, list);
  }

  const pageToRivals = new Map<string, Set<string>>();
  for (const [, rows] of byQuery) {
    if (rows.length < 2) continue;
    const paths = rows.map((r) => toPathname(r.page));
    for (const p of paths) {
      const set = pageToRivals.get(p) ?? new Set<string>();
      for (const other of paths) {
        if (other !== p) set.add(other);
      }
      pageToRivals.set(p, set);
    }
  }

  const out = new Map<string, string[]>();
  for (const [p, set] of pageToRivals) {
    out.set(p, [...set].sort());
  }
  return out;
}

function topQueriesForPath(
  pairs: GscQueryPageRow[],
  pathname: string,
  limit = 5
): string[] {
  return pairs
    .filter((r) => toPathname(r.page) === pathname)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit)
    .map((r) => r.query);
}

function organicSessionsForPath(
  channels: Ga4LandingChannelRow[],
  pathname: string
): number {
  return channels
    .filter((r) => toPathname(r.pagePath) === pathname)
    .filter((r) => /organic/i.test(r.channelGroup))
    .reduce((sum, r) => sum + r.sessions, 0);
}

async function main() {
  loadEnvLocal();
  const { days, out } = parseArgs();
  const paths = inventoryPublicPaths();

  console.log(
    `SEO portfolio audit — ${paths.length} public routes, last ${days} days\n`
  );
  console.log(
    "NOTE: Net-new SEO URL batches are frozen until this cohort finishes 30/60/90-day review.\n"
  );

  const auth = await getGoogleMarketingAuthClient();

  let gscPages: GscPageRow[] = [];
  let gscPairs: GscQueryPageRow[] = [];
  let ga4Pages: Ga4PageRow[] = [];
  let ga4Channels: Ga4LandingChannelRow[] = [];
  let ga4Conversions: Ga4LandingConversionRow[] = [];

  try {
    gscPages = await fetchGscPages(auth, { days, limit: 25_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("insufficient authentication scopes")) {
      throw new Error(
        `${msg}\nReconnect Google in Kreatli CRM → Connect Google Ads (grants Search Console + Analytics read access).`
      );
    }
    throw err;
  }

  try {
    gscPairs = await fetchGscQueryPagePairs(auth, { days, limit: 25_000 });
  } catch (err) {
    console.warn(
      `GSC query×page skipped: ${err instanceof Error ? err.message : err}`
    );
  }

  try {
    ga4Pages = await fetchGa4TopPages(auth, { days, limit: 10_000 });
  } catch (err) {
    console.warn(`GA4 pages skipped: ${err instanceof Error ? err.message : err}`);
  }

  try {
    ga4Channels = await fetchGa4LandingByChannel(auth, {
      days,
      limit: 10_000,
    });
  } catch (err) {
    console.warn(
      `GA4 channels skipped: ${err instanceof Error ? err.message : err}`
    );
  }

  try {
    ga4Conversions = await fetchGa4LandingConversions(auth, {
      days,
      limit: 10_000,
    });
  } catch (err) {
    console.warn(
      `GA4 conversions skipped: ${err instanceof Error ? err.message : err}`
    );
  }

  const gscByPath = new Map<string, GscPageRow>();
  for (const row of gscPages) {
    gscByPath.set(toPathname(row.page), row);
  }

  const ga4ByPath = new Map<string, Ga4PageRow>();
  for (const row of ga4Pages) {
    const p = toPathname(row.pagePath);
    const prev = ga4ByPath.get(p);
    if (!prev) {
      ga4ByPath.set(p, { ...row, pagePath: p });
    } else {
      ga4ByPath.set(p, {
        pagePath: p,
        sessions: prev.sessions + row.sessions,
        views: prev.views + row.views,
        engagedSessions: prev.engagedSessions + row.engagedSessions,
      });
    }
  }

  const convByPath = new Map<string, number>();
  for (const row of ga4Conversions) {
    const p = toPathname(row.pagePath);
    convByPath.set(p, (convByPath.get(p) ?? 0) + row.keyEvents);
  }

  const cannibal = buildCannibalizationMap(gscPairs);

  const rows: PortfolioRow[] = paths.map((p) => {
    const g = gscByPath.get(p);
    const a = ga4ByPath.get(p);
    const cannibalizedWith = cannibal.get(p) ?? [];
    const cluster = inferCluster(p);
    const impressions = g?.impressions ?? 0;
    const clicks = g?.clicks ?? 0;
    const sessions = a?.sessions ?? 0;
    const keyEvents = convByPath.get(p) ?? 0;
    const { action, reason } = suggestAction({
      impressions,
      clicks,
      sessions,
      keyEvents,
      cannibalizedWith,
      cluster,
    });

    return {
      path: p,
      template: inferPageTemplateFromPath(p),
      cluster,
      gscClicks: clicks,
      gscImpressions: impressions,
      gscCtr: g?.ctr ?? 0,
      gscPosition: g ? g.position : null,
      ga4Sessions: sessions,
      ga4EngagedSessions: a?.engagedSessions ?? 0,
      ga4KeyEvents: keyEvents,
      organicSessions: organicSessionsForPath(ga4Channels, p),
      topQueries: topQueriesForPath(gscPairs, p),
      cannibalizedWith,
      suggestedAction: action,
      reason,
    };
  });

  const byAction = new Map<PortfolioAction, number>();
  for (const row of rows) {
    byAction.set(row.suggestedAction, (byAction.get(row.suggestedAction) ?? 0) + 1);
  }

  const withImpressions = rows.filter((r) => r.gscImpressions > 0).length;
  const zeroSignal = rows.filter(
    (r) => r.gscImpressions === 0 && r.ga4Sessions === 0
  ).length;

  console.log("=== Summary ===\n");
  console.log(`Public routes:           ${rows.length}`);
  console.log(`With GSC impressions:    ${withImpressions}`);
  console.log(`Zero GSC+GA4 signal:     ${zeroSignal}`);
  console.log("Suggested actions:");
  for (const action of [
    "Keep",
    "Enrich",
    "Merge/301",
    "Noindex",
    "Retire",
    "Review",
  ] as PortfolioAction[]) {
    console.log(`  ${action.padEnd(10)} ${byAction.get(action) ?? 0}`);
  }
  console.log("");

  const priorities = [...rows]
    .sort(
      (a, b) =>
        b.gscImpressions + b.ga4Sessions * 5 -
        (a.gscImpressions + a.ga4Sessions * 5)
    )
    .slice(0, 25);

  console.log("=== Top 25 by search/traffic signal ===\n");
  for (const row of priorities) {
    console.log(row.path);
    console.log(
      `  ${row.cluster} | GSC ${row.gscClicks}c/${row.gscImpressions}i` +
        (row.gscPosition != null
          ? ` pos ${row.gscPosition.toFixed(1)}`
          : "") +
        ` | GA4 ${row.ga4Sessions} sess (${row.organicSessions} organic)` +
        ` | keyEvents ${row.ga4KeyEvents}`
    );
    console.log(`  → ${row.suggestedAction}: ${row.reason}`);
    if (row.topQueries.length) {
      console.log(`  queries: ${row.topQueries.join("; ")}`);
    }
    if (row.cannibalizedWith.length) {
      console.log(
        `  cannibal: ${row.cannibalizedWith.slice(0, 5).join(", ")}`
      );
    }
    console.log("");
  }

  const mergeCandidates = rows.filter((r) => r.suggestedAction === "Merge/301");
  if (mergeCandidates.length) {
    console.log("=== Cannibalization candidates (confirm before 301) ===\n");
    for (const row of mergeCandidates.slice(0, 20)) {
      console.log(
        `${row.path} ↔ ${row.cannibalizedWith.slice(0, 4).join(", ")}`
      );
    }
    console.log("");
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    days,
    freezeNote:
      "Do not publish net-new SEO route batches until 30/60/90-day cohort review completes. Confirm Coverage in GSC UI — this report does not replace it.",
    summary: {
      routeCount: rows.length,
      withImpressions,
      zeroSignal,
      byAction: Object.fromEntries(byAction),
    },
    rows,
  };

  const outPath =
    out ??
    path.join(
      process.cwd(),
      "tmp",
      `seo-portfolio-${new Date().toISOString().slice(0, 10)}.json`
    );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
