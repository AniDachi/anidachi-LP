/**
 * On-page SEO check (ANI-81). Read-only: fetches pages and reports; changes nothing.
 * Rules: Linear document "On-page SEO rules". Targets: lib/seo-onpage/targets.ts.
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:onpage                                   # production, all target pages
 *   pnpm --filter @anidachi/web seo:onpage --base http://localhost:3003      # local dev server
 *   pnpm --filter @anidachi/web seo:onpage --pages /netflix-watch-party,/watch-youtube-together
 *   pnpm --filter @anidachi/web seo:onpage --gsc gsc.json                    # adds cannibalization + enrichment ideas
 *   pnpm --filter @anidachi/web seo:onpage --keyword-map ~/.claude/scheduled-tasks/anidachi-shared/keyword_map.json
 *   pnpm --filter @anidachi/web seo:onpage --no-links                        # skip the sitemap crawl for inbound links
 *   pnpm --filter @anidachi/web seo:onpage --json report.json --update-baseline
 *
 * --gsc takes a JSON array of { query, page, impressions, clicks, position } rows
 * (Search Console, dimensions query × page). Exit code 1 when a must-fix finding is
 * neither in the baseline (scripts/seo/onpage-baseline.json) nor an approved exception.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPage, type ExtractedPage } from "../../lib/seo-onpage/html";
import {
  auditDuplicates,
  auditGsc,
  auditLinks,
  auditPage,
  syncWithKeywordMap,
  type Finding,
  type GscRow,
  type InboundLink,
} from "../../lib/seo-onpage/checks";
import { PAGE_TARGETS } from "../../lib/seo-onpage/targets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE = path.join(__dirname, "onpage-baseline.json");

type Options = {
  base: string;
  pages: string[] | null;
  json: string | null;
  baseline: string;
  updateBaseline: boolean;
  gsc: string | null;
  keywordMap: string | null;
  links: boolean;
};

function parseArgs(argv: string[]): Options {
  const opt: Options = { base: "https://www.anidachi.app", pages: null, json: null, baseline: DEFAULT_BASELINE, updateBaseline: false, gsc: null, keywordMap: null, links: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    if (a === "--base") opt.base = next().replace(/\/$/, "");
    else if (a === "--pages") opt.pages = next().split(",").map((p) => p.trim()).filter(Boolean);
    else if (a === "--json") opt.json = next();
    else if (a === "--baseline") opt.baseline = next();
    else if (a === "--update-baseline") opt.updateBaseline = true;
    else if (a === "--gsc") opt.gsc = next();
    else if (a === "--keyword-map") opt.keywordMap = next().replace(/^~(?=\/)/, os.homedir());
    else if (a === "--no-links") opt.links = false;
    else if (a !== "--") throw new Error(`Unknown option ${a}`);
  }
  return opt;
}

async function fetchPage(base: string, p: string): Promise<{ status: number; finalPath: string; html: string }> {
  const res = await fetch(base + p, { headers: { "User-Agent": "AniDachi-onpage-audit/1.0" }, redirect: "follow" });
  const html = await res.text();
  return { status: res.status, finalPath: new URL(res.url).pathname.replace(/\/$/, "") || "/", html };
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Crawl every sitemap URL and collect body links (main content, navigation excluded). */
async function crawlInbound(base: string): Promise<{ inbound: Map<string, InboundLink[]>; outbound: Map<string, Set<string>> }> {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, "") || "/");
  const inbound = new Map<string, InboundLink[]>();
  const outbound = new Map<string, Set<string>>();
  await pool(paths, 8, async (from) => {
    try {
      const { html, status } = await fetchPage(base, from);
      if (status !== 200) return;
      const page = extractPage(html);
      const outs = new Set<string>();
      for (const link of page.links) {
        let to: string;
        try {
          const u = new URL(link.href, base + from);
          if (u.origin !== new URL(base).origin && !/(^|\.)anidachi\.app$/.test(u.hostname)) continue;
          to = u.pathname.replace(/\/$/, "") || "/";
        } catch {
          continue;
        }
        outs.add(to);
        const list = inbound.get(to) ?? [];
        list.push({ from, text: link.text });
        inbound.set(to, list);
      }
      outbound.set(from, outs);
    } catch {
      // A page that fails to load is reported by its own audit, not here.
    }
  });
  return { inbound, outbound };
}

const ICON = { must: "✗", warn: "!", info: "·" } as const;

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const allowNoindex = !/^https:\/\/www\.anidachi\.app$/.test(opt.base);
  const targets = PAGE_TARGETS.filter((t) => !opt.pages || opt.pages.includes(t.path));
  if (targets.length === 0) throw new Error("No matching pages in lib/seo-onpage/targets.ts.");

  const baselineKeys = new Set<string>(
    fs.existsSync(opt.baseline) ? (JSON.parse(fs.readFileSync(opt.baseline, "utf8")).keys as string[]) : [],
  );
  const gscRows: GscRow[] = opt.gsc ? JSON.parse(fs.readFileSync(opt.gsc, "utf8")) : [];

  console.log(`On-page SEO check: ${targets.length} page(s) on ${opt.base}${allowNoindex ? " (noindex allowed: not production)" : ""}`);
  const crawl = opt.links ? await crawlInbound(opt.base) : null;

  const pages: { path: string; page: ExtractedPage }[] = [];
  const findings: Finding[] = [];
  for (const t of targets) {
    const fetched = await fetchPage(opt.base, t.path);
    const page = extractPage(fetched.html);
    pages.push({ path: t.path, page });
    findings.push(...auditPage(page, t, { status: fetched.status, finalPath: fetched.finalPath, allowNoindex }, opt.base));
    if (crawl) findings.push(...auditLinks(t, crawl.inbound.get(t.path) ?? [], crawl.outbound.get(t.path) ?? new Set()));
    if (gscRows.length) findings.push(...auditGsc(t, page, gscRows, opt.base));
  }
  const hubs = targets.filter((t) => t.kind === "hub").map((t) => ({ path: t.path, text: pages.find((p) => p.path === t.path)?.page.mainText ?? "" }));
  findings.push(...auditDuplicates(hubs));

  let failing = 0;
  for (const t of targets) {
    const mine = findings.filter((f) => f.path === t.path);
    const count = (s: string) => mine.filter((f) => f.severity === s && !f.excepted).length;
    console.log(`\n━━ ${t.path}  (${t.ticket})  must-fix ${count("must")} · warnings ${count("warn")} · info ${count("info")}`);
    for (const sev of ["must", "warn", "info"] as const) {
      for (const f of mine.filter((x) => x.severity === sev)) {
        const state = f.excepted ? "approved exception" : baselineKeys.has(f.key) ? "known" : "NEW";
        if (sev === "must" && !f.excepted && !baselineKeys.has(f.key)) failing += 1;
        console.log(`  ${ICON[sev]} [${f.group}/${f.rule}] ${f.message}${sev === "info" ? "" : `  (${state})`}`);
        console.log(`      → ${f.excepted ? `Exception: ${f.excepted}` : f.fix}`);
      }
    }
  }

  if (opt.keywordMap) {
    const notes = syncWithKeywordMap(targets, JSON.parse(fs.readFileSync(opt.keywordMap, "utf8")));
    console.log(`\nSync with the locked ANI-68 map: ${notes.length ? "" : "no differences."}`);
    for (const n of notes) console.log(`  · ${n}`);
  }

  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ base: opt.base, generatedAt: new Date().toISOString(), findings }, null, 2));
  if (opt.updateBaseline) {
    const keys = findings.filter((f) => f.severity !== "info" && !f.excepted).map((f) => f.key).sort();
    fs.writeFileSync(opt.baseline, `${JSON.stringify({ note: "Known on-page findings (ANI-81). Only findings not listed here fail the gate.", generatedAt: new Date().toISOString(), base: opt.base, keys }, null, 2)}\n`);
    console.log(`\nBaseline written: ${keys.length} known finding(s), including ${failing} must-fix that were new → ${path.relative(process.cwd(), opt.baseline)}`);
    return;
  }
  console.log(`\n${failing === 0 ? "PASS" : "FAIL"}: ${failing} new must-fix finding(s).`);
  if (failing > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
