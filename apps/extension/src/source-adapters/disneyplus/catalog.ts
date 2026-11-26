import {
	disneyPlusEntityId,
	disneyPlusPlaybackId,
	disneyPlusSeasonIdentifier,
	disneyPlusSourceUrl,
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import type { ExtensionAuthTokens } from "../../auth-tokens";
import { captureDisneyPlusDetails, clearDisneyPlusDetails, getDisneyPlusDetails, readDisneyPlusPlaybackMetadata, restoreDisneyPlusDetails, restoreDisneyPlusPlaybackMetadata } from "./metadata";

import {
	encodeDisneyPlusCatalogTransfer, hydrateDisneyPlusDetails, isDisneyPlusProfileBoundary,
	parseDisneyPlusCatalogTransfer, savedPlayback, transferIncludesPlayback,
} from "./catalog-transfer";

type Handoff = (message: { type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF"; action: "read" | "save"; payload?: string }) => Promise<unknown>;

/** Read public episode cards as Disney renders each season. Never switch a
 * viewer's selected season or turn Disney's profile progress into AniDachi progress. */
export function startDisneyPlusCatalogCapture(doc: Document, send: Handoff | undefined =
	typeof chrome === "undefined" || !chrome.runtime?.sendMessage ? undefined : message => chrome.runtime.sendMessage(message)): () => void {
	if (doc.location.origin !== "https://www.disneyplus.com") return () => {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let currentPath = "", lastSaved = "", requestedPlayback: string | null = null, generation = 0;
	const forget = () => {
		generation++;
		clearDisneyPlusDetails(doc);
		lastSaved = ""; requestedPlayback = null;
	};
	const capture = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		const href = doc.location.href;
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
		if (!send || !id || id === requestedPlayback || readDisneyPlusPlaybackMetadata(doc, id)) return;
		requestedPlayback = id;
		const attempt = generation;
		void send({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "read" }).then(payload => {
			if (attempt !== generation || disneyPlusPlaybackId(doc.location.href) !== id) return;
			const transfer = parseDisneyPlusCatalogTransfer(payload);
			if (transfer && transferIncludesPlayback(transfer, id)) restoreDisneyPlusDetails(doc, hydrateDisneyPlusDetails(transfer));
			else {
				const saved = savedPlayback.safeParse(payload);
				if (saved.success) restoreDisneyPlusPlaybackMetadata(doc, saved.data.metadata);
			}
		}).catch(() => undefined);
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
		!metadata.seasonNumber || !details.seasons.get(metadata.seasonNumber)?.episodes.has(playbackId)) return null;
	const seasons = [...details.seasons.values()].sort((a, b) => a.number - b.number).map(season => {
		const identifier = disneyPlusSeasonIdentifier(seriesId, season.number);
		return {
			providerSeasonIdentifier: identifier,
			seasonKey: `disneyplus:season:${identifier}`,
			title: season.title,
			seasonNumber: season.number,
			order: season.number - 1,
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
