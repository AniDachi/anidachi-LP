import { PrimeVideoProviderIdSchema, primeVideoSourceUrl, WatchCatalogSnapshotInputSchema, type WatchCatalogSnapshotInput } from "@anidachi/protocol";
import { isPrimeArtwork, primeVideoId, PrimeMetadataSchema, type PrimeMetadata } from "./contract";
export type ObjectValue = Record<string, unknown>;
export const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
export const text = (value: unknown): string | null => typeof value === "string" && value.trim().length > 0 && value.length <= 300 ? value.trim() : null;
export const ordinal = (value: unknown): number | null => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1000 ? value : null;
const fullId = (value: unknown): value is string => typeof value === "string" && /^amzn1\.dv\.gti\.[a-z0-9-]{1,100}$/.test(value);
type PublicRecord = { id: string; compact: string; type: string; sequence: number | null; launched: boolean };
type Episode = { id: string; title: string; number: number };
export type PrimePage = { contentId: string; metadata: PrimeMetadata; catalog: WatchCatalogSnapshotInput | null };
function record(value: unknown, key: string): PublicRecord | null {
  const item = object(value);
  if (!fullId(key) || item.gti !== key || !PrimeVideoProviderIdSchema.safeParse(item.compactGTI).success ||
    typeof item.link !== "string" || item.link.length > 2048 || !item.link.startsWith("/detail/")) return null;
  const compact = item.compactGTI as string;
  if (primeVideoId(`https://www.primevideo.com${item.link}`) !== compact || !["movie", "episode", "season"].includes(String(item.titleType))) return null;
  return { id: key, compact, type: String(item.titleType), sequence: ordinal(item.sequenceNumber), launched: item.isLaunched === true };
}
function artwork(...values: unknown[]): string | null {
  for (const value of values) { const images = object(value); for (const key of ["packshot", "covershot", "titleshot"]) {
    const url = images[key]; if (typeof url === "string" && url.length <= 2048 && isPrimeArtwork(url)) return url;
  } } return null;
}
/** History requires agreement across every admitted list and known ID mapping. */
function seriesAnchor(lists: { entries: ObjectValue[] }[], records: Map<string, PublicRecord>, invalidRecords: Set<string>): string | null {
  let confirmed: { full: string; compact: string } | null = null;
  for (const list of lists) {
    const anchors = list.entries.filter(row => row.sequenceNumber === 1);
    if (anchors.length !== 1) return null;
    const candidate = anchors[0]!;
    if (!fullId(candidate.seasonId) || typeof candidate.seasonLink !== "string" || invalidRecords.has(candidate.seasonId)) return null;
    const compact = primeVideoId(`https://www.primevideo.com${candidate.seasonLink}`);
    if (!compact || confirmed && (confirmed.full !== candidate.seasonId || confirmed.compact !== compact)) return null;
    const known = records.get(candidate.seasonId);
    if (known && (known.compact !== compact || known.type !== "season" || known.sequence !== 1)) return null;
    for (const row of records.values()) if (row.compact === compact && row.id !== candidate.seasonId) return null;
    confirmed = { full: candidate.seasonId, compact };
  }
  return confirmed?.compact ?? null;
}

/** Reads only public title collections; never serialize the surrounding hydration/account state. */
export function readPrimePage(documentValue: Document, titleInfo: unknown, territory: unknown, locale: unknown): PrimePage | null {
  const element = documentValue.getElementById("dv-web-page-hydration-data");
  const raw = element?.textContent; if (!raw || raw.length > 8_000_000) return null;
  let data: ObjectValue; try { data = object(JSON.parse(raw)); } catch { return null; }
  const body = object(object(object(data.init).preparations).body);
  const states = [object(object(body.atf).state), object(object(body.btf).state)];
  const invalidRecords = new Set<string>();
  const records = new Map<string, PublicRecord>(); const details = new Map<string, ObjectValue>();
  for (const state of states) {
    const entries = Object.entries(object(state.self)); if (entries.length > 2000) return null;
    for (const [key, value] of entries) {
      const parsed = record(value, key), prior = records.get(key);
      if (!parsed || prior && (prior.compact !== parsed.compact || prior.type !== parsed.type || prior.sequence !== parsed.sequence)) {
        invalidRecords.add(key); records.delete(key); continue;
      }
      if (!invalidRecords.has(key)) records.set(key, parsed);
    }
    const detail = object(state.detail);
    for (const collection of [detail.headerDetail, detail.detail]) {
      const entries = Object.entries(object(collection)); if (entries.length > 2000) return null;
      for (const [key, value] of entries) details.set(key, object(value));
    }
  }
  const info = object(titleInfo); const id = info.titleId;
  if (!fullId(id)) return null;
  const current = records.get(id); if (!current || !["episode", "movie"].includes(current.type)) return null;
  const routeId = primeVideoId(documentValue.defaultView?.location.href ?? ""); if (!routeId) return null;
  const detail = details.get(id) ?? {};
  const title = text(info.title); if (!title) return null;
  const context = typeof territory === "string" && /^[A-Z]{2}$/.test(territory) && typeof locale === "string" && /^[a-z]{2,3}[_-][A-Z]{2}$/.test(locale)
    ? { region: territory, requestedLocale: locale.replace("_", "-"), audioLocale: null, subtitleLocales: [], observedAt: new Date().toISOString() } : null;
  if (current.type === "movie") {
    if (text(detail.title) !== title || routeId !== current.compact || info.type !== "MOVIE" || (detail.titleType !== undefined && detail.titleType !== "movie")) return null;
    const metadata = PrimeMetadataSchema.safeParse({ identity: { kind: "movie", providerMovieId: current.compact }, title, episodeTitle: title,
      seasonTitle: null, seasonNumber: null, episodeNumber: null, artworkUrl: artwork(detail.images), context });
    return metadata.success ? { contentId: current.compact, metadata: metadata.data, catalog: null } : null;
  }
  // The selected season and its episode-list membership establish the relationship,
  // even when the address bar remains on that season through native Next Episode.
  const lists: { season: PublicRecord; entries: ObjectValue[] }[] = [];
  for (const state of states) for (const [seasonId, value] of Object.entries(object(state.seasons))) {
    const season = records.get(seasonId); if (!season || season.type !== "season" || !Array.isArray(value) || value.length > 100) continue;
    const entries = value.map(object); const selected = entries.filter(row => row.isSelected === true);
    if (selected.length === 1 && selected[0]!.seasonId === seasonId) lists.push({ season, entries });
  }
  const selected = lists[0]; if (!selected || lists.some(list => list.season.id !== selected.season.id)) return null;
  const { season, entries } = selected;
  // Ambiguous playback IDs are fatal; unrelated anchor conflicts only suspend history.
  for (const target of [current, season]) if ([...records.values()].some(row => row.id !== target.id && row.compact === target.compact)) return null;
  const selectedRow = entries.find(row => row.isSelected === true)!;
  if (typeof selectedRow.seasonLink !== "string" || primeVideoId(`https://www.primevideo.com${selectedRow.seasonLink}`) !== season.compact || selectedRow.sequenceNumber !== season.sequence) return null;
  if (routeId !== season.compact && ![...records.values()].some(row => row.compact === routeId && row.type === "episode")) return null;
  const memberIds = new Set<string>();
  for (const state of states) { const ids = object(state.episodeList).cardTitleIds;
    if (Array.isArray(ids) && ids.length <= 2000) for (const value of ids) if (fullId(value)) memberIds.add(value);
  }
  if (!memberIds.has(id) || text(detail.title) !== title || detail.titleType !== "episode") return null;
  // An episode route must itself belong to the same observed season, not merely appear in self.
  if (routeId !== season.compact && ![...memberIds].some(key => records.get(key)?.compact === routeId)) return null;
  const seasonDetail = details.get(season.id) ?? {};
  const seasonNumber = ordinal(seasonDetail.seasonNumber), episodeNumber = ordinal(detail.episodeNumber);
  if (info.type !== "EPISODE" || !seasonNumber || !episodeNumber || season.sequence !== seasonNumber || current.sequence !== episodeNumber ||
    info.seasonNumber !== seasonNumber || info.episodeNumber !== episodeNumber) return null;
  const seriesTitle = text(info.seriesTitle), seasonTitle = text(seasonDetail.title);
  if (!seriesTitle || seasonDetail.parentTitle !== seriesTitle || !seasonTitle) return null;
  const anchor = seriesAnchor(lists, records, invalidRecords);
  const identity = anchor ? { kind: "episode" as const, seriesAnchorSeasonId: anchor, providerSeasonIdentifier: season.compact, providerEpisodeIdentifier: current.compact } : null;
  const metadata = PrimeMetadataSchema.safeParse({ identity, title: seriesTitle, episodeTitle: title, seasonTitle, seasonNumber, episodeNumber,
    artworkUrl: artwork(seasonDetail.images, detail.images), context });
  if (!metadata.success) return null;
  // Only observed enabled provider Play actions establish unplayed availability.
  const playable = new Set<string>([current.compact]);
  const actions = documentValue.querySelectorAll<HTMLAnchorElement>('a[data-testid="episodes-playbutton"][role="button"]');
  if (actions.length <= 4000) for (const action of actions) {
    if (action.hasAttribute("disabled") || ![null, "false"].includes(action.getAttribute("aria-disabled"))) continue;
    try {
      const url = new URL(action.getAttribute("href") ?? "", documentValue.defaultView?.location.href);
      const compact = primeVideoId(url.href);
      if (compact && url.searchParams.get("autoplay") === "1") playable.add(compact);
    } catch { /* Ignore malformed public links. */ }
  }
  const episodes: Episode[] = [];
  for (const member of memberIds) { const row = records.get(member), item = details.get(member); if (!row || row.type !== "episode" || !item) continue;
    const number = ordinal(item.episodeNumber), episodeTitle = text(item.title);
    if ((row.compact === current.compact || row.launched && playable.has(row.compact)) && number && row.sequence === number && episodeTitle && item.titleType === "episode") episodes.push({ id: row.compact, title: episodeTitle, number });
  }
  const catalog = anchor && context ? WatchCatalogSnapshotInputSchema.safeParse({ schemaVersion: 3, provider: "primevideo", titleKey: `primevideo:series:${anchor}`,
    providerSeriesId: anchor, title: seriesTitle, completeness: "partial", context,
    seasons: [{ seasonKey: `primevideo:season:${season.compact}`, providerSeasonIdentifier: season.compact, title: seasonTitle, seasonNumber, order: seasonNumber - 1,
      // Unproved entries are omitted; they are never labeled unavailable.
      episodes: episodes.map((episode, order) => ({ episodeKey: `primevideo:episode:${episode.id}`, providerEpisodeIdentifier: episode.id, title: episode.title,
        episodeNumber: episode.number, order, releasedAt: null, available: true,
        watchVariants: [{ providerContentId: episode.id, audioLocale: null, original: true, order: 0, sourceUrl: primeVideoSourceUrl(episode.id) }] })) }] }) : null;
  return { contentId: current.compact, metadata: metadata.data, catalog: catalog?.success ? catalog.data : null };
}
