import { catalogEpisode, episodeCoordinates, seasonOrdinal } from "./episode-labels";
import { getHboCmsPacket, hboCmsVisitSignal, startHboCmsClient } from "./cms-client";
import type { HboCmsPlayback } from "./cms-catalog";
import { hboMaxMediaSource, hboMaxVideo, isHboMaxAd } from "./player";
import { isVisibleInPlayer } from "./player-chrome";
import type { ExtensionAuthTokens } from "../../auth-tokens";
import { isHboMaxOrigin, hboMaxArtworkUrl, hboMaxDetail, hboMaxPlaybackId, hboMaxSourceUrl, hboMaxFingerprint, WatchSourceDescriptorSchema, type WatchSourceDescriptor, type HboMaxHistoryIdentity } from "@anidachi/protocol";

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
const corroboratedPlayer = new WeakMap<Document, { visit: AbortSignal; playbackId: string; seriesId: string; season: number; episode: number }>();

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
	const text = value?.replace(/\p{Bidi_Control}/gu, "").replace(/\s+/gu, " ").trim();
	return text && text.length <= 300 ? text : null;
}
function sameTitle(a: string | null | undefined, b: string | null | undefined) {
	const comparable = (value?: string | null) => value?.normalize("NFC").replace(/[‘’]/gu, "'");
	return comparable(a) === comparable(b);
}

export function getHboMaxDetails(doc: Document) { return detailsByDocument.get(doc); }

function catalogArtwork(root: ParentNode, title: string): string | null {
	for (const img of root.querySelectorAll<HTMLImageElement>("img[alt]")) {
		if (clean(img.alt) !== title) continue;
		const picture = img.closest("picture");
		const sets = [img.srcset, ...Array.from(picture?.querySelectorAll("source[srcset]") ?? [], source => source.getAttribute("srcset") ?? "")];
		const candidates = [img.currentSrc, img.src, ...sets.flatMap(set => set.split(",").map(entry => entry.trim().split(/\s+/u)[0]))];
		for (const candidate of candidates) {
			const url = candidate && hboMaxArtworkUrl(candidate);
			if (url) return url;
		}
	}
	return null;
}

function captureDetails(doc: Document) {
	const entity = hboMaxDetail(doc.location.href);
	if (!entity) return;
	const main = doc.querySelector("main");
	const root = main ?? doc;
	const heading = root.querySelector('[role="heading"][aria-level="1"]:not([aria-hidden="true"])') ??
		root.querySelector('h1:not([role="presentation"]):not([aria-hidden="true"])');
	const title = clean(heading?.getAttribute("aria-label")) ?? clean(heading?.textContent);
	const mainTitle = clean(main?.getAttribute("aria-label"));
	if (!heading || !title || (mainTitle && !sameTitle(mainTitle, title))) return;
	const previous = priorDetail.get(doc);
	if (previous && previous.id !== entity.id && previous.heading === heading && previous.title === title) return;
	let details = detailsByDocument.get(doc);
	if (details?.id !== entity.id || details.kind !== entity.kind || details.title !== title || details.locale !== doc.documentElement.lang) {
		const excluded = new Set<string>();
		if (details && details.id !== entity.id) {
			for (const season of details.seasons.values()) for (const id of season.episodes.keys()) excluded.add(id);
		}
		priorDetail.set(doc, { id: entity.id, title, heading, excluded });
		details = { ...entity, title, locale: doc.documentElement.lang, artworkUrl: null, seasons: new Map(), movieId: null };
		detailsByDocument.set(doc, details);
		movieClicks.delete(doc);
	}
	details.artworkUrl = catalogArtwork(root, title) ?? details.artworkUrl;
	if (details.kind !== "series") return;
	for (const panel of root.querySelectorAll('[role="tabpanel"]:not([hidden]):not([aria-hidden="true"])')) {
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
			const episode = catalogEpisode(label, link.getAttribute("aria-label"), seasonTitle, seasonNumber, Boolean(seasonMenu));
			if (!episode) continue;
			season.episodes.set(id, { playbackId: id, ...episode });
		}
		if (season.episodes.size) details.seasons.set(seasonNumber, season);
	}
}

export function startHboMaxCatalogCapture(doc: Document, loadSaved: (() => Promise<HboMaxPlaybackMetadata | null>) | undefined =
	typeof chrome !== "undefined" && chrome.runtime?.sendMessage ?
		() => chrome.runtime.sendMessage({ type: "ANIDACHI_HBOMAX_SAVED_METADATA" }) : undefined): () => void {
	if (!isHboMaxOrigin(doc.location.origin)) return () => {};
	const cmsClient = startHboCmsClient(doc);
	let requested: string | null = null;
	let generation = 0;
	const forget = () => {
		generation++;
		cmsClient.reset();
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
			if (id && loadSaved && (getHboCmsPacket(doc, id)?.metadata || !readHboMaxPlaybackMetadata(doc, id))) {
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
		cmsClient.sync();
		observer.disconnect();
		if (hboMaxDetail(doc.location.href)) {
			observer.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true,
				attributeFilter: ["href", "aria-hidden", "hidden", "src", "srcset", "aria-selected", "aria-label", "lang"] });
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
		cmsClient.stop();
	};
}

function isPrimaryMovieControl(target: Element): boolean {
	const button = target.closest('[data-testid="play_button"], [data-testid="restart_button"]');
	const info = button?.closest('[data-testid="infoBlockFullContent"]');
	if (!info || !button) return false;
	const primary = info.querySelector('[data-testid="play_button"]');
	return button === primary || (button.getAttribute("data-testid") === "restart_button" &&
		Boolean(primary) && button.parentElement === primary?.parentElement);
}

function playerInfo(doc: Document) {
	const selector = '[data-testid="playerContainer"] [data-testid="content-metadata"]';
	// Responsive catch-up controls can repeat the series title without episode details.
	return (doc.querySelector(selector + ' [data-testid="player-ux-season-episode"]') ??
		doc.querySelector(selector + ' [data-testid="player-ux-asset-title"]'))?.closest('[data-testid="content-metadata"]') ?? null;
}

function playerLabels(doc: Document, info = playerInfo(doc)): PlayerLabels | null {
	const title = clean(info?.querySelector('[data-testid="player-ux-asset-title"]')?.textContent);
	if (!title) return null;
	return { title, ordinalLabel: clean(info?.querySelector('[data-testid="player-ux-season-episode"]')?.textContent),
		subtitle: clean(info?.querySelector('[data-testid="player-ux-asset-subtitle"]')?.textContent) };
}

export function readHboMaxPlayerTitle(doc: Document, playbackId: string): string | null {
	return hboMaxPlaybackId(doc.location.href) === playbackId ?
		clean(playerInfo(doc)?.querySelector('[data-testid="player-ux-asset-title"]')?.textContent) : null;
}

function visibleCmsLabels(doc: Document): PlayerLabels | null {
	let titleOnly: PlayerLabels | null = null;
	for (const info of doc.querySelectorAll('[data-testid="playerContainer"] [data-testid="content-metadata"]')) {
		const player = info.closest<HTMLElement>('[data-testid="playerContainer"]')!;
		const text = (testId: string) => {
			const label = info.querySelector('[data-testid="' + testId + '"]');
			return label && !label.closest('[hidden], [aria-hidden="true"]') && isVisibleInPlayer(label, player) ? clean(label.textContent) : null;
		};
		const title = text("player-ux-asset-title");
		if (!title) continue;
		const labels = { title, subtitle: text("player-ux-asset-subtitle"), ordinalLabel: text("player-ux-season-episode") };
		if (labels.subtitle || labels.ordinalLabel) return labels;
		titleOnly = labels;
	}
	return titleOnly;
}

function corroborateHboCmsPlayback(doc: Document, playbackId: string, cms: HboCmsPlayback): HboMaxPlaybackMetadata | null {
	const seriesId = cms.identity.providerSeriesId;
	const visit = hboCmsVisitSignal(doc, playbackId);
	if (!visit) return null;
	const source = roomSource.get(doc);
	const room = source?.sourceUrl === hboMaxSourceUrl(playbackId) ? source : undefined;
	const saved = savedSource.get(doc);
	let independentIdentity = false;
	let verifiedArtwork: string | null = null;
	for (const reference of [
		{ identity: room?.hbomaxIdentity, season: room?.seasonNumber, episode: room?.episodeNumber, artwork: room?.posterUrl },
		{ identity: saved?.identity, season: saved?.seasonNumber, episode: saved?.episodeNumber, artwork: saved?.artworkUrl },
	]) {
		const identity = reference.identity;
		if (!identity) continue;
		const video = identity.kind === "movie" ? identity.providerPlaybackId : identity.providerEpisodeIdentifier;
		if (video !== playbackId) continue;
		if (identity.kind !== "episode" || identity.providerSeriesId !== seriesId ||
			(reference.season != null && reference.season !== cms.seasonNumber) ||
			(reference.episode != null && reference.episode !== cms.episodeNumber)) return null;
		independentIdentity = true;
		if (!verifiedArtwork && reference.artwork) verifiedArtwork = hboMaxArtworkUrl(reference.artwork);
	}
	const details = detailsByDocument.get(doc);
	const matchingDetail = details?.kind === "series" && details.id === seriesId ? details : null;
	const card = matchingDetail?.seasons.get(cms.seasonNumber)?.episodes.get(playbackId);
	if (card && card.number !== cms.episodeNumber) return null;
	if (card) independentIdentity = true;
	const previous = corroboratedPlayer.get(doc);
	if (previous?.visit === visit && previous.playbackId === playbackId) {
		if (previous.seriesId !== seriesId || previous.season !== cms.seasonNumber || previous.episode !== cms.episodeNumber) return null;
		independentIdentity = true;
	}
	let labels = visibleCmsLabels(doc);
	let coordinates = episodeCoordinates(labels?.ordinalLabel ?? null, cms.seasonTitle);
	if (!labels?.subtitle && !coordinates) {
		const video = hboMaxVideo(doc);
		if (!video?.parentElement || !hboMaxMediaSource(video) || video.readyState < 2 ||
			!Number.isFinite(video.duration) || video.duration <= 0 || isHboMaxAd(video.parentElement)) return null;
		// HBO hides both responsive control layouts while idle but keeps the active episode on the page itself.
		const mainTitle = clean((video.closest("main") ?? doc.querySelector("main[aria-label]"))?.getAttribute("aria-label"));
		const documentEpisode = /^(.+)\s+[•·]\s+HBO Max$/iu.exec(clean(doc.title) ?? "")?.[1];
		let collapsed: PlayerLabels | null = null;
		for (const info of video.parentElement.querySelectorAll('[data-testid="content-metadata"]')) {
			const row = playerLabels(doc, info);
			if (!row || (!row.subtitle && !row.ordinalLabel)) continue;
			if (collapsed && (!sameTitle(collapsed.title, row.title) ||
				(collapsed.subtitle && row.subtitle && !sameTitle(collapsed.subtitle, row.subtitle)))) return null;
			const pair = episodeCoordinates(row.ordinalLabel, cms.seasonTitle);
			if (pair && (pair.season !== cms.seasonNumber || pair.episode !== cms.episodeNumber)) return null;
			if (!collapsed || row.subtitle) collapsed = row;
		}
		const expectedTitle = independentIdentity ? collapsed?.subtitle ?? cms.episodeTitle : cms.episodeTitle;
		if (documentEpisode && !sameTitle(documentEpisode, expectedTitle)) return null;
		// In-player Next and autoplay can leave <main> on the first episode for the entire visit.
		const playerMatchesTab = documentEpisode && collapsed?.subtitle && sameTitle(collapsed.subtitle, documentEpisode);
		if (!playerMatchesTab && mainTitle && !sameTitle(mainTitle, expectedTitle)) return null;
		if (!independentIdentity && (!(mainTitle || documentEpisode) || (!collapsed?.subtitle && !(mainTitle && documentEpisode)))) return null;
		if (collapsed) {
			labels = collapsed;
			coordinates = episodeCoordinates(collapsed.ordinalLabel, cms.seasonTitle);
		}
	}
	if (coordinates && (coordinates.season !== cms.seasonNumber || coordinates.episode !== cms.episodeNumber)) return null;
	// A separately verified watch can have localized display strings. The player still controls the coordinates.
	if (labels && (!independentIdentity || !coordinates) && (!sameTitle(labels.title, cms.title) ||
		(labels.subtitle && !sameTitle(labels.subtitle, cms.episodeTitle)))) return null;
	if (labels?.subtitle || coordinates) {
		corroboratedPlayer.set(doc, { visit, playbackId, seriesId, season: cms.seasonNumber, episode: cms.episodeNumber });
	}
	const title = labels?.title ?? cms.title;
	const episodeTitle = labels?.subtitle ?? cms.episodeTitle;
	return { ...cms, title, episodeTitle, displayTitle: title + " — " + episodeTitle, artworkUrl: matchingDetail?.artworkUrl ?? verifiedArtwork };
}

export function readHboMaxPlaybackMetadata(doc: Document, playbackId: string, loadedEpisode?: HboCmsPlayback): HboMaxPlaybackMetadata | null {
	if (hboMaxPlaybackId(doc.location.href) !== playbackId) return null;
	const packet = getHboCmsPacket(doc, playbackId);
	const metadata = resolvePlayback(doc, playbackId, packet?.metadata) ??
		(!packet?.metadata && loadedEpisode?.identity.kind === "episode" && loadedEpisode.identity.providerEpisodeIdentifier === playbackId ? loadedEpisode : null);
	if (!metadata || !packet?.poster) return metadata;
	const identity = metadata.identity;
	const titleId = identity.kind === "episode" ? identity.providerSeriesId : identity.providerMovieId;
	return packet.poster.titleId === titleId ? { ...metadata, artworkUrl: packet.poster.url } : metadata;
}

function resolvePlayback(doc: Document, playbackId: string, cms: HboCmsPlayback | null | undefined): HboMaxPlaybackMetadata | null {
	if (cms) return corroborateHboCmsPlayback(doc, playbackId, cms);
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
	const season = details?.kind === "series" ? [...details.seasons.values()].find(item => item.episodes.has(playbackId)) : undefined;
	const coordinates = episodeCoordinates(ordinalLabel, season?.title ?? fallback?.seasonTitle);
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
	const episode = season?.episodes.get(playbackId);
	if (!season || !episode || season.number !== coordinates?.season || episode.number !== coordinates.episode || !sameTitle(episode.title, subtitle)) return verified;
	return { title, displayTitle: title + " — " + episode.title, artworkUrl: details.artworkUrl, episodeTitle: episode.title,
		episodeNumber: episode.number, seasonNumber: season.number, seasonTitle: season.title,
		identity: { kind: "episode", providerSeriesId: details.id, providerEpisodeIdentifier: playbackId } };
}
