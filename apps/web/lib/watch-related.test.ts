import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { animeList } from "./anime-data";
import { WATCH_RELATED_LIMIT, getWatchGenreHubs, getWatchRelated } from "./watch-related";

const bySlug = (slug: string) => animeList.find((a) => a.slug === slug)!;
const curated = (slug: string) =>
  bySlug(slug).related.map((s) => animeList.find((a) => a.slug === s)).filter((a) => a !== undefined);

describe("watch page related titles", () => {
  it("keep the curated picks first, never include the page itself, and fill to the limit", () => {
    const anime = bySlug("attack-on-titan");
    const related = getWatchRelated(anime, curated(anime.slug));
    assert.equal(related.length, WATCH_RELATED_LIMIT);
    assert.deepEqual(related.slice(0, anime.related.length).map((a) => a.slug), anime.related);
    assert.ok(!related.some((a) => a.slug === anime.slug));
    assert.equal(new Set(related.map((a) => a.slug)).size, related.length);
  });

  it("link to every title from at least one other watch page", () => {
    const linked = new Set(animeList.flatMap((a) => getWatchRelated(a, curated(a.slug)).map((r) => r.slug)));
    const unlinked = animeList.filter((a) => !linked.has(a.slug)).map((a) => a.slug);
    assert.deepEqual(unlinked, []);
  });

  it("point to matching genre hubs", () => {
    assert.deepEqual(getWatchGenreHubs(bySlug("attack-on-titan")).map((h) => h.href), ["/watch-action-anime-with-friends"]);
  });
});
