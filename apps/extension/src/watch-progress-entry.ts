import type { VideoAdapter } from "./source-adapters/core/types";
import { getCrunchyrollProgressEntry } from "./source-adapters/crunchyroll/progress";
import { getYouTubeProgressEntry } from "./source-adapters/youtube/progress";
import type { WatchProgressEntry } from "./watch-progress";

interface WatchProgressEntryInput {
	adapter: VideoAdapter;
	roomId?: string;
	watchedWithCount: number;
}

export function getWatchProgressEntryForAdapter(
	input: WatchProgressEntryInput,
): WatchProgressEntry | null {
	if (input.adapter.id === "crunchyroll") {
		return getCrunchyrollProgressEntry({
			title: input.adapter.getTitle(),
			video: input.adapter.video,
			roomId: input.roomId,
			watchedWithCount: input.watchedWithCount,
		});
	}

	if (input.adapter.id === "youtube") {
		return getYouTubeProgressEntry({
			title: input.adapter.getTitle(),
			video: input.adapter.video,
			roomId: input.roomId,
			watchedWithCount: input.watchedWithCount,
		});
	}

	return null;
}
