import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { animeList } from "./anime-data";
import { SITEMAP_EXCLUDED_WATCH_SLUGS } from "./sitemap-watch-exclusions";

const watchPath = (slug: string) => `/watch/${slug}-with-friends`;
const sitemapPaths = () => new Set(sitemap().map((entry) => new URL(entry.url).pathname));

describe("sitemap watch-page exclusions", () => {
  it("only lists slugs that exist", () => {
    const known = new Set(animeList.map((anime) => anime.slug));
    for (const slug of SITEMAP_EXCLUDED_WATCH_SLUGS) {
      assert.ok(known.has(slug), `unknown watch slug in exclusions: ${slug}`);
    }
  });

  it("keeps the top-priority franchises in the sitemap", () => {
    for (const slug of ["one-piece", "demon-slayer", "jujutsu-kaisen", "attack-on-titan", "naruto"]) {
      assert.ok(!SITEMAP_EXCLUDED_WATCH_SLUGS.has(slug), `${slug} must stay in the sitemap`);
    }
  });

  it("leaves excluded pages out of sitemap.xml and keeps the rest", () => {
    const paths = sitemapPaths();
    for (const slug of SITEMAP_EXCLUDED_WATCH_SLUGS) {
      assert.ok(!paths.has(watchPath(slug)), `${slug} should not be in the sitemap`);
    }
    const kept = animeList.filter((anime) => !SITEMAP_EXCLUDED_WATCH_SLUGS.has(anime.slug));
    for (const anime of kept) {
      assert.ok(paths.has(watchPath(anime.slug)), `${anime.slug} should stay in the sitemap`);
    }
    assert.ok(paths.has("/netflix-watch-party"));
  });
});
