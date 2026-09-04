import {
  isValidHistoryMedia,
  normalizeHistoryUrl,
  type HistoryObservation,
  type ProviderPlaybackMetadata,
  type SourceAdapterHistoryPolicy,
} from "../core/history-policy";
import type { VideoAdapter } from "../core/types";
import {
	inferCrunchyrollSeasonFromSourceUrl,
	inferCrunchyrollSeasonFromTitle,
	normalizeSeasonTitle,
	seasonNumberFromTitle,
} from "./season";

interface CrunchyrollProgressInput {
	title: string | null;
	video: HTMLVideoElement;
	roomId?: string;
	watchedWithCount: number;
}

export interface CrunchyrollCurrentObjectIdentity {
	providerSeriesId: string;
	providerSeasonIdentifier: string;
	providerEpisodeIdentifier: string;
	providerContentId: string;
	audioLocale: string | null;
	titleKey: `crunchyroll:series:${string}`;
	seasonKey: `crunchyroll:season:${string}`;
	episodeKey: `crunchyroll:episode:${string}`;
}

/**
 * Resolves one recorded watch GUID without claiming a complete series catalog.
 * Network traversal and retry ownership remain in the Crunchyroll MAIN-world
 * bridge; this helper consumes only its sanitized, already-fetched evidence.
 */
export function resolveCrunchyrollCurrentObjectIdentity(input: {
	watchId: string;
	objectResponse: unknown;
	seasonsResponse: unknown;
	episodesResponse: unknown;
}): CrunchyrollCurrentObjectIdentity | null {
	const watchId = readPathSafeId(input.watchId, "crunchyroll:watch:");
	if (!watchId) return null;

	const objects = responseData(input.objectResponse).filter(
		(record) => readIdentityString(record.id) === watchId,
	);
	if (objects.length !== 1) return null;

	const metadata = identityRecord(objects[0].episode_metadata);
	const providerSeriesId = readPathSafeId(
		metadata?.series_id,
		"crunchyroll:series:",
	);
	const objectVariants = identityRecords(metadata?.versions).filter(
		(variant) => readPathSafeId(variant.guid, "crunchyroll:raw:") === watchId,
	);
	if (!providerSeriesId || objectVariants.length !== 1) return null;

	const seasonGuid = readPathSafeId(
		objectVariants[0].season_guid,
		"crunchyroll:season:",
	);
	const objectSeasonGuid = readPathSafeId(
		metadata?.season_id,
		"crunchyroll:season:",
	);
	if (
		!seasonGuid ||
		(metadata?.season_id != null && objectSeasonGuid === null) ||
		(objectSeasonGuid && objectSeasonGuid !== seasonGuid)
	) {
		return null;
	}

	const seasons = responseData(input.seasonsResponse).filter(
		(season) =>
			(readPathSafeId(season.id, "crunchyroll:raw:") === seasonGuid ||
				matchingVariants(season, seasonGuid).length > 0) &&
			matchingVariants(season, seasonGuid).length === 1,
	);
	if (seasons.length !== 1) return null;
	const season = seasons[0];
	const seasonRawId = readPathSafeId(season.id, "crunchyroll:raw:");
	const providerSeasonIdentifier = readCanonicalPart(
		season.identifier,
		"crunchyroll:season:",
	);
	const objectSeasonIdentifier = readCanonicalPart(
		metadata?.season_identifier,
		"crunchyroll:season:",
	);
	const seasonSeriesId = readIdentityString(season.series_id);
	if (
		!seasonRawId ||
		!providerSeasonIdentifier ||
		!providerSeasonIdentifier.startsWith(`${providerSeriesId}|`) ||
		(metadata?.season_identifier != null &&
			objectSeasonIdentifier !== providerSeasonIdentifier) ||
		(season.series_id != null && seasonSeriesId === null) ||
		(seasonSeriesId !== null && seasonSeriesId !== providerSeriesId)
	) return null;
	const seasonAliases = new Set([
		seasonRawId,
		...identityRecords(season.versions).map((variant) =>
			readPathSafeId(variant.guid, "crunchyroll:raw:"),
		),
	].filter((value): value is string => value !== null));

	const episodes = responseData(input.episodesResponse).filter(
		(episode) =>
			(readPathSafeId(episode.id, "crunchyroll:raw:") === watchId ||
				matchingVariants(episode, watchId).length > 0) &&
			matchingVariants(episode, watchId).length === 1,
	);
	if (episodes.length !== 1) return null;
	const episode = episodes[0];
	if (!readPathSafeId(episode.id, "crunchyroll:raw:")) return null;
	const episodeVariant = matchingVariants(episode, watchId)[0];
	const episodeSeriesId = readIdentityString(episode.series_id);
	const episodeSeasonId = readIdentityString(episode.season_id);
	if (
		readIdentityString(episodeVariant.season_guid) !== seasonGuid ||
		(episode.series_id != null && episodeSeriesId === null) ||
		(episodeSeriesId !== null && episodeSeriesId !== providerSeriesId) ||
		(episode.season_id != null && episodeSeasonId === null) ||
		(episodeSeasonId !== null && !seasonAliases.has(episodeSeasonId))
	) {
		return null;
	}
	const providerEpisodeIdentifier = readCanonicalPart(
		episode.identifier,
		"crunchyroll:episode:",
	);
	if (
		!providerEpisodeIdentifier ||
		!providerEpisodeIdentifier.startsWith(`${providerSeasonIdentifier}|`)
	) return null;

	return {
		providerSeriesId,
		providerSeasonIdentifier,
		providerEpisodeIdentifier,
		providerContentId: watchId,
		audioLocale: readAudioLocale(objectVariants[0].audio_locale),
		titleKey: `crunchyroll:series:${providerSeriesId}`,
		seasonKey: `crunchyroll:season:${providerSeasonIdentifier}`,
		episodeKey: `crunchyroll:episode:${providerEpisodeIdentifier}`,
	};
}

function responseData(value: unknown): Array<Record<string, unknown>> {
	const response = identityRecord(value);
	return identityRecords(response?.data);
}

function identityRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function identityRecords(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value)
		? value.flatMap((item) => {
				const record = identityRecord(item);
				return record ? [record] : [];
			})
		: [];
}

function readIdentityString(value: unknown): string | null {
	return typeof value === "string" &&
		value.trim() === value &&
		value.length > 0 &&
		!/[\u0000-\u001f\u007f-\u009f]/u.test(value)
		? value
		: null;
}

function readCanonicalPart(value: unknown, prefix: string): string | null {
	const part = readIdentityString(value);
	return part && prefix.length + part.length <= 220 ? part : null;
}

function readPathSafeId(value: unknown, prefix: string): string | null {
	const id = readCanonicalPart(value, prefix);
	return id && /^[A-Za-z0-9_-]+$/u.test(id) ? id : null;
}

function readAudioLocale(value: unknown): string | null {
	const locale = readIdentityString(value);
	return locale &&
		locale.length <= 35 &&
		/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(locale)
		? locale
		: null;
}

function matchingVariants(
	record: Record<string, unknown>,
	guid: string,
): Array<Record<string, unknown>> {
	return identityRecords(record.versions).filter(
		(variant) => readPathSafeId(variant.guid, "crunchyroll:raw:") === guid,
	);
}

export function getCrunchyrollProgressEntry(
	input: CrunchyrollProgressInput,
): ProviderPlaybackMetadata | null {
	if (!location.hostname.endsWith("crunchyroll.com")) {
		return null;
	}

	const url = new URL(location.href);
	const match = url.pathname.match(/\/watch\/([^/?#]+)\/?([^/?#]*)?/);
	if (!match?.[1]) {
		return null;
	}

	const watchId = match[1];
	const slug = match[2] || watchId;
	const title =
		cleanCrunchyrollTitle(input.title ?? document.title) || toTitle(slug);
	const duration = Number.isFinite(input.video.duration)
		? input.video.duration
		: 0;
	const sourceUrl = `${url.origin}${url.pathname}`;
	const seriesInfo = getCrunchyrollSeriesInfo(title);
	const seasonInfo = getCrunchyrollSeasonInfo(title, sourceUrl);
	const isMovie = looksLikeMovie(title, duration);
	const isEpisode =
		!isMovie && (Boolean(seriesInfo.title) || looksLikeEpisode(title));
	const itemTitle = isEpisode ? (seriesInfo.title ?? toTitle(slug)) : title;
	const seasonTitle = isEpisode
		? normalizeSeasonTitleForSeries(
				seasonInfo.title,
				itemTitle,
				seasonInfo.number,
			)
		: seasonInfo.title;
	const seasonId =
		isEpisode && (seasonTitle || seasonInfo.number)
			? seasonInfo.seasonId
			: null;
	const seriesKey =
		slugify(seriesInfo.slug || seriesInfo.title || slug) || slug;

	return {
		provider: "crunchyroll",
		kind: isEpisode ? "episode" : "movie",
		itemId: isEpisode
			? `crunchyroll-series:${seriesKey}`
			: `crunchyroll-movie:${watchId}`,
		itemTitle,
		contentId: watchId,
		...(isEpisode && seriesInfo.seriesId
			? { seriesId: seriesInfo.seriesId }
			: {}),
		...(isEpisode && seasonId ? { seasonId } : {}),
		...(isEpisode && seasonTitle ? { seasonTitle } : {}),
		...(isEpisode && seasonInfo.number
			? { seasonNumber: seasonInfo.number }
			: {}),
		episodeId: watchId,
		episodeTitle: title,
		...(isEpisode && seriesInfo.artworkUrl
			? { artworkUrl: seriesInfo.artworkUrl }
			: {}),
		sourceUrl,
		currentTime: input.video.currentTime || 0,
		duration,
		roomId: input.roomId,
		watchedWithCount: input.watchedWithCount,
	};
}

export const crunchyrollHistoryPolicy: SourceAdapterHistoryPolicy = {
  observe: getCrunchyrollHistoryObservation,
};

export function getCrunchyrollHistoryObservation(input: {
  adapter: VideoAdapter;
}): HistoryObservation | null {
  const { adapter } = input;
  if (
    adapter.id !== "crunchyroll" ||
    adapter.provider !== "crunchyroll" ||
    !isValidHistoryMedia(adapter.video)
  ) {
    return null;
  }
  const url = getCanonicalCrunchyrollWatchUrl(location.href);
  if (!url) return null;
  const entry = getCrunchyrollProgressEntry({
    title: adapter.getTitle(),
    video: adapter.video,
    watchedWithCount: 1,
  });
  if (!entry) return null;
  const titleKey = entry.itemId.trim();
  const episodeKey = (entry.episodeId ?? entry.contentId ?? "").trim();
  const title = entry.itemTitle.trim();
  const episodeTitle = (entry.episodeTitle ?? title).trim();
  if (!titleKey || !episodeKey || !title || !episodeTitle) return null;
  return {
    provider: "crunchyroll",
    providerLabel: "Crunchyroll",
    titleKey,
    itemKind: entry.kind === "episode" ? "series" : "movie",
    title,
    artworkUrl: entry.artworkUrl ?? null,
    episodeKey,
    episodeTitle,
    seasonKey: entry.seasonId ?? null,
    seasonTitle: entry.seasonTitle ?? null,
    seasonNumber: entry.seasonNumber ?? null,
    episodeNumber: null,
    sourceUrl: url,
    currentTime: adapter.video.currentTime,
    duration: adapter.video.duration,
    progress: adapter.video.currentTime / adapter.video.duration,
    catalogState: "unavailable",
  };
}

function getCanonicalCrunchyrollWatchUrl(value: string): string | null {
  const normalized = normalizeHistoryUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (
    url.hostname !== "crunchyroll.com" &&
    !url.hostname.endsWith(".crunchyroll.com")
  ) return null;
  const match = url.pathname.match(
    /^\/(?:(?<locale>[a-z]{2}(?:-[a-z]{2})?)\/)?watch\/(?<id>[A-Za-z0-9_-]+)(?:\/(?<slug>[A-Za-z0-9][A-Za-z0-9-]*))?\/?$/,
  );
  if (!match?.groups?.id) return null;
  return `${url.origin}${url.pathname}`;
}

interface CrunchyrollSeriesInfo {
	title: string | null;
	slug: string | null;
	seriesId: string | null;
	artworkUrl: string | null;
}

interface CrunchyrollSeasonInfo {
	seasonId: string | null;
	title: string | null;
	number: number | null;
}

interface CrunchyrollSeriesCandidate {
	title?: string | null;
	url?: string | null;
	artworkUrl?: string | null;
}

interface CrunchyrollSeasonCandidate {
	title?: string | null;
	url?: string | null;
	seasonNumber?: number | null;
}

function getCrunchyrollSeriesInfo(episodeTitle: string): CrunchyrollSeriesInfo {
	const metaSeriesUrl =
		document.querySelector<HTMLMetaElement>('meta[property="og:video:series"]')
			?.content ??
		document.querySelector<HTMLMetaElement>('meta[property="video:series"]')
			?.content;
	const linkCandidates = getSeriesLinkCandidates();
	const jsonLdCandidates = getJsonLdSeriesCandidates();
	const candidates: CrunchyrollSeriesCandidate[] = [
		...jsonLdCandidates,
		...linkCandidates,
		{
			title: document.querySelector<HTMLMetaElement>(
				'meta[name="series-title"]',
			)?.content,
			url: metaSeriesUrl,
		},
		{
			title: document.querySelector<HTMLMetaElement>(
				'meta[name="crunchyroll:series_title"]',
			)?.content,
			url: metaSeriesUrl,
		},
		{
			title: document.querySelector<HTMLElement>('[data-t*="series" i]')
				?.textContent,
			url: metaSeriesUrl,
		},
		{
			title: document.querySelector<HTMLElement>('[data-testid*="series" i]')
				?.textContent,
			url: metaSeriesUrl,
		},
		{ url: metaSeriesUrl },
	];

	const usable = candidates
		.map((candidate) => ({
			...candidate,
			title: cleanCrunchyrollTitle(candidate.title ?? ""),
		}))
		.find((candidate) =>
			isUsefulSeriesTitle(candidate.title ?? "", episodeTitle),
		);
	const urlInfo =
		candidates
			.map((candidate) => getCrunchyrollSeriesUrlInfo(candidate.url))
			.find(Boolean) ?? null;
	const artworkUrl =
		candidates
			.map((candidate) => cleanImageUrl(candidate.artworkUrl))
			.find(Boolean) ?? null;
	const fallbackTitle = urlInfo?.slug ? toTitle(urlInfo.slug) : null;
	const title = usable?.title ?? fallbackTitle;

	return {
		title: title && isUsefulSeriesTitle(title, episodeTitle) ? title : null,
		slug: urlInfo?.slug ?? null,
		seriesId: urlInfo?.seriesId ?? null,
		artworkUrl,
	};
}

function getCrunchyrollSeasonInfo(
	episodeTitle: string,
	sourceUrl: string,
): CrunchyrollSeasonInfo {
	const candidates = [
		...getJsonLdSeasonCandidates(),
		sourceUrlSeasonCandidate(sourceUrl),
		titleSeasonCandidate(episodeTitle),
		...getMetaTitleSeasonCandidates(),
		titleSeasonCandidate(document.title),
	].filter((candidate): candidate is CrunchyrollSeasonCandidate =>
		Boolean(candidate),
	);
	const normalized = candidates
		.map((candidate) => normalizeSeasonCandidate(candidate))
		.filter(
			(
				candidate,
			): candidate is Required<Pick<CrunchyrollSeasonCandidate, "title">> &
				CrunchyrollSeasonCandidate =>
				Boolean(candidate.title || candidate.seasonNumber),
		);
	const best =
		normalized.find((candidate) => candidate.seasonNumber) ??
		normalized[0] ??
		null;
	const seasonNumber =
		normalized
			.map((candidate) => candidate.seasonNumber)
			.find((value): value is number => Boolean(value)) ?? null;
	const title = best?.title ?? (seasonNumber ? `Season ${seasonNumber}` : null);
	const seasonId = getSeasonId(best ?? { title, seasonNumber });

	return {
		seasonId,
		title,
		number: seasonNumber,
	};
}

function getSeriesLinkCandidates(): CrunchyrollSeriesCandidate[] {
	return [
		...document.querySelectorAll<HTMLAnchorElement>('a[href*="/series/"]'),
	].map((link) => {
		const image = link.querySelector("img");
		return {
			title: link.textContent || link.getAttribute("aria-label") || image?.alt,
			url: link.href,
			artworkUrl: isPortraitImage(image)
				? image?.currentSrc || image?.src
				: null,
		};
	});
}

function getCrunchyrollSeriesUrlInfo(value: string | null | undefined): {
	seriesId: string;
	slug: string;
} | null {
	if (!value) {
		return null;
	}

	const match = value.match(/\/series\/([^/?#]+)\/?([^/?#]*)?/);
	if (!match?.[1]) {
		return null;
	}

	return {
		seriesId: match[1],
		slug: match[2] || match[1],
	};
}

function cleanImageUrl(value: string | null | undefined): string | null {
	if (
		!value ||
		!/^https?:\/\//i.test(value) ||
		value.includes("crunchyroll.com/ru/")
	) {
		return null;
	}

	return value;
}

function isPortraitImage(image: HTMLImageElement | null): boolean {
	if (!image) {
		return false;
	}

	return image.naturalHeight > image.naturalWidth && image.naturalWidth > 0;
}

function getJsonLdSeriesCandidates(): CrunchyrollSeriesCandidate[] {
	const candidates: CrunchyrollSeriesCandidate[] = [];

	for (const script of document.querySelectorAll<HTMLScriptElement>(
		'script[type="application/ld+json"]',
	)) {
		const parsed = parseJson(script.textContent ?? "");
		collectJsonLdSeriesCandidates(parsed, candidates, 0);
	}

	return candidates;
}

function getJsonLdSeasonCandidates(): CrunchyrollSeasonCandidate[] {
	const candidates: CrunchyrollSeasonCandidate[] = [];

	for (const script of document.querySelectorAll<HTMLScriptElement>(
		'script[type="application/ld+json"]',
	)) {
		const parsed = parseJson(script.textContent ?? "");
		collectJsonLdSeasonCandidates(parsed, candidates, 0);
	}

	return candidates;
}

function cleanCrunchyrollTitle(title: string): string {
	return title
		.replace(/\s*-\s*Watch on Crunchyroll\s*$/i, "")
		.replace(/\s*\|\s*Crunchyroll\s*$/i, "")
		.replace(/\s*·\s*Crunchyroll\s*$/i, "")
		.trim();
}

function looksLikeEpisode(title: string): boolean {
	return (
		/^E\s?\d+\b/i.test(title) ||
		/^EP\s?\.?\s?\d+\b/i.test(title) ||
		/^S\d+\s+E\d+\b/i.test(title) ||
		/\bEpisode\s+\d+\b/i.test(title) ||
		/\bEp\.?\s+\d+\b/i.test(title) ||
		/\bСерия\s+\d+\b/i.test(title) ||
		/\bЭпизод\s+\d+\b/i.test(title) ||
		/\bСезон\s+\d+\s+Серия\s+\d+\b/i.test(title)
	);
}

function looksLikeMovie(title: string, duration: number): boolean {
	const normalized = title.toLowerCase();
	const hasMovieWord =
		/\b(movie|film|feature)\b/i.test(title) ||
		/фильм|полнометраж/i.test(normalized);
	if (!hasMovieWord) {
		return false;
	}

	return duration >= 40 * 60 || !looksLikeEpisode(title);
}

function isUsefulSeriesTitle(value: string, episodeTitle: string): boolean {
	if (!value || value.length < 2) {
		return false;
	}

	const normalized = value.toLowerCase();
	return (
		normalized !== "crunchyroll" &&
		normalized !== episodeTitle.toLowerCase() &&
		!/^https?:\/\//i.test(value) &&
		!value.includes("crunchyroll.com/") &&
		!/^e\d+\b/i.test(value) &&
		!looksLikeSeasonTitle(value)
	);
}

function toTitle(value: string): string {
	return value
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase())
		.trim();
}

function collectJsonLdSeriesCandidates(
	value: unknown,
	output: CrunchyrollSeriesCandidate[],
	depth: number,
): void {
	if (!value || depth > 8) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectJsonLdSeriesCandidates(item, output, depth + 1);
		}
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	const record = value as Record<string, unknown>;
	if (
		record["@type"] === "BreadcrumbList" &&
		Array.isArray(record.itemListElement)
	) {
		for (const item of record.itemListElement) {
			if (!item || typeof item !== "object") {
				continue;
			}

			const listItem = item as Record<string, unknown>;
			const listItemRecord =
				listItem.item && typeof listItem.item === "object"
					? (listItem.item as Record<string, unknown>)
					: null;
			const itemUrl =
				typeof listItem.item === "string"
					? listItem.item
					: typeof listItemRecord?.["@id"] === "string"
						? listItemRecord["@id"]
						: typeof listItemRecord?.url === "string"
							? listItemRecord.url
							: typeof listItem.url === "string"
								? listItem.url
								: null;
			if (!itemUrl?.includes("/series/")) {
				continue;
			}

			output.push({
				title:
					typeof listItem.name === "string"
						? listItem.name
						: typeof listItemRecord?.name === "string"
							? listItemRecord.name
							: null,
				artworkUrl: getJsonLdImageUrl(listItemRecord ?? listItem),
				url: itemUrl,
			});
		}
	}

	for (const key of [
		"partOfSeries",
		"partOfTVSeries",
		"partOfSeason",
		"isPartOf",
	]) {
		const nested = record[key];
		if (nested && typeof nested === "object") {
			const name = (nested as Record<string, unknown>).name;
			const id = (nested as Record<string, unknown>)["@id"];
			const url = (nested as Record<string, unknown>).url;
			if (typeof name === "string" && key !== "partOfSeason") {
				output.push({
					title: name,
					artworkUrl: getJsonLdImageUrl(nested),
					url:
						typeof id === "string" ? id : typeof url === "string" ? url : null,
				});
			}
			collectJsonLdSeriesCandidates(nested, output, depth + 1);
		}
	}

	const graph = record["@graph"];
	if (graph) {
		collectJsonLdSeriesCandidates(graph, output, depth + 1);
	}
}

function getJsonLdImageUrl(value: unknown): string | null {
	if (!value) {
		return null;
	}

	if (typeof value === "string") {
		return value;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const found = getJsonLdImageUrl(item);
			if (found) {
				return found;
			}
		}
		return null;
	}

	if (typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	const direct =
		readJsonLdString(record.image) ?? readJsonLdString(record.thumbnailUrl);
	if (direct) {
		return direct;
	}

	const typeValue = Array.isArray(record["@type"])
		? record["@type"].join(" ")
		: record["@type"];
	const type = typeof typeValue === "string" ? typeValue.toLowerCase() : "";
	if (type.includes("imageobject")) {
		const imageObjectUrl =
			readJsonLdString(record.contentUrl) ?? readJsonLdString(record.url);
		if (imageObjectUrl) {
			return imageObjectUrl;
		}
	}

	return getJsonLdImageUrl(record.image) ?? getJsonLdImageUrl(record.thumbnail);
}

function readJsonLdString(value: unknown): string | null {
	return typeof value === "string" && value ? value : null;
}

function collectJsonLdSeasonCandidates(
	value: unknown,
	output: CrunchyrollSeasonCandidate[],
	depth: number,
): void {
	if (!value || depth > 8) {
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectJsonLdSeasonCandidates(item, output, depth + 1);
		}
		return;
	}

	if (typeof value !== "object") {
		return;
	}

	const record = value as Record<string, unknown>;
	const typeValue = Array.isArray(record["@type"])
		? record["@type"].join(" ")
		: record["@type"];
	const type = typeof typeValue === "string" ? typeValue.toLowerCase() : "";

	if (type.includes("tvseason") || type.includes("creativeworkseason")) {
		output.push(seasonCandidateFromRecord(record));
	}

	for (const key of ["partOfSeason", "season"]) {
		const nested = record[key];
		if (nested && typeof nested === "object") {
			output.push(seasonCandidateFromRecord(nested as Record<string, unknown>));
			collectJsonLdSeasonCandidates(nested, output, depth + 1);
		}
	}

	const graph = record["@graph"];
	if (graph) {
		collectJsonLdSeasonCandidates(graph, output, depth + 1);
	}
}

function seasonCandidateFromRecord(
	record: Record<string, unknown>,
): CrunchyrollSeasonCandidate {
	const id = record["@id"];
	const url = record.url;
	return {
		title: typeof record.name === "string" ? record.name : null,
		url: typeof id === "string" ? id : typeof url === "string" ? url : null,
		seasonNumber:
			normalizeSeasonNumber(record.seasonNumber) ??
			seasonNumberFromTitle(typeof record.name === "string" ? record.name : ""),
	};
}

function sourceUrlSeasonCandidate(
	sourceUrl: string,
): CrunchyrollSeasonCandidate | null {
	const inferred = inferCrunchyrollSeasonFromSourceUrl(sourceUrl);
	if (!inferred) {
		return null;
	}

	return {
		title: inferred.seasonTitle,
		seasonNumber: inferred.seasonNumber,
	};
}

function titleSeasonCandidate(
	title: string | null | undefined,
): CrunchyrollSeasonCandidate | null {
	const inferred = inferCrunchyrollSeasonFromTitle(title);
	if (!inferred) {
		return null;
	}

	return {
		title: inferred.seasonTitle,
		seasonNumber: inferred.seasonNumber,
	};
}

function getMetaTitleSeasonCandidates(): CrunchyrollSeasonCandidate[] {
	const selectors = [
		'meta[property="og:title"]',
		'meta[name="twitter:title"]',
		'meta[name="title"]',
		'meta[property="twitter:title"]',
	];

	return selectors
		.map((selector) =>
			titleSeasonCandidate(
				document.querySelector<HTMLMetaElement>(selector)?.content,
			),
		)
		.filter((candidate): candidate is CrunchyrollSeasonCandidate =>
			Boolean(candidate),
		);
}

function normalizeSeasonCandidate(
	candidate: CrunchyrollSeasonCandidate,
): CrunchyrollSeasonCandidate {
	const seasonNumber =
		normalizeSeasonNumber(candidate.seasonNumber) ??
		seasonNumberFromTitle(candidate.title ?? "");
	const title = normalizeSeasonTitle(candidate.title, seasonNumber);
	return {
		title,
		url: typeof candidate.url === "string" ? candidate.url : null,
		seasonNumber,
	};
}

function normalizeSeasonNumber(value: unknown): number | null {
	const number =
		typeof value === "number"
			? value
			: Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(number) && number > 0 && number <= 1000
		? Math.floor(number)
		: null;
}

function looksLikeSeasonTitle(value: string): boolean {
	return Boolean(seasonNumberFromTitle(value) || /^s\d+$/i.test(value.trim()));
}

function getSeasonId(candidate: CrunchyrollSeasonCandidate): string | null {
	if (candidate.seasonNumber) {
		return `season-${candidate.seasonNumber}`;
	}
	const raw = candidate.url || candidate.title;
	if (!raw) {
		return null;
	}
	return slugify(raw) || null;
}

function normalizeSeasonTitleForSeries(
	seasonTitle: string | null,
	seriesTitle: string,
	seasonNumber: number | null,
): string | null {
	if (!seasonTitle) {
		return seasonNumber ? `Season ${seasonNumber}` : null;
	}

	const normalizedSeason = seasonTitle.toLowerCase();
	const normalizedSeries = seriesTitle.toLowerCase();
	if (normalizedSeries && normalizedSeason.startsWith(normalizedSeries)) {
		const suffix = seasonTitle
			.slice(seriesTitle.length)
			.replace(/^[-:–—\s]+/, "")
			.trim();
		if (suffix) {
			return normalizeSeasonTitle(suffix, seasonNumber);
		}
		return seasonNumber ? `Season ${seasonNumber}` : null;
	}

	return seasonTitle;
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}
