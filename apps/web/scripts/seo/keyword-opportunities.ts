/**
 * Pull top GSC + GA4 pages, then find related Keyword Planner opportunities.
 *
 * Prereqs: Google Ads env vars + reconnect OAuth in CRM (adds Search Console + Analytics scopes).
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:keywords
 *   pnpm --filter @anidachi/web seo:keywords -- --days 28 --limit 15
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeywordIdeas, type KeywordIdeaResult } from "../../lib/google-ads/client";
import { getGoogleMarketingAuthClient } from "../../lib/google-marketing/auth";
import { fetchGa4TopPages, type Ga4PageRow } from "../../lib/google-marketing/ga4";
import { fetchGscTopPages, type GscPageRow } from "../../lib/google-marketing/gsc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CombinedPage = {
  path: string;
  gsc?: GscPageRow;
  ga4?: Ga4PageRow;
  score: number;
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
  let limit = 20;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) days = Number(args[++i]);
    if (args[i] === "--limit" && args[i + 1]) limit = Number(args[++i]);
  }
  return { days, limit };
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

function pathToSeedKeywords(pathname: string): string[] {
  const seeds = new Set<string>();
  const parts = pathname.split("/").filter(Boolean);

  if (pathname === "/" || pathname === "") {
    seeds.add("watch anime with friends");
    seeds.add("anime watch party");
    return [...seeds];
  }

  if (parts[0] === "watch" && parts[1]) {
    const slug = parts[1].replace(/-with-friends$/, "").replace(/-/g, " ");
    seeds.add(`watch ${slug} with friends`);
    seeds.add(`${slug} watch party`);
  } else if (parts[0] === "guides" && parts[1]) {
    seeds.add(parts.slice(1).join(" ").replace(/-/g, " "));
  } else if (parts[0] === "glossary" && parts[1]) {
    seeds.add(parts[1].replace(/-/g, " "));
  } else if (parts.length > 0) {
    seeds.add(parts.join(" ").replace(/-/g, " "));
  }

  if (pathname.includes("crunchyroll")) seeds.add("crunchyroll watch party");
  if (pathname.includes("watch-party")) seeds.add("anime watch party");
  if (pathname.includes("watch-anime-together")) {
    seeds.add("watch anime together");
    seeds.add("watch anime with friends online");
  }

  return [...seeds].filter(Boolean).slice(0, 3);
}

function mergeTopPages(
  gsc: GscPageRow[],
  ga4: Ga4PageRow[],
  limit: number
): CombinedPage[] {
  const byPath = new Map<string, CombinedPage>();

  for (const row of gsc) {
    const p = toPathname(row.page);
    const cur = byPath.get(p) ?? { path: p, score: 0 };
    cur.gsc = row;
    cur.score += row.clicks * 3 + row.impressions * 0.05;
    byPath.set(p, cur);
  }

  for (const row of ga4) {
    const p = toPathname(row.pagePath);
    const cur = byPath.get(p) ?? { path: p, score: 0 };
    cur.ga4 = row;
    cur.score += row.sessions * 2 + row.views * 0.5 + row.engagedSessions;
    byPath.set(p, cur);
  }

  return [...byPath.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function isLikelyUntapped(
  idea: KeywordIdeaResult,
  existingPaths: Set<string>
): boolean {
  const text = idea.text.toLowerCase();
  const searches = idea.avgMonthlySearches ?? 0;
  if (searches < 10) return false;

  const normalized = `/${text.replace(/\s+/g, "-")}`;
  if ([...existingPaths].some((p) => p.includes(normalized.slice(0, 20)))) {
    return false;
  }

  const noisy =
    /netflix|hulu|disney|sausage party|corpse party|dub only|where to watch single/i.test(
      text
    );
  if (noisy) return false;

  const relevant =
    /anime|watch|party|crunchyroll|funimation|together|friends|sync|watchroom|extension/i.test(
      text
    );
  return relevant;
}

async function main() {
  loadEnvLocal();
  const { days, limit } = parseArgs();

  const auth = await getGoogleMarketingAuthClient();

  console.log(`Fetching last ${days} days — top ${limit} pages...\n`);

  let gsc: GscPageRow[] = [];
  let ga4: Ga4PageRow[] = [];

  try {
    gsc = await fetchGscTopPages(auth, { days, limit });
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
    ga4 = await fetchGa4TopPages(auth, { days, limit });
  } catch (err) {
    console.warn(
      `GA4 fetch skipped: ${err instanceof Error ? err.message : err}`
    );
  }

  const topPages = mergeTopPages(gsc, ga4, limit);
  if (topPages.length === 0) {
    console.log("No page data returned.");
    return;
  }

  console.log("=== Top pages (GSC + GA4) ===\n");
  for (const row of topPages) {
    const g = row.gsc;
    const a = row.ga4;
    console.log(row.path);
    if (g) {
      console.log(
        `  GSC: ${g.clicks} clicks, ${g.impressions} impr, pos ${g.position.toFixed(1)}`
      );
    }
    if (a) {
      console.log(
        `  GA4: ${a.sessions} sessions, ${a.views} views, ${a.engagedSessions} engaged`
      );
    }
    console.log("");
  }

  const seedSet = new Set<string>();
  for (const page of topPages.slice(0, 10)) {
    for (const seed of pathToSeedKeywords(page.path)) {
      seedSet.add(seed);
    }
  }

  const seeds = [...seedSet].slice(0, 12);
  console.log(`=== Keyword Planner seeds (${seeds.length}) ===\n`);
  console.log(seeds.map((s) => `- ${s}`).join("\n"));
  console.log("");

  const allIdeas: KeywordIdeaResult[] = [];
  const existingPaths = new Set(topPages.map((p) => p.path));

  for (const seed of seeds) {
    const ideas = await generateKeywordIdeas({ keywords: [seed] });
    allIdeas.push(...ideas);
  }

  const deduped = new Map<string, KeywordIdeaResult>();
  for (const idea of allIdeas) {
    const key = idea.text.toLowerCase();
    const prev = deduped.get(key);
    if (
      !prev ||
      (idea.avgMonthlySearches ?? 0) > (prev.avgMonthlySearches ?? 0)
    ) {
      deduped.set(key, idea);
    }
  }

  const opportunities = [...deduped.values()]
    .filter((idea) => isLikelyUntapped(idea, existingPaths))
    .sort((a, b) => (b.avgMonthlySearches ?? 0) - (a.avgMonthlySearches ?? 0))
    .slice(0, 30);

  console.log("=== Untapped keyword opportunities ===\n");
  if (opportunities.length === 0) {
    console.log("No strong opportunities found — try reconnecting OAuth or widening seeds.");
    return;
  }

  for (const row of opportunities) {
    const searches =
      row.avgMonthlySearches != null
        ? row.avgMonthlySearches.toLocaleString()
        : "n/a";
    console.log(
      `- ${row.text} | ${searches}/mo | competition: ${row.competition ?? "n/a"}`
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
