import { netflixWatchId } from "./source-adapters/netflix/contract";
import {
	isPrimeRoomBrowsingPage,
	isPrimePlayerPageSender,
	parsePrimePageUrl,
} from "./source-adapters/primevideo/url";

export type CatalogRoomProvider = "netflix" | "primevideo";
export function supportsCatalogRoom(
	provider: unknown,
): provider is CatalogRoomProvider {
	return provider === "netflix" || provider === "primevideo";
}

export function catalogRoomProvider(value: string): CatalogRoomProvider | null {
	if (isPrimeRoomBrowsingPage(value)) return "primevideo";
	try {
		const url = new URL(value);
		if (
			url.origin !== "https://www.netflix.com" ||
			url.username ||
			url.password
		)
			return null;
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
	if (netflixWatchId(value)) return "netflix";
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
			!!netflixWatchId(sender.tab?.url ?? sender.url!))
	);
}
