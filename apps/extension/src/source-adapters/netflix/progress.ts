import {
	HISTORY_OBSERVATION_SUSPENDED,
	type SourceAdapterHistoryPolicy,
} from "../core/history-policy";
import { NetflixVideoAdapter } from "./adapter";
import { netflixWatchId } from "./contract";
export const netflixHistoryPolicy: SourceAdapterHistoryPolicy = {
	observe({ adapter }) {
		if (
			!(adapter instanceof NetflixVideoAdapter) ||
			!netflixWatchId(location.href)
		)
			return null;
		const snapshot = adapter.getNetflixSnapshot();
		if (!snapshot) return HISTORY_OBSERVATION_SUSPENDED;
		const { metadata, movieId, currentTime, duration } = snapshot;
		const identity = metadata.identity;
		const episode = identity.kind === "episode";
		const key = `netflix:${episode ? "episode" : "movie"}:${movieId}`;
		return {
			provider: "netflix",
			providerLabel: "Netflix",
			netflixIdentity: identity,
			titleKey: episode ? `netflix:series:${identity.providerSeriesId}` : key,
			itemKind: episode ? "series" : "movie",
			title: metadata.title,
			artworkUrl: metadata.artworkUrl,
			episodeKey: key,
			episodeTitle: metadata.episodeTitle,
			seasonKey: episode
				? `netflix:season:${identity.providerSeasonIdentifier}`
				: null,
			seasonTitle: metadata.seasonTitle,
			seasonNumber: metadata.seasonNumber,
			episodeNumber: metadata.episodeNumber,
			sourceUrl: `https://www.netflix.com/watch/${movieId}`,
			currentTime,
			duration,
			progress: currentTime / duration,
		};
	},
};
