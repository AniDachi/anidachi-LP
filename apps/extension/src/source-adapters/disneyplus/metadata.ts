import { disneyControlsPortal, findDisneyPlusElement } from "./dom";
import { decimalDigits } from "./published-title";
import {
	disneyPlusEntityId, disneyPlusRouteLocale,
	disneyPlusPlaybackId,
	disneyPlusFingerprint,
	disneyPlusSourceUrl,
	WatchSourceDescriptorSchema,
	type WatchSourceDescriptor,
	type DisneyPlusHistoryIdentity,
} from "@anidachi/protocol";

export type DisneyPlusPlaybackMetadata = {
	identity: DisneyPlusHistoryIdentity;
	title: string;
	episodeTitle: string;
	seasonTitle: string | null;
	seasonNumber: number | null;
	namedSeasonId?: string;
	episodeNumber: number | null;
	artworkUrl: string | null;
};

export type DisneyPlusEpisode = { playbackId: string; title: string; number: number };
export type DisneyPlusSeason = { number: number | null; providerId?: string; title: string; episodes: Map<string, DisneyPlusEpisode> };
export type DisneyPlusDetails = {
	entityId: string;
	title: string;
	artworkUrl: string | null;
	locale: string;
	movieId: string | null;
	seasons: Map<number | string, DisneyPlusSeason>;
};

// Retain only the current details page's public roster in this document. Browse
// observations do not create progress or a durable list of visited titles.
const detailsByDocument = new WeakMap<Document, DisneyPlusDetails>();
const previousEntityEpisodes = new WeakMap<Document, Set<string>>();
// Only a provider-resolved play -> entity relationship may bind an alternate regional playable.
const publishedPlayback = new WeakMap<Document, { id: string; details: DisneyPlusDetails }>();
export function observePublishedDisneyTitle(doc: Document, id: string, details: DisneyPlusDetails) {
	publishedPlayback.set(doc, { id, details });
	restoreDisneyPlusDetails(doc, details);
}

function bindDisneyEdition(doc: Document, details: DisneyPlusDetails, playbackId: string) {
	const binding = publishedPlayback.get(doc);
	if (binding?.id !== playbackId || binding.details !== details) return;
	const portal = disneyControlsPortal(doc);
	const button = portal && findDisneyPlusElement(portal, ".title-bug-container button.title-btn");
	const normalize = (text: string) => decimalDigits(text.normalize("NFKC")).replace(/\s+/gu, " ").trim().toLocaleLowerCase(details.locale);
	const title = displayText(button?.querySelector(".title-field")?.textContent);
	const label = displayText(button?.querySelector(".subtitle-field")?.textContent);
	if (!title || !label || normalize(title) !== normalize(details.title)) return;
	const caption = normalize(label);
	// Compare both ordinals and the actual episode title. The series redirect alone
	// cannot distinguish regional edits, trailers, or two episodes with the same name.
	for (const season of details.seasons.values()) {
		for (const [publicId, episode] of season.episodes) {
			const suffix = normalize(episode.title);
			if (!caption.endsWith(suffix)) continue;
			const digits = caption.slice(0, -suffix.length).match(/\d+/gu);
			if (!digits || digits.length !== 2 || Number(digits[0]) !== season.number || Number(digits[1]) !== episode.number) continue;
			season.episodes.delete(publicId);
			season.episodes.set(playbackId, { ...episode, playbackId });
			publishedPlayback.delete(doc);
			return;
		}
	}
}

const roomPlayback = new WeakMap<Document, DisneyPlusPlaybackMetadata>();
const priorPlayback = new WeakMap<Document, DisneyPlusPlaybackMetadata>();
const lastHeading = new WeakMap<Document, { title: string; entityId: string; element: Element }>();

function displayText(value: string | null | undefined): string | null {
	const text = value?.replace(/\s+/gu, " ").trim();
	return text && text.length <= 300 ? text : null;
}

function artwork(doc: Document): string | null {
	const img = doc.querySelector<HTMLImageElement>('img[data-testid="details-page-background-image-responsive"]');
	const src = img?.currentSrc || img?.getAttribute("src");
	if (!src || src.length > 2048) return null;
	try {
		const url = new URL(src, doc.baseURI);
		return url.origin === "https://disney.images.edge.bamgrid.com" && !url.username && !url.password && url.pathname !== "/" ? url.href : null;
	} catch { return null; }
}

function playId(link: HTMLAnchorElement | null): string | null {
	return link && !link.hasAttribute("disabled") && link.getAttribute("aria-disabled") !== "true"
		? disneyPlusPlaybackId(link.href) : null;
}

function ordinal(value: string | undefined): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
}

function localeFor(doc: Document): string | null {
	const pathLocale = disneyPlusRouteLocale(doc.location.pathname);
	const locale = pathLocale ?? doc.documentElement.lang;
	try { return Intl.getCanonicalLocales(locale)[0] ?? null; } catch { return null; }
}

function seasonHeadingBeforeGrid(panel: Element, grid: Element): string | null {
	// The single-season page places its caption alongside the grid. Only accept
	// a standalone heading/paragraph, never text from a card or an adjacent grid.
	const labelSelector = "p, h1, h2, h3, h4, h5, h6, [role=heading]";
	for (let node: Element | null = grid; node && node !== panel; node = node.parentElement) {
		const before = node.previousElementSibling;
		if (!before) continue;
		const captions = before.matches(labelSelector) ? [before] : before.querySelectorAll(labelSelector);
		if (captions.length !== 1 || before.matches('[data-testid="set-grid"]') ||
			before.querySelector('[data-testid="set-grid"]')) return null;
		const caption = displayText(captions[0]?.textContent);
		return caption && caption === displayText(before.textContent) ? caption : null;
	}
	return null;
}

function readSeason(panel: Element): DisneyPlusSeason | null {
	const grids = Array.from(panel.querySelectorAll('[data-testid="set-grid"]')).filter(grid => !grid.closest('[hidden], [aria-hidden="true"]'));
	if (grids.length !== 1) return null;
	const grid = grids[0]!;
	const caption = displayText(panel.querySelector('[data-testid="dropdown-button"]')?.textContent) ?? seasonHeadingBeforeGrid(panel, grid);
	const captionNumbers = caption?.match(/\d+/gu);
	let seasonNumber = captionNumbers?.length === 1 ? ordinal(captionNumbers[0]) : null;
	if (caption && !seasonNumber) return null;
	const links = grid.querySelectorAll<HTMLAnchorElement>('a[data-testid="set-item"][href]');
	if (!links.length || links.length > 2000) return null;
	const episodes = new Map<string, DisneyPlusEpisode>();
	const positions = new Map<number, string>();
	for (const link of links) {
		const id = playId(link);
		const rowTitle = link.querySelector('[data-testid="standard-regular-list-item-title"]')?.textContent?.trim();
		const parts = /^(\d{1,4})\s*[.．]\s*(.+)$/u.exec(rowTitle ?? "");
		const number = ordinal(parts?.[1]);
		const title = displayText(parts?.[2]);
		if (!id || !number || !title) continue;
		// Corroborate both displayed ordinals before accepting rows left in
		// the DOM while Disney switches the selected season.
		const label = link.getAttribute("aria-label") ?? "";
		const titleIndex = label.indexOf(title);
		if (titleIndex <= 0) continue;
		const prefix = label.slice(0, titleIndex);
		const numbers = prefix.match(/\d+/gu);
		const labelSeason = ordinal(numbers?.at(-2));
		if (!labelSeason || ordinal(numbers?.at(-1)) !== number) continue;
		// Without a separate caption, the roster can establish its common
		// season ordinal. Avoid extracting translated words from accessibility copy.
		if (!seasonNumber) seasonNumber = labelSeason;
		if (seasonNumber !== labelSeason) {
			if (!caption) return null;
			continue;
		}
		if ((episodes.has(id) && episodes.get(id)?.number !== number) ||
			(positions.has(number) && positions.get(number) !== id)) return null;
		positions.set(number, id);
		episodes.set(id, { playbackId: id, title, number });
	}
	return episodes.size && seasonNumber ? { number: seasonNumber, title: caption ?? String(seasonNumber), episodes } : null;
}

export function captureDisneyPlusDetails(doc: Document): void {
	const entityId = disneyPlusEntityId(doc.location.href);
	if (!entityId) return;
	const heading = doc.querySelector<HTMLImageElement>('[data-testid="details-title-treatment"] img');
	const title = displayText(heading?.alt);
	const locale = localeFor(doc);
	if (!heading || !title || !locale) return;
	const previous = lastHeading.get(doc);
	// A SPA may commit the address before replacing its detail subtree.
	if (previous && previous.entityId !== entityId && previous.element === heading && previous.title === title) return;
	lastHeading.set(doc, { title, element: heading, entityId });

	const prior = detailsByDocument.get(doc);
	if (prior && prior.entityId !== entityId) {
		// The heading may update before React replaces the episode grid. Never
		// bind an old title's already-observed play IDs to a different series.
		previousEntityEpisodes.set(doc, new Set([...prior.seasons.values()].flatMap(s => [...s.episodes.keys()])));
	}
	const details = prior?.entityId === entityId && prior.locale === locale ? prior : {
		entityId, locale, title, artworkUrl: null, movieId: null, seasons: new Map<number | string, DisneyPlusSeason>(),
	};
	details.title = title;
	details.artworkUrl = artwork(doc) ?? details.artworkUrl;
	const episodesTab = doc.querySelector('[role="tab"][aria-controls="episodes"]');
	const panel = doc.querySelector('#episodes[role="tabpanel"]');
	if (episodesTab && panel) {
		details.movieId = null;
		const options = panel.querySelectorAll('[data-testid="dropdown-list"][role="listbox"] [role="option"]');
		if (options.length <= 100) for (const option of options) {
			const name = displayText(option.textContent);
			const numbers = name?.match(/\d+/gu);
			const number = numbers?.length === 1 ? ordinal(numbers[0]) : null;
			if (name && number && !details.seasons.has(number)) details.seasons.set(number, { number, title: name, episodes: new Map() });
		}
		const season = readSeason(panel);
		if (season?.number != null) {
			const previousIds = previousEntityEpisodes.get(doc);
			if (previousIds) for (const id of season.episodes.keys()) if (previousIds.has(id)) season.episodes.delete(id);
			// A grid can be incrementally rendered. Keep other observed rows from
			// this season, while letting the latest visible position replace an old variant.
			const positions = new Set([...season.episodes.values()].map(episode => episode.number));
			for (const [id, episode] of details.seasons.get(season.number)?.episodes ?? [])
				if (!positions.has(episode.number) && !season.episodes.has(id)) season.episodes.set(id, episode);
			details.seasons.set(season.number, season);
		}
	} else if (!episodesTab && !panel && !details.seasons.size) {
		const primary = playId(doc.querySelector<HTMLAnchorElement>('a[data-testid="playback-action-button"][href]'));
		// A film's own entity is its primary playable, and the masthead describes
		// the film duration. A series hero that starts an episode cannot qualify.
		const masthead = doc.querySelector('[data-testid="masthead-metadata"]')?.textContent ?? "";
		if (primary === entityId && /\d\s*(?:h\b|h(?=\s*\d)|min\b|hr\b|hour|hora|minute|分钟|分鐘|分)/iu.test(masthead))
			details.movieId = primary;
	}
	detailsByDocument.set(doc, details);
}

export function readDisneyPlusPlayerTitle(doc: Document, playbackId: string): string | null {
	if (disneyPlusPlaybackId(doc.location.href) !== playbackId) return null;
	const title = /^(.*?)\s*\|\s*Disney\+\s*$/iu.exec(doc.title)?.[1];
	return displayText(title);
}

export function readDisneyPlusPlaybackMetadata(doc: Document, playbackId: string): DisneyPlusPlaybackMetadata | null {
	if (disneyPlusPlaybackId(doc.location.href) !== playbackId) return null;
	const details = detailsByDocument.get(doc);
	const exact = (item: DisneyPlusPlaybackMetadata | undefined) => item &&
		(item.identity.kind === "episode" ? item.identity.providerEpisodeIdentifier : item.identity.providerMovieId) === playbackId ? item : null;
	const saved = exact(priorPlayback.get(doc)) ?? exact(roomPlayback.get(doc));
	if (!details) return saved;
	if (!details.movieId && ![...details.seasons.values()].some(season => season.episodes.has(playbackId))) {
		bindDisneyEdition(doc, details, playbackId);
	}
	const common = { title: details.title, artworkUrl: details.artworkUrl };
	if (details.movieId === playbackId)
		return { ...common, identity: { kind: "movie", providerMovieId: playbackId }, episodeTitle: details.title,
			seasonTitle: null, seasonNumber: null, episodeNumber: null };
	let metadata: DisneyPlusPlaybackMetadata | null = null;
	for (const season of details.seasons.values()) {
		const episode = season.episodes.get(playbackId);
		if (!episode) continue;
		if (metadata) return null;
		metadata = { ...common, identity: { kind: "episode", providerSeriesId: details.entityId, providerEpisodeIdentifier: playbackId },
			episodeTitle: episode.title, seasonTitle: season.title, seasonNumber: season.number, episodeNumber: episode.number,
			...(season.number === null && season.providerId && { namedSeasonId: season.providerId }) };
	}
	return metadata ?? saved;
}

/** Called for a currently admitted guest's authoritative host source. This
 * fallback describes only the playing item and creates no catalog availability. */
export function observeDisneyPlusRoomSource(doc: Document, descriptor: WatchSourceDescriptor): void {
	clearDisneyPlusRoomSource(doc);
	const parsed = WatchSourceDescriptorSchema.safeParse(descriptor);
	if (!parsed.success) return;
	const source = parsed.data;
	const id = disneyPlusPlaybackId(doc.location.href);
	const identity = source.disneyplusIdentity;
	if (!id || source.provider !== "disneyplus" || !identity || source.sourceUrl !== disneyPlusSourceUrl(id) ||
		source.canonicalUrl !== source.sourceUrl || source.videoFingerprint !== disneyPlusFingerprint(id) ||
		(identity.kind === "episode" ? identity.providerEpisodeIdentifier : identity.providerMovieId) !== id) return;
	const artworkUrl = source.posterUrl?.startsWith("https://disney.images.edge.bamgrid.com/") ? source.posterUrl : null;
	if (identity.kind === "movie") {
		const title = displayText(source.title);
		if (!title || source.episodeTitle || source.seasonNumber !== undefined || source.episodeNumber !== undefined) return;
		roomPlayback.set(doc, { identity, title, artworkUrl, episodeTitle: title, seasonNumber: null, seasonTitle: null, episodeNumber: null });
		return;
	}
	const title = displayText(source.seriesTitle), episodeTitle = displayText(source.episodeTitle);
	if (!title || !episodeTitle || (source.seasonNumber !== undefined && source.seasonNumber < 1) ||
		(source.episodeNumber !== undefined && source.episodeNumber < 1)) return;
	roomPlayback.set(doc, { identity, title, artworkUrl, episodeTitle, seasonNumber: source.seasonNumber ?? null,
		episodeNumber: source.episodeNumber ?? null, seasonTitle: null });
}

export function clearDisneyPlusRoomSource(doc: Document): void {
	roomPlayback.delete(doc);
}

export function getDisneyPlusDetails(doc: Document): DisneyPlusDetails | undefined {
	return detailsByDocument.get(doc);
}

export function restoreDisneyPlusDetails(doc: Document, details: DisneyPlusDetails): void {
	detailsByDocument.set(doc, details);
}

export function restoreDisneyPlusPlaybackMetadata(doc: Document, metadata: DisneyPlusPlaybackMetadata): void {
	priorPlayback.set(doc, metadata);
}

export function clearDisneyPlusDetails(doc: Document): void {
	detailsByDocument.delete(doc);
	publishedPlayback.delete(doc);
	previousEntityEpisodes.delete(doc);
	priorPlayback.delete(doc);
	clearDisneyPlusRoomSource(doc);
	lastHeading.delete(doc);
}
