import type { VideoAdapter } from "./source-adapters/core/types";

export type CurrentResourceDisplay = {
	provider: VideoAdapter["provider"];
	providerLabel: string;
	title: string;
	episodeTitle: string | null;
	itemKind: "series" | "movie";
	currentTime: number;
	duration: number;
	progress: number;
};

/** Ephemeral player UI only: no history policy, discovery, or persistence. */
export function readCurrentResourceDisplay(
	adapter: VideoAdapter,
): CurrentResourceDisplay | null {
	const playback = adapter.getPlaybackSnapshot();
	if (playback.phase !== "content") return null;
	const source = adapter.getSourceDescriptor();
	const duration = adapter.video.duration;
	if (
		!source ||
		!Number.isFinite(duration) ||
		duration <= 0 ||
		!Number.isFinite(playback.contentTime)
	)
		return null;
	return {
		provider: source.provider,
		providerLabel: adapter.name,
		title: source.seriesTitle ?? source.title,
		episodeTitle: source.episodeTitle ?? null,
		itemKind: source.seriesTitle ? "series" : "movie",
		currentTime: playback.contentTime,
		duration,
		progress: Math.max(0, Math.min(1, playback.contentTime / duration)),
	};
}
