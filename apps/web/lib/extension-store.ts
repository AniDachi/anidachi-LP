/**
 * Where the extension runs and how the store rates it, in one place.
 *
 * Browser: positioning copy (title, H1, subhead) names no browser. Only short
 * factual lines such as the meta description and the hero trust row use this
 * label, so a new browser launch is a one-line change here.
 *
 * Rating: copied by hand from the Chrome Web Store listing. Re-check monthly;
 * the hero hides it below `minToShow`, because the sample is still small.
 */
export const EXTENSION_BROWSER_LABEL = "desktop Chrome";

export const CHROME_STORE_RATING = {
  value: 4.6,
  count: 10,
  checkedOn: "2026-11-19",
  minToShow: 4.5,
} as const;

export function shouldShowStoreRating(): boolean {
  return CHROME_STORE_RATING.value >= CHROME_STORE_RATING.minToShow;
}
