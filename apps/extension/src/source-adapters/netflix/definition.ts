import type { SourceAdapterDefinition } from "../core/types";
import {
	resolveCanonicalSourceNavigation,
	withRoomHash,
} from "../core/source-navigation";
import { NetflixVideoAdapter } from "./adapter";
import { netflixWatchId } from "./contract";
import { netflixHistoryPolicy } from "./progress";
export const netflixDefinition: SourceAdapterDefinition = {
	id: "netflix",
	provider: "netflix",
	priority: 200,
	historyPolicy: netflixHistoryPolicy,
	detect(video) {
		if (!netflixWatchId(location.href)) return null;
		const container = video.closest<HTMLElement>('[data-uia="watch-video"]');
		return container ? new NetflixVideoAdapter(video, container) : null;
	},
	async ensureSource(source, context) {
		if (context.roomProvider !== "netflix" || source.provider !== "netflix")
			return { status: "unsupported", reason: "provider-mismatch" };
		if (context.signal.aborted)
			return { status: "failed", reason: "navigation-failed" };
		const result = resolveCanonicalSourceNavigation(
			source,
			location.href,
			"netflix",
		);
		if (!result.ok) return { status: "unsupported", reason: result.reason };
		if (result.alreadyCurrent) return { status: "already-current" };
		const targetUrl = withRoomHash(result.target, context.roomId);
		try {
			location.assign(targetUrl);
			return { status: "navigation-started", targetUrl };
		} catch {
			return { status: "failed", reason: "navigation-failed" };
		}
	},
};
