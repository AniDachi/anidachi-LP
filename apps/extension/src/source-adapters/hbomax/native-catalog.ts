import { HBO_MAX_ORIGIN, hboMaxDetail, hboMaxPlaybackId, isHboMaxOrigin } from "@anidachi/protocol";
import { parseHboNativePage } from "./cms-catalog";
import { resolveHboLocale } from "./locale";

const maxBodyBytes = 12 * 1024 * 1024;
type NativePage = NonNullable<ReturnType<typeof parseHboNativePage>>;

/** Restrict observation to the provider's ordinary GET responses for series and player pages. */
export function hboCatalogRoute(raw: string): string | null {
	if (!raw.includes("/cms/routes/")) return null;
	let url: URL;
	try { url = new URL(raw); } catch { return null; }
	if (url.protocol !== "https:" || url.port || url.username || url.password ||
		!/(?:^|\.)prd\.api\.(?:hbomax|max|discomax)\.com$/u.test(url.hostname) ||
		!url.pathname.startsWith("/cms/routes/")) return null;
	const route = HBO_MAX_ORIGIN + url.pathname.slice("/cms/routes".length);
	return hboMaxPlaybackId(route) || hboMaxDetail(route)?.kind === "series" ? route : null;
}

async function readCatalogBody(response: Response, signal: AbortSignal): Promise<unknown> {
	if (signal.aborted || !response.ok || !response.headers.get("content-type")?.includes("json") ||
		Number(response.headers.get("content-length")) > maxBodyBytes) return null;
	const reader = response.clone().body?.getReader();
	if (!reader) return null;
	const decoder = new TextDecoder();
	let size = 0;
	const chunks: string[] = [];
	const cancel = () => { void reader.cancel().catch(() => {}); };
	signal.addEventListener("abort", cancel, { once: true });
	try {
		while (!signal.aborted) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBodyBytes) { cancel(); return null; }
			chunks.push(decoder.decode(value, { stream: true }));
		}
		return signal.aborted ? null : JSON.parse(chunks.join("") + decoder.decode());
	} finally {
		signal.removeEventListener("abort", cancel);
		reader.releaseLock();
	}
}

export function startHboNativeCatalog(win: Window): () => void {
	const doc = win.document;
	if (!isHboMaxOrigin(doc.location.origin)) return () => {};
	const original = win.fetch;
	let generation = 0;
	const reading = new Set<AbortController>();
	let pages: { native: NativePage; locale: string | null }[] = [];
	const locale = () => doc.documentElement?.lang || null;

	const publish = () => {
		const id = hboMaxPlaybackId(doc.location.href);
		if (!id) return;
		const language = locale();
		for (const page of pages) {
			if (page.locale && language) {
				const resolved = resolveHboLocale(page.locale, language);
				if (!resolved) continue;
				page.locale = resolved;
			} else if (language) page.locale = language;
			const { metadata, show, episodes, playbackId } = page.native;
			const item = episodes.find(episode => episode.id === id);
			let current = playbackId === id ? metadata : null;
			if (!current && item && show) {
				current = {
					identity: { kind: "episode", providerSeriesId: show.seriesId, providerEpisodeIdentifier: id },
					title: show.title, displayTitle: show.title + " — " + item.title, episodeTitle: item.title,
					episodeNumber: item.number, seasonNumber: item.seasonNumber,
					seasonTitle: show.seasons.find(season => season.number === item.seasonNumber)?.title ?? null, artworkUrl: null,
				};
			}
			if (!current) continue;
			doc.dispatchEvent(new CustomEvent("anidachi:hbo-cms", {
				detail: JSON.stringify({ playbackId: id, metadata: current, show, episodes, locale: page.locale }),
			}));
			return;
		}
	};
	const observedFetch: typeof fetch = function (this: Window, input, init) {
		const result = original.call(this, input, init);
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		const route = typeof raw === "string" && hboCatalogRoute(raw);
		if (!route || (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "GET") return result;
		const started = generation;
		const language = locale();
		void result.then(async response => {
			if (started !== generation || hboCatalogRoute(response.url) !== route) return;
			// A page can prefetch multiple watch links. Give the latest route priority.
			if (reading.size >= 3) reading.values().next().value?.abort();
			const controller = new AbortController();
			reading.add(controller);
			let body: unknown;
			try {
				body = await readCatalogBody(response, AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]));
			} finally { reading.delete(controller); }
			if (started !== generation || !body) return;
			const native = parseHboNativePage(body, route);
			if (!native) return;
			pages = [{ native, locale: language }, ...pages].slice(0, 3);
			publish();
		}).catch(() => {});
		return result;
	};
	const forget = () => {
		generation++;
		pages = [];
		for (const controller of reading) controller.abort();
		reading.clear();
	};
	const routeChanged = () => {
		if (!hboMaxPlaybackId(doc.location.href) && !hboMaxDetail(doc.location.href)) forget();
		else publish();
	};
	win.fetch = observedFetch;
	doc.addEventListener("anidachi:hbo-cms-read", publish);
	win.navigation?.addEventListener("currententrychange", routeChanged);
	win.addEventListener("popstate", routeChanged);
	win.addEventListener("pagehide", forget);
	return () => {
		forget();
		if (win.fetch === observedFetch) win.fetch = original;
		doc.removeEventListener("anidachi:hbo-cms-read", publish);
		win.navigation?.removeEventListener("currententrychange", routeChanged);
		win.removeEventListener("popstate", routeChanged);
		win.removeEventListener("pagehide", forget);
	};
}
