import type { ExtensionAuthTokens } from "../../auth-tokens";
import { hboMaxArtworkUrl, hboMaxDetail, hboMaxPlaybackId, hboMaxSourceUrl, hboMaxFingerprint, WatchSourceDescriptorSchema, type WatchSourceDescriptor, type HboMaxHistoryIdentity } from "@anidachi/protocol";

type Episode = { playbackId: string; number: number; title: string };
type Season = { number: number; title: string; episodes: Map<string, Episode> };
type Details = {
	kind: "movie" | "series"; id: string; title: string; locale: string; artworkUrl: string | null;
	seasons: Map<number, Season>; movieId: string | null;
};
export type HboMaxPlaybackMetadata = {
	identity: HboMaxHistoryIdentity; title: string; displayTitle: string; artworkUrl: string | null;
	episodeTitle: string; episodeNumber: number | null; seasonTitle: string | null; seasonNumber: number | null;
};
const detailsByDocument = new WeakMap<Document, Details>();
const movieClicks = new WeakMap<Document, { detail: Details; at: number }>();

const priorDetail = new WeakMap<Document, { id: string; title: string; heading: Element; excluded: Set<string> }>();
type PlayerLabels = { title: string; ordinalLabel: string | null; subtitle: string | null };
const lastPlayer = new WeakMap<Document, { id: string; labels: PlayerLabels }>();
const roomSource = new WeakMap<Document, WatchSourceDescriptor>();
const savedSource = new WeakMap<Document, HboMaxPlaybackMetadata>();

export function observeHboMaxRoomSource(doc: Document, descriptor: WatchSourceDescriptor) {
	roomSource.delete(doc);
	const parsed = WatchSourceDescriptorSchema.safeParse(descriptor);
	const id = hboMaxPlaybackId(doc.location.href);
	if (parsed.success && id && parsed.data.provider === "hbomax" && parsed.data.sourceUrl === hboMaxSourceUrl(id) &&
		parsed.data.canonicalUrl === parsed.data.sourceUrl && parsed.data.videoFingerprint === hboMaxFingerprint(id))
		roomSource.set(doc, parsed.data);
}

export function clearHboMaxRoomSource(doc: Document) { roomSource.delete(doc); }

function clean(value: string | null | undefined) {
	const text = value?.replace(/[\u2066-\u2069]/gu, "").replace(/\s+/gu, " ").trim();
	return text && text.length <= 300 ? text : null;
}
// Normalize only ordinal labels. The UI keeps the original title and season text.
function numericText(value: string) {
	return value.normalize("NFKC")
		.replace(/[٠-٩]/gu, digit => String(digit.charCodeAt(0) - 0x660))
		.replace(/[۰-۹]/gu, digit => String(digit.charCodeAt(0) - 0x6f0));
}
function sameTitle(a: string | null | undefined, b: string | null | undefined) {
	const comparable = (value?: string | null) => value?.normalize("NFC").replace(/[‘’]/gu, "'");
	return comparable(a) === comparable(b);
}

function playerOrdinals(value: string | null) {
	if (!value) return null;
	const label = numericText(value);
	// These two coordinates belong to the dedicated player season/episode node.
	// Reject reversed markers, unrelated numbers and ambiguous presentations.
	const match = /^(?:s|season|saison|staffel|stagione|sezon|t|temporada|シーズン)\.?\s*([0-9]+)\s*[,·:–—-]?\s*(?:e|ep|episode|épisode|episodio|episódio|folge|odcinek|第)\.?\s*([0-9]+)(?:話)?\s*:?$/iu.exec(label)
		?? /^第?([0-9]+)季\s*第([0-9]+)[集話]\s*:?$/u.exec(label);
	const season = ordinal(match?.[1]), episode = ordinal(match?.[2]);
	return season && episode ? { season, episode } : null;
}
function cardCoordinates(label: string | null) {
	// HBO isolates the coordinates inside a translated action such as "Watch".
	// Only accept a complete season and episode pair before the title separator.
	const prefix = label?.split(/[:：]/u, 1)[0];
	if (!prefix) return null;
	for (const part of prefix.split(/[\u2066-\u2068]/u).reverse()) {
		const pair = playerOrdinals(clean(part));
		if (pair) return pair;
	}
	return playerOrdinals(clean(prefix));
}
function seasonOrdinal(label: string) {
	const value = numericText(label);
	const match = /^(?:season|saison|temporada|staffel|stagione|sezon|série|シーズン)\s*([0-9]+)$/iu.exec(value)
		?? /^第?([0-9]+)(?:季|シーズン)$/u.exec(value);
	return ordinal(match?.[1]);
}
function cardEpisode(value: string | null) {
	if (!value) return null;
	// Normalize the numeric prefix separately to preserve the provider's title.
	const match = /^([\p{Nd}]+)[.．、]\s*(.+)$/u.exec(value)
		?? /^第([\p{Nd}]+)[話集]\s*[：:、.．-]?\s*(.+)$/u.exec(value);
	const number = match && ordinal(numericText(match[1]));
	return number && match ? { number, title: match[2] } : null;
}
function ordinal(value: string | undefined) {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
}

export function getHboMaxDetails(doc: Document) { return detailsByDocument.get(doc); }

function catalogArtwork(doc: Document, title: string): string | null {
	for (const img of doc.querySelectorAll<HTMLImageElement>("img[alt]")) {
		if (clean(img.alt) !== title) continue;
		const url = hboMaxArtworkUrl(img.currentSrc || img.src);
		if (url) return url;
	}
	return null;
}

function captureDetails(doc: Document) {
	const entity = hboMaxDetail(doc.location.href);
	if (!entity) return;
	const heading = doc.querySelector("h1");
	const title = clean(heading?.textContent);
	if (!heading || !title) return;
	const previous = priorDetail.get(doc);
	if (previous && previous.id !== entity.id && previous.heading === heading && previous.title === title) return;
	let details = detailsByDocument.get(doc);
	if (details?.id !== entity.id || details.kind !== entity.kind || details.title !== title) {
		const excluded = new Set<string>();
		if (details && details.id !== entity.id) {
			for (const season of details.seasons.values()) for (const id of season.episodes.keys()) excluded.add(id);
		}
		priorDetail.set(doc, { id: entity.id, title, heading, excluded });
		details = { ...entity, title, locale: doc.documentElement.lang, artworkUrl: null, seasons: new Map(), movieId: null };
		detailsByDocument.set(doc, details);
		movieClicks.delete(doc);
	}
	details.artworkUrl = catalogArtwork(doc, title) ?? details.artworkUrl;
	if (details.kind !== "series") return;
	for (const panel of doc.querySelectorAll('[role="tabpanel"]:not([hidden]):not([aria-hidden="true"])')) {
		const seasonMenu = Array.from(panel.querySelectorAll('button[aria-haspopup="true"][aria-expanded]:not([data-tile-action-menu])'))
			.find(button => !button.closest('a[data-testid$="_tile"]') && seasonOrdinal(clean(button.textContent) ?? "") !== null);
		const seasonTitle = clean(seasonMenu?.textContent ?? panel.querySelector("h2")?.textContent);
		const seasonNumber = seasonTitle && seasonOrdinal(seasonTitle);
		if (!seasonTitle || !seasonNumber) continue;
		const season: Season = details.seasons.get(seasonNumber) ?? { title: seasonTitle, number: seasonNumber, episodes: new Map() };
		for (const link of panel.querySelectorAll<HTMLAnchorElement>('a[href*="/video/watch/"][data-testid]')) {
			const id = hboMaxPlaybackId(link.href);
			if (!id || link.dataset.testid !== id + "_tile" || priorDetail.get(doc)?.excluded.has(id) ||
				(link.dataset.sonicId && link.dataset.sonicId !== id) || (link.dataset.sonicType && link.dataset.sonicType !== "video")) continue;
			if ([...details.seasons.values()].some(other => other.number !== seasonNumber && other.episodes.has(id))) continue;
			const label = clean(link.querySelector('[class*="StyledPrimaryTitle"]')?.textContent ?? link.querySelector("p")?.textContent);
			const episode = cardEpisode(label);
			if (!episode) continue;
			const accessible = link.getAttribute("aria-label");
			const coordinates = cardCoordinates(accessible);
			// On multi-season pages the menu label can update before the old grid is replaced.
			if (seasonMenu && !coordinates) continue;
			if (coordinates && (coordinates.season !== seasonNumber || coordinates.episode !== episode.number)) continue;
			season.episodes.set(id, { playbackId: id, ...episode });
		}
		if (season.episodes.size) details.seasons.set(seasonNumber, season);
	}
}

export function startHboMaxCatalogCapture(doc: Document, loadSaved: (() => Promise<HboMaxPlaybackMetadata | null>) | undefined =
	typeof chrome !== "undefined" && chrome.runtime?.sendMessage ?
		() => chrome.runtime.sendMessage({ type: "ANIDACHI_HBOMAX_SAVED_METADATA" }) : undefined): () => void {
	if (doc.location.origin !== "https://www.hbomax.com") return () => {};
	let requested: string | null = null;
	let generation = 0;
	const forget = () => {
		generation++;
		priorDetail.delete(doc);
		lastPlayer.delete(doc);
		requested = null;
		roomSource.delete(doc);
		savedSource.delete(doc);
		detailsByDocument.delete(doc);
		movieClicks.delete(doc);
	};
	const update = () => {
		const id = hboMaxPlaybackId(doc.location.href);
		if (id !== requested) {
			if (requested && lastPlayer.get(doc)?.id !== requested) {
				const mounted = playerLabels(doc);
				if (mounted) lastPlayer.set(doc, { id: requested, labels: mounted });
			}
			const current = ++generation;
			savedSource.delete(doc);
			requested = id;
			if (id && loadSaved && !readHboMaxPlaybackMetadata(doc, id)) {
				void loadSaved().then(metadata => {
					if (metadata && current === generation && hboMaxPlaybackId(doc.location.href) === id)
						savedSource.set(doc, metadata);
				}).catch(() => {});
			}
		}
		if (hboMaxDetail(doc.location.href)) captureDetails(doc);
		else if (!hboMaxPlaybackId(doc.location.href)) {
			detailsByDocument.delete(doc);
			movieClicks.delete(doc);
		}
	};
	const click = (event: Event) => {
		update();
		const details = detailsByDocument.get(doc);
		if (details?.kind === "movie" && hboMaxDetail(doc.location.href)) movieClicks.delete(doc);
		if (details?.kind === "movie" && hboMaxDetail(doc.location.href)?.id === details.id &&
			event.target instanceof Element && isPrimaryMovieControl(event.target))
			movieClicks.set(doc, { detail: details, at: Date.now() });
	};
	const authChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
		const change = changes.authTokens;
		const previous = change?.oldValue as Partial<ExtensionAuthTokens> | undefined;
		const next = change?.newValue as Partial<ExtensionAuthTokens> | undefined;
		if (area === "local" && change && (previous?.user?.id !== next?.user?.id || previous?.authSessionId !== next?.authSessionId)) forget();
	};
	if (typeof chrome !== "undefined") chrome.storage?.onChanged?.addListener(authChanged);
	const navigation = doc.defaultView?.navigation;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let observedPath = "";
	const observer = new MutationObserver(() => {
		if (doc.location.pathname !== observedPath) { routeChanged(); return; }
		if (!hboMaxDetail(doc.location.href) || timer !== undefined) return;
		timer = setTimeout(() => { timer = undefined; update(); }, 80);
	});
	function routeChanged() {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		observedPath = doc.location.pathname;
		observer.disconnect();
		if (hboMaxDetail(doc.location.href)) {
			observer.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true,
				attributeFilter: ["href", "aria-hidden", "hidden", "src", "srcset", "aria-selected"] });
		} else if (!navigation) {
			// Chromium provides navigation events. Other environments need only detect a route change.
			observer.observe(doc, { subtree: true, childList: true });
		}
		update();
	}
	routeChanged();
	doc.addEventListener("click", click, true);
	doc.defaultView?.addEventListener("popstate", routeChanged);
	navigation?.addEventListener("currententrychange", routeChanged);
	return () => {
		if (timer !== undefined) clearTimeout(timer);
		observer.disconnect();
		doc.removeEventListener("click", click, true);
		doc.defaultView?.removeEventListener("popstate", routeChanged);
		navigation?.removeEventListener("currententrychange", routeChanged);
		if (typeof chrome !== "undefined") chrome.storage?.onChanged?.removeListener(authChanged);
		forget();
	};
}

function isPrimaryMovieControl(target: Element): boolean {
	const button = target.closest('[data-testid="play_button"], [data-testid="restart_button"]');
	const info = button?.closest('[data-testid="infoBlockFullContent"]');
	if (!info || !button) return false;
	const primary = info.querySelector('[data-testid="play_button"]');
	return button === primary || (button.getAttribute("data-testid") === "restart_button" &&
		button.parentElement?.contains(info.querySelector('[data-testid="myList_button"]')) === true);
}

function playerInfo(doc: Document) {
	const selector = '[data-testid="playerContainer"] [data-testid="content-metadata"]';
	// Responsive catch-up controls can repeat the series title without episode details.
	return (doc.querySelector(selector + ' [data-testid="player-ux-season-episode"]') ??
		doc.querySelector(selector + ' [data-testid="player-ux-asset-title"]'))?.closest('[data-testid="content-metadata"]') ?? null;
}

function playerLabels(doc: Document): PlayerLabels | null {
	const info = playerInfo(doc);
	const title = clean(info?.querySelector('[data-testid="player-ux-asset-title"]')?.textContent);
	if (!title) return null;
	return { title, ordinalLabel: clean(info?.querySelector('[data-testid="player-ux-season-episode"]')?.textContent),
		subtitle: clean(info?.querySelector('[data-testid="player-ux-asset-subtitle"]')?.textContent) };
}

export function readHboMaxPlayerTitle(doc: Document, playbackId: string): string | null {
	return hboMaxPlaybackId(doc.location.href) === playbackId ?
		clean(playerInfo(doc)?.querySelector('[data-testid="player-ux-asset-title"]')?.textContent) : null;
}

export function readHboMaxPlaybackMetadata(doc: Document, playbackId: string): HboMaxPlaybackMetadata | null {
	if (hboMaxPlaybackId(doc.location.href) !== playbackId) return null;
	const details = detailsByDocument.get(doc);
	const labels = playerLabels(doc);
	if (!labels) return null;
	const { title, ordinalLabel, subtitle } = labels;
	const prior = lastPlayer.get(doc);
	if (prior && prior.id !== playbackId && sameTitle(prior.labels.title, title) &&
		prior.labels.ordinalLabel === ordinalLabel && sameTitle(prior.labels.subtitle, subtitle)) return null;
	lastPlayer.set(doc, { id: playbackId, labels });
	const source = roomSource.get(doc);
	let fallback = savedSource.get(doc);
	const identity = source?.hbomaxIdentity;
	if (source && identity && source.sourceUrl === hboMaxSourceUrl(playbackId)) {
		const movie = identity.kind === "movie";
		const seriesTitle = clean(movie ? source.title : source.seriesTitle);
		const episodeTitle = movie ? seriesTitle : clean(source.episodeTitle);
		if (seriesTitle && episodeTitle)
			fallback = { identity, title: seriesTitle, displayTitle: movie ? seriesTitle : seriesTitle + " — " + episodeTitle,
				episodeTitle, seasonNumber: source.seasonNumber ?? null, episodeNumber: source.episodeNumber ?? null,
				seasonTitle: null, artworkUrl: source.posterUrl ? hboMaxArtworkUrl(source.posterUrl) : null };
	}
	const coordinates = playerOrdinals(ordinalLabel);
	let verified: HboMaxPlaybackMetadata | null = null;
	if (fallback?.identity.kind === "movie" && fallback.identity.providerPlaybackId === playbackId && !ordinalLabel && !subtitle) {
		verified = { ...fallback, title, displayTitle: title, episodeTitle: title };
	}
	if (fallback?.identity.kind === "episode" && fallback.identity.providerEpisodeIdentifier === playbackId && subtitle && coordinates &&
		fallback.seasonNumber === coordinates.season && fallback.episodeNumber === coordinates.episode) {
		verified = { ...fallback, title, displayTitle: title + " — " + subtitle, episodeTitle: subtitle };
	}
	if (!details || !sameTitle(details.title, title)) return verified;
	if (details.kind === "movie") {
		if (ordinalLabel || subtitle) return null;
		const click = movieClicks.get(doc);
		if (click) {
			movieClicks.delete(doc);
			if (click.detail === details && Date.now() - click.at < 60_000) details.movieId = playbackId;
		}
		if (details.movieId !== playbackId) return verified;
		return { title, displayTitle: title, artworkUrl: details.artworkUrl, episodeTitle: title, episodeNumber: null, seasonNumber: null,
			seasonTitle: null, identity: { kind: "movie", providerMovieId: details.id, providerPlaybackId: playbackId } };
	}
	const season = coordinates && details.seasons.get(coordinates.season);
	const episode = season?.episodes.get(playbackId);
	if (!season || !episode || episode.number !== coordinates?.episode || !sameTitle(episode.title, subtitle)) return verified;
	return { title, displayTitle: title + " — " + episode.title, artworkUrl: details.artworkUrl, episodeTitle: episode.title,
		episodeNumber: episode.number, seasonNumber: season.number, seasonTitle: season.title,
		identity: { kind: "episode", providerSeriesId: details.id, providerEpisodeIdentifier: playbackId } };
}
