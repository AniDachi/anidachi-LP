import { parsePrimePageUrl, primeDomainFamily } from "@anidachi/protocol";
export { parsePrimePageUrl };
export { PRIME_VIDEO_DOMAIN_ROOTS, PRIME_CONTENT_MATCHES, hasPrimeBrowserHost, primeObservedLink, primeRouteMatches } from "@anidachi/protocol";
export type { PrimeRoute } from "@anidachi/protocol";

/** Places where an existing Prime room can accompany its owner between titles. */
export function isPrimeRoomBrowsingPage(value: string): boolean {
  try {
    const url = new URL(value);
    const family = primeDomainFamily(url.hostname);
    if (!family || url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const path = url.pathname
      .replace(/^\/region\/[a-z0-9-]{2,16}(?=\/|$)/i, "")
      .replace(/^(?:\/-\/[a-z]{2,3}(?:[_-][a-z]{2})?|\/[a-z]{2,3}[_-][a-z]{2})(?=\/|$)/i, "");
    if (family === "primevideo.com")
      return !!parsePrimePageUrl(value) || /^(?:\/?$|\/(?:storefront|collection|genre|search|category|watchlist|movie|tv|sports|home|offers|addons)(?:\/|$))/i.test(path);
    // Retail product pages also use /dp/ASIN. Only the actual player can
    // establish Prime ownership there; the URL cannot authorize a browsing call.
    return /^\/Amazon-Video(?:\/|$)/.test(path) ||
      /^\/gp\/video(?:\/?$|\/(?:storefront|search|watchlist|genre|collection|category)(?:\/|$))/.test(path) ||
      (path.startsWith("/gp/video/detail/") && !!parsePrimePageUrl(value));
  } catch {
    return false;
  }
}

/** Chrome keeps the content script's initial URL after same-document navigation. */
export function isPrimePlayerPageSender(sender: chrome.runtime.MessageSender): boolean {
  return isPrimePageSender(sender, value => parsePrimePageUrl(value) !== null);
}

export function isPrimeBrowsingSender(sender: chrome.runtime.MessageSender): boolean {
  return isPrimePageSender(sender, isPrimeRoomBrowsingPage);
}

function isPrimePageSender(sender: chrome.runtime.MessageSender, matches: (value: string) => boolean): boolean {
  if (!sender.url || sender.tab?.id === undefined || sender.frameId !== 0) return false;
  const url = sender.tab.url ?? sender.url;
  if (!matches(url)) return false;
  const origin = new URL(url).origin;
  return sender.url.startsWith(origin + "/") && (sender.origin === undefined || sender.origin === origin);
}
