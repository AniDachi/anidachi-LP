import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveHistoryPortrait } from "./history-title-portraits";

const id = "65e808bd-2703-452d-bf62-d941d9d799fd";
const poster = "https://img3.hulu.com/user/v3/artwork/" + id + "?base_image=asset&size=458x687";
const fixture = (html: string) => async () => new Response(html, { headers: { "Content-Type": "text/html" } });

test("Disney uses the publisher's portrait for the exact title ID, independently of its localized name", async () => {
  const wrong = poster.replace(id, "f1c31566-ec05-4d30-b23f-3177442233f4");
  const landscape = poster.replace("458x687", "1280x720");
  const html = [wrong, landscape, poster].map(src => '<img src="' + src.replaceAll("&", "&amp;") + '">').join("");
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, "alls-fair", fixture(html)), poster);
  assert.equal(await resolveHistoryPortrait("disneyplus:movie:" + id, "alls-fair", fixture('<img src="' + wrong + '">')), null);
});
test("Netflix uses the title's own boxshot even when recommendations and backdrops are present", async () => {
  const url = "https://dnm.nflximg.net/api/v6/sample/native.jpg";
  const data = { props: { apolloState: {
    "NetflixOriginal:1234": { id: 1234, 'image({"size":"LARGE"})': { __ref: "own" } },
    other: { type: "boxshot", url: url + "?unrelated" }, own: { type: "boxshot", url },
  } } };
  const document = () => '<script id="__NEXT_DATA__">' + JSON.stringify(data) + '</script>';
  assert.equal(await resolveHistoryPortrait("netflix:series:1234", "", fixture(document())), url);
  assert.equal(await resolveHistoryPortrait("netflix:movie:555", "", fixture(document())), null);
  data.props.apolloState.own.type = "billboard";
  assert.equal(await resolveHistoryPortrait("netflix:series:1234", "", fixture(document())), null);
});
test("unrelated history and off-site redirects cannot trigger another lookup", async () => {
  let calls = 0;
  const redirect = async () => { calls++; return new Response(null, { status: 302, headers: { Location: "https://example.com/" } }); };
  assert.equal(await resolveHistoryPortrait("youtube:video:123", "", redirect), null);
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, "", redirect), null);
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
    if (url.includes("/en-us/browse/entity-")) return fixture('<script id="__NEXT_DATA__">' + JSON.stringify(disney) + '</script>')();
    return fixture('<img src="' + poster + '">')();
  };
  assert.equal(await resolveHistoryPortrait("disneyplus:series:" + id, "autre-titre", request), poster);
  assert.deepEqual(urls, ["https://www.hulu.com/series/autre-titre-" + id,
    "https://www.disneyplus.com/en-us/browse/entity-" + id, "https://www.hulu.com/series/alls-fair-" + id]);
});
