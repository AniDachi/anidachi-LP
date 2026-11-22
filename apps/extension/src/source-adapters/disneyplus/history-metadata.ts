import {
	disneyPlusHistoryKeys, disneyPlusSourceUrl, DisneyPlusProviderIdSchema, WatchHistoryResponseSchema,
	type WatchHistoryResponse,
} from "@anidachi/protocol";
import { canCaptureWatchHistory } from "../../watch-history-access";
import { createWatchHistoryStorage, watchHistoryPartitionKey } from "../../watch-history-storage";
import { isHistoryRecordingEnabled } from "../../history-recording-choice";
import type { DisneyPlusPlaybackMetadata } from "./metadata";

/** A previous verified personal row can identify its own playback on a fresh
 * history Resume. It supplies labels only and cannot prove current availability. */
export function disneyPlusMetadataFromHistory(history: WatchHistoryResponse, playbackId: string): DisneyPlusPlaybackMetadata | null {
	const url = disneyPlusSourceUrl(playbackId);
	let match: DisneyPlusPlaybackMetadata | null = null;
	for (const item of history.items) {
		if (item.provider !== "disneyplus") continue;
		const artworkUrl = item.artworkUrl?.startsWith("https://disney.images.edge.bamgrid.com/") ? item.artworkUrl : null;
		if (item.itemKind === "movie") {
			const identity = { kind: "movie" as const, providerMovieId: playbackId };
			if (item.sourceUrl !== url || item.titleKey !== disneyPlusHistoryKeys(identity).titleKey) continue;
			if (match) return null;
			match = { identity, title: item.title, artworkUrl, episodeTitle: item.title, seasonTitle: null, seasonNumber: null, episodeNumber: null };
			continue;
		}
		const seriesId = item.titleKey.split(":")[2];
		if (!seriesId || !DisneyPlusProviderIdSchema.safeParse(seriesId).success) continue;
		const identity = { kind: "episode" as const, providerSeriesId: seriesId, providerEpisodeIdentifier: playbackId };
		for (const season of item.seasons) for (const episode of season.episodes) {
			const keys = disneyPlusHistoryKeys(identity, episode.seasonNumber);
			if (item.titleKey !== keys.titleKey || episode.sourceUrl !== url || episode.episodeKey !== keys.episodeKey ||
				episode.seasonKey !== keys.seasonKey) continue;
			if (match) return null;
			match = { identity, title: item.title, artworkUrl, episodeTitle: episode.episodeTitle,
				seasonTitle: episode.seasonTitle, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber };
		}
	}
	return match;
}

export async function readSavedDisneyPlusMetadata(owner: string, playbackId: string): Promise<DisneyPlusPlaybackMetadata | null> {
	if (!await isHistoryRecordingEnabled(owner)) return null;
	const root = await createWatchHistoryStorage().readRoot();
	const generation = root.activeGenerations?.[owner];
	if (generation === undefined) return null;
	const partition = root.partitions[watchHistoryPartitionKey(owner, generation)];
	if (!partition || partition.ownerUserId !== owner || partition.accountGeneration !== generation || !partition.preferencesConfirmed ||
		!canCaptureWatchHistory(partition.accessLease, owner, Date.now(), "disneyplus")) return null;
	const history = WatchHistoryResponseSchema.safeParse(partition.cache);
	if (!history.success || history.data.meta.ownerUserId !== owner || history.data.meta.accountGeneration !== generation) return null;
	return disneyPlusMetadataFromHistory(history.data, playbackId);
}
