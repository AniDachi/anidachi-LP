import { disneyCatalogPortrait, type WatchHistoryResponse } from "@anidachi/protocol";
import { unstable_cache } from "next/cache";
import { pressPortrait, titleSlug, type DisneyPressTitle } from "./disney-press-portrait";

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
  const options: RequestInit = { signal, redirect: "manual", cache: "no-store", headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" } };
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

function disneyStorefrontTitle(html: string, id: string): DisneyPressTitle | null {
  const json = nextData.exec(html)?.[1];
  if (!json) return null;
  const page = object(object(object(JSON.parse(json)).props).pageProps);
  if (page.pageId !== "entity-" + id) return null;
  const blocks = object(page.stitchDocument).mainContent;
  if (!Array.isArray(blocks)) return null;
  const sections = blocks.map(object);
  const hero = sections.find(block => block._type === "DetailEntityHero");
  const title = object(hero?.backgroundImage).alt;
  const synopsis = sections.find(block => block._type === "MediaDetails")?.summary;
  const slug = typeof title === "string" && titleSlug(title);
  return slug && slug.length <= 160 ? { slug, synopsis: typeof synopsis === "string" ? synopsis : "" } : null;
}

export async function resolveHistoryPortrait(key: string, request = fetch, titleHint = "") {
  const netflix = netflixKey.exec(key);
  if (netflix) {
    const page = await readPage("https://media.netflix.com/en/only-on-netflix/" + netflix[1], request, AbortSignal.timeout(4200));
    return page ? netflixPoster(page, netflix[1]!) : null;
  }
  const disney = disneyKey.exec(key);
  if (!disney) return null;
  const id = disney[2]!;
  const path = disney[1] === "series" ? "series" : "movie";
  const signal = AbortSignal.timeout(7000);
  const disneyPage = await readPage("https://www.disneyplus.com/browse/entity-" + id, request,
    AbortSignal.any([signal, AbortSignal.timeout(3000)])).catch(() => null);
  const title = disneyPage && disneyStorefrontTitle(disneyPage, id);
  // Regional titles can be absent from the US Disney storefront. Hulu artwork still has to match the exact ID.
  const slug = title ? title.slug : titleHint;
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  const controller = new AbortController();
  const remaining = AbortSignal.any([signal, controller.signal]);
  const lookup = async (url: string, select: (html: string) => string | null) => {
    const html = await readPage(url, request, remaining);
    const portrait = html && select(html);
    if (!portrait) throw new Error("No matching publisher key art");
    return portrait;
  };
  const candidates = [lookup("https://www.hulu.com/" + path + "/" + slug + "-" + id, html => huluPoster(html, id))];
  if (title && title.synopsis) {
    candidates.push(
      lookup("https://press.hulu.com/shows/" + slug + "/", html => pressPortrait(html, title, "hulu")),
      lookup("https://press.disneyplus.com/disney-plus/" + slug + "/logos", html => pressPortrait(html, title, "disney")),
    );
  }
  return Promise.any(candidates).catch(() => null).finally(() => controller.abort());
}

const cachedNetflix = unstable_cache(resolveHistoryPortrait, ["history-netflix-portrait-v1"], { revalidate: 86400 });
const discoverDisney = unstable_cache((key: string, hint: string) => resolveHistoryPortrait(key, fetch, hint),
  ["history-disney-portrait-v3"], { revalidate: 300 });

async function publisherPortrait(key: string, hint: string) {
  if (!disneyKey.test(key)) return cachedNetflix(key);
  const url = await discoverDisney(key, hint);
  if (url) {
    const { db } = await import("./anidachi-auth/db");
    // Successful publisher lookups outlive the request cache. No account or watch data is stored here.
    await db().from("disney_publisher_portraits").upsert({ title_key: key, artwork_url: url },
      { onConflict: "title_key", ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(1200));
  }
  return url;
}

async function savedDisneyPortraits(history: WatchHistoryResponse, keys: string[]) {
  const { db } = await import("./anidachi-auth/db");
  const client = db();
  const signal = AbortSignal.timeout(1800);
  const [native, published] = await Promise.all([
    client.from("watch_episode_progress").select("title_key,disney_portrait_url")
      .eq("user_id", history.meta.ownerUserId).eq("history_generation", history.meta.accountGeneration)
      .eq("provider", "disneyplus").in("title_key", keys).not("disney_portrait_url", "is", null).abortSignal(signal),
    client.from("disney_publisher_portraits").select("title_key,artwork_url").in("title_key", keys).abortSignal(signal),
  ]);
  const catalog = new Map<string, string>();
  for (const row of published.data ?? []) catalog.set(row.title_key, row.artwork_url);
  for (const row of native.data ?? []) {
    const url = disneyCatalogPortrait(row.disney_portrait_url);
    if (url) catalog.set(row.title_key, url);
  }
  return catalog;
}

export async function withTitlePortraits(history: WatchHistoryResponse, readNative = savedDisneyPortraits, publisher = publisherPortrait): Promise<WatchHistoryResponse> {
  const items = [...history.items];
  const keys = items.filter(item => disneyKey.test(item.titleKey)).map(item => item.titleKey);
  const catalog = keys.length ? await readNative(history, keys).catch(() => null) : null;
  const pending = items.flatMap((item, index) => {
    const native = (disneyKey.test(item.titleKey) ? disneyCatalogPortrait(item.artworkUrl) : null) ?? catalog?.get(item.titleKey);
    if (native) { items[index] = { ...item, artworkUrl: native }; return []; }
    if (!disneyKey.test(item.titleKey) && !netflixKey.test(item.titleKey)) return [];
    return [{ index, key: item.titleKey, hint: disneyKey.test(item.titleKey) ? titleSlug(item.title).slice(0, 160) : "" }];
  });
  const deadline = Date.now() + 2600;
  let next = 0;
  async function worker() {
    while (next < pending.length && Date.now() < deadline) {
      const { index, key, hint } = pending[next++]!;
      try {
        const url = await publisher(key, hint);
        if (url) items[index] = { ...items[index]!, artworkUrl: url };
      } catch { /* Publisher outages must leave the saved artwork usable. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
  return { ...history, items };
}
