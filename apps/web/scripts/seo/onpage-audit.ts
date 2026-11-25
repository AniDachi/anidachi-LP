/**
 * On-page SEO check (ANI-81). Read-only: fetches pages and reports; changes nothing in the repo.
 * Rules: Linear document "On-page SEO rules". Targets and exceptions: lib/seo-onpage/targets.ts.
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:onpage                                   # production, all target pages
 *   pnpm --filter @anidachi/web seo:onpage --base http://localhost:3003      # local dev server
 *   pnpm --filter @anidachi/web seo:onpage --pages /netflix-watch-party,/watch-youtube-together
 *   pnpm --filter @anidachi/web seo:onpage --gsc gsc.json                    # adds cannibalization + enrichment ideas
 *   pnpm --filter @anidachi/web seo:onpage --keyword-map ~/.claude/scheduled-tasks/anidachi-shared/keyword_map.json
 *   pnpm --filter @anidachi/web seo:onpage --no-links                        # skip the sitemap crawl for inbound links
 *   pnpm --filter @anidachi/web seo:onpage --json report.json
 *
 * --gsc takes a JSON array of { query, page, impressions, clicks, position } rows
 * (Search Console, dimensions query × page).
 *
 * Exit code 1 when a must-fix finding has no exception in targets.ts. A known must-fix we chose
 * to fix later is recorded there as an exception with `deferredTo`, next to the page's targets,
 * so fixing a page never needs a separate PR to update a list.
 *
 * Each run is compared with the last run for the same site, kept outside the repo in
 * ~/.cache/anidachi-seo-onpage/<host>.json (--state-dir to move it, --no-save to leave it alone),
 * to mark findings that are new since then.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractPage, isPasswordGate, type ExtractedPage } from "../../lib/seo-onpage/html";
import {
  auditDuplicates,
  auditGsc,
  auditLinks,
  auditPage,
  staleExceptions,
  syncWithKeywordMap,
  type Finding,
  type GscRow,
  type InboundLink,
} from "../../lib/seo-onpage/checks";
import { PAGE_TARGETS } from "../../lib/seo-onpage/targets";

type Options = {
  base: string;
  pages: string[] | null;
  json: string | null;
  stateDir: string;
  save: boolean;
  gsc: string | null;
  keywordMap: string | null;
  links: boolean;
};

const home = (p: string) => p.replace(/^~(?=\/)/, os.homedir());

function parseArgs(argv: string[]): Options {
  const opt: Options = {
    base: "https://www.anidachi.app",
    pages: null,
    json: null,
    stateDir: path.join(os.homedir(), ".cache", "anidachi-seo-onpage"),
    save: true,
    gsc: null,
    keywordMap: null,
    links: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    if (a === "--base") opt.base = next().replace(/\/$/, "");
    else if (a === "--pages") opt.pages = next().split(",").map((p) => p.trim()).filter(Boolean);
    else if (a === "--json") opt.json = next();
    else if (a === "--state-dir") opt.stateDir = home(next());
    else if (a === "--no-save") opt.save = false;
    else if (a === "--gsc") opt.gsc = next();
    else if (a === "--keyword-map") opt.keywordMap = home(next());
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

class PasswordGateError extends Error {}

function assertNotGated(base: string, p: string, html: string) {
  if (!isPasswordGate(html)) return;
  throw new PasswordGateError(
    `${base}${p} shows a password page, not the site, so there is nothing to check.\n` +
      "Run against production, a local server (--base http://localhost:3003) or the PR's Vercel preview instead.",
  );
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

/**
 * Where a finding comes from. Runs are compared per source, and only for sources both runs used,
 * so a run without --gsc or with --no-links doesn't report those findings as gone (or new).
 */
type Source = "page" | "links" | "gsc";
const sourceOf = (f: Finding): Source => (f.group === "links" ? "links" : f.group === "data" ? "gsc" : "page");

type LastRun = { base: string; generatedAt: string; pages: Record<string, { at: string; sources: Partial<Record<Source, string[]>> }> };

function stateFile(opt: Options): string {
  return path.join(opt.stateDir, `${new URL(opt.base).host.replace(/[^a-z0-9.-]/gi, "_")}.json`);
}

function readLastRun(file: string): LastRun | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LastRun;
  } catch {
    return null;
  }
}

const ICON = { must: "✗", warn: "!", info: "·" } as const;

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const allowNoindex = !/^https:\/\/www\.anidachi\.app$/.test(opt.base);
  const targets = PAGE_TARGETS.filter((t) => !opt.pages || opt.pages.includes(t.path));
  if (targets.length === 0) throw new Error("No matching pages in lib/seo-onpage/targets.ts.");

  const gscRows: GscRow[] = opt.gsc ? JSON.parse(fs.readFileSync(opt.gsc, "utf8")) : [];
  const file = stateFile(opt);
  const last = readLastRun(file);

  console.log(`On-page SEO check: ${targets.length} page(s) on ${opt.base}${allowNoindex ? " (noindex allowed: not production)" : ""}`);
  console.log(last ? `Compared with the last run on ${last.generatedAt.slice(0, 16).replace("T", " ")} UTC.` : "First run for this site: nothing to compare with.");

  // Stop before the sitemap crawl if the site sits behind a password page (staging).
  const first = await fetchPage(opt.base, targets[0].path);
  assertNotGated(opt.base, targets[0].path, first.html);

  const crawl = opt.links ? await crawlInbound(opt.base) : null;

  const pages: { path: string; page: ExtractedPage }[] = [];
  const findings: Finding[] = [];
  for (const t of targets) {
    const fetched = t === targets[0] ? first : await fetchPage(opt.base, t.path);
    assertNotGated(opt.base, t.path, fetched.html);
    const page = extractPage(fetched.html);
    pages.push({ path: t.path, page });
    findings.push(...auditPage(page, t, { status: fetched.status, finalPath: fetched.finalPath, allowNoindex }, opt.base));
    if (crawl) findings.push(...auditLinks(t, crawl.inbound.get(t.path) ?? [], crawl.outbound.get(t.path) ?? new Set()));
    if (gscRows.length) findings.push(...auditGsc(t, page, gscRows, opt.base));
  }
  const hubs = targets.filter((t) => t.kind === "hub").map((t) => ({ path: t.path, text: pages.find((p) => p.path === t.path)?.page.mainText ?? "" }));
  findings.push(...auditDuplicates(hubs));

  let failing = 0;
  let newSinceLast = 0;
  for (const t of targets) {
    const mine = findings.filter((f) => f.path === t.path);
    const before = last?.pages[t.path]?.sources;
    const ran: Source[] = ["page", ...(crawl ? (["links"] as const) : []), ...(gscRows.length ? (["gsc"] as const) : [])];
    const compared = ran.filter((src) => before?.[src]);
    const seen = before ? new Set(compared.flatMap((src) => before[src] ?? [])) : null;
    const count = (s: string) => mine.filter((f) => f.severity === s && !f.excepted).length;
    console.log(`\n━━ ${t.path}  (${t.ticket})  must-fix ${count("must")} · warnings ${count("warn")} · info ${count("info")}`);
    for (const sev of ["must", "warn", "info"] as const) {
      for (const f of mine.filter((x) => x.severity === sev)) {
        if (sev === "must" && !f.excepted) failing += 1;
        const isNew = seen !== null && compared.includes(sourceOf(f)) && !seen.has(f.key);
        if (isNew) newSinceLast += 1;
        const state = f.excepted ? "exception" : isNew ? "NEW since last run" : seen && compared.includes(sourceOf(f)) ? "seen last run" : "";
        console.log(`  ${ICON[sev]} [${f.group}/${f.rule}] ${f.message}${state ? `  (${state})` : ""}`);
        console.log(`      → ${f.excepted ?? f.fix}`);
      }
    }
    if (seen) {
      const fixed = [...seen].filter((k) => !mine.some((f) => f.key === k));
      for (const k of fixed) console.log(`  ✓ gone since last run: ${k.split("|").slice(1).join(" · ")}`);
    }
  }

  const stale = staleExceptions(targets, findings);
  if (stale.length) {
    console.log("\nExceptions no longer needed:");
    for (const n of stale) console.log(`  · ${n}`);
  }

  if (opt.keywordMap) {
    const notes = syncWithKeywordMap(targets, JSON.parse(fs.readFileSync(opt.keywordMap, "utf8")));
    console.log(`\nSync with the locked ANI-68 map: ${notes.length ? "" : "no differences."}`);
    for (const n of notes) console.log(`  · ${n}`);
  }

  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ base: opt.base, generatedAt: new Date().toISOString(), findings }, null, 2));

  if (opt.save) {
    const now = new Date().toISOString();
    const next: LastRun = { base: opt.base, generatedAt: now, pages: { ...(last?.pages ?? {}) } };
    const ran: Source[] = ["page", ...(crawl ? (["links"] as const) : []), ...(gscRows.length ? (["gsc"] as const) : [])];
    for (const t of targets) {
      const sources = { ...(last?.pages[t.path]?.sources ?? {}) };
      for (const src of ran) sources[src] = findings.filter((f) => f.path === t.path && sourceOf(f) === src).map((f) => f.key).sort();
      next.pages[t.path] = { at: now, sources };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  }

  console.log(`\n${failing === 0 ? "PASS" : "FAIL"}: ${failing} must-fix finding(s) without an exception${last ? `; ${newSinceLast} finding(s) new since the last run` : ""}.`);
  if (failing > 0) process.exitCode = 1;
}

main().catch((error) => {
  if (error instanceof PasswordGateError) console.error(`\nSTOPPED: ${error.message}`);
  else console.error(error);
  process.exitCode = 1;
});
