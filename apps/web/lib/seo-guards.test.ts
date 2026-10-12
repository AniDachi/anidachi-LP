import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getGuideLinks } from "./guide-links";
import { discoverStaticSitemapUrlPaths, isExcludedFromSitemap } from "./sitemap-discovery";

const APP_DIR = path.join(process.cwd(), "app");

function pageFile(urlPath: string): string {
  return path.join(APP_DIR, ...urlPath.split("/").filter(Boolean), "page.tsx");
}

describe("sitemap", () => {
  const paths = discoverStaticSitemapUrlPaths();

  it("leaves out private, dev-only, and redirecting routes", () => {
    for (const urlPath of paths) {
      assert.ok(!isExcludedFromSitemap(urlPath), urlPath);
      assert.ok(!urlPath.startsWith("/dev"), urlPath);
      assert.ok(!urlPath.startsWith("/account"), urlPath);
    }
    assert.ok(!paths.includes("/checkout"));
  });

  it("includes the install page", () => {
    assert.ok(paths.includes("/extension"));
  });

  it("lists only pages that set their own canonical", () => {
    for (const urlPath of paths) {
      if (urlPath === "/") continue;
      const source = fs.readFileSync(pageFile(urlPath), "utf8");
      assert.ok(
        source.includes("canonical") || /get(Guide|Listicle)Metadata\(/.test(source),
        `${urlPath} has no canonical`,
      );
    }
  });
});

describe("titles", () => {
  it("never end with the brand, which the layout template already adds", () => {
    const offenders: string[] = [];
    for (const urlPath of discoverStaticSitemapUrlPaths()) {
      const source = fs.readFileSync(pageFile(urlPath), "utf8");
      const match = source.match(/^export const metadata[\s\S]*?^ {2}title:\s*\n?\s*"([^"]+)"/m);
      if (match && /(\||—|-)\s*AniDachi\s*$/.test(match[1])) offenders.push(`${urlPath}: ${match[1]}`);
    }
    const guides = fs.readFileSync(path.join(process.cwd(), "lib/pseo-new-guides.tsx"), "utf8");
    for (const m of guides.matchAll(/\n\t\ttitle: "([^"]+)"/g)) {
      if (/(\||—)\s*AniDachi$/.test(m[1])) offenders.push(`pseo: ${m[1]}`);
    }
    assert.deepEqual(offenders, []);
  });
});

describe("related guide links", () => {
  it("gives different pages different slices of the same tag", () => {
    const a = getGuideLinks({ includeTags: ["pillar-watch-anime"], excludeHref: "/guides/a", limit: 4 });
    const b = getGuideLinks({ includeTags: ["pillar-watch-anime"], excludeHref: "/guides/b", limit: 4 });
    assert.equal(a.length, 4);
    assert.notDeepEqual(
      a.map((l) => l.href),
      b.map((l) => l.href),
    );
  });
});
