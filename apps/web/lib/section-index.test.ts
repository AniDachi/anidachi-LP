import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guideLinks } from "./guide-links";
import {
  COMPARE_ENTRIES,
  GLOSSARY_ENTRIES,
  SECTION_INDEX_PATHS,
  TOOLS_ENTRIES,
  getGuideGroups,
  getWatchGroups,
} from "./section-index";
import { discoverStaticSitemapUrlPaths } from "./sitemap-discovery";

const sitemap = discoverStaticSitemapUrlPaths();
const inSection = (prefix: string) => sitemap.filter((p) => p.startsWith(`${prefix}/`)).sort();
const hrefs = (entries: { href: string }[]) => entries.map((e) => e.href).sort();

describe("section index pages", () => {
  it("are in the sitemap", () => {
    for (const path of SECTION_INDEX_PATHS) assert.ok(sitemap.includes(path), path);
  });

  it("list every compare, glossary and tool page exactly once", () => {
    assert.deepEqual(hrefs(COMPARE_ENTRIES), inSection("/compare"));
    assert.deepEqual(hrefs(GLOSSARY_ENTRIES), inSection("/glossary"));
    assert.deepEqual(hrefs(TOOLS_ENTRIES), inSection("/tools"));
  });

  it("list every guide exactly once", () => {
    const listed = getGuideGroups().flatMap((g) => g.entries.map((e) => e.href));
    assert.equal(new Set(listed).size, listed.length);
    assert.deepEqual(listed.sort(), inSection("/guides"));
    assert.ok(guideLinks.length >= listed.length);
  });

  it("list every watch page and genre hub", () => {
    const [genres, series, films] = getWatchGroups();
    assert.ok(genres.entries.every((e) => sitemap.includes(e.href)));
    const titles = [...series.entries, ...films.entries].map((e) => e.href);
    assert.equal(new Set(titles).size, titles.length);
    assert.ok(titles.length > 100);
  });
});
