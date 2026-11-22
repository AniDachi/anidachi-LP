import { disneyPlusHistoryKeys, disneyPlusPlaybackId } from "@anidachi/protocol";
import { HISTORY_OBSERVATION_SUSPENDED, type SourceAdapterHistoryPolicy } from "../core/history-policy";
import { readDisneyPlusPlaybackMetadata } from "./metadata";

export const disneyPlusHistoryPolicy: SourceAdapterHistoryPolicy = {
	observe({ adapter }) {
		if (adapter.provider !== "disneyplus") return null;
		const doc = adapter.video.ownerDocument;
		const watchId = disneyPlusPlaybackId(doc.location.href);
		if (!watchId) return null;
		const timeline = adapter.getPlaybackSnapshot();
		const source = adapter.getSourceDescriptor();
		if (timeline.phase !== "content" || !source || disneyPlusPlaybackId(source.sourceUrl) !== watchId)
			return HISTORY_OBSERVATION_SUSPENDED;
		const metadata = readDisneyPlusPlaybackMetadata(doc, watchId);
		const duration = source.duration;
		const currentTime = timeline.contentTime;
		if (!metadata || !duration || !Number.isFinite(duration) || !Number.isFinite(currentTime) ||
			duration <= 0 || currentTime < 0 || currentTime > duration) return HISTORY_OBSERVATION_SUSPENDED;
		const { identity, ...labels } = metadata;
		return {
			provider: "disneyplus", providerLabel: "Disney+", disneyplusIdentity: identity,
			...disneyPlusHistoryKeys(identity, metadata.seasonNumber), ...labels,
			sourceUrl: source.sourceUrl, currentTime, duration, progress: currentTime / duration,
		};
	},
};
