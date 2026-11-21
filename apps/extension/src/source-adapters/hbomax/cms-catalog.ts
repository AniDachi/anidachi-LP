import {
	HBO_MAX_ORIGIN, HboMaxHistoryIdentitySchema, HboMaxProviderIdSchema, WATCH_CATALOG_MAX_EPISODES,
	WatchCatalogSnapshotInputSchema, hboMaxArtworkUrl, hboMaxDetail, hboMaxPlaybackId, hboMaxSeasonIdentifier, hboMaxSourceUrl,
	type WatchCatalogLocaleContext, type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import { z } from "zod";

const title = z.string().trim().min(1).max(300);
const seasonNumber = z.number().int().min(1).max(1000);
const episodeNumber = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const collectionId = z.string().regex(/^[0-9]{1,39}$/u);
const seasonSchema = z.strictObject({
	id: HboMaxProviderIdSchema, number: seasonNumber, title, episodeCount: z.number().int().min(0).max(WATCH_CATALOG_MAX_EPISODES).nullable(),
});
export const HboCmsShowSchema = z.strictObject({
	seriesId: HboMaxProviderIdSchema, title, collectionId, seasons: z.array(seasonSchema).min(1).max(100),
}).refine(show => new Set(show.seasons.map(season => season.id)).size === show.seasons.length &&
	new Set(show.seasons.map(season => season.number)).size === show.seasons.length &&
	show.seasons.reduce((total, season) => total + (season.episodeCount ?? 0), 0) <= WATCH_CATALOG_MAX_EPISODES);
export const HboCmsEpisodeSchema = z.strictObject({
	id: HboMaxProviderIdSchema, number: episodeNumber, title, seasonNumber,
});
export const HboCmsPlaybackSchema = z.strictObject({
	identity: HboMaxHistoryIdentitySchema.refine(identity => identity.kind === "episode"), title, displayTitle: z.string().min(1).max(603),
	episodeTitle: title, episodeNumber, seasonTitle: title.nullable(), seasonNumber,
	artworkUrl: z.null(),
});
export type HboCmsShow = z.infer<typeof HboCmsShowSchema>;
export type HboCmsEpisode = z.infer<typeof HboCmsEpisodeSchema>;
export type HboCmsPlayback = z.infer<typeof HboCmsPlaybackSchema>;

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function cleanTitle(value: unknown): string | null {
	if (typeof value !== "string" || value.length > 500) return null;
	const normalized = value.replace(/\p{Bidi_Control}/gu, "").replace(/\s+/gu, " ").trim();
	return normalized && normalized.length <= 300 ? normalized : null;
}
type Resource = { type: string; id: string; attributes?: unknown; relationships?: unknown };
function resource(value: unknown): Resource | null {
	const r = record(value);
	return r && typeof r.type === "string" && typeof r.id === "string" && r.id.length <= 256 ? r as Resource : null;
}
function related(row: Resource, name: string): unknown {
	return record(record(row.relationships)?.[name])?.data;
}
function refId(value: unknown, type: string): string | null {
	const ref = resource(value);
	return ref?.type === type ? ref.id : null;
}
function documentResources(value: unknown) {
	const doc = record(value);
	const root = resource(doc?.data);
	if (!root || !Array.isArray(doc?.included) || doc.included.length > 30_000) return null;
	const byType = new Map<string, Map<string, Resource | null>>();
	for (const item of doc.included) {
		const row = resource(item);
		if (!row || !["video", "show", "season", "collection", "collectionItem", "image"].includes(row.type)) continue;
		let group = byType.get(row.type);
		if (!group) { group = new Map(); byType.set(row.type, group); }
		// Ambiguous included resources cannot establish an identity.
		group.set(row.id, group.has(row.id) ? null : row);
	}
	return { root, byType, get: (type: string, id: string) => byType.get(type)?.get(id) ?? null };
}
function routeUrl(row: Resource): string | null {
	const path = record(row.attributes)?.url;
	return row.type === "route" && typeof path === "string" && path.startsWith("/") ? HBO_MAX_ORIGIN + path : null;
}
function episodeData(video: Resource, seriesId: string, seasonId: string): HboCmsEpisode | null {
	const attrs = record(video.attributes);
	if (video.type !== "video" || attrs?.videoType !== "EPISODE" || refId(related(video, "show"), "show") !== seriesId ||
		refId(related(video, "season"), "season") !== seasonId) return null;
	const parsed = HboCmsEpisodeSchema.safeParse({
		id: video.id, number: attrs.episodeNumber, title: cleanTitle(attrs.name), seasonNumber: attrs.seasonNumber,
	});
	return parsed.success ? parsed.data : null;
}

type CmsDocument = NonNullable<ReturnType<typeof documentResources>>;

function titlePoster(doc: CmsDocument, titleId: string) {
	const title = doc.get("show", titleId); // HBO also represents a movie's catalog title as a show.
	const images = title && related(title, "images");
	if (!Array.isArray(images)) return null;
	for (const image of images) {
		const id = refId(image, "image");
		const attrs = id && record(doc.get("image", id)?.attributes);
		if (!attrs || attrs.kind !== "poster-with-logo" || typeof attrs.src !== "string" ||
			typeof attrs.width !== "number" || typeof attrs.height !== "number" || !(attrs.height > attrs.width && attrs.width > 0)) continue;
		const url = hboMaxArtworkUrl(attrs.src);
		if (url) return { titleId, url };
	}
	return null;
}

function playbackMetadata(doc: CmsDocument, playbackId: string): HboCmsPlayback | null {
	const video = doc.get("video", playbackId);
	if (!video) return null;
	const seriesId = refId(related(video, "show"), "show");
	const seasonId = refId(related(video, "season"), "season");
	if (!seriesId || !seasonId) return null;
	const show = doc.get("show", seriesId);
	const episode = episodeData(video, seriesId, seasonId);
	const showTitle = cleanTitle(record(show?.attributes)?.name);
	if (!episode || !showTitle) return null;
	const season = doc.get("season", seasonId);
	const seasonAttrs = record(season?.attributes);
	if (season && seasonAttrs?.seasonNumber !== episode.seasonNumber) return null;
	const parsed = HboCmsPlaybackSchema.safeParse({
		identity: { kind: "episode", providerSeriesId: seriesId, providerEpisodeIdentifier: playbackId },
		title: showTitle, displayTitle: showTitle + " — " + episode.title, episodeTitle: episode.title, episodeNumber: episode.number,
		seasonTitle: cleanTitle(seasonAttrs?.displayName), seasonNumber: episode.seasonNumber, artworkUrl: null,
	});
	return parsed.success ? parsed.data : null;
}

/** Read the requested player route only. Recommendation videos in included do not supply its identity. */
export function parseHboCmsPlayback(value: unknown, playbackId: string): HboCmsPlayback | null {
	const doc = documentResources(value);
	return doc && hboMaxPlaybackId(routeUrl(doc.root) ?? "") === playbackId ? playbackMetadata(doc, playbackId) : null;
}

const showRail = "generic-show-page-rail-episodes-tabbed-content";
const playerRail = "generic-video-player-show-episodes-ipd";
function routeRail(doc: CmsDocument, seriesId: string): string | null {
	const url = routeUrl(doc.root) ?? "";
	const detail = hboMaxDetail(url);
	if (detail?.kind === "series" && detail.id === seriesId) return showRail;
	const playback = hboMaxPlaybackId(url);
	const identity = playback && playbackMetadata(doc, playback)?.identity;
	return identity && identity.kind === "episode" && identity.providerSeriesId === seriesId ? playerRail : null;
}

function episodeFilter(row: Resource, seriesId: string) {
	const attrs = record(row.attributes);
	const component = record(attrs?.component);
	if (row.type !== "collection" || !collectionId.safeParse(row.id).success || (attrs?.alias !== showRail && attrs?.alias !== playerRail) ||
		component?.mandatoryParams !== `pf[show.id]=${seriesId}` || !Array.isArray(component.filters) || component.filters.length > 100) return null;
	const filters = component.filters.map(record).filter(filter => filter?.id === "seasonNumber");
	const options = filters.length === 1 && filters[0]?.options;
	if (!Array.isArray(options) || !options.length || options.length > 100) return null;
	const numbers = new Set<number>();
	for (const option of options) {
		const item = record(option);
		if (typeof item?.id !== "string" || !/^[1-9][0-9]{0,3}$/u.test(item.id) ||
			item.parameter !== `pf[seasonNumber]=${item.id}` || Number(item.id) > 1000 || numbers.has(Number(item.id))) return null;
		numbers.add(Number(item.id));
	}
	return numbers;
}

export function parseHboCmsShow(value: unknown, seriesId: string): HboCmsShow | null {
	const doc = documentResources(value);
	return doc && showPlan(doc, seriesId);
}

function showPlan(doc: CmsDocument, seriesId: string): HboCmsShow | null {
	const alias = routeRail(doc, seriesId);
	if (!alias) return null;
	const show = doc.get("show", seriesId);
	if (!show) return null;
	const seasonRefs = related(show, "seasons");
	if (!Array.isArray(seasonRefs) || !seasonRefs.length || seasonRefs.length > 100) return null;
	const seasons: HboCmsShow["seasons"] = [];
	for (const ref of seasonRefs) {
		const id = refId(ref, "season");
		const season = id ? doc.get("season", id) : null;
		const attrs = record(season?.attributes);
		if (!attrs) return null;
		const seasonTitle = cleanTitle(attrs.displayName) ?? String(attrs.seasonNumber);
		const parsed = seasonSchema.safeParse({ id, number: attrs.seasonNumber, title: seasonTitle,
			episodeCount: record(attrs.videoCountByType)?.EPISODE ?? null });
		if (!parsed.success) return null;
		seasons.push(parsed.data);
	}
	const collections = [...doc.byType.get("collection")?.values() ?? []].filter(row => {
		if (!row || record(row.attributes)?.alias !== alias) return false;
		const numbers = episodeFilter(row, seriesId);
		return numbers && numbers.size === seasons.length && seasons.every(season => numbers.has(season.number));
	});
	if (collections.length !== 1) return null;
	const parsed = HboCmsShowSchema.safeParse({ seriesId, title: cleanTitle(record(show.attributes)?.name),
		collectionId: collections[0]!.id, seasons: seasons.sort((a, b) => a.number - b.number) });
	return parsed.success ? parsed.data : null;
}

/** Follow only the episode rail's item references, never unrelated video resources in included. */
export function parseHboCmsSeason(value: unknown, show: HboCmsShow, number: number): HboCmsEpisode[] | null {
	const doc = documentResources(value);
	return doc && seasonEpisodes(doc, show, number);
}

function seasonEpisodes(doc: CmsDocument, show: HboCmsShow, number: number): HboCmsEpisode[] | null {
	const season = show.seasons.find(item => item.number === number);
	if (!season) return null;
	let rail = doc.root;
	if (rail.type === "route") {
		const alias = routeRail(doc, show.seriesId);
		const included = doc.get("collection", show.collectionId);
		if (!alias || !included || record(included.attributes)?.alias !== alias) return null;
		rail = included;
	}
	if (rail.id !== show.collectionId || !episodeFilter(rail, show.seriesId)?.has(number)) return null;
	const items = related(rail, "items");
	if (!Array.isArray(items) || items.length > WATCH_CATALOG_MAX_EPISODES) return null;
	const result = new Map<string, HboCmsEpisode>();
	for (const ref of items) {
		const itemId = refId(ref, "collectionItem");
		const item = itemId ? doc.get("collectionItem", itemId) : null;
		const videoId = item && refId(related(item, "video"), "video");
		const video = videoId && doc.get("video", videoId);
		if (!video) continue;
		const episode = episodeData(video, show.seriesId, season.id);
		if (episode?.seasonNumber === number) result.set(episode.id, episode);
	}
	return [...result.values()];
}

/** Reduce a single provider response to public title data before handing it to the extension. */
export function parseHboNativePage(value: unknown, url: string) {
	const doc = documentResources(value);
	if (!doc) return null;
	const bound = routeUrl(doc.root) ?? "";
	let playbackId = hboMaxPlaybackId(url);
	const detail = hboMaxDetail(url);
	let metadata: HboCmsPlayback | null = null;
	let seriesId: string;
	if (playbackId && hboMaxPlaybackId(bound) === playbackId) {
		const video = doc.get("video", playbackId);
		if (video && record(video.attributes)?.videoType === "MOVIE") {
			const titleId = refId(related(video, "show"), "show");
			const poster = titleId && titlePoster(doc, titleId);
			return poster ? { playbackId, poster, metadata: null, show: null, episodes: [] } : null;
		}
		metadata = playbackMetadata(doc, playbackId);
		if (metadata?.identity.kind !== "episode") return null;
		seriesId = metadata.identity.providerSeriesId;
	} else if (detail && hboMaxDetail(bound)?.id === detail.id && hboMaxDetail(bound)?.kind === detail.kind) {
		if (detail.kind === "movie") {
			const poster = titlePoster(doc, detail.id);
			const movies = [...doc.byType.get("video")?.values() ?? []].filter(video => video &&
				record(video.attributes)?.videoType === "MOVIE" && refId(related(video, "show"), "show") === detail.id);
			playbackId = movies.length === 1 ? movies[0]!.id : null;
			return poster && playbackId ? { playbackId, poster, metadata: null, show: null, episodes: [] } : null;
		}
		seriesId = detail.id;
	} else return null;
	const show = showPlan(doc, seriesId);
	let episodes: HboCmsEpisode[] = [];
	if (show) {
		const rail = doc.get("collection", show.collectionId);
		const filters = record(record(rail?.attributes)?.component)?.filters;
		const selected = Array.isArray(filters) && filters.find(f => record(f)?.id === "seasonNumber")?.initiallySelectedOptionIds;
		const current = metadata?.seasonNumber ?? (Array.isArray(selected) && selected.length === 1 ? Number(selected[0]) : null);
		if (current) episodes = seasonEpisodes(doc, show, current) ?? [];
	}
	const poster = titlePoster(doc, seriesId);
	return metadata || episodes.length || poster ? { playbackId, metadata, show, episodes, poster } : null;
}

export function buildHboCmsCatalog(show: HboCmsShow, episodes: HboCmsEpisode[], playbackId: string,
	context: WatchCatalogLocaleContext, nativeAvailability?: ReadonlySet<string>): WatchCatalogSnapshotInput | null {
	if (!HboCmsShowSchema.safeParse(show).success || episodes.length > 2 * WATCH_CATALOG_MAX_EPISODES) return null;
	const byId = new Map<string, HboCmsEpisode>();
	const bySeason = new Map(show.seasons.map(season => [season.number, new Map<number, HboCmsEpisode>()]));
	for (const episode of episodes) {
		const season = bySeason.get(episode.seasonNumber);
		if (!season || !HboCmsEpisodeSchema.safeParse(episode).success) return null;
		const previous = byId.get(episode.id);
		if (previous && (previous.seasonNumber !== episode.seasonNumber || previous.number !== episode.number || previous.title !== episode.title)) return null;
		const atNumber = season.get(episode.number);
		if (atNumber && atNumber.id !== episode.id) return null;
		byId.set(episode.id, episode);
		season.set(episode.number, episode);
	}
	if (!byId.has(playbackId) || byId.size > WATCH_CATALOG_MAX_EPISODES) return null;
	const complete = !!context.region && show.seasons.every(season => season.episodeCount !== null &&
		season.episodeCount > 0 && season.episodeCount === bySeason.get(season.number)!.size);
	const seasons = show.seasons.filter(season => bySeason.get(season.number)!.size > 0).map(season => {
		const id = hboMaxSeasonIdentifier(show.seriesId, season.number);
		return { providerSeasonIdentifier: id, seasonKey: "hbomax:season:" + id, title: season.title, seasonNumber: season.number, order: season.number - 1,
			episodes: [...bySeason.get(season.number)!.values()].sort((a, b) => a.number - b.number).map(episode => ({
				providerEpisodeIdentifier: episode.id, episodeKey: "hbomax:episode:" + episode.id, title: episode.title, episodeNumber: episode.number,
				order: episode.number - 1, releasedAt: null, available: nativeAvailability?.has(episode.id) ?? true,
				watchVariants: [{ providerContentId: episode.id, sourceUrl: hboMaxSourceUrl(episode.id), audioLocale: null, original: false, order: 0 }],
			})) };
	});
	const result = WatchCatalogSnapshotInputSchema.safeParse({ schemaVersion: 3, provider: "hbomax", providerSeriesId: show.seriesId,
		titleKey: "hbomax:series:" + show.seriesId, title: show.title, completeness: complete ? "complete" : "partial", seasons, context });
	return result.success ? result.data : null;
}
