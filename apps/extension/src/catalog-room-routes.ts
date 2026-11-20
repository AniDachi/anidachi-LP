import { canonicalizeRoomSourceUrl } from "@anidachi/protocol";
import { isCrunchyrollCatalogOrigin, crunchyrollCatalogPath, localizedWatchUrl } from "./source-adapters/crunchyroll/url";
import { YOUTUBE_CATALOG_ORIGINS, isYouTubeCatalogPath, youtubePageWatchSource } from "./source-adapters/youtube/url";
import { netflixWatchId } from "./source-adapters/netflix/contract";
import {
	isPrimeRoomBrowsingPage,
	isPrimePlayerPageSender,
	parsePrimePageUrl,
} from "./source-adapters/primevideo/url";

export type CatalogRoomProvider = "netflix" | "primevideo" | "crunchyroll" | "youtube";

export function supportsCatalogReturn(provider: unknown): provider is Exclude<CatalogRoomProvider, "primevideo"> {
	return provider === "netflix" || provider === "crunchyroll" || provider === "youtube";
}

export function catalogWatchSource(provider: unknown, href: string) {
	if (!supportsCatalogReturn(provider)) return null;
	const result = canonicalizeRoomSourceUrl(href, provider);
	return result.ok ? result.source : null;
}

/** All callers pass the canonical room source URL. YouTube stores its ID in the query. */
export function catalogContentId(canonicalUrl: string) {
	const url = new URL(canonicalUrl);
	return url.searchParams.get("v") ?? url.pathname.split("/").at(-1);
}

export function catalogWatchDestination(sourceUrl: string, currentHref: string) {
	const target = new URL(sourceUrl);
	return isCrunchyrollCatalogOrigin(target.origin) ? localizedWatchUrl(target, currentHref).href : target.href;
}

export function supportsCatalogRoom(
	provider: unknown,
): provider is CatalogRoomProvider {
	return supportsCatalogReturn(provider) || provider === "primevideo";
}

export function catalogRoomProvider(value: string): CatalogRoomProvider | null {
	if (isPrimeRoomBrowsingPage(value)) return "primevideo";
	try {
		const url = new URL(value);
		if (url.username || url.password) return null;
		if (YOUTUBE_CATALOG_ORIGINS.includes(url.origin)) {
			return isYouTubeCatalogPath(url.pathname) || youtubePageWatchSource(url) ? "youtube" : null;
		}
		if (isCrunchyrollCatalogOrigin(url.origin)) {
			return crunchyrollCatalogPath(url.pathname) || catalogWatchSource("crunchyroll", value) ? "crunchyroll" : null;
		}
		if (url.origin !== "https://www.netflix.com") return null;
		const catalog =
			/^\/(?:browse(?:\/[^/]+)*|search|latest|title\/[1-9][0-9]{0,19})\/?$/.test(
				url.pathname,
			);
		return catalog || netflixWatchId(value) ? "netflix" : null;
	} catch {
		return null;
	}
}

export function catalogPlayerProvider(
	value: string,
): CatalogRoomProvider | null {
	try {
		if (youtubePageWatchSource(new URL(value))) return "youtube";
	} catch {
		return null;
	}
	if (netflixWatchId(value)) return "netflix";
	if (catalogWatchSource("crunchyroll", value)) return "crunchyroll";
	return parsePrimePageUrl(value) ? "primevideo" : null;
}

export function isCatalogRoomSender(sender: chrome.runtime.MessageSender) {
	const url = sender.tab?.url ?? sender.url;
	if (
		!url ||
		!sender.url ||
		sender.tab?.id === undefined ||
		sender.frameId !== 0 ||
		!catalogRoomProvider(url)
	)
		return false;
	const origin = new URL(url).origin;
	return (
		sender.url.startsWith(origin + "/") &&
		(sender.origin === undefined || sender.origin === origin)
	);
}

export function isCatalogPlayerSender(sender: chrome.runtime.MessageSender) {
	return (
		isPrimePlayerPageSender(sender) ||
		(isCatalogRoomSender(sender) &&
			supportsCatalogReturn(catalogPlayerProvider(sender.tab?.url ?? sender.url!)))
	);
}
