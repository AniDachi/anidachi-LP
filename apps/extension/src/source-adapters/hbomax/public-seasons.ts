import {
	HBO_MAX_ORIGIN, WATCH_CATALOG_MAX_EPISODES, hboMaxCatalogPath, hboMaxDetail, hboMaxPlaybackId, localizeHboMaxUrl,
} from "@anidachi/protocol";
import { HboCmsEpisodeSchema, HboCmsShowSchema, type HboCmsEpisode, type HboCmsShow } from "./cms-catalog";
import { resolveHboLocale } from "./locale";

const pageBytes = 6_000_000;
const pageTimeout = 10_000;
const cacheTtl = 5 * 60_000;
const missingPage = Symbol("missing HBO season page");

function object(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function sameMarketAlternate(href: string | undefined, source: URL, seriesId: string) {
	const currentMarket = /^\/([a-z]{2})\/[a-z]{2}(?:-[a-zA-Z]{2,4})?\/show\//u.exec(source.pathname)?.[1];
	if (!currentMarket || !href) return null;
	let target: URL;
	try { target = new URL(href, source); } catch { return null; }
	const path = /^\/([a-z]{2})\/[a-z]{2}(?:-[a-zA-Z]{2,4})?\/show\/([^/]+)$/u.exec(target.pathname);
	return target.origin === source.origin && !target.username && !target.password && !target.search && !target.hash &&
		path?.[1] === currentMarket && path[2] === seriesId && target.href !== source.href ? target.href : null;
}
function attributes(tag: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const match of tag.matchAll(/\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>]+))/gu)) {
		const key = match[1]!.toLowerCase();
		result.set(key, result.has(key) ? "" : match[2] ?? match[3] ?? match[4]!);
	}
	return result;
}

/** Inspect inert text only. Skip script bodies and comments when locating document metadata. */
function mappedGroup(html: string, url: string, locale: string, seriesId: string) {
	const tags = /<!--[\s\S]*?-->|<(html|link|script)\b[^>]{0,8192}>/giu;
	const scriptEnd = /<\/script\s*>/giu;
	let lang: string | undefined, canonical: string | undefined, json: string | undefined;
	const alternatives = new Set<string>();
	const source = new URL(url);
	let match: RegExpExecArray | null;
	while ((match = tags.exec(html))) {
		if (!match[1]) continue;
		const type = match[1].toLowerCase();
		const attrs = attributes(match[0]);
		if (type === "html") {
			if (lang !== undefined) return null;
			lang = attrs.get("lang") ?? "";
		} else if (type === "link") {
			const roles = attrs.get("rel")?.toLowerCase().split(/\s+/u);
			if (roles?.includes("canonical")) {
				if (canonical !== undefined) return null;
				canonical = attrs.get("href") ?? "";
			}
			if (roles?.includes("alternate") && resolveHboLocale(locale, attrs.get("hreflang") ?? "")) {
				const candidate = sameMarketAlternate(attrs.get("href"), source, seriesId);
				if (candidate) alternatives.add(candidate);
			}
		} else if (type === "script") {
			scriptEnd.lastIndex = tags.lastIndex;
			const end = scriptEnd.exec(html);
			if (!end) return null;
			if (attrs.get("id") === "__NEXT_DATA__") {
				if (json !== undefined || attrs.get("type") !== "application/json") return null;
				json = html.slice(tags.lastIndex, end.index);
			}
			tags.lastIndex = scriptEnd.lastIndex;
		}
	}
	if (!lang || canonical !== url || !json) return null;
	const props = object(object(JSON.parse(json))?.props);
	const mapped = object(object(props?.pageProps)?.mappedData);
	if (!mapped) return null;
	let group: Record<string, unknown> | null = null;
	for (const value of Object.values(mapped)) {
		const row = object(value);
		if (row?.hbomaxId !== seriesId || row.seriesId !== seriesId || !Array.isArray(row.seasons)) continue;
		if (group) return null;
		group = row;
	}
	const alternate = !resolveHboLocale(locale, lang) && alternatives.size === 1 ? [...alternatives][0]! : null;
	return group && { group, alternate, language: lang };
}

function publicEpisode(value: unknown, show: HboCmsShow, season: number, baseUrl: URL): HboCmsEpisode | null {
	const row = object(value);
	if (!row || (row.seriesId !== null && row.seriesId !== show.seriesId) || (row.seasonNumber !== null && row.seasonNumber !== season) ||
		typeof row.episodeUrl !== "string" || !row.episodeUrl.startsWith("/") || /[?#]/u.test(row.episodeUrl)) return null;
	const href = baseUrl.origin + row.episodeUrl;
	if (!hboMaxCatalogPath(href)) return null;
	const parts = row.episodeUrl.split("/");
	const id = parts.pop(), slug = parts.pop();
	if (!slug || !id || parts.pop() !== "s" + season) return null;
	const showPath = parts.join("/");
	const detail = hboMaxDetail(baseUrl.origin + showPath);
	const prefix = /^(.*?)\/shows?\//u.exec(showPath)?.[1];
	const expectedPrefix = baseUrl.pathname.slice(0, -("/show/" + show.seriesId).length);
	if (detail?.kind !== "series" || detail.id !== show.seriesId || (prefix !== "" && prefix !== expectedPrefix)) return null;
	const number = /^e([1-9][0-9]*)(?:-|$)/u.exec(slug)?.[1];
	if (!number || Number(number) !== row.episodeNumber) return null;
	const names = object(row.title);
	const parsed = HboCmsEpisodeSchema.safeParse({ id, number: row.episodeNumber, seasonNumber: season, title: names?.full ?? names?.short });
	return parsed.success ? parsed.data : null;
}

type PublicPage = { seasons: Map<number, string>; episodes: HboCmsEpisode[]; alternate: string | null; language: string };
type PageCache = { scope: string; pages: Map<string, { page: PublicPage; expires: number }> };
const documentPages = new WeakMap<Document, PageCache>();

function publicCache(doc: Document | undefined, show: HboCmsShow, base: URL, locale: string) {
	if (!doc) return null;
	const roster = [...show.seasons].sort((a, b) => a.number - b.number).map(s => [s.id, s.number, s.episodeCount]);
	const scope = JSON.stringify([base.href, locale, roster]);
	let cache = documentPages.get(doc);
	if (cache?.scope !== scope) {
		cache = { scope, pages: new Map() };
		documentPages.set(doc, cache);
	}
	return cache.pages;
}
function parsePage(html: string, url: string, baseUrl: URL, show: HboCmsShow, locale: string): PublicPage | null {
	const mapped = mappedGroup(html, url, locale, show.seriesId);
	const group = mapped?.group;
	if (!Array.isArray(group?.seasons) || group.seasons.length !== show.seasons.length) return null;
	const seasons = new Map<number, string>();
	const episodes: HboCmsEpisode[] = [];
	for (const value of group.seasons) {
		const row = object(value);
		const native = show.seasons.find(season => season.id === row?.seasonId && season.number === row.seasonNumber);
		if (!row || !native || seasons.has(native.number) || !Array.isArray(row.episodes) || row.episodes.length > WATCH_CATALOG_MAX_EPISODES ||
			(row.seasonNumberSlug !== "" && row.seasonNumberSlug !== "s" + native.number)) return null;
		const seasonUrl = row.seasonNumberSlug ? baseUrl.href + "/" + row.seasonNumberSlug : baseUrl.href;
		if ([...seasons.values()].includes(seasonUrl)) return null;
		seasons.set(native.number, seasonUrl);
		// Non-selected season placeholders contain zero rows and zero count in this document.
		if (seasonUrl !== url) continue;
		if (native.episodeCount === null || row.numberOfEpisodes !== native.episodeCount || row.episodes.length !== native.episodeCount) return null;
		const ids = new Set<string>(), numbers = new Set<number>();
		for (const item of row.episodes) {
			const episode = publicEpisode(item, show, native.number, baseUrl);
			if (!episode || ids.has(episode.id) || numbers.has(episode.number)) return null;
			ids.add(episode.id); numbers.add(episode.number); episodes.push(episode);
		}
	}
	return [...seasons.values()].includes(url) ? { seasons, episodes, alternate: mapped!.alternate, language: mapped!.language } : null;
}

async function readPublicPage(url: string, signal: AbortSignal, budget: { remaining: number }) {
	const deadline = AbortSignal.any([signal, AbortSignal.timeout(pageTimeout)]);
	const response = await fetch(url, { method: "GET", credentials: "omit", redirect: "error", mode: "same-origin",
		referrerPolicy: "no-referrer", headers: { Accept: "text/html" }, signal: deadline });
	if (!deadline.aborted && !response.redirected && response.url === url && response.status === 404) {
		await response.body?.cancel();
		return missingPage;
	}
	const length = response.headers.get("content-length");
	if (deadline.aborted || !response.ok || response.redirected || response.url !== url || !response.body ||
		response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "text/html" ||
		(length !== null && (!/^\d+$/u.test(length) || Number(length) > Math.min(pageBytes, budget.remaining)))) {
		await response.body?.cancel();
		return null;
	}
	const reader = response.body.getReader(), decoder = new TextDecoder();
	const cancel = () => { void reader.cancel().catch(() => undefined); };
	deadline.addEventListener("abort", cancel, { once: true });
	let bytes = 0, html = "";
	try {
		while (!deadline.aborted) {
			const chunk = await reader.read();
			if (deadline.aborted) break;
			if (chunk.done) return html + decoder.decode();
			bytes += chunk.value.byteLength;
			budget.remaining -= chunk.value.byteLength;
			if (bytes > pageBytes || budget.remaining < 0) return null;
			html += decoder.decode(chunk.value, { stream: true });
		}
		return null;
	} finally {
		deadline.removeEventListener("abort", cancel);
		await reader.cancel().catch(() => undefined);
		reader.releaseLock();
	}
}

/** Fill the native show's season roster from its own anonymously served public pages. */
export async function loadHboPublicEpisodes(show: HboCmsShow, known: HboCmsEpisode[], watchHref: string, locale: string,
	signal: AbortSignal, doc?: Document): Promise<HboCmsEpisode[]> {
	if (signal.aborted || !hboMaxPlaybackId(watchHref) || !HboCmsShowSchema.safeParse(show).success ||
		!known.length || known.length > WATCH_CATALOG_MAX_EPISODES || !known.some(e => e.id === hboMaxPlaybackId(watchHref))) return known;
	let baseUrl = new URL(localizeHboMaxUrl(HBO_MAX_ORIGIN + "/show/" + show.seriesId, watchHref));
	const combined = new Map(known.map(episode => [episode.id, episode]));
	const needs = (season: HboCmsShow["seasons"][number]) => season.episodeCount !== null &&
		[...combined.values()].filter(episode => episode.seasonNumber === season.number).length < season.episodeCount;
	if (!show.seasons.some(needs)) return known;
	const cache = publicCache(doc, show, baseUrl, locale);
	// Two root reads allow an advertised same-market language alternate. The remaining seasons are read in pairs.
	const maxReads = show.seasons.length + 1;
	let reads = 0;
	const stop = new AbortController();
	const deadline = AbortSignal.any([signal, stop.signal, AbortSignal.timeout((2 + Math.ceil((show.seasons.length - 1) / 2)) * pageTimeout)]);
	const budget = { remaining: pageBytes * maxReads };
	const read = async (url: string, base = baseUrl, language?: string) => {
		if (deadline.aborted) return null;
		const cached = cache?.get(url);
		if (cached && cached.expires > Date.now() && (!language || cached.page.language === language)) return cached.page;
		if (reads >= maxReads || budget.remaining <= 0) return null;
		reads++;
		try {
			const html = await readPublicPage(url, deadline, budget);
			if (deadline.aborted || !html) return null;
			return html === missingPage ? missingPage : parsePage(html, url, base, show, locale);
		} catch { return null; }
	};
	const remember = (url: string, page: PublicPage) => {
		// Only anonymously published rows reach this cache. The active native watch is rechecked on each admission.
		if (!deadline.aborted && cache && cache.get(url)?.page !== page && (cache.has(url) || cache.size < maxReads))
			cache.set(url, { page, expires: Date.now() + cacheTtl });
	};
	const merge = (page: PublicPage) => {
		const unique = new Map(page.episodes.map(e => [e.id, e]));
		const selectedSeason = page.episodes[0]?.seasonNumber;
		for (const existing of combined.values()) {
			const added = unique.get(existing.id);
			if (added && (added.number !== existing.number || added.seasonNumber !== existing.seasonNumber)) return false;
			if (selectedSeason === existing.seasonNumber && !added) return false;
		}
		for (const episode of page.episodes) if (!combined.has(episode.id)) combined.set(episode.id, episode);
		return true;
	};
	let root = await read(baseUrl.href);
	if (!root || root === missingPage) return known;
	if (root.alternate) {
		const alternateUrl = new URL(root.alternate);
		const localized = await read(alternateUrl.href, alternateUrl);
		if (!localized) return known;
		if (localized !== missingPage) { root = localized; baseUrl = alternateUrl; }
	}
	if (!merge(root)) return known;
	remember(baseUrl.href, root);
	const advertisedSeasons = root.seasons;
	const publicLanguage = root.language;
	const missing = show.seasons.filter(needs).map(season => advertisedSeasons.get(season.number)!).filter(url => url !== baseUrl.href);
	async function next() {
		while (!deadline.aborted) {
			const url = missing.shift();
			if (!url) return;
			const page = await read(url, baseUrl, publicLanguage);
			if (deadline.aborted) return;
			if (page === missingPage) continue;
			if (!page || show.seasons.some(s => advertisedSeasons.get(s.number) !== page.seasons.get(s.number)) || !merge(page)) {
				stop.abort();
			} else remember(url, page);
		}
	}
	await Promise.all([next(), next()]);
	return signal.aborted ? known : [...combined.values()];
}
