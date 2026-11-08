/**
 * Where analytics may run, and which visits are automated.
 * Browser-only helpers: both return safe defaults during SSR.
 */

/** The only host whose traffic belongs in the production GA4 / Amplitude data. */
export const ANALYTICS_PRODUCTION_HOST = "www.anidachi.app";

/** Screen sizes seen only on the Singapore/China crawler and headless browsers. */
const BOT_SCREEN_SIZES = new Set(["1280x1200", "1366x1366", "800x600"]);

export function isProductionAnalyticsHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === ANALYTICS_PRODUCTION_HOST;
}

export function isLikelyBot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = window.navigator;
    if (nav.webdriver === true) return true;
    if (/HeadlessChrome|PhantomJS/i.test(nav.userAgent || "")) return true;
    const size = `${window.screen?.width}x${window.screen?.height}`;
    return BOT_SCREEN_SIZES.has(size);
  } catch {
    return false;
  }
}

/**
 * Inline script for the root layout. Loads GA4 only on the production host and
 * tags automated visits with traffic_type "bot" so a GA4 data filter can drop them.
 * Keep in sync with isLikelyBot() above.
 */
export function buildGaBootstrapScript(measurementId: string): string {
  const id = JSON.stringify(measurementId);
  return `
(function(){
  if (location.hostname !== ${JSON.stringify(ANALYTICS_PRODUCTION_HOST)}) return;
  var bot = false;
  try {
    var n = navigator;
    bot = n.webdriver === true || /HeadlessChrome|PhantomJS/i.test(n.userAgent || "") ||
      ${JSON.stringify([...BOT_SCREEN_SIZES])}.indexOf(screen.width + "x" + screen.height) !== -1;
  } catch (e) {}
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ${id};
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", ${id}, bot ? { traffic_type: "bot" } : {});
})();`;
}
