import { disneyPlusRouteLocale, DisneyPlusHistoryIdentitySchema, DisneyPlusProviderIdSchema, WATCH_CATALOG_MAX_EPISODES } from "@anidachi/protocol";
import { z } from "zod";
import type { DisneyPlusDetails } from "./metadata";

const label = z.string().trim().min(1).max(300);
const ordinal = z.number().int().min(1).max(1000);
export const savedPlayback = z.strictObject({
	metadata: z.strictObject({
		identity: DisneyPlusHistoryIdentitySchema, title: label, episodeTitle: label, seasonTitle: label.nullable(),
		seasonNumber: ordinal.nullable(), namedSeasonId: DisneyPlusProviderIdSchema.optional(), episodeNumber: ordinal.nullable(),
		artworkUrl: z.url().max(2048).regex(/^https:\/\/disney\.images\.edge\.bamgrid\.com\/[^/]/u).nullable(),
	}),
});
const episode = z.strictObject({ playbackId: DisneyPlusProviderIdSchema, title: label, number: ordinal });
const season = z.strictObject({ number: ordinal.nullable(), providerId: DisneyPlusProviderIdSchema.optional(), title: label, episodes: z.array(episode).max(WATCH_CATALOG_MAX_EPISODES) });

const transfer = z.strictObject({
	entityId: DisneyPlusProviderIdSchema,
	title: label,
	locale: z.string().min(2).max(35),
	artworkUrl: z.url().max(2048).regex(/^https:\/\/disney\.images\.edge\.bamgrid\.com\/[^/]/u).nullable(),
	movieId: DisneyPlusProviderIdSchema.nullable(),
	seasons: z.array(season).max(100),
}).refine(value => {
	const episodes = value.seasons.flatMap(s => s.episodes);
	return (value.movieId === null ? episodes.length > 0 : value.movieId === value.entityId && episodes.length === 0) &&
		episodes.length <= WATCH_CATALOG_MAX_EPISODES && new Set(episodes.map(e => e.playbackId)).size === episodes.length &&
		value.seasons.every(s => s.number !== null || s.providerId) && new Set(value.seasons.map(s => s.number ?? s.providerId)).size === value.seasons.length &&
		value.seasons.every(s => new Set(s.episodes.map(e => e.number)).size === s.episodes.length);
});

export type DisneyPlusCatalogTransfer = z.infer<typeof transfer>;

export function parseDisneyPlusCatalogTransfer(payload: unknown): DisneyPlusCatalogTransfer | null {
	if (typeof payload !== "string" || payload.length > 256_000) return null;
	try {
		const parsed = transfer.safeParse(JSON.parse(payload));
		return parsed.success ? parsed.data : null;
	} catch { return null; }
}

export function encodeDisneyPlusCatalogTransfer(details: DisneyPlusDetails): string {
	return JSON.stringify({ ...details, seasons: [...details.seasons.values()].map(s => ({ ...s, episodes: [...s.episodes.values()] })) });
}

export function transferIncludesPlayback(details: DisneyPlusCatalogTransfer, id: string): boolean {
	return details.movieId === id || details.seasons.some(s => s.episodes.some(e => e.playbackId === id));
}

export function hydrateDisneyPlusDetails(details: DisneyPlusCatalogTransfer): DisneyPlusDetails {
	return { ...details, seasons: new Map(details.seasons.map(s => [s.number ?? s.providerId!,
		{ ...s, episodes: new Map(s.episodes.map(e => [e.playbackId, e])) }])) };
}

export function isDisneyPlusProfileBoundary(value: string): boolean {
	try {
		const url = new URL(value);
		const locale = disneyPlusRouteLocale(url.pathname);
		const path = locale ? url.pathname.slice(locale.length + 1) : url.pathname;
		return url.origin === "https://www.disneyplus.com" &&
			/^\/(?:select-profile|profiles?|edit-profiles|identity|account|login|logout|sign-in|sign-up)(?:\/|$)/iu.test(path);
	} catch { return false; }
}
