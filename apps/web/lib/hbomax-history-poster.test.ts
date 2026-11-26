import assert from "node:assert/strict";
import { it } from "node:test";
import { HBO_MAX_ORIGIN } from "@anidachi/protocol";
import { resolveHboMaxHistoryPoster } from "./hbomax-history-poster";

const id = "78e15665-f6c8-4b58-8786-e0d9e2b65ced";
const path = "/show/" + id;
const image = `https://beam-images.warnermediacdn.com/BEAM_LWM_DELIVERABLES/${id}/poster.jpeg`;
const expected = image + "?host=wbd-images.prod-vod.h264.io&partner=beamcom&w=500";
const tag = (id: string, value: unknown) => `<script id="${id}" type="application/json">${JSON.stringify(value)}</script>`;
const html = (data: string, status = 200) => new Response(data, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
function page(pathname: string, imageUrl = image, matchId = id) {
  return tag("__NEXT_DATA__", { props: { pageProps: { canonicalURL: HBO_MAX_ORIGIN + pathname,
    mappedData: { title: { hbomaxId: matchId, imageUrlLink: pathname, images: { "poster-with-logo": imageUrl } } },
  } } });
}

it("resolves the exact movie poster from its public page", async () => {
  const movie = "/movie/" + id;
  assert.equal(await resolveHboMaxHistoryPoster("movie", id, async url => {
    assert.equal(url, HBO_MAX_ORIGIN + movie);
    return html(page(movie));
  }), expected);
});

it("uses one advertised storefront when the default page has no title", async () => {
  const regional = "/vn/en" + path;
  const urls: string[] = [];
  const result = await resolveHboMaxHistoryPoster("series", id, async url => {
    urls.push(String(url));
    return urls.length === 1 ? html(tag("__DOTCOM_GEO__", { pageLocales: { pathname: path,
      availableLocales: ["//example.org", "us/en", "cl/es", "vn/en"] } }), 404) : html(page(regional));
  });
  assert.deepEqual(urls, [HBO_MAX_ORIGIN + path, HBO_MAX_ORIGIN + regional]);
  assert.equal(result, expected);
});

it("ignores unrelated titles, regions and foreign image hosts", async () => {
  for (const data of [page(path, image, "unrelated"), page("/other"), page(path, "https://example.org/poster"),
    tag("__DOTCOM_GEO__", { pageLocales: { pathname: "/other", availableLocales: ["vn/en"] } })]) {
    assert.equal(await resolveHboMaxHistoryPoster("series", id, async () => html(data)), null);
  }
});

it("does not cache an upstream outage as missing artwork", async () => {
  await assert.rejects(() => resolveHboMaxHistoryPoster("series", id, async () => html("", 503)));
});
