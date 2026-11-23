import { isPrimeHistoryPosterKey, isPrimeHistoryPosterUrl } from "@anidachi/protocol";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function read(url: string, signal: AbortSignal, request: typeof fetch, mime: string, limit: number) {
  const options: RequestInit = { signal, redirect: "manual", cache: "no-store", headers: { Accept: mime, "Accept-Language": "en-US,en;q=0.9" } };
  let response = await request(url, options);
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    const dest = location && new URL(location, url);
    if (!dest || dest.origin !== new URL(url).origin || dest.username || dest.password) throw new Error("Unexpected poster metadata redirect");
    response = await request(dest.href, options);
  }
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes(mime)) {
    await response.body?.cancel();
    throw new Error("Poster metadata unavailable");
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let result = "", size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) return result + decoder.decode();
    size += part.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Poster metadata exceeds size limit"); }
    result += decoder.decode(part.value, { stream: true });
  }
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export async function resolvePrimeHistoryPoster(key: string, request = fetch) {
  if (!isPrimeHistoryPosterKey(key)) return null;
  const [, kind, id] = key.split(":");
  const signal = AbortSignal.timeout(8000);
  const html = await read("https://www.primevideo.com/region/na/detail/" + id, signal, request, "text/html", 8_000_000);
  const raw = /<script\b[^>]*\bid=["']dv-web-page-hydration-data["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!raw) return null;
  const body = record(record(record(record(JSON.parse(raw)).init).preparations).body);
  const state = record(record(body.atf).state);
  const current = state.pageTitleId;
  if (typeof current !== "string") return null;
  const self = record(record(state.self)[current]);
  const detail = record(record(record(state.detail).headerDetail)[current]);
  const series = kind === "series";
  if (self.compactGTI !== id || self.gti !== current || detail.catalogId !== current ||
      detail.titleType !== (series ? "season" : "movie") || (series && detail.seasonNumber !== 1)) return null;
  const title = series ? detail.parentTitle : detail.title;
  const cast = record(detail.contributors).cast;
  const year = detail.releaseYear;
  if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof year !== "number" || !Array.isArray(cast)) return null;
  const actors = new Set(cast.flatMap(person => {
    const name = record(person).name;
    return typeof name === "string" && name.trim() ? [normalize(name)] : [];
  }));
  if (!actors.size) return null;
  const json = await read("https://v3.sg.media-imdb.com/suggestion/x/" + encodeURIComponent(title) + ".json",
    signal, request, "application/json", 256_000);
  const results = record(JSON.parse(json)).d;
  if (!Array.isArray(results)) return null;
  const matches = results.map(record).filter(row => {
    if (typeof row.id !== "string" || !/^tt\d+$/.test(row.id) || typeof row.l !== "string" || normalize(row.l) !== normalize(title) ||
        typeof row.s !== "string" || typeof row.y !== "number" || !(series ? ["tvSeries", "tvMiniSeries"] : ["movie", "tvMovie"]).includes(String(row.qid))) return false;
    const sharedCast = new Set(row.s.split(",").map(normalize).filter(actor => actors.has(actor)));
    // Prime's first-season release can be the regional release the following year.
    const delta = Math.abs(row.y - year);
    // A season's cast can omit the series leads. Accept an exact title, type
    // and original year only when the result set identifies one work.
    return delta === 0 || (delta === 1 && sharedCast.size >= 2);
  });
  if (matches.length !== 1) return null;
  const image = record(matches[0]!.i);
  return typeof image.height === "number" && typeof image.width === "number" &&
    image.width >= 200 && image.height > image.width && isPrimeHistoryPosterUrl(image.imageUrl) ? image.imageUrl : null;
}
