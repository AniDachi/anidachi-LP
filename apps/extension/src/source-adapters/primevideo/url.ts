import { parsePrimePageUrl } from "@anidachi/protocol";
export { parsePrimePageUrl };
export { PRIME_VIDEO_DOMAIN_ROOTS, PRIME_CONTENT_MATCHES, hasPrimeBrowserHost, primeObservedLink, primeRouteMatches } from "@anidachi/protocol";
export type { PrimeRoute } from "@anidachi/protocol";

/** Chrome keeps the content script's initial URL after same-document navigation. */
export function isPrimePlayerPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (!sender.url || sender.tab?.id === undefined || sender.frameId !== 0) return false;
  const route = parsePrimePageUrl(sender.tab.url ?? sender.url);
  if (!route) return false;
  const origin = route.url.origin;
  return sender.url.startsWith(origin + "/") && (sender.origin === undefined || sender.origin === origin);
}
