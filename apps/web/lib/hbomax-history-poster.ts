import { HBO_MAX_ORIGIN } from "@anidachi/protocol";

const imageOrigin = "https://beam-images.warnermediacdn.com";
const maxPageBytes = 6 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scriptData(html: string, id: "__NEXT_DATA__" | "__DOTCOM_GEO__") {
  const match = new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, "i").exec(html);
  return match ? record(JSON.parse(match[1])) : {};
}

function titlePoster(html: string, path: string, id: string) {
  const page = record(record(scriptData(html, "__NEXT_DATA__").props).pageProps);
  if (page.canonicalURL !== HBO_MAX_ORIGIN + path) return null;
  for (const value of Object.values(record(page.mappedData))) {
    const row = record(value);
    if (row.hbomaxId !== id || row.imageUrlLink !== path) continue;
    const source = record(row.images)["poster-with-logo"];
    if (typeof source !== "string" || !URL.canParse(source)) continue;
    const url = new URL(source);
    if (url.origin !== imageOrigin || !url.pathname.startsWith(`/BEAM_LWM_DELIVERABLES/${id}/`)) continue;
    const poster = new URL(url.pathname, imageOrigin);
    poster.search = "host=wbd-images.prod-vod.h264.io&partner=beamcom&w=500";
    return poster.href;
  }
  return null;
}

async function storefrontPage(path: string, signal: AbortSignal, request: typeof fetch) {
  const response = await request(HBO_MAX_ORIGIN + path, { signal, redirect: "error", cache: "no-store" });
  if (!response.ok && response.status !== 404) throw new Error("HBO storefront unavailable");
  if (!response.headers.get("content-type")?.includes("text/html") || !response.body) throw new Error("Expected HBO storefront HTML");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return html + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxPageBytes) {
      await reader.cancel();
      throw new Error("HBO storefront page exceeds size limit");
    }
    html += decoder.decode(value, { stream: true });
  }
}

export async function resolveHboMaxHistoryPoster(kind: "series" | "movie", id: string, request = fetch) {
  const path = `/${kind === "series" ? "show" : "movie"}/${id}`;
  const signal = AbortSignal.timeout(10000);
  const html = await storefrontPage(path, signal, request);
  const poster = titlePoster(html, path, id);
  if (poster) return poster;

  // A title unavailable in the default storefront can still advertise its regional pages.
  const geo = record(scriptData(html, "__DOTCOM_GEO__").pageLocales);
  if (geo.pathname !== path || !Array.isArray(geo.availableLocales)) return null;
  const locales = geo.availableLocales.filter((locale): locale is string =>
    typeof locale === "string" && locale !== "us/en" && /^[a-z]{2}\/[a-z]{2}(?:-[a-z]{2,4})?$/i.test(locale));
  const locale = locales.find(value => value.endsWith("/en")) ?? locales[0];
  if (!locale) return null;
  const regional = `/${locale}${path}`;
  return titlePoster(await storefrontPage(regional, signal, request), regional, id);
}
