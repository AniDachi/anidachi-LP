import { z } from "zod";
import {
	NetflixHistoryIdentitySchema,
	NetflixProviderIdSchema,
	WatchCatalogLocaleContextSchema,
	WatchCatalogSnapshotInputSchema,
} from "@anidachi/protocol";

export const NETFLIX_REQUEST = "anidachi-netflix-request-v1";
export const NETFLIX_RESULT = "anidachi-netflix-result-v1";
export const NETFLIX_VIDEO_GENERATION = "data-anidachi-netflix-generation";
const token = z.string().min(1).max(80);
const title = z.string().trim().min(1).max(300);
export const NetflixMetadataSchema = z.strictObject({
	identity: NetflixHistoryIdentitySchema,
	title,
	episodeTitle: title,
	seasonTitle: title.nullable(),
	seasonNumber: z.number().int().nonnegative().max(1000).nullable(),
	episodeNumber: z.number().int().nonnegative().max(10000).nullable(),
	artworkUrl: z.string().max(2048).refine(isNetflixArtwork).nullable(),
	context: WatchCatalogLocaleContextSchema.nullable(),
});
export const NetflixSnapshotSchema = z
	.strictObject({
		generation: token,
		movieId: NetflixProviderIdSchema,
		currentTime: z.number().finite().min(0).max(604800),
		duration: z.number().finite().positive().max(604800),
		playing: z.boolean(),
		metadata: NetflixMetadataSchema,
	})
	.refine(
		(s) =>
			s.currentTime <= s.duration &&
			(s.metadata.identity.kind === "movie"
				? s.metadata.identity.providerMovieId
				: s.metadata.identity.providerEpisodeIdentifier) === s.movieId,
	);
export type NetflixSnapshot = z.infer<typeof NetflixSnapshotSchema>;
export type NetflixMetadata = z.infer<typeof NetflixMetadataSchema>;
export const NetflixRequestSchema = z
	.strictObject({
		source: z.literal(NETFLIX_REQUEST),
		id: token,
		action: z.enum(["snapshot", "play", "pause", "seek", "catalog", "cancel"]),
		movieId: NetflixProviderIdSchema,
		generation: token.optional(),
		time: z.number().finite().min(0).max(604800).optional(),
	})
	.refine(
		(r) => r.action === "snapshot" || r.action === "cancel" || !!r.generation,
	)
	.refine((r) => r.action !== "seek" || r.time !== undefined);
export type NetflixRequest = z.infer<typeof NetflixRequestSchema>;
export const NetflixResultSchema = z.strictObject({
	source: z.literal(NETFLIX_RESULT),
	id: token,
	ok: z.boolean(),
	snapshot: NetflixSnapshotSchema.nullable().optional(),
	catalog: WatchCatalogSnapshotInputSchema.refine(
		(c) => c.provider === "netflix",
	).optional(),
});
export type NetflixResult = z.infer<typeof NetflixResultSchema>;
export function netflixWatchId(href: string): string | null {
	try {
		const url = new URL(href);
		if (
			url.protocol !== "https:" ||
			url.host !== "www.netflix.com" ||
			url.username ||
			url.password
		)
			return null;
		return url.pathname.match(/^\/watch\/([1-9][0-9]{0,19})\/?$/)?.[1] ?? null;
	} catch {
		return null;
	}
}
export function isNetflixArtwork(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			url.hostname.endsWith(".nflxso.net")
		);
	} catch {
		return false;
	}
}

/** Bound array traversal before Zod visits every nested catalog item. */
export function hasBoundedNetflixResult(value: unknown): boolean {
	if (!value || typeof value !== "object") return false;
	const catalog = (value as { catalog?: unknown }).catalog;
	if (catalog === undefined) return true;
	if (!catalog || typeof catalog !== "object") return false;
	const seasons = (catalog as { seasons?: unknown }).seasons;
	if (!Array.isArray(seasons) || seasons.length > 100) return false;
	let count = 0;
	for (const season of seasons) {
		if (!season || !Array.isArray(season.episodes)) return false;
		count += season.episodes.length;
		if (count > 2000) return false;
		for (const episode of season.episodes) {
			if (
				!episode ||
				!Array.isArray(episode.watchVariants) ||
				episode.watchVariants.length !== 1
			)
				return false;
		}
	}
	return true;
}
