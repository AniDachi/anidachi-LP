import { hboMaxSeasonIdentifier, hboMaxSourceUrl, WatchCatalogSnapshotInputSchema, type WatchCatalogSnapshotInput } from "@anidachi/protocol";
import { getHboMaxDetails, readHboMaxPlaybackMetadata } from "./metadata";
export { startHboMaxCatalogCapture } from "./metadata";

export function readHboMaxCatalog(doc: Document, seriesId: string, playbackId: string): WatchCatalogSnapshotInput | null {
	const metadata = readHboMaxPlaybackMetadata(doc, playbackId);
	const details = getHboMaxDetails(doc);
	if (metadata?.identity.kind !== "episode" || metadata.identity.providerSeriesId !== seriesId || details?.id !== seriesId ||
		!metadata.seasonNumber || !details.seasons.get(metadata.seasonNumber)?.episodes.has(playbackId)) return null;
	const seasons = [...details.seasons.values()].sort((a, b) => a.number - b.number).map(season => {
		const identifier = hboMaxSeasonIdentifier(seriesId, season.number);
		return {
			providerSeasonIdentifier: identifier,
			seasonKey: `hbomax:season:${identifier}`,
			title: season.title,
			seasonNumber: season.number,
			order: season.number - 1,
			episodes: [...season.episodes.values()].sort((a, b) => a.number - b.number).map(episode => ({
				providerEpisodeIdentifier: episode.playbackId,
				episodeKey: `hbomax:episode:${episode.playbackId}`,
				title: episode.title, episodeNumber: episode.number, order: episode.number - 1,
				releasedAt: null, available: true,
				watchVariants: [{ providerContentId: episode.playbackId, sourceUrl: hboMaxSourceUrl(episode.playbackId),
					audioLocale: null, original: false, order: 0 }],
			})),
		};
	});
	// The rendered grid has no independently established total or territory.
	const parsed = WatchCatalogSnapshotInputSchema.safeParse({
		schemaVersion: 3, provider: "hbomax", providerSeriesId: seriesId, titleKey: `hbomax:series:${seriesId}`,
		title: details.title, completeness: "partial", seasons,
		context: { region: null, requestedLocale: details.locale, audioLocale: null, subtitleLocales: [], observedAt: new Date().toISOString() },
	});
	return parsed.success ? parsed.data : null;
}
