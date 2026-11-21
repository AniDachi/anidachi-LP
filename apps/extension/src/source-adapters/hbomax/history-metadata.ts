import {
	hboMaxArtworkUrl, hboMaxPlaybackId, hboMaxHistoryKeys, hboMaxSourceUrl, HboMaxProviderIdSchema, WatchHistoryResponseSchema,
	type WatchHistoryResponse,
} from "@anidachi/protocol";
import { getStoredAuthTokens } from "../../auth-tokens";
import { canCaptureWatchHistory } from "../../watch-history-access";
import { createWatchHistoryStorage, watchHistoryPartitionKey } from "../../watch-history-storage";
import { isHistoryRecordingEnabled } from "../../history-recording-choice";
import type { HboMaxPlaybackMetadata } from "./metadata";

/** A previous verified personal row can identify its own playback on a fresh
 * history Resume. It supplies labels only and cannot prove current availability. */
export function hboMaxMetadataFromHistory(history: WatchHistoryResponse, playbackId: string): HboMaxPlaybackMetadata | null {
	const url = hboMaxSourceUrl(playbackId);
	let match: HboMaxPlaybackMetadata | null = null;
	for (const item of history.items) {
		if (item.provider !== "hbomax") continue;
		const artworkUrl = item.artworkUrl ? hboMaxArtworkUrl(item.artworkUrl) : null;
		if (item.itemKind === "movie") {
			const id = HboMaxProviderIdSchema.safeParse(item.titleKey.split(":")[2]);
			if (!id.success) continue;
			const identity = { kind: "movie" as const, providerMovieId: id.data, providerPlaybackId: playbackId };
			if (item.latestActivity.episodeKey !== hboMaxHistoryKeys(identity).episodeKey || item.sourceUrl !== url || item.titleKey !== hboMaxHistoryKeys(identity).titleKey) continue;
			if (match) return null;
			match = { identity, title: item.title, displayTitle: item.title, artworkUrl, episodeTitle: item.title, seasonTitle: null, seasonNumber: null, episodeNumber: null };
			continue;
		}
		const seriesId = item.titleKey.split(":")[2];
		if (!seriesId || !HboMaxProviderIdSchema.safeParse(seriesId).success) continue;
		const identity = { kind: "episode" as const, providerSeriesId: seriesId, providerEpisodeIdentifier: playbackId };
		for (const season of item.seasons) for (const episode of season.episodes) {
			const keys = hboMaxHistoryKeys(identity, episode.seasonNumber);
			if (item.titleKey !== keys.titleKey || episode.sourceUrl !== url || episode.episodeKey !== keys.episodeKey ||
				episode.seasonKey !== keys.seasonKey) continue;
			if (match) return null;
			match = { identity, title: item.title, displayTitle: item.title + " — " + episode.episodeTitle, artworkUrl, episodeTitle: episode.episodeTitle,
				seasonTitle: episode.seasonTitle, seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber };
		}
	}
	return match;
}

export async function readSavedHboMaxMetadata(owner: string, playbackId: string): Promise<HboMaxPlaybackMetadata | null> {
	if (!await isHistoryRecordingEnabled(owner)) return null;
	const root = await createWatchHistoryStorage().readRoot();
	const generation = root.activeGenerations?.[owner];
	if (generation === undefined) return null;
	const partition = root.partitions[watchHistoryPartitionKey(owner, generation)];
	if (!partition || partition.ownerUserId !== owner || partition.accountGeneration !== generation || !partition.preferencesConfirmed ||
		!canCaptureWatchHistory(partition.accessLease, owner, Date.now(), "hbomax")) return null;
	const history = WatchHistoryResponseSchema.safeParse(partition.cache);
	if (!history.success || history.data.meta.ownerUserId !== owner || history.data.meta.accountGeneration !== generation) return null;
	return hboMaxMetadataFromHistory(history.data, playbackId);
}

export async function handleHboMaxSavedMetadata(sender: chrome.runtime.MessageSender): Promise<HboMaxPlaybackMetadata | null> {
	const id = hboMaxPlaybackId(sender.url ?? "");
	if (!id || sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id === undefined ||
		(sender.origin !== undefined && sender.origin !== "https://www.hbomax.com")) return null;
	const session = await getStoredAuthTokens();
	if (!session?.authSessionId || !session.user.id) return null;
	const metadata = await readSavedHboMaxMetadata(session.user.id, id);
	if (!metadata) return null;
	const current = await getStoredAuthTokens();
	return current?.user.id === session.user.id && current.authSessionId === session.authSessionId &&
		hboMaxPlaybackId((await chrome.tabs.get(sender.tab.id)).url ?? "") === id ? metadata : null;
}
