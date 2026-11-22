import { describe, it, expect } from "vitest";
import { disneyPortraitCard } from "../src/disney-portrait-cards";
import { DisneyPortraitBatchSchema } from "@anidachi/protocol";

const id = "65e808bd-2703-452d-bf62-d941d9d799fd";
const asset = "https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/01a1a48c-43c5-75e7-9d54-cb770a55d506/compose";
const native = asset + "?format=webp&label=standard_art_vertical_hulu-original-series_067&width=800";
function image(href: string, src: string) {
  return { currentSrc: src, closest: () => ({ href }) } as unknown as HTMLImageElement;
}
describe("Disney catalog cards", () => {
  it("binds the published artwork ID to its own localized title link", () => {
    const href = "https://www.disneyplus.com/pt-br/browse/entity-" + id;
    expect(disneyPortraitCard(image(href, native.replace("800", "400")))).toEqual({ id, url: native });
    expect(DisneyPortraitBatchSchema.safeParse({ generation: 1, epoch: 2, cards: [{ key: "disneyplus:movie:" + id, url: native }] }).success).toBe(true);
    expect(disneyPortraitCard(image(href, native.replace("_hulu-original-series", "")))?.id).toBe(id);
    expect(disneyPortraitCard(image(href, native.replace("vertical", "horizontal")))).toBeNull();
    expect(disneyPortraitCard(image(href, native.replace("bamgrid.com", "bamgrid.com.example.org")))).toBeNull();
    expect(disneyPortraitCard(image(href.replace("www.disneyplus.com", "example.org"), native))).toBeNull();
    expect(disneyPortraitCard(image(href.replace("browse/entity-", "play/"), native))).toBeNull();
  });
});
