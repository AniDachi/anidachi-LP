import { expect, it } from "vitest";
import { disneyPlaybackPortraits } from "../src/disney-playback-portrait";

const series = "f1c31566-ec05-4d30-b23f-3177442233f4";
const asset = "01a18f00-faa9-7ada-8548-66637c3f59c7";
const avail = "9ad21449-d975-4f5f-add0-2197839b16bd";
const artwork = { standard: { tile: { "0.67": { imageId: asset } } } };
const networkAttribution = { slug: "disney-original" };
const experience = { playerExperience: { availId: avail, image: artwork, networkAttribution } };
const deeplink = { deeplink: { actions: [{ type: "browse", pageId: "entity-" + series }, { type: "playback", availId: avail }] } };
const result = { id: series, url: "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/" + asset + "/compose?format=webp&label=standard_art_vertical_disney-original_067&width=800" };

it.each([true, false])("pairs a direct play by availability ID regardless of delivery order (%s)", reverse => {
  const read = disneyPlaybackPortraits();
  const play = () => read("playerExperience/" + avail, experience);
  const link = () => read("deeplink", deeplink);
  expect((reverse ? play : link)()).toBeUndefined();
  expect(read("playerExperience/" + series, experience)).toBeUndefined();
  expect((reverse ? link : play)()).toEqual(result);
});

it("selects only the current entity's vertical tile and applies its publisher attribution", () => {
  const read = disneyPlaybackPortraits();
  const page = { id: "entity-" + series, visuals: { artwork, networkAttribution: { slug: "hulu-original-series" } } };
  expect(read("page/entity-" + series, { page })?.url).toBe(result.url.replace("disney-original", "hulu-original-series"));
  expect(read("page/entity-" + asset, { page })).toBeUndefined();
  expect(read("page/entity-" + series, { page: { ...page, visuals: {} } })).toBeUndefined();
});
