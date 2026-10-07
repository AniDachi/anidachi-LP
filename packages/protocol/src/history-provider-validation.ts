import { canonicalizeRoomSourceUrl } from "./source-url";
import { isNetflixHistoryKey } from "./netflix-identity";

export type HistoryProvider = "crunchyroll" | "youtube" | "netflix";
export function historyKeyMatchesProvider(provider: HistoryProvider, key: string, kinds: readonly ("series" | "season" | "episode" | "movie" | "video")[]): boolean {
  if (provider === "netflix") return kinds.some(kind => kind !== "video" && isNetflixHistoryKey(key, kind));
  // Older read fixtures used bare keys. Qualified keys must stay provider-bound.
  return !key.includes(":") || kinds.some(kind => key.startsWith(`${provider}:${kind}:`) && key.length > `${provider}:${kind}:`.length);
}
export function historyEpisodeSourceMatches(provider: HistoryProvider, episode: { episodeKey: string; seasonKey: string | null; sourceUrl: string }): boolean {
  if (!historyKeyMatchesProvider(provider, episode.episodeKey, ["episode", "movie", "video"]) ||
    (episode.seasonKey !== null && !historyKeyMatchesProvider(provider, episode.seasonKey, ["season"]))) return false;
  const source = canonicalizeRoomSourceUrl(episode.sourceUrl, provider);
  if (!source.ok || (provider !== "youtube" && source.source.sourceUrl !== episode.sourceUrl)) return false;
  if (provider === "netflix") {
    const movie = isNetflixHistoryKey(episode.episodeKey, "movie");
    return (movie ? episode.seasonKey === null : episode.seasonKey !== null) &&
      episode.sourceUrl === `https://www.netflix.com/watch/${episode.episodeKey.split(":")[2]}`;
  }
  return true;
}
