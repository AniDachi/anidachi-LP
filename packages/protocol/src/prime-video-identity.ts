import { z } from "zod";

/** Prime compactGTIs are opaque, case-sensitive identifiers, never titles or ordinals. */
export const PrimeVideoProviderIdSchema = z.string().regex(/^[A-Z0-9]{26}$/);

export const PrimeVideoHistoryIdentitySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("movie"), providerMovieId: PrimeVideoProviderIdSchema }),
  z.strictObject({
    kind: z.literal("episode"),
    // A verified season-1 compactGTI anchors the series; this is not a provider series ID.
    seriesAnchorSeasonId: PrimeVideoProviderIdSchema,
    providerSeasonIdentifier: PrimeVideoProviderIdSchema,
    providerEpisodeIdentifier: PrimeVideoProviderIdSchema,
  }),
]);
export type PrimeVideoHistoryIdentity = z.infer<typeof PrimeVideoHistoryIdentitySchema>;

export function isPrimeVideoHistoryKey(value: string, kind: "series" | "season" | "episode" | "movie"): boolean {
  return new RegExp(`^primevideo:${kind}:[A-Z0-9]{26}$`).test(value);
}

/** Formatting helpers expect IDs admitted by PrimeVideoProviderIdSchema. */
export function primeVideoSourceUrl(providerId: string): string {
  return `https://www.primevideo.com/detail/${providerId}`;
}
export function primeVideoFingerprint(providerId: string): string {
  return `primevideo|detail/${providerId}`;
}
export function primeVideoHistoryKeys(identity: PrimeVideoHistoryIdentity) {
  if (identity.kind === "movie") {
    const key = `primevideo:movie:${identity.providerMovieId}`;
    return { itemKind: "movie" as const, titleKey: key, episodeKey: key, seasonKey: null };
  }
  return {
    itemKind: "series" as const,
    titleKey: `primevideo:series:${identity.seriesAnchorSeasonId}`,
    seasonKey: `primevideo:season:${identity.providerSeasonIdentifier}`,
    episodeKey: `primevideo:episode:${identity.providerEpisodeIdentifier}`,
  };
}
