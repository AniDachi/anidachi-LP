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

/** First metadata title in a page file: a template string, or `{ absolute: … }` that skips the suffix. */
export function readMetadataTitle(source: string): { title: string; absolute: boolean } | null {
  const match = source.match(
    /^(?:export )?const metadata[\s\S]*?^[ \t]+title:\s*(?:\{\s*absolute:\s*)?("(?:[^"\\]|\\.)*"|`[^`]*`)/m,
  );
  if (!match) return null;
  return { title: match[1].slice(1, -1), absolute: /title:\s*\{\s*absolute:/.test(match[0]) };
}

describe("titles", () => {
  it("never repeat the brand that the layout template already adds", () => {
    const offenders: string[] = [];
    const unread: string[] = [];
    for (const urlPath of discoverStaticSitemapUrlPaths()) {
      if (urlPath === "/") continue;
      const source = fs.readFileSync(pageFile(urlPath), "utf8");
      const found = readMetadataTitle(source);
      if (!found) {
        // Computed titles (`title: pageTitle`) and metadata helpers are checked by their own tests.
        const computed = /^(?:export )?const metadata[\s\S]*?^[ \t]+title:\s*[A-Za-z_$]/m.test(source);
        if (!computed && !/get(Guide|Listicle)Metadata\(|generateMetadata/.test(source)) unread.push(urlPath);
        continue;
      }
      if (!found.absolute && /AniDachi/.test(found.title)) offenders.push(`${urlPath}: ${found.title}`);
    }
    const guides = fs.readFileSync(path.join(process.cwd(), "lib/pseo-new-guides.tsx"), "utf8");
    // Page entries sit two levels deep; deeper `title:` keys are section headings.
    for (const m of guides.matchAll(/\n(?:\t\t| {4})title: "([^"]+)"/g)) {
      if (/AniDachi/.test(m[1])) offenders.push(`pseo: ${m[1]}`);
    }
    assert.deepEqual(offenders, []);
    assert.deepEqual(unread, []);
  });

  it("reads tab- and space-indented titles alike", () => {
    assert.deepEqual(readMetadataTitle('export const metadata = {\n\ttitle: "A | AniDachi",\n};'), {
      title: "A | AniDachi",
      absolute: false,
    });
    assert.deepEqual(readMetadataTitle('const metadata: Metadata = {\n  title: { absolute: "About AniDachi" },\n};'), {
      title: "About AniDachi",
      absolute: true,
    });
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
