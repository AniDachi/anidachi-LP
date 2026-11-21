import { hasHboMaxHostname } from "@anidachi/protocol";
import { detectHboMaxAdapter, hbomaxDefinition } from "./hbomax/definition";
import { hasPrimeBrowserHost } from "./primevideo/url";
import { primeVideoDefinition } from "./primevideo/definition";
import type {
	SourceAdapterDefinition,
	SourceProvider,
	VideoAdapter,
} from "./core/types";
import { findBestVideo } from "./core/video-discovery";
import { crunchyrollDefinition } from "./crunchyroll/definition";
import { detectDisneyPlusAdapter, disneyPlusDefinition } from "./disneyplus/definition";
import { isDisneyPlusOrigin } from "./disneyplus/url";
import { netflixDefinition } from "./netflix/definition";
import { genericDefinition } from "./generic/definition";
import { detectYouTubeWatchAdapter, youtubeDefinition } from "./youtube/definition";
import { parseYouTubeVideoId, YOUTUBE_CATALOG_ORIGINS } from "./youtube/url";

const sourceAdapterDefinitions = [
	youtubeDefinition,
	crunchyrollDefinition,
	netflixDefinition,
	primeVideoDefinition,
	disneyPlusDefinition,
	hbomaxDefinition,
	genericDefinition,
] as const satisfies readonly SourceAdapterDefinition[];

export function detectSourceAdapter(
	documentValue: Document = document,
): VideoAdapter | null {
	if (hasHboMaxHostname(location.href)) return detectHboMaxAdapter(documentValue);
	if (isDisneyPlusOrigin(location.href)) return detectDisneyPlusAdapter(documentValue);
	if (hasPrimeBrowserHost(location.href)) {
		const videos = documentValue.querySelectorAll<HTMLVideoElement>("#dv-web-player video");
		return videos.length === 1 ? primeVideoDefinition.detect(videos[0]!) : null;
	}
	const url = new URL(location.href);
	if (YOUTUBE_CATALOG_ORIGINS.includes(url.origin) && /^\/watch\/?$/.test(url.pathname)) {
		return detectYouTubeWatchAdapter(documentValue, parseYouTubeVideoId(url));
	}
	const winner = findBestVideo(documentValue);
	if (!winner) {
		return null;
	}

	// Never fall back to raw HTML5 controls on Netflix previews/unsupported phases.
	if (location.hostname === "www.netflix.com") return netflixDefinition.detect(winner);

	for (const definition of sourceAdapterDefinitions) {
		const adapter = definition.detect(winner);
		if (adapter) {
			return adapter;
		}
	}

	return null;
}

export function getDefinitionForProvider(
	provider: SourceProvider,
): SourceAdapterDefinition | null {
	return (
		sourceAdapterDefinitions.find(
			(definition) => definition.provider === provider,
		) ?? null
	);
}
