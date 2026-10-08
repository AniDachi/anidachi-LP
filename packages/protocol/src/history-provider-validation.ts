import { canonicalizeRoomSourceUrl, hasNetflixHostname } from "./source-url";
import { isNetflixHistoryKey } from "./netflix-identity";

export type HistoryProvider = "crunchyroll" | "youtube" | "netflix";
export function historyKeyMatchesProvider(provider: HistoryProvider, key: string, kinds: readonly ("series" | "season" | "episode" | "movie" | "video")[]): boolean {
  if (provider === "netflix") return kinds.some(kind => kind !== "video" && isNetflixHistoryKey(key, kind));
  // Older read fixtures used bare keys. Qualified keys must stay provider-bound.
  return !key.includes(":") || kinds.some(kind => key.startsWith(`${provider}:${kind}:`) && key.length > `${provider}:${kind}:`.length);
}
/** Read-only compatibility for old namespaces. Writer/catalog admission stays strict. */
export function historyReadKeyMatchesProvider(provider: HistoryProvider, key: string, kinds: readonly ("series" | "season" | "episode" | "movie" | "video")[]): boolean {
  if (provider === "netflix") return historyKeyMatchesProvider(provider, key, kinds);
  return !/^(?:crunchyroll|youtube|netflix):/.test(key) || key.startsWith(`${provider}:`);
}
export function historyEpisodeSourceMatches(provider: HistoryProvider, episode: { episodeKey: string; seasonKey: string | null; sourceUrl: string }): boolean {
  if (!historyReadKeyMatchesProvider(provider, episode.episodeKey, ["episode", "movie", "video"]) ||
    (episode.seasonKey !== null && !historyReadKeyMatchesProvider(provider, episode.seasonKey, ["season"]))) return false;
  const source = canonicalizeRoomSourceUrl(episode.sourceUrl, provider);
  if (!source.ok || (provider !== "youtube" && source.source.sourceUrl !== episode.sourceUrl)) return false;
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
  if (keys.some(key => key !== null && /^(?:crunchyroll|youtube|netflix):/.test(key) && !key.startsWith(`${provider}:`))) return false;
  return sourceUrls.every(value => !hasNetflixHostname(value) || provider === "netflix");
}
