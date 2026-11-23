import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrimeHistoryPoster } from "./prime-history-poster";

const id = "0JYIPCYT3HVMUYMF0SY5XFGIQX";
const gti = "amzn1.dv.gti.first-season";
const poster = "https://m.media-amazon.com/images/M/example._V1_.jpg";
const title = "Test Series";
const candidate = { id: "tt101", l: title, y: 2011, qid: "tvSeries", s: "Actor One, Actor Two", i: { width: 960, height: 1440, imageUrl: poster } };
function store(results: unknown[], compact = id): typeof fetch {
  const state = { pageTitleId: gti, self: { [gti]: { compactGTI: compact, gti } }, detail: { headerDetail: {
    [gti]: { catalogId: gti, titleType: "season", seasonNumber: 1, parentTitle: title, releaseYear: 2012,
      contributors: { cast: [{ name: "Actor One" }, { name: "Actor Two" }] } },
  } } };
  return async url => {
    if (String(url).startsWith("https://www.primevideo.com/region/na/detail/")) {
      const data = { init: { preparations: { body: { atf: { state } } } } };
      return new Response('<script id="dv-web-page-hydration-data">' + JSON.stringify(data) + '</script>', { headers: { "content-type": "text/html" } });
    }
    assert.equal(String(url), "https://v3.sg.media-imdb.com/suggestion/x/Test%20Series.json");
    return Response.json({ d: results });
  };
}
test("uses a unique portrait for the exact first-season anchor, cast and release", async () => {
  const key = "primevideo:series:" + id;
  const other = { ...candidate, id: "tt202", s: "Another Cast", y: 2019 };
  assert.equal(await resolvePrimeHistoryPoster(key, store([other, candidate])), poster);
  for (const rows of [[other], [candidate, { ...candidate, id: "tt303" }], [{ ...candidate, qid: "movie" }],
    [{ ...candidate, i: { ...candidate.i, width: 1920 } }], [{ ...candidate, i: { ...candidate.i, imageUrl: "https://example.com/poster.jpg" } }]]) {
    assert.equal(await resolvePrimeHistoryPoster(key, store(rows)), null);
  }
  assert.equal(await resolvePrimeHistoryPoster(key, store([candidate], "OTHER")), null);
});
