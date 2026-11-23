import {
	HBO_MAX_ORIGIN, WATCH_CATALOG_MAX_EPISODES, hboMaxCatalogPath, hboMaxDetail, hboMaxPlaybackId, localizeHboMaxUrl,
} from "@anidachi/protocol";
import { HboCmsEpisodeSchema, HboCmsShowSchema, type HboCmsEpisode, type HboCmsShow } from "./cms-catalog";
import { resolveHboLocale } from "./locale";

const pageBytes = 6_000_000;
const pageTimeout = 10_000;
const cacheTtl = 5 * 60_000;
const missingPage = Symbol("missing HBO season page");
const transientError = Symbol("temporary HBO page failure");

function object(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** The same public storefront hint used by HBO's website. The profile UI language can be from a different country. */
async function readStorefrontCountry(doc?: Document): Promise<string | null> {
	try {
		const country = (await doc?.defaultView?.cookieStore?.get("countryCode"))?.value;
		return country && /^[a-z]{2}$/iu.test(country) ? country.toLowerCase() : null;
	} catch { return null; }
}

function regionalShowUrl(geo: string | undefined, root: URL, country: string, locale: string): URL | null {
	if (!geo) return null;
	const config = object(JSON.parse(geo));
	const page = object(config?.pageLocales), brand = object(config?.brand);
	if (page?.pathname !== root.pathname || !Array.isArray(page.availableLocales)) return null;
	const aliases = Object.entries(object(brand?.territory) ?? {}).filter(([, countries]) => Array.isArray(countries) && countries.includes(country));
	const market = aliases.length ? aliases[0]![0] : country;
	if (aliases.length > 1 || !/^[a-z]{2}$/u.test(market)) return null;
	const languages = page.availableLocales.filter((item): item is string => typeof item === "string" &&
		/^[a-z]{2}\/[a-z]{2}(?:-[a-z]{2,4})?$/u.test(item) && item.startsWith(market + "/")).map(item => item.split("/")[1]!);
	const playerLanguage = new Intl.Locale(locale);
	const language = languages.find(tag => tag === playerLanguage.baseName.toLowerCase()) ??
		languages.find(tag => resolveHboLocale(tag, playerLanguage.baseName)) ??
		languages.find(tag => tag === (object(brand?.defaultLang)?.[market] ?? "en"));
	if (!language) return null;
	return market === "us" && language === "en" ? root : new URL("/" + market + "/" + language + root.pathname, root.origin);
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
function pageMarkup(html: string, url: string, locale: string, seriesId: string) {
	const tags = /<!--[\s\S]*?-->|<(html|link|script)\b[^>]{0,8192}>/giu;
	const scriptEnd = /<\/script\s*>/giu;
	let lang: string | undefined, canonical: string | undefined, json: string | undefined;
	let geo: string | undefined, next: string | undefined;
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
			if (roles?.includes("next")) {
				if (next !== undefined || !attrs.get("href")) return null;
				next = attrs.get("href")!.replaceAll("&amp;", "&");
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
			} else if (attrs.get("id") === "__DOTCOM_GEO__") {
				if (geo !== undefined || attrs.get("type") !== "application/json" || end.index - tags.lastIndex > 100_000) return null;
				geo = html.slice(tags.lastIndex, end.index);
			}
			tags.lastIndex = scriptEnd.lastIndex;
		}
	}
	const alternate = lang && !resolveHboLocale(locale, lang) && alternatives.size === 1 ? [...alternatives][0]! : null;
	return { lang, canonical, json, geo, alternate, next };
}

function mappedGroup(markup: NonNullable<ReturnType<typeof pageMarkup>>, url: string, seasonUrl: string, seriesId: string) {
	const { lang, canonical, json, alternate } = markup;
	if (!lang || (canonical !== url && canonical !== seasonUrl) || !json) return null;
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

type PublicPage = { seasons: Map<number, string>; episodes: HboCmsEpisode[]; alternate: string | null; language: string;
	total: number | null; next: string | null };
type PageCache = { scope: string; root?: string; pages: Map<string, { page: PublicPage; expires: number }> };
const documentPages = new WeakMap<Document, PageCache>();

function publicCache(doc: Document | undefined, show: HboCmsShow, base: URL, locale: string, country: string | null) {
	if (!doc) return null;
	const roster = [...show.seasons].sort((a, b) => a.number - b.number).map(s => [s.id, s.number, s.episodeCount]);
	const scope = JSON.stringify([base.href, country, locale, roster]);
	let cache = documentPages.get(doc);
	if (cache?.scope !== scope) {
		cache = { scope, pages: new Map() };
		documentPages.set(doc, cache);
	}
	return cache;
}
function parsePage(markup: NonNullable<ReturnType<typeof pageMarkup>>, url: string, baseUrl: URL, show: HboCmsShow): PublicPage | null {
	const address = new URL(url);
	const seasonPage = address.origin + address.pathname;
	const mapped = mappedGroup(markup, url, seasonPage, show.seriesId);
	const group = mapped?.group;
	if (!Array.isArray(group?.seasons) || group.seasons.length !== show.seasons.length) return null;
	const seasons = new Map<number, string>();
	const episodes: HboCmsEpisode[] = [];
	let total: number | null = null;
	for (const value of group.seasons) {
		const row = object(value);
		const native = show.seasons.find(season => season.id === row?.seasonId && season.number === row.seasonNumber);
		if (!row || !native || seasons.has(native.number) || !Array.isArray(row.episodes) || row.episodes.length > WATCH_CATALOG_MAX_EPISODES ||
			(row.seasonNumberSlug !== "" && row.seasonNumberSlug !== "s" + native.number)) return null;
		const seasonUrl = row.seasonNumberSlug ? baseUrl.href + "/" + row.seasonNumberSlug : baseUrl.href;
		if ([...seasons.values()].includes(seasonUrl)) return null;
		seasons.set(native.number, seasonUrl);
		// Non-selected season placeholders contain zero rows and zero count in this document.
		if (seasonUrl !== seasonPage) continue;
		const count = row.numberOfEpisodes;
		if (count != null && (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > WATCH_CATALOG_MAX_EPISODES ||
			(native.episodeCount !== null && count !== native.episodeCount))) return null;
		total = native.episodeCount ?? (typeof count === "number" ? count : null);
		if (total !== null && row.episodes.length > total) return null;
		const ids = new Set<string>(), numbers = new Set<number>();
		for (const item of row.episodes) {
			const episode = publicEpisode(item, show, native.number, baseUrl);
			if (!episode || ids.has(episode.id) || numbers.has(episode.number)) return null;
			ids.add(episode.id); numbers.add(episode.number); episodes.push(episode);
		}
	}
	if (![...seasons.values()].includes(seasonPage)) return null;
	const next = markup.next ? new URL(markup.next, address) : null;
	if (next && (next.origin !== address.origin || next.pathname !== address.pathname || !next.search ||
		next.username || next.password || next.hash)) return null;
	return { seasons, episodes, total, next: next?.href ?? null, alternate: mapped!.alternate, language: mapped!.language };
}

async function readPublicPage(url: string, signal: AbortSignal, budget: { remaining: number }, readMissingRoot: boolean) {
	const deadline = AbortSignal.any([signal, AbortSignal.timeout(pageTimeout)]);
	let response: Response;
	try {
		response = await fetch(url, { method: "GET", credentials: "omit", redirect: "error", mode: "same-origin",
			referrerPolicy: "no-referrer", headers: { Accept: "text/html" }, signal: deadline });
	} catch { return signal.aborted ? null : transientError; }
	if (response.status >= 500 && response.status < 600 && !response.redirected && response.url === url) {
		await response.body?.cancel();
		return transientError;
	}
	const missing = response.status === 404;
	if (missing && !readMissingRoot && !deadline.aborted && !response.redirected && response.url === url) {
		await response.body?.cancel();
		return missingPage;
	}
	const length = response.headers.get("content-length");
	if (deadline.aborted || (!response.ok && !(missing && readMissingRoot)) || response.redirected || response.url !== url || !response.body ||
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
			if (chunk.done) return { html: html + decoder.decode(), missing };
			bytes += chunk.value.byteLength;
			budget.remaining -= chunk.value.byteLength;
			if (bytes > pageBytes || budget.remaining < 0) return null;
			html += decoder.decode(chunk.value, { stream: true });
		}
		return signal.aborted ? null : transientError;
	} catch {
		return signal.aborted ? null : transientError;
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
	const nativeCounts = new Map<number, number>();
	for (const episode of combined.values()) nativeCounts.set(episode.seasonNumber, (nativeCounts.get(episode.seasonNumber) ?? 0) + 1);
	const needs = (season: HboCmsShow["seasons"][number]) => season.episodeCount === null ||
		(nativeCounts.get(season.number) ?? 0) < season.episodeCount;
	if (!show.seasons.some(needs)) return known;
	const hasMarket = /^\/[a-z]{2}\/[a-z]{2}(?:-[a-zA-Z]{2,4})?\/show\//u.test(baseUrl.pathname);
	const country = hasMarket ? null : await readStorefrontCountry(doc);
	if (country) baseUrl.pathname = "/show/" + show.seriesId;
	const cache = publicCache(doc, show, baseUrl, locale, country);
	// A countryless player can need one region lookup, then a same-market language alternate.
	const rootReads = country ? 3 : 2;
	const seasonPages = show.seasons.length - 1 + rootReads;
	// Continuations share the same deadline and body budget as the original season roster.
	const maxReads = 2 * seasonPages + 32;
	let reads = 0;
	const stop = new AbortController();
	const deadline = AbortSignal.any([signal, stop.signal, AbortSignal.timeout((rootReads + 1 + Math.ceil((show.seasons.length - 1) / 2)) * pageTimeout)]);
	const budget = { remaining: pageBytes * seasonPages };
	const readPage = async (url: string, base: URL, storefront?: string | null): Promise<PublicPage | typeof missingPage | null> => {
		try {
			const fetchPage = () => {
				if (deadline.aborted || reads >= maxReads || budget.remaining <= 0) return null;
				reads++;
				return readPublicPage(url, deadline, budget, !!storefront);
			};
			let resource = await fetchPage();
			if (resource === transientError) resource = await fetchPage();
			if (deadline.aborted || !resource) return null;
			if (resource === missingPage || resource === transientError) return missingPage;
			const markup = pageMarkup(resource.html, url, locale, show.seriesId);
			if (!markup) return null;
			if (storefront) {
				const regional = regionalShowUrl(markup.geo, base, storefront, locale);
				if (!regional) return null;
				if (regional.href !== url) {
					baseUrl = regional;
					return readPage(regional.href, regional);
				}
			}
			return resource.missing ? missingPage : parsePage(markup, url, base, show);
		} catch { return null; }
	};
	const read = async (url: string, base = baseUrl, language?: string, storefront?: string | null): Promise<PublicPage | typeof missingPage | null> => {
		if (deadline.aborted) return null;
		const cached = cache?.pages.get(url);
		if (cached && cached.expires > Date.now() && (!language || resolveHboLocale(language, cached.page.language))) return cached.page;
		const first = await readPage(url, base, storefront);
		if (!first || first === missingPage) return first;
		if (language && !resolveHboLocale(language, first.language)) return null;
		if (!first.next) return first.total === null || first.episodes.length === first.total ? first : null;
		const episodes = new Map(first.episodes.map(e => [e.id, e]));
		const numbers = new Set(first.episodes.map(e => e.number));
		const visited = new Set([url]);
		let page = first;
		while (page.next) {
			if (visited.has(page.next) || !page.episodes.length) return null;
			visited.add(page.next);
			const more = await readPage(page.next, storefront ? baseUrl : base);
			if (!more || more === missingPage) return more;
			if (!resolveHboLocale(first.language, more.language) || more.total !== first.total ||
				show.seasons.some(s => first.seasons.get(s.number) !== more.seasons.get(s.number))) return null;
			const previousSize = episodes.size;
			for (const episode of more.episodes) {
				const existing = episodes.get(episode.id);
				if (existing ? existing.number !== episode.number : numbers.has(episode.number)) return null;
				episodes.set(episode.id, episode); numbers.add(episode.number);
			}
			if (episodes.size === previousSize || episodes.size > (first.total ?? WATCH_CATALOG_MAX_EPISODES)) return null;
			page = more;
		}
		if (first.total !== null && first.total !== episodes.size) return null;
		return { ...first, episodes: [...episodes.values()], next: null };
	};
	const remember = (url: string, page: PublicPage) => {
		// Only anonymously published rows reach this cache. The active native watch is rechecked on each admission.
		if (!deadline.aborted && cache && cache.pages.get(url)?.page !== page && (cache.pages.has(url) || cache.pages.size < maxReads))
			cache.pages.set(url, { page, expires: Date.now() + cacheTtl });
	};
	const merge = (page: PublicPage) => {
		const unique = new Map(page.episodes.map(e => [e.id, e]));
		let additions = unique.size;
		const selectedSeason = page.episodes[0]?.seasonNumber;
		for (const existing of combined.values()) {
			const added = unique.get(existing.id);
			if (added && (added.number !== existing.number || added.seasonNumber !== existing.seasonNumber)) return false;
			if (selectedSeason === existing.seasonNumber && !added) return false;
			if (added) additions--;
		}
		if (combined.size + additions > WATCH_CATALOG_MAX_EPISODES) return false;
		for (const episode of page.episodes) if (!combined.has(episode.id)) combined.set(episode.id, episode);
		return true;
	};
	const cachedRoot = cache?.root && (cache.pages.get(cache.root)?.expires ?? 0) > Date.now() ? cache.root : null;
	if (cachedRoot) baseUrl = new URL(cachedRoot);
	let root = await read(baseUrl.href, baseUrl, undefined, cachedRoot ? null : country);
	if (!root || root === missingPage) return known;
	if (root.alternate) {
		const alternateUrl = new URL(root.alternate);
		const localized = await read(alternateUrl.href, alternateUrl);
		if (!localized) return known;
		if (localized !== missingPage) { root = localized; baseUrl = alternateUrl; }
	}
	if (!merge(root)) return known;
	remember(baseUrl.href, root);
	if (cache) cache.root = baseUrl.href;
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
	if (signal.aborted || (country && await readStorefrontCountry(doc) !== country)) return known;
	return [...combined.values()];
}
