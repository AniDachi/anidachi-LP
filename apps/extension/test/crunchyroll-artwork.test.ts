import { describe, expect, it } from "vitest";
import {
  getCrunchyrollRelatedSeriesId,
  selectCrunchyrollPosterTall,
} from "../src/crunchyroll-artwork-select";

describe("Crunchyroll artwork", () => {
  it("selects catalog poster_tall artwork instead of wide artwork", () => {
    const posterUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png";

    expect(
      selectCrunchyrollPosterTall({
        data: [
          {
            images: {
              poster_wide: [
                [
                  {
                    width: 1200,
                    height: 675,
                    source:
                      "https://www.crunchyroll.com/imgsrv/display/thumbnail/1200x675/catalog/crunchyroll/45aad1aa86094418e9744664a037ac92.png",
                  },
                ],
              ],
              poster_tall: [
                [
                  {
                    width: 120,
                    height: 180,
                    source:
                      "https://www.crunchyroll.com/imgsrv/display/thumbnail/120x180/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png",
                  },
                  {
                    width: 480,
                    height: 720,
                    source: posterUrl,
                  },
                  {
                    width: 1560,
                    height: 2340,
                    source:
                      "https://www.crunchyroll.com/imgsrv/display/thumbnail/1560x2340/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png",
                  },
                ],
              ],
            },
          },
        ],
      }),
    ).toBe(posterUrl);
  });

  it("extracts the related series id from movie-like episode objects", () => {
    expect(
      getCrunchyrollRelatedSeriesId({
        data: [
          {
            episode_metadata: {
              series_id: "GNVHKN92K",
            },
            images: {
              thumbnail: [
                [
                  {
                    width: 320,
                    height: 180,
                    source:
                      "https://www.crunchyroll.com/imgsrv/display/thumbnail/320x180/catalog/crunchyroll/3c4e0226ade9a212a4595f97c77bb8e4.png",
                  },
                ],
              ],
            },
          },
        ],
      }),
    ).toBe("GNVHKN92K");
  });

  it("selects nested poster_tall artwork from wrapped CMS responses", () => {
    const posterUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/nested-poster.png";

    expect(
      selectCrunchyrollPosterTall({
        data: {
          items: [
            {
              cms: {
                object: {
                  images: {
                    poster_tall: [
                      [
                        {
                          width: 1200,
                          height: 675,
                          source:
                            "https://www.crunchyroll.com/imgsrv/display/thumbnail/1200x675/catalog/crunchyroll/wide.png",
                        },
                        {
                          width: 480,
                          height: 720,
                          source: posterUrl,
                        },
                      ],
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    ).toBe(posterUrl);
  });

  it("falls back to non-poster portrait artwork when poster_tall is missing", () => {
    const portraitUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/portrait.png";

    expect(
      selectCrunchyrollPosterTall({
        data: [
          {
            images: {
              thumbnail: [
                [
                  {
                    width: 640,
                    height: 360,
                    source:
                      "https://www.crunchyroll.com/imgsrv/display/thumbnail/640x360/catalog/crunchyroll/wide.png",
                  },
                ],
              ],
              keyart: [
                [
                  {
                    width: 480,
                    height: 720,
                    source: portraitUrl,
                  },
                ],
              ],
            },
          },
        ],
      }),
    ).toBe(portraitUrl);
  });

  it("uses a thumbnail as a last artwork fallback instead of returning empty", () => {
    const thumbnailUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/640x360/catalog/crunchyroll/thumb.png";

    expect(
      selectCrunchyrollPosterTall({
        data: [
          {
            images: {
              thumbnail: [
                [
                  {
                    width: 640,
                    height: 360,
                    source: thumbnailUrl,
                  },
                ],
              ],
            },
          },
        ],
      }),
    ).toBe(thumbnailUrl);
  });

  it("extracts related series ids from nested CMS wrappers", () => {
    expect(
      getCrunchyrollRelatedSeriesId({
        data: {
          item: {
            cms: {
              object: {
                episode_metadata: {
                  series_id: "GYEXAMPLE",
                },
              },
            },
          },
        },
      }),
    ).toBe("GYEXAMPLE");
  });
});
