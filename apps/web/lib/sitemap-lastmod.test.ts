import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { animeList } from "./anime-data";
import { discoverStaticSitemapUrlPaths, staticPathsToSitemapEntries } from "./sitemap-discovery";
import {
  extractDateModifiedLiteral,
  extractPageContentDate,
  getStaticPageContentDate,
  isTrustworthyIsoDate,
  longDateToIso,
} from "./sitemap-lastmod";
import { WATCH_ENRICHMENT, WATCH_PAGE_TEMPLATE_DATE_MODIFIED, getWatchPageDateModified } from "./watch-page-enrichment";

const NOW = new Date("2026-11-05T12:00:00Z");
const noDelegate = () => null;

describe("sitemap lastmod parsing", () => {
  it("reads a single dateModified literal", () => {
    assert.equal(extractDateModifiedLiteral(`<SeoPageLayout dateModified="2026-10-20" />`), "2026-10-20");
    assert.equal(extractDateModifiedLiteral(`dateModified = "2026-10-19",`), "2026-10-19");
  });

  it("refuses to pick between disagreeing dates", () => {
    assert.equal(
      extractDateModifiedLiteral(`dateModified="2026-10-01" … dateModified="2026-10-20"`),
      null
    );
  });

  it("converts MarketingArticle long dates", () => {
    assert.equal(longDateToIso("October 17, 2026"), "2026-10-17");
    assert.equal(longDateToIso("June 1, 2026"), "2026-06-01");
    assert.equal(longDateToIso("Octember 1, 2026"), null);
  });

  it("rejects malformed and future dates", () => {
    assert.ok(isTrustworthyIsoDate("2026-10-01", NOW));
    assert.ok(!isTrustworthyIsoDate("2026-02-30", NOW));
    assert.ok(!isTrustworthyIsoDate("2026-12-01", NOW));
    assert.ok(!isTrustworthyIsoDate("Oct 1", NOW));
  });

  it("follows shared page components only when the page has no date of its own", () => {
    const delegate = (file: string) =>
      file === "lib/pseo-new-guides.tsx" ? `dateModified="2026-10-01"` : null;
    assert.equal(extractPageContentDate(`<PseoGuidePage slug="x" />`, delegate, NOW), "2026-10-01");
    assert.equal(extractPageContentDate(`<PseoListiclePage slug="x" />`, delegate, NOW), "2026-10-01");
    assert.equal(extractPageContentDate(`<HomeClient />`, delegate, NOW), null);
    assert.equal(
      extractPageContentDate(`<SectionIndexPage dateModified={someVariable} />`, () => `dateModified = "2026-10-19"`, NOW),
      null
    );
  });

  it("omits the date instead of inventing one", () => {
    assert.equal(extractPageContentDate(`export default function Page() {}`, noDelegate, NOW), null);
  });
});

describe("sitemap lastmod output", () => {
  it("uses the declared content date for known pages", () => {
    const hubSource = fs.readFileSync(path.join(process.cwd(), "app/netflix-watch-party/page.tsx"), "utf8");
    const declared = extractDateModifiedLiteral(hubSource);
    assert.ok(declared, "/netflix-watch-party declares one dateModified");
    assert.equal(getStaticPageContentDate("/netflix-watch-party"), declared);
    const termsSource = fs.readFileSync(path.join(process.cwd(), "app/terms/page.tsx"), "utf8");
    const termsUpdated = termsSource.match(/<MarketingArticle\b[^>]*\bupdated="([^"]+)"/)?.[1] ?? "";
    assert.equal(getStaticPageContentDate("/terms"), longDateToIso(termsUpdated));
    assert.equal(getStaticPageContentDate("/watch"), "2026-10-19");
  });

  it("leaves pages without a declared date undated", () => {
    assert.equal(getStaticPageContentDate("/"), null);
    const [entry] = staticPathsToSitemapEntries("https://www.anidachi.app", ["/"], () => null);
    assert.equal("lastModified" in entry, false);
  });

  it("dates watch pages from their enrichment or the template", () => {
    for (const anime of animeList) {
      const expected = WATCH_ENRICHMENT[anime.slug]?.updated ?? WATCH_PAGE_TEMPLATE_DATE_MODIFIED;
      assert.equal(getWatchPageDateModified(anime.slug), expected);
    }
  });

  it("never emits a rolling date or an invalid date", () => {
    const entries = sitemap();
    if (entries.length === 0) {
      // Indexing disabled in this environment; validate the static entries directly.
      entries.push(...staticPathsToSitemapEntries("https://www.anidachi.app", discoverStaticSitemapUrlPaths()));
    }
    let dated = 0;
    const distinct = new Set<string>();
    for (const entry of entries) {
      if (entry.lastModified === undefined) continue;
      dated += 1;
      assert.equal(typeof entry.lastModified, "string", entry.url);
      const value = entry.lastModified as string;
      assert.ok(isTrustworthyIsoDate(value), `${entry.url}: ${value}`);
      distinct.add(value);
    }
    assert.ok(dated > entries.length / 2, `only ${dated} of ${entries.length} URLs have lastmod`);
    // One shared date across the site would mean a build or "today" timestamp, not content dates.
    assert.ok(distinct.size > 3, `only ${distinct.size} distinct lastmod values`);
  });
});
