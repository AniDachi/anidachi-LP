import type { WatchSourceDescriptor } from "@anidachi/protocol";
import {
	resolveCanonicalSourceNavigation,
	withRoomHash,
} from "../core/source-navigation";
import type {
	EnsureSourceResult,
	SourceNavigationContext,
} from "../core/types";

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

		const navigation = resolveCanonicalSourceNavigation(
			source,
			environment.currentHref(),
			"youtube",
		);
		if (!navigation.ok) {
			return { status: "unsupported", reason: navigation.reason };
		}
		if (navigation.alreadyCurrent) {
			return { status: "already-current" };
		}
		const targetUrl = withRoomHash(navigation.target, context.roomId);
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
