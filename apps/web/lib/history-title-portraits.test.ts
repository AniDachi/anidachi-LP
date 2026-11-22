import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHistoryPortrait } from "./history-title-portraits";
import { pressPortrait } from "./disney-press-portrait";

const id = "65e808bd-2703-452d-bf62-d941d9d799fd";
const poster = "https://img3.hulu.com/user/v3/artwork/" + id + "?base_image=asset&size=458x687";
const fixture = (html: string) => async () => new Response(html, { headers: { "Content-Type": "text/html" } });
const synopsis = "Two colleagues open a law firm in the city.";
const disneyPage = '<script id="__NEXT_DATA__">' + JSON.stringify({ props: { pageProps: {
  pageId: "entity-" + id, stitchDocument: { mainContent: [
    { _type: "DetailEntityHero", backgroundImage: { alt: "All’s Fair" } },
    { _type: "MediaDetails", summary: synopsis },
  ] },
} } }) + '</script>';
const storefront = (html: string) => async (input: Parameters<typeof fetch>[0]) =>
  fixture(String(input).includes("/browse/entity-") ? disneyPage : html)();

test("Disney uses the publisher's portrait for the exact title ID, independently of its localized name", async () => {
  const wrong = poster.replace(id, "f1c31566-ec05-4d30-b23f-3177442233f4");
  const landscape = poster.replace("458x687", "1280x720");
  const html = [wrong, landscape, poster].map(src => '<img src="' + src.replaceAll("&", "&amp;") + '">').join("");
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, storefront(html)), poster);
  assert.equal(await resolveHistoryPortrait("disneyplus:movie:" + id, storefront('<img src="' + wrong + '">')), null);
});
test("Netflix uses the title's own boxshot even when recommendations and backdrops are present", async () => {
  const url = "https://dnm.nflximg.net/api/v6/sample/native.jpg";
  const data = { props: { apolloState: {
    "NetflixOriginal:1234": { id: 1234, 'image({"size":"LARGE"})': { __ref: "own" } },
    other: { type: "boxshot", url: url + "?unrelated" }, own: { type: "boxshot", url },
  } } };
  const document = () => '<script id="__NEXT_DATA__">' + JSON.stringify(data) + '</script>';
  assert.equal(await resolveHistoryPortrait("netflix:series:1234", fixture(document())), url);
  assert.equal(await resolveHistoryPortrait("netflix:movie:555", fixture(document())), null);
  data.props.apolloState.own.type = "billboard";
  assert.equal(await resolveHistoryPortrait("netflix:series:1234", fixture(document())), null);
});
test("unrelated history and off-site redirects cannot trigger another lookup", async () => {
  let calls = 0;
  const redirect = async () => { calls++; return new Response(null, { status: 302, headers: { Location: "https://example.com/" } }); };
  assert.equal(await resolveHistoryPortrait("youtube:video:123", redirect), null);
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, redirect), null);
  assert.equal(calls, 1);
});

test("a localized Disney title recovers the US storefront slug from its own entity", async () => {
  const urls: string[] = [];
  const disney = { props: { pageProps: { pageId: "entity-" + id, stitchDocument: { mainContent: [
    { _type: "DetailEntityHero", backgroundImage: { alt: "All’s Fair" } },
  ] } } } };
  const request = async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/autre-titre-")) return new Response(null, { status: 404 });
    if (url.includes("/browse/entity-")) return fixture('<script id="__NEXT_DATA__">' + JSON.stringify(disney) + '</script>')();
    return fixture('<img src="' + poster + '">')();
  };
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, request), poster);
  assert.deepEqual(urls, ["https://www.disneyplus.com/browse/entity-" + id, "https://www.hulu.com/series/alls-fair-" + id]);
});

test("a regional-only title may use localized Hulu artwork only for the saved entity", async () => {
  const request = async (input: Parameters<typeof fetch>[0]) => String(input).includes("/titre-local-" + id)
    ? fixture('<img src="' + poster + '">')() : new Response(null, { status: 404 });
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, request, "titre-local"), poster);
});

test("direct links resolve official vertical artwork when the storefront is unavailable", async () => {
  const url = "https://press.hulu.com/storage/uploads/Show-416x614.png";
  const html = '<h1>All&#8217;s Fair</h1><p>' + synopsis + '</p><img src="' + url + '" alt="show logo">';
  const request = async (input: Parameters<typeof fetch>[0]) => {
    const target = String(input);
    if (target.includes("/browse/entity-")) return fixture(disneyPage)();
    if (target.startsWith("https://press.hulu.com/")) return fixture(html)();
    return new Response(null, { status: 406 });
  };
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, request), url);
  const expected = {slug: "alls-fair", synopsis};
  assert.equal(pressPortrait(html.replace(synopsis, "This remake follows a different family."), expected, "hulu"), null);
  assert.equal(pressPortrait(html.replace("416x614", "614x416"), expected, "hulu"), null);
  assert.equal(pressPortrait(html.replace("press.hulu.com", "example.org"), expected, "hulu"), null);
  assert.equal(pressPortrait(html.replace("All&#8217;s Fair", "Another Title"), expected, "hulu"), null);
  const art = "https://lumiere-a.akamaihd.net/v1/images/poster.jpg?region=0%2C0%2C800%2C1200";
  const disney = '<h1>All’s Fair Logos and Key Art</h1><p>' + synopsis + '</p><img alt="All’s Fair S1 Key Art" src="' + art + '">';
  assert.equal(pressPortrait(disney, expected, "disney"), art);
  assert.equal(pressPortrait(disney.replace("800%2C1200", "1200%2C800"), expected, "disney"), null);
});

test("a catalog portrait survives later episode checkpoints and bypasses publisher fallbacks", async () => {
  const { withTitlePortraits } = await import("./history-title-portraits");
  const titleKey = "disneyplus:series:" + id;
  const title = { titleKey, title: "All’s Fair", artworkUrl: "https://disney.images.edge.bamgrid.com/background", currentTime: 317 };
  const history = { items: [title] } as unknown as Parameters<typeof withTitlePortraits>[0];
  const native = "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/01a1a48c-43c5-75e7-9d54-cb770a55d506/compose?format=webp&label=standard_art_vertical_hulu-original-series_067&width=800";
  let publisherCalls = 0;
  const lookup = async () => { publisherCalls++; return poster; };
  const result = await withTitlePortraits(history, async (_, keys) => {
    assert.deepEqual(keys, [titleKey]);
    return new Map([[titleKey, native]]);
  }, lookup);
  assert.deepEqual(result.items[0], { ...title, artworkUrl: native });
  assert.equal(publisherCalls, 0);
  assert.equal((await withTitlePortraits(history, async () => new Map(), lookup)).items[0]?.artworkUrl, poster);
  assert.equal(publisherCalls, 1);
});
