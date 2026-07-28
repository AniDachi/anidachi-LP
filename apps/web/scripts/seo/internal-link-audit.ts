/**
 * Read-only internal-link audit for marketing routes.
 * Does NOT modify pages, footer, nav, or sitemap.
 *
 * Reports:
 * - broken internal href targets (path not in public inventory)
 * - public URLs with fewer than 2 contextual inbound links from other pages
 * - paths more than 3 clicks from home via discovered edges (BFS)
 *
 * Usage:
 *   pnpm --filter @anidachi/web seo:links
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { animeList } from "../../lib/anime-data";
import { discoverStaticSitemapUrlPaths } from "../../lib/sitemap-discovery";
import { guideLinks } from "../../lib/guide-links";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, "../../app");
const COMPONENTS_DIR = path.join(__dirname, "../../components");

function inventoryPublicPaths(): Set<string> {
  const staticPaths = discoverStaticSitemapUrlPaths();
  const animePaths = animeList.map((a) => `/watch/${a.slug}-with-friends`);
  return new Set([...staticPaths, ...animePaths]);
}

function walkFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "api" || ent.name === "blou" || ent.name === "kreatli-email-crm") {
        continue;
      }
      walkFiles(full, out);
    } else if (/\.(tsx|ts|mdx)$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractInternalHrefs(source: string): string[] {
  const hrefs: string[] = [];
  const re =
    /(?:href|url)\s*[:=]\s*(?:\{)?["'`](\/(?!\/)[^"'`?#]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const raw = m[1].replace(/\/$/, "") || "/";
    if (raw.startsWith("/api/")) continue;
    hrefs.push(raw);
  }
  return hrefs;
}

function fileToUrlPath(absFile: string): string | null {
  const rel = path.relative(APP_DIR, absFile).replace(/\\/g, "/");
  if (rel.startsWith("..")) return null;
  if (!/page\.(tsx|ts|mdx)$/.test(rel)) return null;
  const dir = path.posix.dirname(rel);
  if (dir === ".") return "/";
  if (dir.includes("[")) return null;
  return `/${dir}`;
}

function bfsDepth(
  edges: Map<string, Set<string>>,
  start: string
): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    const d = dist.get(cur) ?? 0;
    for (const next of edges.get(cur) ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, d + 1);
      q.push(next);
    }
  }
  return dist;
}

function main() {
  const publicPaths = inventoryPublicPaths();
  const files = [...walkFiles(APP_DIR), ...walkFiles(COMPONENTS_DIR)];

  const outbound = new Map<string, Set<string>>();
  const inbound = new Map<string, Set<string>>();
  const broken: Array<{ from: string; to: string; file: string }> = [];

  for (const p of publicPaths) {
    outbound.set(p, new Set());
    inbound.set(p, new Set());
  }

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const fromPath = fileToUrlPath(file) ?? "(component)";
    const hrefs = extractInternalHrefs(source);
    for (const href of hrefs) {
      if (!publicPaths.has(href) && !href.startsWith("/#")) {
        // Allow hash-only home anchors and known non-sitemap product paths softly
        if (
          href === "/login" ||
          href.startsWith("/account") ||
          href.startsWith("/room/") ||
          href.startsWith("/join")
        ) {
          continue;
        }
        if (!href.includes("[") && !href.includes("${")) {
          broken.push({
            from: fromPath,
            to: href,
            file: path.relative(path.join(__dirname, "../.."), file),
          });
        }
        continue;
      }
      if (!publicPaths.has(href)) continue;
      if (fromPath !== "(component)" && publicPaths.has(fromPath)) {
        outbound.get(fromPath)?.add(href);
        inbound.get(href)?.add(fromPath);
      } else if (fromPath === "(component)") {
        // Footer/nav/shared components: credit as inbound from "chrome"
        inbound.get(href)?.add("(site-chrome)");
      }
    }
  }

  // Registry soft edges (related lists may render these)
  for (const item of guideLinks) {
    if (!publicPaths.has(item.href)) continue;
    inbound.get(item.href)?.add("(guide-links-registry)");
  }

  const thinInbound: string[] = [];
  for (const p of [...publicPaths].sort()) {
    const count = inbound.get(p)?.size ?? 0;
    // site-chrome alone counts as 1; require another contextual source for "2"
    const sources = [...(inbound.get(p) ?? [])];
    const contextual = sources.filter((s) => s !== "(guide-links-registry)");
    if (contextual.length < 2 && p !== "/") {
      thinInbound.push(
        `${p}  (inbound: ${sources.join(", ") || "none"})`
      );
    }
  }

  const depths = bfsDepth(outbound, "/");
  const deep: string[] = [];
  for (const p of [...publicPaths].sort()) {
    const d = depths.get(p);
    if (d == null) {
      // unreachable via page→page edges from home (may still be in footer)
      if (!(inbound.get(p)?.has("(site-chrome)"))) {
        deep.push(`${p}  (no BFS path from / via page edges)`);
      }
    } else if (d > 3) {
      deep.push(`${p}  (depth ${d})`);
    }
  }

  console.log("=== Internal link audit (read-only) ===\n");
  console.log(`Public routes: ${publicPaths.size}`);
  console.log(`Broken internal targets: ${broken.length}`);
  console.log(`Thin contextual inbound (<2): ${thinInbound.length}`);
  console.log(`Deep / unreachable via page edges: ${deep.length}`);
  console.log("");

  if (broken.length) {
    console.log("=== Possibly broken hrefs (review before changing) ===\n");
    for (const row of broken.slice(0, 40)) {
      console.log(`${row.to}  ← ${row.from} (${row.file})`);
    }
    if (broken.length > 40) console.log(`… +${broken.length - 40} more`);
    console.log("");
  }

  if (thinInbound.length) {
    console.log("=== Thin inbound (informational — do not prune) ===\n");
    for (const line of thinInbound.slice(0, 40)) console.log(line);
    if (thinInbound.length > 40) {
      console.log(`… +${thinInbound.length - 40} more`);
    }
    console.log("");
  }

  if (deep.length) {
    console.log("=== Depth / reachability notes ===\n");
    for (const line of deep.slice(0, 40)) console.log(line);
    if (deep.length > 40) console.log(`… +${deep.length - 40} more`);
    console.log("");
  }

  console.log(
    "No files were modified. Use this report to plan additive links only."
  );
}

main();
