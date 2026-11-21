import { isHboMaxHistoryKey, hboMaxSourceUrl } from "./hbomax-identity";
import { isDisneyPlusHistoryKey, disneyPlusSourceUrl } from "./disneyplus-identity";
import { canonicalizeRoomSourceUrl, hasHboMaxHostname, hasDisneyPlusHostname, hasNetflixHostname, hasPrimeVideoHostname } from "./source-url";
import { isNetflixHistoryKey } from "./netflix-identity";
import { isPrimeVideoHistoryKey, primeVideoSourceUrl } from "./prime-video-identity";

export type HistoryProvider = import("./source-url").RoomSourceProvider;
export function historyKeyMatchesProvider(provider: HistoryProvider, key: string, kinds: readonly ("series" | "season" | "episode" | "movie" | "video")[]): boolean {
  if (provider === "hbomax") return kinds.some(kind => isHboMaxHistoryKey(key, kind));
  if (provider === "disneyplus") return kinds.some(kind => isDisneyPlusHistoryKey(key, kind));
  if (provider === "primevideo") return kinds.some(kind => kind !== "video" && isPrimeVideoHistoryKey(key, kind));
  if (provider === "netflix") return kinds.some(kind => kind !== "video" && isNetflixHistoryKey(key, kind));
  // Older read fixtures used bare keys. Qualified keys must stay provider-bound.
  return !key.includes(":") || kinds.some(kind => key.startsWith(`${provider}:${kind}:`) && key.length > `${provider}:${kind}:`.length);
}
/** HBO movie details and their playable videos use separate UUIDs. */
export function historyMovieEpisodeMatchesTitle(provider: HistoryProvider, titleKey: string, episodeKey: string): boolean {
  return provider === "hbomax" ? isHboMaxHistoryKey(episodeKey, "movie") : episodeKey === titleKey;
}
/** Read-only compatibility for old namespaces. Writer/catalog admission stays strict. */
export function historyReadKeyMatchesProvider(provider: HistoryProvider, key: string, kinds: readonly ("series" | "season" | "episode" | "movie" | "video")[]): boolean {
  if (provider === "disneyplus" || provider === "hbomax" || provider === "netflix" || provider === "primevideo") return historyKeyMatchesProvider(provider, key, kinds);
  return !/^(?:crunchyroll|youtube|netflix|primevideo|disneyplus|hbomax):/.test(key) || key.startsWith(`${provider}:`);
}
export function historyEpisodeSourceMatches(provider: HistoryProvider, episode: { episodeKey: string; seasonKey: string | null; sourceUrl: string; seasonTitle?: string | null; seasonNumber?: number | null; episodeNumber?: number | null }): boolean {
  if (!historyReadKeyMatchesProvider(provider, episode.episodeKey, ["episode", "movie", "video"]) ||
    (episode.seasonKey !== null && !historyReadKeyMatchesProvider(provider, episode.seasonKey, ["season"]))) return false;
  const source = canonicalizeRoomSourceUrl(episode.sourceUrl, provider);
  if (!source.ok || (provider !== "youtube" && source.source.sourceUrl !== episode.sourceUrl)) return false;
  if (provider === "hbomax") {
    const movie = isHboMaxHistoryKey(episode.episodeKey, "movie");
    return episode.sourceUrl === hboMaxSourceUrl(episode.episodeKey.split(":")[2]!) &&
      (!movie || [episode.seasonKey, episode.seasonTitle, episode.seasonNumber, episode.episodeNumber].every(value => value == null));
  }
  if (provider === "disneyplus") {
    const movie = isDisneyPlusHistoryKey(episode.episodeKey, "movie");
    return episode.sourceUrl === disneyPlusSourceUrl(episode.episodeKey.split(":")[2]!) &&
      (!movie || [episode.seasonKey, episode.seasonTitle, episode.seasonNumber, episode.episodeNumber].every(value => value == null));
  }
  if (provider === "primevideo") {
    const movie = isPrimeVideoHistoryKey(episode.episodeKey, "movie");
    return (movie ? episode.seasonKey === null &&
      [episode.seasonTitle, episode.seasonNumber, episode.episodeNumber].every(value => value == null) : episode.seasonKey !== null) &&
      episode.sourceUrl === primeVideoSourceUrl(episode.episodeKey.split(":")[2]!);
  }
  if (provider === "netflix") {
    const movie = isNetflixHistoryKey(episode.episodeKey, "movie");
    return (movie ? episode.seasonKey === null : episode.seasonKey !== null) &&
      episode.sourceUrl === `https://www.netflix.com/watch/${episode.episodeKey.split(":")[2]}`;
  }
  return true;
}

/** Preserve legacy CR/YT bare-key read fixtures and localized URLs. Explicitly
 * qualified foreign keys and Netflix hosts cannot cross the provider boundary. */
export function historyReadReferencesMatchProvider(
  provider: string, keys: readonly (string | null)[], sourceUrls: readonly string[],
): boolean {
  if (keys.some(key => key !== null && /^(?:crunchyroll|youtube|netflix|primevideo|disneyplus|hbomax):/.test(key) && !key.startsWith(`${provider}:`))) return false;
  return sourceUrls.every(value => (!hasHboMaxHostname(value) || provider === "hbomax") && (!hasDisneyPlusHostname(value) || provider === "disneyplus") && (!hasNetflixHostname(value) || provider === "netflix") &&
    (!hasPrimeVideoHostname(value) || provider === "primevideo"));
}
