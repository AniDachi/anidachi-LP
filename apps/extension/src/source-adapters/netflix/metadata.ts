import {
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogLocaleContext,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import {
	isNetflixArtwork,
	NetflixMetadataSchema,
	type NetflixMetadata,
} from "./contract";

type RecordValue = Record<string, unknown>;
export function record(value: unknown): RecordValue | null {
	return value !== null && typeof value === "object"
		? (value as RecordValue)
		: null;
}
export function netflixId(value: unknown): string | null {
	if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0))
		return null;
	const text =
		typeof value === "string" || typeof value === "number" ? String(value) : "";
	return /^[1-9][0-9]{0,19}$/.test(text) ? text : null;
}
function label(value: unknown): string | null {
	return typeof value === "string" && value.trim() && value.length <= 300
		? value.trim()
		: null;
}
function sequence(value: unknown, max = 10000): number | null {
	return typeof value === "number" &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= max
		? value
		: null;
}
function artwork(video: RecordValue): string | null {
	const candidates = [video.boxart, video.artwork, video.storyart]
		.flatMap((a) => (Array.isArray(a) ? a.slice(0, 30) : []))
		.map(record)
		.filter(
			(a): a is RecordValue =>
				!!a &&
				typeof a.url === "string" &&
				a.url.length <= 2048 &&
				isNetflixArtwork(a.url),
		);
	return (
		((
			candidates.find(
				(a) =>
					typeof a.h === "number" &&
					typeof a.w === "number" &&
					a.h > a.w &&
					a.w > 0,
			) ?? candidates[0]
		)?.url as string) ?? null
	);
}
export function netflixContext(
	country: unknown,
	locale: unknown,
): WatchCatalogLocaleContext | null {
	if (
		typeof locale !== "string" ||
		!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(locale) ||
		locale.length > 35
	)
		return null;
	return {
		region:
			typeof country === "string" && /^[A-Z]{2}$/.test(country)
				? country
				: null,
		requestedLocale: locale,
		audioLocale: null,
		subtitleLocales: [],
		observedAt: new Date().toISOString(),
	};
}
/** Bound traversal and fail closed on ambiguous IDs; no bookmark/profile fields. */
export function readNetflixMetadata(
	raw: unknown,
	movieId: string,
	context: WatchCatalogLocaleContext | null,
): NetflixMetadata | null {
	const video = record(raw);
	const id = netflixId(video?.id),
		title = label(video?.title);
	if (!video || !id || !title) return null;
	const common = { title, artworkUrl: artwork(video), context };
	if (video.type === "movie" && id === movieId)
		return NetflixMetadataSchema.parse({
			...common,
			identity: { kind: "movie", providerMovieId: id },
			episodeTitle: title,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
		});
	if (
		video.type !== "show" ||
		netflixId(video.currentEpisode) !== movieId ||
		!Array.isArray(video.seasons) ||
		video.seasons.length > 100
	)
		return null;
	let found: NetflixMetadata | null = null,
		count = 0;
	const episodeIds = new Set<string>(),
		seasonIds = new Set<string>();
	for (const rawSeason of video.seasons) {
		const season = record(rawSeason),
			seasonId = netflixId(season?.id);
		if (
			!season ||
			!seasonId ||
			seasonIds.has(seasonId) ||
			!Array.isArray(season.episodes)
		)
			return null;
		seasonIds.add(seasonId);
		count += season.episodes.length;
		if (count > 2000) return null;
		for (const rawEpisode of season.episodes) {
			const episode = record(rawEpisode),
				episodeId = netflixId(episode?.id);
			if (
				!episodeId ||
				episodeIds.has(episodeId) ||
				netflixId(episode?.episodeId) !== episodeId
			)
				return null;
			episodeIds.add(episodeId);
			if (episodeId !== movieId) continue;
			if (
				!episode ||
				episode.autoplayable !== true ||
				typeof episode.runtime !== "number" ||
				!Number.isFinite(episode.runtime) ||
				episode.runtime <= 0 ||
				!label(episode.title)
			)
				return null;
			found = {
				...common,
				identity: {
					kind: "episode",
					providerSeriesId: id,
					providerSeasonIdentifier: seasonId,
					providerEpisodeIdentifier: episodeId,
				},
				episodeTitle: label(episode.title)!,
				seasonTitle: label(season.title),
				seasonNumber: sequence(season.seq, 1000),
				episodeNumber: sequence(episode.seq),
			};
		}
	}
	return found;
}
export function readNetflixCatalog(
	raw: unknown,
	movieId: string,
	context: WatchCatalogLocaleContext | null,
): WatchCatalogSnapshotInput | null {
	const metadata = readNetflixMetadata(raw, movieId, context);
	if (!metadata || metadata.identity.kind !== "episode" || !context)
		return null;
	const video = record(raw)!;
	let complete = !!context.region;
	const seasons = (video.seasons as unknown[]).map((rawSeason, order) => {
		const season = record(rawSeason)!;
		const sid = netflixId(season.id)!;
		if (
			!label(season.title) ||
			!Array.isArray(season.episodes) ||
			season.episodes.length === 0
		)
			complete = false;
		return {
			seasonKey: `netflix:season:${sid}`,
			providerSeasonIdentifier: sid,
			title: label(season.title) ?? `Season ${order + 1}`,
			seasonNumber: sequence(season.seq, 1000),
			order,
			episodes: (season.episodes as unknown[]).flatMap(
				(rawEpisode, episodeOrder) => {
					const episode = record(rawEpisode)!;
					const eid = netflixId(episode.id)!;
					if (
						typeof episode.autoplayable !== "boolean" ||
						!label(episode.title) ||
						typeof episode.runtime !== "number" ||
						!Number.isFinite(episode.runtime) ||
						episode.runtime <= 0
					) {
						complete = false;
						return [];
					}
					return [
						{
							episodeKey: `netflix:episode:${eid}`,
							providerEpisodeIdentifier: eid,
							title: label(episode.title)!,
							episodeNumber: sequence(episode.seq),
							order: episodeOrder,
							releasedAt: null,
							available: episode.autoplayable,
							watchVariants: [
								{
									providerContentId: eid,
									audioLocale: null,
									original: true,
									order: 0,
									sourceUrl: `https://www.netflix.com/watch/${eid}`,
								},
							],
						},
					];
				},
			),
		};
	});
	const parsed = WatchCatalogSnapshotInputSchema.safeParse({
		schemaVersion: 3,
		provider: "netflix",
		providerSeriesId: metadata.identity.providerSeriesId,
		titleKey: `netflix:series:${metadata.identity.providerSeriesId}`,
		title: metadata.title,
		completeness: complete ? "complete" : "partial",
		context,
		seasons,
	});
	return parsed.success ? parsed.data : null;
}
