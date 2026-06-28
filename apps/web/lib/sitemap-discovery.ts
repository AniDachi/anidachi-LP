import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { INTERNAL_TOOL_APP_SEGMENTS } from "@/lib/internal-tool-routes";

const APP_DIR = path.join(process.cwd(), "app");

/** Top-level `app/` segments to omit entirely (internal / non-marketing). */
const EXCLUDED_TOP_LEVEL = new Set<string>(INTERNAL_TOOL_APP_SEGMENTS);

/** URL paths that must not appear in the sitemap (e.g. `noindex` pages). */
const EXCLUDED_URL_PATHS = new Set(["/success"]);

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

function stripRouteGroups(segments: string[]): string[] {
  return segments.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
}

function relPathToUrlPath(relFromApp: string): string | null {
  const norm = relFromApp.replace(/\\/g, "/");
  const dir = path.posix.dirname(norm);
  if (dir === ".") return "/";
  const segments = dir.split("/").filter(Boolean);
  const urlSegments = stripRouteGroups(segments);
  if (urlSegments.some(isDynamicSegment)) return null;
  return `/${urlSegments.join("/")}`;
}

function isExcludedTreeRel(relFromApp: string): boolean {
  const first = relFromApp.split(/[/\\]/)[0];
  return first !== undefined && EXCLUDED_TOP_LEVEL.has(first);
}

function walkPageFiles(dir: string, relFromApp = ""): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const childRel = relFromApp ? `${relFromApp}/${ent.name}` : ent.name;
    if (isExcludedTreeRel(childRel)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkPageFiles(full, childRel));
    } else if (
      ent.name === "page.tsx" ||
      ent.name === "page.ts" ||
      ent.name === "page.mdx"
    ) {
      out.push(childRel.split(path.sep).join("/"));
    }
  }
  return out;
}

function inferSitemapMeta(urlPath: string): {
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
} {
  // `priority` / `changeFrequency` are optional hints; Google largely ignores them for ranking.
  if (urlPath === "/") {
    return { changeFrequency: "weekly", priority: 1 };
  }
  if (
    urlPath === "/watch-anime-together" ||
    urlPath === "/watch-crunchyroll-together" ||
    urlPath === "/anime-watch-party-toolkit"
  ) {
    return { changeFrequency: "weekly", priority: 0.9 };
  }
  if (urlPath === "/watch-party-starter") {
    return { changeFrequency: "weekly", priority: 0.88 };
  }
  if (
    urlPath === "/watch-action-anime-with-friends" ||
    urlPath === "/watch-romance-anime-with-friends" ||
    urlPath === "/watch-comedy-anime-with-friends" ||
    urlPath === "/watch-sports-anime-with-friends" ||
    urlPath === "/watch-mystery-anime-with-friends" ||
    urlPath === "/watch-isekai-anime-with-friends" ||
    urlPath === "/watch-psychological-anime-with-friends" ||
    urlPath === "/watch-horror-anime-with-friends" ||
    urlPath === "/watch-slice-of-life-anime-with-friends" ||
    urlPath === "/watch-mecha-anime-with-friends" ||
    urlPath === "/watch-fantasy-anime-with-friends" ||
    urlPath === "/watch-sci-fi-anime-with-friends" ||
    urlPath === "/watch-shoujo-anime-with-friends" ||
    urlPath === "/watch-supernatural-anime-with-friends" ||
    urlPath === "/watch-crunchyroll-together-long-distance" ||
    urlPath === "/best-apps-watch-anime-together-long-distance" ||
    urlPath === "/watch-anime-long-distance-boyfriend-girlfriend" ||
    urlPath === "/timezone-friendly-anime-watch-parties"
  ) {
    return { changeFrequency: "monthly", priority: 0.85 };
  }
  if (
    urlPath === "/long-distance-anime-date-night-ideas" ||
    urlPath === "/watch-kdrama-together-long-distance" ||
    urlPath === "/watch-youtube-together-long-distance" ||
    urlPath === "/watch-movies-together-long-distance" ||
    urlPath === "/best-anime-for-long-distance-relationships" ||
    urlPath === "/watch-netflix-together-long-distance"
  ) {
    return { changeFrequency: "monthly", priority: 0.75 };
  }
  if (urlPath.startsWith("/compare/")) {
    return { changeFrequency: "monthly", priority: 0.7 };
  }
  if (urlPath.startsWith("/guides/")) {
    if (
      urlPath.includes("best-anime-to-watch") ||
      urlPath.includes("best-isekai-anime-to-watch") ||
      urlPath.includes("first-anime-watch-party-checklist")
    ) {
      return { changeFrequency: "monthly", priority: 0.71 };
    }
    return { changeFrequency: "monthly", priority: 0.8 };
  }
  if (urlPath.startsWith("/glossary/")) {
    if (urlPath === "/glossary/crunchyroll-mega-fan") {
      return { changeFrequency: "monthly", priority: 0.52 };
    }
    return { changeFrequency: "monthly", priority: 0.5 };
  }
  if (urlPath.startsWith("/resources/")) {
    return { changeFrequency: "monthly", priority: 0.72 };
  }
  if (urlPath === "/privacy" || urlPath === "/terms") {
    return { changeFrequency: "yearly", priority: 0.3 };
  }
  return { changeFrequency: "monthly", priority: 0.5 };
}

/**
 * Discover static marketing routes by scanning `app` for `page.tsx`, `page.ts`, or `page.mdx`.
 * Skips folders with dynamic route segments; programmatic watch URLs come from data.
 */
export function discoverStaticSitemapUrlPaths(): string[] {
  const rels = walkPageFiles(APP_DIR);
  const urls = new Set<string>();
  for (const rel of rels) {
    const urlPath = relPathToUrlPath(rel);
    if (urlPath == null) continue;
    if (EXCLUDED_URL_PATHS.has(urlPath)) continue;
    urls.add(urlPath);
  }
  return [...urls].sort((a, b) => a.localeCompare(b));
}

function resolvePageModuleAbsPath(urlPath: string): string | null {
  const baseDir =
    urlPath === "/"
      ? APP_DIR
      : path.join(APP_DIR, ...urlPath.slice(1).split("/").filter(Boolean));
  for (const name of ["page.tsx", "page.ts", "page.mdx"]) {
    const abs = path.join(baseDir, name);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

export function staticPathsToSitemapEntries(
  siteUrl: string,
  urlPaths: string[]
): MetadataRoute.Sitemap {
  return urlPaths.map((urlPath) => {
    const absPage = resolvePageModuleAbsPath(urlPath);
    const meta = inferSitemapMeta(urlPath);
    let lastModified: Date | undefined;
    if (absPage) {
      try {
        lastModified = fs.statSync(absPage).mtime;
      } catch {
        lastModified = undefined;
      }
    }
    const entry: MetadataRoute.Sitemap[number] = {
      url: `${siteUrl}${urlPath}`,
      changeFrequency: meta.changeFrequency,
      priority: meta.priority,
    };
    if (lastModified) entry.lastModified = lastModified;
    return entry;
  });
}
