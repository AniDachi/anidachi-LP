import {
	MAX_WATCH_TITLE_CHARS,
	type PlaybackState,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { Html5VideoAdapter } from "./source-adapters/core/html5-video-adapter";
import {
	canonicalWatchSourceUrl,
	normalizeVideoFingerprint,
} from "./source-adapters/core/source-url";
import type { VideoAdapter } from "./source-adapters/core/types";
import { findBestVideo } from "./source-adapters/core/video-discovery";
import { crunchyrollDefinition } from "./source-adapters/crunchyroll/definition";
import { GenericVideoAdapter } from "./source-adapters/generic/adapter";
import { genericDefinition } from "./source-adapters/generic/definition";
import { youtubeDefinition } from "./source-adapters/youtube/definition";

export type {
	PlayerEvent,
	SeekOptions,
	VideoAdapter,
} from "./source-adapters/core/types";
export {
	canonicalWatchSourceUrl,
	GenericVideoAdapter,
	Html5VideoAdapter,
	normalizeVideoFingerprint,
};

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
		provider: watchProviderFromAdapterId(adapter.id),
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

function watchProviderFromAdapterId(
	adapterId: string,
): WatchSourceDescriptor["provider"] {
	if (adapterId === "crunchyroll") return "crunchyroll";
	if (adapterId === "youtube") return "youtube";
	return "generic";
}

export function findBestVideoAdapter(): VideoAdapter | null {
	const winner = findBestVideo(document);
	if (!winner) {
		return null;
	}

	const youtubeAdapter = youtubeDefinition.detect(winner);
	if (youtubeAdapter) {
		return youtubeAdapter;
	}

	const crunchyrollAdapter = crunchyrollDefinition.detect(winner);
	if (crunchyrollAdapter) {
		return crunchyrollAdapter;
	}

	return genericDefinition.detect(winner);
}
