import { z } from "zod";

/** Stable positive decimal IDs; never labels, locale, or episode numbers. */
export const NetflixProviderIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);

export const NetflixHistoryIdentitySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("episode"),
    providerSeriesId: NetflixProviderIdSchema,
    providerSeasonIdentifier: NetflixProviderIdSchema,
    providerEpisodeIdentifier: NetflixProviderIdSchema,
  }),
  z.strictObject({ kind: z.literal("movie"), providerMovieId: NetflixProviderIdSchema }),
]);
export type NetflixHistoryIdentity = z.infer<typeof NetflixHistoryIdentitySchema>;

/** Keys on legacy CR/YT read fixtures were not always canonical. Preserve them;
 * Netflix's new contract requires fully qualified stable numeric identities. */
export function isNetflixHistoryKey(value: string, kind: "series" | "season" | "episode" | "movie"): boolean {
  return new RegExp(`^netflix:${kind}:[1-9][0-9]{0,19}$`).test(value);
}
