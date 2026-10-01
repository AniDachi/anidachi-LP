// Provider selectors stay here; the shared overlay owns only the state marker.
const guardedPlayers = [
	'html[data-anidachi-composer-open] [data-anidachi-adapter="youtube"]:not(.ad-showing)',
	'[data-anidachi-adapter="youtube"][data-anidachi-composer-open]:not(.ad-showing)',
];
const chrome = [
	".ytp-chrome-top",
	".ytp-chrome-bottom",
	".ytp-progress-bar-container",
	".ytp-gradient-top",
	".ytp-gradient-bottom",
	".ytp-bezel",
	".ytp-tooltip",
];

// Descendants can explicitly restore pointer-events/visibility in YouTube's CSS.
// Never hide the video, captions, ads, buffering/errors, or the AniDachi overlay.
const selectors = guardedPlayers.flatMap((player) =>
	chrome.flatMap((part) => [`${player} ${part}`, `${player} ${part} *`]),
);
export const YOUTUBE_COMPOSER_CHROME_STYLES = `
  ${selectors.join(",\n  ")} {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    transition: none !important;
  }
`;
