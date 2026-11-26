import { hboMaxHistoryKeys, hboMaxPlaybackId } from "@anidachi/protocol";
import { HISTORY_OBSERVATION_SUSPENDED, type SourceAdapterHistoryPolicy } from "../core/history-policy";
import { readHboMaxPlaybackMetadata } from "./metadata";

export const hboMaxHistoryPolicy: SourceAdapterHistoryPolicy = {
	observe({ adapter }) {
		if (adapter.provider !== "hbomax") return null;
		const doc = adapter.video.ownerDocument;
		const watchId = hboMaxPlaybackId(doc.location.href);
		if (!watchId) return null;
		const timeline = adapter.getPlaybackSnapshot();
		const source = adapter.getSourceDescriptor();
		if (timeline.phase !== "content" || !source || hboMaxPlaybackId(source.sourceUrl) !== watchId)
			return HISTORY_OBSERVATION_SUSPENDED;
		const metadata = readHboMaxPlaybackMetadata(doc, watchId);
		const duration = source.duration;
		const currentTime = timeline.contentTime;
		if (!metadata || !duration || !Number.isFinite(duration) || !Number.isFinite(currentTime) ||
			duration <= 0 || currentTime < 0 || currentTime > duration) return HISTORY_OBSERVATION_SUSPENDED;
		const { identity, displayTitle, ...labels } = metadata;
		return {
			provider: "hbomax", providerLabel: "HBO Max", hbomaxIdentity: identity,
			...hboMaxHistoryKeys(identity, metadata.seasonNumber), ...labels,
			sourceUrl: source.sourceUrl, currentTime, duration, progress: currentTime / duration,
		};
	},
};
