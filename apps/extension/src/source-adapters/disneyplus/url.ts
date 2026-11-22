import { disneyPlusPlaybackId, disneyPlusRouteLocale } from "@anidachi/protocol";

export const DISNEY_PLUS_ORIGIN = "https://www.disneyplus.com";
export const disneyPlusWatchId = disneyPlusPlaybackId;

export function isDisneyPlusOrigin(href: string): boolean {
  return /^https:\/\/www\.disneyplus\.com(?:\/|$)/.test(href) &&
    !/[\\\s\x00-\x1f\x7f]/.test(href);
}

/** Both source and destination keep the one supported www.disneyplus.com origin. */
export function localizeDisneyPlusWatchUrl(target: URL, currentHref: string): URL {
  const playbackId = disneyPlusWatchId(target.href);
  if (!playbackId || !isDisneyPlusOrigin(currentHref)) throw new Error("Invalid Disney+ navigation");
  const locale = disneyPlusRouteLocale(new URL(currentHref).pathname);
  return new URL(`${locale ? "/" + locale : ""}/play/${playbackId}`, DISNEY_PLUS_ORIGIN);
}
