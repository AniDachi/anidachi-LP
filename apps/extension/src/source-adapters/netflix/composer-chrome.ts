// Netflix mounts these controls lazily; CSS also covers controls inserted while typing.
export const NETFLIX_COMPOSER_CHROME_STYLES = `
html[data-anidachi-composer-open] [data-anidachi-adapter="netflix"] [data-uia="controls-standard"],
html[data-anidachi-composer-open] [data-anidachi-adapter="netflix"] [data-uia="control-nav-back"],
html[data-anidachi-composer-open] [data-anidachi-adapter="netflix"] [data-uia="control-flag"],
[data-anidachi-adapter="netflix"][data-anidachi-composer-open] [data-uia="controls-standard"],
[data-anidachi-adapter="netflix"][data-anidachi-composer-open] [data-uia="control-nav-back"],
[data-anidachi-adapter="netflix"][data-anidachi-composer-open] [data-uia="control-flag"] {
  opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
}
`;
