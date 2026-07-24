import type { WatchSourceDescriptor } from "@anidachi/protocol";
import { withRoomHash } from "../core/source-navigation";
import type {
	EnsureSourceResult,
	SourceNavigationContext,
} from "../core/types";
import {
	isYouTubeProviderHost,
	isYouTubeWatchPage,
	parseYouTubeVideoId,
} from "./url";

interface YouTubeNavigationEnvironment {
	assign(url: string): void;
	currentHref(): string;
}

type YouTubeSourceNavigator = (
	source: WatchSourceDescriptor,
	context: SourceNavigationContext,
) => Promise<EnsureSourceResult>;

export function createYouTubeSourceNavigator(
	environment: YouTubeNavigationEnvironment,
): YouTubeSourceNavigator {
	return async (source, context) => {
		if (
			source.provider !== "youtube" ||
			context.roomProvider !== "youtube"
		) {
			return { status: "unsupported", reason: "provider-mismatch" };
		}
		if (context.signal.aborted) {
			return { status: "failed", reason: "navigation-failed" };
		}

		const validated = validateYouTubeSource(source);
		if (!validated.ok) {
			return { status: "unsupported", reason: validated.reason };
		}

		const currentVideoId = getCurrentYouTubeVideoId(environment.currentHref());
		if (currentVideoId === validated.videoId) {
			return { status: "already-current" };
		}

		const target = new URL("https://www.youtube.com/watch");
		target.searchParams.set("v", validated.videoId);
		const targetUrl = withRoomHash(target, context.roomId);
		if (context.signal.aborted) {
			return { status: "failed", reason: "navigation-failed" };
		}

		try {
			environment.assign(targetUrl);
			return { status: "navigation-started", targetUrl };
		} catch {
			return { status: "failed", reason: "navigation-failed" };
		}
	};
}

export const ensureYouTubeSource = createYouTubeSourceNavigator({
	assign: (url) => location.assign(url),
	currentHref: () => location.href,
});

function validateYouTubeSource(
	source: WatchSourceDescriptor,
):
	| { ok: true; videoId: string }
	| {
			ok: false;
			reason: "provider-mismatch" | "invalid-source" | "unsupported-route";
	  } {
	let sourceUrl: URL;
	let canonicalUrl: URL;
	try {
		sourceUrl = new URL(source.sourceUrl);
		canonicalUrl = new URL(source.canonicalUrl);
	} catch {
		return { ok: false, reason: "invalid-source" };
	}

	if (
		!isYouTubeProviderHost(sourceUrl.hostname) ||
		!isYouTubeProviderHost(canonicalUrl.hostname)
	) {
		return { ok: false, reason: "provider-mismatch" };
	}
	if (!isYouTubeWatchPage(sourceUrl) || !isYouTubeWatchPage(canonicalUrl)) {
		return { ok: false, reason: "unsupported-route" };
	}

	const sourceVideoId = parseYouTubeVideoId(sourceUrl);
	const canonicalVideoId = parseYouTubeVideoId(canonicalUrl);
	if (!sourceVideoId || !canonicalVideoId || sourceVideoId !== canonicalVideoId) {
		return { ok: false, reason: "invalid-source" };
	}
	if (source.videoFingerprint !== `youtube|${canonicalVideoId}`) {
		return { ok: false, reason: "invalid-source" };
	}

	return { ok: true, videoId: canonicalVideoId };
}

function getCurrentYouTubeVideoId(currentHref: string): string | null {
	try {
		return parseYouTubeVideoId(new URL(currentHref));
	} catch {
		return null;
	}
}
