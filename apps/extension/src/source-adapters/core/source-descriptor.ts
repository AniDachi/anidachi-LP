import {
	MAX_WATCH_TITLE_CHARS,
	type PlaybackState,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { canonicalWatchSourceUrl } from "./source-url";
import type { VideoAdapter } from "./types";

export function buildWatchSourceDescriptor(
	adapter: VideoAdapter,
	state: PlaybackState,
): WatchSourceDescriptor | undefined {
	const sourceUrl = canonicalWatchSourceUrl(state.sourceUrl ?? location.href);
	if (!sourceUrl) {
		return undefined;
	}

	const title = normalizeWatchTitle(
		adapter.getTitle()?.trim() || document.title?.trim() || adapter.name,
	);
	const duration = Number.isFinite(adapter.video.duration)
		? adapter.video.duration
		: undefined;
	return {
		provider: sourceProviderFromAdapterId(adapter.id),
		sourceUrl,
		canonicalUrl: sourceUrl,
		videoFingerprint: state.videoFingerprint,
		title,
		...(duration !== undefined ? { duration } : {}),
	};
}

function normalizeWatchTitle(title: string): string {
	return title.length <= MAX_WATCH_TITLE_CHARS
		? title
		: title.slice(0, MAX_WATCH_TITLE_CHARS);
}

export function sourceProviderFromAdapterId(
	adapterId: string,
): WatchSourceDescriptor["provider"] {
	if (adapterId === "crunchyroll") return "crunchyroll";
	if (adapterId === "youtube") return "youtube";
	return "generic";
}
