import { disneyPlusEntityId, disneyPlusPlaybackId } from "@anidachi/protocol";
import { parseDisneyTitle, type PublishedTitle } from "./published-title";
import type { DisneyPlusDetails, DisneyPlusSeason } from "./metadata";

export type ReadDisneyTitle = (url: URL, signal: AbortSignal) => Promise<{ page: PublishedTitle; url: URL } | null>;
const maxBytes = 10 * 1024 * 1024;

/** Fetch the same public title document Disney serves to a signed-out viewer. */
export const readDisneyTitle: ReadDisneyTitle = async (url, signal) => {
	if (url.origin !== "https://www.disneyplus.com" || !(disneyPlusEntityId(url.href) || disneyPlusPlaybackId(url.href))) return null;
	try {
		const response = await fetch(url, { mode: "same-origin", credentials: "omit", referrerPolicy: "no-referrer",
			headers: { Accept: "text/html" }, signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) });
		const id = disneyPlusEntityId(response.url);
		if (!response.ok || !id || !response.headers.get("content-type")?.toLowerCase().startsWith("text/html") ||
			Number(response.headers.get("content-length")) > maxBytes || !response.body) {
			await response.body?.cancel(); return null;
		}
		const reader = response.body.getReader(), decoder = new TextDecoder();
		let bytes = 0, html = "";
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.length;
			if (bytes > maxBytes) { await reader.cancel(); return null; }
			html += decoder.decode(chunk.value, { stream: true });
		}
		const page = parseDisneyTitle(html + decoder.decode(), id);
		return page ? { url: new URL(response.url), page } : null;
	} catch { return null; }
};

export async function loadPublishedDisneyCatalog(url: URL, playbackId: string, expectedSeries: string | null,
	signal: AbortSignal, publish: (value: DisneyPlusDetails) => void, read: ReadDisneyTitle = readDisneyTitle,
	options: { observe?: (details: DisneyPlusDetails) => void; expand?: () => Promise<void> } = {}) {
	const root = await read(url, signal);
	if (!root || signal.aborted || (expectedSeries && expectedSeries !== root.page.entityId)) return;
	const { page } = root;
	const details: DisneyPlusDetails = { entityId: page.entityId, title: page.title, artworkUrl: page.artworkUrl,
		locale: page.locale, movieId: page.selectedSeasonId ? null : page.entityId, seasons: new Map() };
	if (details.movieId) { if (details.movieId === playbackId) publish(details); return details.movieId === playbackId; }
	const add = (s: PublishedTitle["seasons"][number]) => {
		if (!s.episodes?.length) return;
		const season: DisneyPlusSeason = { number: s.number, title: s.name, providerId: s.id,
			episodes: new Map(s.episodes.map(e => [e.playbackId, e])) };
		details.seasons.set(s.number ?? s.id, season);
	};
	const containsPlayback = () => [...details.seasons.values()].some(s => s.episodes.has(playbackId));
	for (const s of page.seasons) add(s);
	options.observe?.(details);
	if (containsPlayback()) publish(details);
	const missing = page.seasons.filter(s => !s.episodes?.length);
	let next = 0, filled = 0;
	async function worker() {
		while (!signal.aborted && next < missing.length) {
			// Once playback is identified, defer the other seasons until the history
			// service actually requests a fresh catalog for this account.
			if (containsPlayback() && options.expand) await options.expand();
			if (signal.aborted || next >= missing.length) return;
			const season = missing[next++]!;
			const target = new URL(root!.url.pathname, root!.url.origin);
			target.searchParams.set("season", season.id);
			const result = await read(target, signal);
			if (signal.aborted || !result || result.page.entityId !== page.entityId || result.page.locale !== page.locale ||
				result.page.region !== page.region || result.page.selectedSeasonId !== season.id) continue;
			const fresh = result.page.seasons.find(s => s.id === season.id);
			if (fresh?.episodes?.length) {
				filled++; add(fresh);
				options.observe?.(details);
				if (fresh.episodes?.some(e => e.playbackId === playbackId)) publish(details);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(3, missing.length) }, worker));
	if (missing.length && !signal.aborted && containsPlayback()) publish(details);
	return !signal.aborted && containsPlayback() && filled === missing.length;
}
