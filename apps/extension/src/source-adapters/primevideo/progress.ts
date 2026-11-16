import { primeVideoHistoryKeys, primeVideoSourceUrl } from "@anidachi/protocol";
import {
	HISTORY_OBSERVATION_SUSPENDED,
	type SourceAdapterHistoryPolicy,
} from "../core/history-policy";
import { PrimeVideoAdapter } from "./adapter";
export const primeHistoryPolicy: SourceAdapterHistoryPolicy = {
	observe({ adapter }) {
		if (!(adapter instanceof PrimeVideoAdapter)) return null;
		const snapshot = adapter.getPrimeSnapshot();
		if (
			!snapshot ||
			snapshot.phase !== "content" ||
			!snapshot.metadata.identity
		)
			return HISTORY_OBSERVATION_SUSPENDED;
		const { metadata, currentTime, duration } = snapshot,
			identity = metadata.identity!;
		const keys = primeVideoHistoryKeys(identity);
		return {
			provider: "primevideo",
			providerLabel: "Prime Video",
			primevideoIdentity: identity,
			...keys,
			title: metadata.title,
			episodeTitle: metadata.episodeTitle,
			artworkUrl: metadata.artworkUrl,
			seasonTitle: metadata.seasonTitle,
			seasonNumber: metadata.seasonNumber,
			episodeNumber: metadata.episodeNumber,
			sourceUrl: primeVideoSourceUrl(snapshot.contentId),
			currentTime,
			duration,
			progress: currentTime / duration,
		};
	},
};
