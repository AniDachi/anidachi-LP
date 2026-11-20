// Only observed native SDK wrappers; Shadow DOM composer controls are unaffected.
export const PRIME_COMPOSER_CHROME_STYLES = `
html[data-anidachi-composer-open] [data-anidachi-adapter="primevideo"] :is(button, [role="slider"], .atvwebplayersdk-title-text, .atvwebplayersdk-episode-timing-container, .atvwebplayersdk-episode-info),
[data-anidachi-adapter="primevideo"][data-anidachi-composer-open] :is(button, [role="slider"], .atvwebplayersdk-title-text, .atvwebplayersdk-episode-timing-container, .atvwebplayersdk-episode-info) {
  opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;
}
`;
