import {
	hboMaxSeasonIdentifier, hboMaxSourceUrl, WatchCatalogLocaleContextSchema, WatchCatalogSnapshotInputSchema,
	type WatchCatalogBeginRequest, type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import { getHboCmsPacket, hboCmsVisitSignal, waitForHboCmsShow } from "./cms-client";
import { buildHboCmsCatalog, type HboCmsEpisode } from "./cms-catalog";
import { getHboMaxDetails, readHboMaxPlaybackMetadata } from "./metadata";
import { loadHboPublicEpisodes } from "./public-seasons";
export { startHboMaxCatalogCapture } from "./metadata";

export function readHboMaxCatalogContext(doc: Document, seriesId: string, playbackId: string): WatchCatalogBeginRequest["context"] | null {
	const metadata = readHboMaxPlaybackMetadata(doc, playbackId);
	if (metadata?.identity.kind !== "episode" || metadata.identity.providerSeriesId !== seriesId ||
		metadata.identity.providerEpisodeIdentifier !== playbackId) return null;
	const packet = getHboCmsPacket(doc, playbackId);
	const parsed = WatchCatalogLocaleContextSchema.safeParse({
		region: null, requestedLocale: doc.documentElement.lang || packet?.locale,
		audioLocale: null, subtitleLocales: [], observedAt: new Date().toISOString(),
	});
	return parsed.success ? parsed.data : null;
}

export async function loadHboMaxCatalog(doc: Document, seriesId: string, playbackId: string, signal: AbortSignal): Promise<WatchCatalogSnapshotInput | null> {
	const context = readHboMaxCatalogContext(doc, seriesId, playbackId);
	if (signal.aborted || !context) return null;
	const visitSignal = hboCmsVisitSignal(doc, playbackId);
	if (!visitSignal) return readHboMaxCatalog(doc, seriesId, playbackId);
	const href = doc.location.href;
	const lifetime = AbortSignal.any([signal, visitSignal]);
	let packet = getHboCmsPacket(doc, playbackId);
	if (!packet?.show) packet = await waitForHboCmsShow(doc, seriesId, playbackId, lifetime);
	// A native player route can supersede an earlier show-page rail during this same visit.
	for (let attempt = 0; attempt < 2 && packet?.show?.seriesId === seriesId; attempt++) {
		if (lifetime.aborted || doc.location.href !== href) return null;
		let episodes = packet.episodes;
		try {
			episodes = await loadHboPublicEpisodes(packet.show, episodes, href, context.requestedLocale, lifetime, doc);
		} catch { /* A public page can be unavailable while its native episode rail remains readable. */ }
		if (lifetime.aborted || doc.location.href !== href) return null;
		const latest = getHboCmsPacket(doc, playbackId);
		if (latest === packet) return catalogSnapshot(doc, seriesId, playbackId, episodes);
		packet = latest;
	}
	return lifetime.aborted || doc.location.href !== href ? null : readHboMaxCatalog(doc, seriesId, playbackId);
}

export function readHboMaxCatalog(doc: Document, seriesId: string, playbackId: string): WatchCatalogSnapshotInput | null {
	return catalogSnapshot(doc, seriesId, playbackId);
}

function catalogSnapshot(doc: Document, seriesId: string, playbackId: string, loaded?: HboCmsEpisode[]): WatchCatalogSnapshotInput | null {
	const context = readHboMaxCatalogContext(doc, seriesId, playbackId);
	if (!context) return null;
	const packet = getHboCmsPacket(doc, playbackId);
	const metadata = readHboMaxPlaybackMetadata(doc, playbackId);
	if (packet?.show?.seriesId === seriesId) {
		const episodes = loaded ?? packet.episodes;
		const active = episodes.find(episode => episode.id === playbackId);
		if (active && active.seasonNumber === metadata?.seasonNumber && active.number === metadata.episodeNumber) {
			const result = buildHboCmsCatalog(packet.show, episodes, playbackId, context,
				new Set(packet.episodes.map(episode => episode.id)));
			if (result) return result;
		}
	}
	const details = getHboMaxDetails(doc);
	if (metadata?.identity.kind !== "episode" || metadata.identity.providerSeriesId !== seriesId || details?.id !== seriesId ||
		!metadata.seasonNumber || details.locale !== doc.documentElement.lang ||
		details.seasons.get(metadata.seasonNumber)?.episodes.get(playbackId)?.number !== metadata.episodeNumber) return null;
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
		context: { ...context, requestedLocale: details.locale },
	});
	return parsed.success ? parsed.data : null;
}
