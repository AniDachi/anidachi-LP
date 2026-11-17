import { z } from "zod";
import {
	canonicalizeRoomSourceUrl,
 PrimeNavigationSchema,
	PrimeVideoProviderIdSchema,
	PrimeVideoHistoryIdentitySchema,
	WatchCatalogLocaleContextSchema,
	WatchCatalogSnapshotInputSchema,
	WATCH_CATALOG_MAX_BYTES,
} from "@anidachi/protocol";

export const PRIME_REQUEST = "anidachi-primevideo-request-v1";
export const PRIME_RESULT = "anidachi-primevideo-result-v1";
export const PRIME_BINDING = "data-anidachi-primevideo-binding";
// Presence permits the overlay only. Commands/history still require PRIME_BINDING.
export const PRIME_PLAYER = "data-anidachi-primevideo-player";
export const PRIME_PLAYER_STATE = "data-anidachi-primevideo-state";
// SDK Close with a completed timeline; ordinary media replacement is not an exit.
export const PRIME_PLAYER_ENDED = "data-anidachi-primevideo-ended";
export const PRIME_NAVIGATING = "anidachi-primevideo-navigating";
export const PRIME_BINDING_CHANGED = "anidachi-primevideo-binding-changed";
const token = z.string().min(1).max(80);
const title = z.string().trim().min(1).max(300);
export function primeVideoId(value: string): string | null {
	const result = canonicalizeRoomSourceUrl(value, "primevideo");
	return result.ok ? result.source.sourceUrl.split("/").at(-1)! : null;
}
export function isPrimeArtwork(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			["images-na.ssl-images-amazon.com", "m.media-amazon.com"].includes(
				url.hostname,
			) &&
			url.pathname.startsWith("/images/")
		);
	} catch {
		return false;
	}
}
export const PrimeMetadataSchema = z.strictObject({
	// Playback identity remains usable when the season-1 history anchor is absent.
	identity: PrimeVideoHistoryIdentitySchema.nullable(),
 primeNavigation: PrimeNavigationSchema.optional(),
	title,
	episodeTitle: title,
	seasonTitle: title.nullable(),
	seasonNumber: z.number().int().min(1).max(1000).nullable(),
	episodeNumber: z.number().int().min(1).max(10000).nullable(),
	artworkUrl: z.string().max(2048).refine(isPrimeArtwork).nullable(),
	context: WatchCatalogLocaleContextSchema.nullable(),
});
export const PrimeSnapshotSchema = z
	.strictObject({
		generation: token,
		contentId: PrimeVideoProviderIdSchema,
		phase: z.enum([
			"content",
			"interstitial",
			"buffering",
			"transition",
			"unsupported",
		]),
		currentTime: z.number().finite().min(0).max(604800),
		duration: z.number().finite().positive().max(604800),
		playing: z.boolean(),
		playbackRate: z.number().finite().min(0.25).max(4),
		metadata: PrimeMetadataSchema,
	})
	.refine(
		(s) =>
			s.currentTime <= s.duration &&
 (!s.metadata.primeNavigation || s.metadata.primeNavigation.contentId === s.contentId) &&
			(!s.metadata.identity ||
				(s.metadata.identity.kind === "movie"
					? s.metadata.identity.providerMovieId
					: s.metadata.identity.providerEpisodeIdentifier) === s.contentId),
	);
export type PrimeSnapshot = z.infer<typeof PrimeSnapshotSchema>;
export type PrimeMetadata = z.infer<typeof PrimeMetadataSchema>;
export const PrimeRequestSchema = z
	.strictObject({
		source: z.literal(PRIME_REQUEST),
		id: token,
		action: z.enum([
			"snapshot",
			"play",
			"resume-interstitial",
			"pause",
			"seek",
			"catalog",
			"rate",
			"cancel",
		]),
		contentId: PrimeVideoProviderIdSchema,
		generation: token.optional(),
		expiresAt: z
			.number()
			.finite()
			.nonnegative()
			.max(8640000000000000)
			.optional(),
		time: z.number().finite().min(0).max(604800).optional(),
		rate: z.number().finite().min(0.5).max(2).optional(),
	})
	.refine(
		(r) => r.action === "snapshot" || r.action === "cancel" || !!r.generation,
	)
	.refine((r) =>
		r.action === "seek" ? r.time !== undefined : r.time === undefined,
	)
	.refine((r) =>
		r.action === "rate" ? r.rate !== undefined : r.rate === undefined,
	)
	.refine(
		(r) =>
			r.expiresAt === undefined || r.action === "seek" || r.action === "cancel",
	);
export type PrimeRequest = z.infer<typeof PrimeRequestSchema>;
export const PrimeResultSchema = z.strictObject({
	source: z.literal(PRIME_RESULT),
	id: token,
	ok: z.boolean(),
	error: z.literal("autoplay-blocked").optional(),
	snapshot: PrimeSnapshotSchema.nullable().optional(),
	catalog: WatchCatalogSnapshotInputSchema.refine(
		(c) => c.provider === "primevideo",
	).optional(),
});
export type PrimeResult = z.infer<typeof PrimeResultSchema>;
/** Reject oversized/cyclic page payloads before schema traversal. */
export function boundedMessage(value: unknown, maxNodes = 60000): boolean {
	let nodes = 0;
	let bytes = 0;
	const seen = new Set<object>();
	const queue: unknown[] = [value];
	while (queue.length) {
		const item = queue.pop();
		if (++nodes > maxNodes) return false;
		if (typeof item === "string") {
			if (item.length > 4096) return false;
			bytes += new TextEncoder().encode(item).byteLength;
			if (bytes > WATCH_CATALOG_MAX_BYTES + 16_384) return false;
		}
		if (!item || typeof item !== "object") continue;
		if (seen.has(item)) return false;
		seen.add(item);
		const keys = Object.keys(item);
		if (keys.length > 2000) return false;
		for (const key of keys) {
			if (key.length > 100) return false;
			queue.push((item as Record<string, unknown>)[key]);
		}
	}
	return true;
}
export function readPrimeBinding(
	video: HTMLVideoElement,
): { contentId: string; generation: string } | null {
	const [contentId, generation, extra] = (
		video.getAttribute(PRIME_BINDING) ?? ""
	).split(":");
	return !extra &&
		PrimeVideoProviderIdSchema.safeParse(contentId).success &&
		token.safeParse(generation).success
		? { contentId: contentId!, generation: generation! }
		: null;
}
