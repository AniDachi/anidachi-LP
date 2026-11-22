import type { WatchHistoryResponse } from "@anidachi/protocol";
import { unstable_cache } from "next/cache";

const nextData = /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i;
const netflixKey = /^netflix:(?:movie|series):([0-9]{1,12})$/;
const disneyKey = /^disneyplus:(series|movie):([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i;

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function netflixPoster(html: string, id: string): string | null {
  const json = nextData.exec(html)?.[1];
  if (!json) return null;
  const entities = object(object(object(JSON.parse(json)).props).apolloState);
  const title = object(entities["NetflixOriginal:" + id]);
  if (String(title.id) !== id) return null;
  for (const [key, reference] of Object.entries(title)) {
    if (!key.startsWith("image(")) continue;
    const image = object(entities[String(object(reference).__ref)]);
    if (image.type === "boxshot" && typeof image.url === "string" &&
      /^https:\/\/dnm\.nflximg\.net\/api\/v6\/[\w./?=&%-]+$/.test(image.url)) return image.url;
  }
  return null;
}

function huluPoster(html: string, id: string): string | null {
  for (const match of html.matchAll(/https:\/\/img[1-4]\.hulu\.com\/user\/v3\/artwork\/[a-f\d-]+\?[^"'\s<>\\]+/gi)) {
    const url = new URL(match[0].replaceAll("&amp;", "&"));
    if (url.pathname !== "/user/v3/artwork/" + id || !url.searchParams.has("base_image")) continue;
    const size = /^(\d+)x(\d+)$/.exec(url.searchParams.get("size") ?? "");
    if (size && Number(size[1]) * 3 === Number(size[2]) * 2) return url.href;
  }
  return null;
}

async function readPage(url: string, request: typeof fetch, signal: AbortSignal): Promise<string | null> {
  const options: RequestInit = { signal, redirect: "manual", cache: "no-store", headers: { Accept: "text/html" } };
  let response = await request(url, options);
  // Some storefronts canonicalize the ID-only path to a localized title slug.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    const dest = location && new URL(location, url);
    if (!dest || dest.origin !== new URL(url).origin) return null;
    response = await request(dest.href, options);
  }
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/html")) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return html + decoder.decode();
    bytes += chunk.value.length;
    if (bytes > 6 * 1024 * 1024) { await reader.cancel(); return null; }
    html += decoder.decode(chunk.value, { stream: true });
  }
}

function titleSlug(title: string) {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
}

function disneyStorefrontSlug(html: string, id: string) {
  const json = nextData.exec(html)?.[1];
  if (!json) return "";
  const page = object(object(object(JSON.parse(json)).props).pageProps);
  if (page.pageId !== "entity-" + id) return "";
  const blocks = object(page.stitchDocument).mainContent;
  if (!Array.isArray(blocks)) return "";
  const hero = blocks.map(object).find(block => block._type === "DetailEntityHero");
  const title = object(hero?.backgroundImage).alt;
  return typeof title === "string" ? titleSlug(title) : "";
}

export async function resolveHistoryPortrait(key: string, slug = "", request = fetch) {
  const signal = AbortSignal.timeout(4200);
  const netflix = netflixKey.exec(key);
  if (netflix) {
    const page = await readPage("https://media.netflix.com/en/only-on-netflix/" + netflix[1], request, signal);
    return page ? netflixPoster(page, netflix[1]!) : null;
  }
  const disney = disneyKey.exec(key);
  if (!disney) return null;
  const id = disney[2]!;
  const path = disney[1] === "series" ? "series" : "movie";
  async function fromHulu(name: string) {
    const page = await readPage("https://www.hulu.com/" + path + "/" + name + "-" + id, request, signal);
    return page ? huluPoster(page, id) : null;
  }
  // Hulu serves the native key art on its slug-and-ID storefront URL.
  if (slug && /^[a-z0-9-]{1,160}$/.test(slug)) {
    const poster = await fromHulu(slug);
    if (poster) return poster;
  }
  const disneyPage = await readPage("https://www.disneyplus.com/en-us/browse/entity-" + id, request, signal);
  const english = disneyPage && disneyStorefrontSlug(disneyPage, id);
  return english && english !== slug ? fromHulu(english) : null;
}

const cachedPortrait = unstable_cache(resolveHistoryPortrait, ["history-title-portrait-v2"], { revalidate: 86400 });

export async function withTitlePortraits(history: WatchHistoryResponse): Promise<WatchHistoryResponse> {
  const items = [...history.items];
  const pending = items.flatMap((item, index) => {
    if (!disneyKey.test(item.titleKey) && !netflixKey.test(item.titleKey)) return [];
    return [{ index, key: item.titleKey, slug: disneyKey.test(item.titleKey) ? titleSlug(item.title) : "" }];
  });
  const deadline = Date.now() + 2600;
  let next = 0;
  async function worker() {
    while (next < pending.length && Date.now() < deadline) {
      const { index, key, slug } = pending[next++]!;
      try {
        const url = await cachedPortrait(key, slug);
        if (url) items[index] = { ...items[index]!, artworkUrl: url };
      } catch { /* Publisher outages must leave the saved artwork usable. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
  return { ...history, items };
}
