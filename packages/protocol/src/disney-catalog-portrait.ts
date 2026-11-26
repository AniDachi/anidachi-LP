import { z } from "zod";

// Disney publishes the artwork ID independently of the title ID on its catalog card.
const asset = /^\/ripcut-delivery\/v2\/variant\/disney\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}|[a-f0-9]{64})\/compose$/i;
const cdn = "https://disney.images.edge.bamgrid.com";

export function disneyCatalogPortrait(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith(cdn + "/")) return null;
  const url = URL.parse(value);
  if (!url || url.origin !== cdn || !asset.test(url.pathname)) return null;
  const label = url.searchParams.get("label");
  if (!label || !/^standard_art_vertical(?:_[a-z0-9-]+)*_[0-9]{3}$/.test(label)) return null;
  return cdn + url.pathname + "?format=webp&label=" + label + "&width=800";
}

export const DisneyPortraitBatchSchema = z.strictObject({
  generation: z.number().int().nonnegative(), epoch: z.number().int().nonnegative(),
  cards: z.array(z.strictObject({
    key: z.string().regex(/^disneyplus:(?:movie|series):[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/),
    url: z.string().max(2048).refine(value => disneyCatalogPortrait(value) === value),
  })).min(1).max(40),
});
