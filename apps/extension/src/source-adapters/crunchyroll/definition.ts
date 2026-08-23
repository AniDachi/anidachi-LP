import type { SourceAdapterDefinition } from "../core/types";
import { findPlayerContainer } from "../core/video-discovery";
import { CrunchyrollVideoAdapter } from "./adapter";
import { ensureCrunchyrollSource } from "./navigation";
import { crunchyrollHistoryPolicy } from "./progress";

export const crunchyrollDefinition: SourceAdapterDefinition = {
	id: "crunchyroll",
	provider: "crunchyroll",
	priority: 200,
	historyPolicy: crunchyrollHistoryPolicy,
	ensureSource: ensureCrunchyrollSource,
	detect(video) {
		const container = findCrunchyrollPlayerContainer(video);
		return container ? new CrunchyrollVideoAdapter(video, container) : null;
	},
};

function findCrunchyrollPlayerContainer(
	video: HTMLVideoElement,
): HTMLElement | null {
	if (!location.hostname.endsWith("crunchyroll.com")) {
		return null;
	}

	const modernContainer = video.closest<HTMLElement>(
		[
			"#player-container",
			".player-container",
			".bitmovinplayer-container",
			"[data-testid='player-controls-root']",
			".video-player-wrapper",
			"[class*='video-player-wrapper']",
		].join(", "),
	);
	if (modernContainer) {
		if (
			modernContainer.matches(
				".bitmovinplayer-container, [data-testid='player-controls-root']",
			)
		) {
			return (
				modernContainer.closest<HTMLElement>(
					"#player-container, .player-container",
				) ?? modernContainer
			);
		}

		return modernContainer;
	}

	const vilosRoot = video.closest<HTMLElement>("#vilosRoot");
	if (vilosRoot) {
		return vilosRoot;
	}

	const player0 = video.closest<HTMLElement>("#player0");
	if (player0) {
		return player0;
	}

	const platformContainer = video.closest<HTMLElement>(
		[
			"#player-container",
			".player-container",
			".watch-video",
			".video-player-wrapper",
			"[class*='video-player-wrapper']",
			"[class*='VideoPlayer']",
			"[data-testid*='video-player']",
			"[data-testid*='player']",
		].join(", "),
	);
	if (platformContainer) {
		return platformContainer;
	}

	return findPlayerContainer(video);
}
