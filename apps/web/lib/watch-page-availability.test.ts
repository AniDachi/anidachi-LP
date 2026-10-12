import assert from "node:assert/strict";
import { test } from "node:test";
import { animeList } from "./anime-data";
import { buildWatchPageMetaDescription, buildWatchHowToSteps, buildWatchPageFaq } from "./watch-page-rich-content";

for (const slug of ["spirited-away", "howls-moving-castle", "princess-mononoke", "my-neighbor-totoro"]) {
  test(`${slug} does not promise unavailable playback`, () => {
    const anime = animeList.find(a => a.slug === slug)!;
    assert.ok(anime.notOnCrunchyroll);
    const description = buildWatchPageMetaDescription(anime);
    assert.match(description, /not on Crunchyroll/i);
    assert.ok(description.length <= 160);
    assert.deepEqual(buildWatchHowToSteps(anime), []);
    const faq = buildWatchPageFaq(anime, anime.episodes);
    assert.match(faq.map(item => item.answer).join(" "), /cannot sync/);
    assert.doesNotMatch(JSON.stringify(faq), /Install AniDachi|open it on Crunchyroll|Rooms currently sync|same watchroom flow/);
  });
}
test("supported titles keep their room setup and FAQ", () => {
  const anime = animeList.find(a => a.slug === "naruto")!;
  assert.equal(buildWatchHowToSteps(anime).length, 5);
  assert.match(buildWatchPageMetaDescription(anime), /AniDachi watchrooms on Crunchyroll/);
  assert.ok(buildWatchPageFaq(anime, anime.episodes).some(item => item.question.includes("watch party feature")));
});
