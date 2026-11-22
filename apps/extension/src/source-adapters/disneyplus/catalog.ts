import {
	disneyPlusEntityId,
	disneyPlusPlaybackId,
	disneyPlusSeasonIdentifier,
	disneyPlusSourceUrl,
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import { loadPublishedDisneyCatalog, type ReadDisneyTitle } from "./published-catalog";
import type { DisneyPlusDetails } from "./metadata";
import type { ExtensionAuthTokens } from "../../auth-tokens";
import { captureDisneyPlusDetails, clearDisneyPlusDetails, getDisneyPlusDetails, observePublishedDisneyTitle, readDisneyPlusPlaybackMetadata, restoreDisneyPlusDetails, restoreDisneyPlusPlaybackMetadata } from "./metadata";

import {
	encodeDisneyPlusCatalogTransfer, hydrateDisneyPlusDetails, isDisneyPlusProfileBoundary,
	parseDisneyPlusCatalogTransfer, savedPlayback, transferIncludesPlayback,
} from "./catalog-transfer";

type Handoff = (message: { type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF"; action: "read" | "save"; payload?: string }) => Promise<unknown>;

const publications = new WeakMap<Document, { job: Promise<void>; expand: () => void }>();
export async function resolveDisneyPlusCatalog(doc: Document, seriesId: string, playbackId: string) {
	const active = publications.get(doc);
	active?.expand();
	await active?.job;
	return readDisneyPlusCatalog(doc, seriesId, playbackId);
}

/** Keep the visible Disney controls untouched while resolving the active playable. */
export function startDisneyPlusCatalogCapture(doc: Document, send: Handoff | undefined =
	typeof chrome === "undefined" || !chrome.runtime?.sendMessage ? undefined : message => chrome.runtime.sendMessage(message),
	readPublished?: ReadDisneyTitle): () => void {
	if (doc.location.origin !== "https://www.disneyplus.com") return () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let currentPath = "", lastSaved = "", requestedPlayback: string | null = null, generation = 0;
	let active: AbortController | undefined;
	let cached: { details: DisneyPlusDetails; until: number; localePath: string } | undefined;
	const cancel = () => { active?.abort(); active = undefined; publications.get(doc)?.expand(); publications.delete(doc); };
	const forget = () => {
		cancel(); cached = undefined;
		generation++;
		clearDisneyPlusDetails(doc);
		lastSaved = ""; requestedPlayback = null;
	};
	const capture = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		const href = doc.location.href;
		if (currentPath !== doc.location.pathname) { cancel(); requestedPlayback = null; generation++; }
		currentPath = doc.location.pathname;
		if (isDisneyPlusProfileBoundary(href)) { forget(); return; }
		const entity = disneyPlusEntityId(href);
		if (entity) {
			requestedPlayback = null;
			captureDisneyPlusDetails(doc);
			const details = getDisneyPlusDetails(doc);
			if (!send || details?.entityId !== entity || (!details.movieId && !details.seasons.size)) return;
			const payload = encodeDisneyPlusCatalogTransfer(details);
			if (payload !== lastSaved && payload.length <= 256_000) {
				lastSaved = payload;
				void send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "save", payload }).catch(() => {
					if (lastSaved === payload) lastSaved = "";
				});
			}
			return;
		}
		const id = disneyPlusPlaybackId(href);
		if (!id || id === requestedPlayback) return;
		requestedPlayback = id;
		const attempt = generation, abort = new AbortController();
		active = abort;
		const current = () => !abort.signal.aborted && attempt === generation && disneyPlusPlaybackId(doc.location.href) === id;
		const url = new URL(href);
		url.search = ""; url.hash = "";
		const localePath = url.pathname.slice(0, url.pathname.toLowerCase().indexOf("/play/"));
		const hasId = (details: DisneyPlusDetails) => details.movieId === id || [...details.seasons.values()].some(s => s.episodes.has(id));
		if (cached && cached.until > Date.now() && cached.localePath === localePath && hasId(cached.details)) {
			restoreDisneyPlusDetails(doc, cached.details); return;
		}
		let expand!: () => void;
		const expansion = new Promise<void>(resolve => { expand = resolve; });
		const job = (async () => {
			if (send && !readDisneyPlusPlaybackMetadata(doc, id)) {
				const payload = await send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "read" }).catch(() => null);
				if (!current()) return;
				const transfer = parseDisneyPlusCatalogTransfer(payload);
				if (transfer && transferIncludesPlayback(transfer, id)) restoreDisneyPlusDetails(doc, hydrateDisneyPlusDetails(transfer));
				else {
					const saved = savedPlayback.safeParse(payload);
					if (saved.success) restoreDisneyPlusPlaybackMetadata(doc, saved.data.metadata);
				}
			}
			if (!current() || !readPublished) return;
			const metadata = readDisneyPlusPlaybackMetadata(doc, id);
			const expected = metadata?.identity.kind === "episode" ? metadata.identity.providerSeriesId : null;
			if (metadata?.identity.kind === "movie") return;
			if (expected) url.pathname = localePath + "/browse/entity-" + expected;
			let resolved: DisneyPlusDetails | undefined;
			const native = getDisneyPlusDetails(doc);
			const observe = (details: DisneyPlusDetails) => {
				if (!current()) return;
				if (native && native !== details && native.entityId === details.entityId && native.locale === details.locale) {
					for (const [key, observed] of native.seasons) {
						const season = details.seasons.get(key);
						if (!season) { details.seasons.set(key, observed); continue; }
						if (season === observed) continue;
						const verified = new Map([...observed.episodes.values()].map(e => [e.number, e]));
						for (const [episodeId, e] of season.episodes) {
							if (verified.has(e.number)) season.episodes.delete(episodeId);
						}
						for (const e of verified.values()) season.episodes.set(e.playbackId, e);
					}
				}
				resolved = details;
				observePublishedDisneyTitle(doc, id, details);
				readDisneyPlusPlaybackMetadata(doc, id);
			};
			const complete = await loadPublishedDisneyCatalog(url, id, expected, abort.signal, details => { if (current() && details.movieId) observe(details); }, readPublished,
				{ observe, expand: () => expansion });
			if (current() && complete && resolved) cached = { details: resolved, until: Date.now() + 5 * 60_000, localePath };
		})().catch(() => undefined);
		publications.set(doc, { job, expand });
	};
	const schedule = () => {
		if (timer === undefined && (doc.location.pathname !== currentPath || disneyPlusEntityId(doc.location.href)))
			timer = setTimeout(capture, 60);
	};
	const authChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
		const change = changes.authTokens;
		const previous = change?.oldValue as Partial<ExtensionAuthTokens> | undefined;
		const next = change?.newValue as Partial<ExtensionAuthTokens> | undefined;
		if (area === "local" && change && (previous?.user?.id !== next?.user?.id || previous?.authSessionId !== next?.authSessionId)) {
			forget(); capture();
		}
	};
	capture();
	const observer = new MutationObserver(schedule);
	observer.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true,
		attributeFilter: ["href", "alt", "src", "srcset", "aria-label", "aria-selected"] });
	// Capture the final DOM before Disney changes the selected season or route.
	doc.addEventListener("click", capture, true);
	doc.defaultView?.addEventListener("popstate", schedule);
	if (typeof chrome !== "undefined") chrome.storage?.onChanged?.addListener(authChanged);
	return () => {
		if (timer !== undefined) clearTimeout(timer);
		observer.disconnect();
		doc.removeEventListener("click", capture, true);
		doc.defaultView?.removeEventListener("popstate", schedule);
		if (typeof chrome !== "undefined") chrome.storage?.onChanged?.removeListener(authChanged);
		forget();
	};
}

export function readDisneyPlusCatalog(doc: Document, seriesId: string, playbackId: string): WatchCatalogSnapshotInput | null {
	const metadata = readDisneyPlusPlaybackMetadata(doc, playbackId);
	const details = getDisneyPlusDetails(doc);
	if (metadata?.identity.kind !== "episode" || metadata.identity.providerSeriesId !== seriesId || details?.entityId !== seriesId ||
		!(metadata.seasonNumber ?? metadata.namedSeasonId) || !details.seasons.get((metadata.seasonNumber ?? metadata.namedSeasonId)!)?.episodes.has(playbackId)) return null;
	const seasons = [...details.seasons.values()].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)).map((season, order) => {
		const identifier = disneyPlusSeasonIdentifier(seriesId, season.number ?? season.providerId!);
		return {
			providerSeasonIdentifier: identifier,
			seasonKey: `disneyplus:season:${identifier}`,
			title: season.title,
			seasonNumber: season.number,
			order,
			episodes: [...season.episodes.values()].sort((a, b) => a.number - b.number).map(episode => ({
				providerEpisodeIdentifier: episode.playbackId,
				episodeKey: `disneyplus:episode:${episode.playbackId}`,
				title: episode.title, episodeNumber: episode.number, order: episode.number - 1,
				releasedAt: null, available: true,
				watchVariants: [{ providerContentId: episode.playbackId, sourceUrl: disneyPlusSourceUrl(episode.playbackId),
					audioLocale: null, original: false, order: 0 }],
			})),
		};
	});
	// The rendered grid has no independently established total or territory.
	const parsed = WatchCatalogSnapshotInputSchema.safeParse({
		schemaVersion: 3, provider: "disneyplus", providerSeriesId: seriesId, titleKey: `disneyplus:series:${seriesId}`,
		title: details.title, completeness: "partial", seasons,
		context: { region: null, requestedLocale: details.locale, audioLocale: null, subtitleLocales: [], observedAt: new Date().toISOString() },
	});
	return parsed.success ? parsed.data : null;
}
