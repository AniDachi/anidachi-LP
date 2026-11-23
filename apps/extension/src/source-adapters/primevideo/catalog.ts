import { createPrimePageReader } from "./page-reader";
import {
	WATCH_CATALOG_MAX_EPISODES,
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import type { PrimeSnapshot } from "./contract";
import {
	primeCatalogLocale,
	primeSeasonMapping,
	readPrimeCatalogHtml,
	readPrimeCatalogPage,
	type PrimeCatalogPage,
} from "./catalog-page";

import { episodeWidgetUrl, readEpisodeWidget } from "./catalog-episodes";

export const PRIME_CATALOG_MAIN_TIMEOUT = 45_000;
export const PRIME_CATALOG_CLIENT_TIMEOUT = 50_000;
const TOTAL_BYTES = 32_000_000;

export function primeCatalogContext(snapshot: PrimeSnapshot): string {
	const context = snapshot.metadata.context;
	return JSON.stringify([
		snapshot.metadata.identity,
		context?.region,
		primeCatalogLocale(context?.requestedLocale),
		context?.audioLocale,
		context?.subtitleLocales,
	]);
}
function matchesSnapshot(
	page: PrimeCatalogPage,
	snapshot: PrimeSnapshot,
): boolean {
	const identity = snapshot.metadata.identity,
		context = snapshot.metadata.context;
	return (
		identity?.kind === "episode" &&
		!!context?.region &&
		page.anchor === identity.seriesAnchorSeasonId &&
		page.selected.compact === identity.providerSeasonIdentifier &&
		page.locale === primeCatalogLocale(context.requestedLocale) &&
		(page.range.tokens.length > 0 ||
			page.season.episodes.some(
				(episode) =>
					episode.providerEpisodeIdentifier ===
					identity.providerEpisodeIdentifier,
			))
	);
}

/** Sequential same-origin metadata GETs only. Failure preserves the honest partial. */
export async function loadPrimeCatalog(
	initial: PrimeSnapshot,
	signal: AbortSignal,
	isCurrent: () => boolean,
	documentValue: Document = document,
): Promise<WatchCatalogSnapshotInput | null> {
	const origin = documentValue.defaultView?.location.origin;
	if (!origin || signal.aborted || !isCurrent()) return null;
	const seed = readPrimeCatalogPage(documentValue, origin);
	if (!seed || !matchesSnapshot(seed, initial)) return null;
	const controller = new AbortController();
	const cancel = () => controller.abort();
	signal.addEventListener("abort", cancel, { once: true });
	const timeout = setTimeout(cancel, PRIME_CATALOG_MAIN_TIMEOUT);
	const alive = () =>
		!controller.signal.aborted && !signal.aborted && isCurrent();
	const read = createPrimePageReader(controller.signal, alive, TOTAL_BYTES);
	try {
		const seasons: WatchCatalogSnapshotInput["seasons"] = [];
		const fullIds = new Set<string>(),
			compactIds = new Set<string>();
		let complete = seed.hasSeasonRoster;
		for (const observed of seed.seasons) {
			if (!alive()) return null;
			let page: PrimeCatalogPage | null;
			try {
				page = readPrimeCatalogHtml(
					await read(observed.url, "text/html"),
					origin,
				);
			} catch {
				complete = false;
				break;
			}
			if (page && page.locale !== seed.locale) return null;
			if (
				!page ||
				page.anchor !== seed.anchor ||
				JSON.stringify(page.selected) !== JSON.stringify(observed) ||
				primeSeasonMapping(page) !== primeSeasonMapping(seed)
			) {
				if (observed.full === seed.selected.full) return null;
				complete = false;
				continue;
			}
			const parts = new Map([
				[
					page.range.selected,
					{ episodes: page.season.episodes, ids: page.episodeFullIds },
				],
			]);
			for (const [index, token] of page.range.tokens.entries()) {
				if (index === page.range.selected) continue;
				if (!alive()) return null;
				try {
					const raw = await read(
						episodeWidgetUrl(observed.url, page.pageTitleId, token),
						"application/json",
					);
					const part = readEpisodeWidget(
						raw,
						page.pageTitleId,
						page.range,
						index,
						origin,
					);
					if (part) parts.set(index, part);
				} catch {
					break;
				}
			}
			const ordered = [...parts.entries()]
				.sort(([a], [b]) => a - b)
				.map(([, part]) => part);
			const ids = ordered.flatMap((part) => part.ids);
			const episodes = ordered
				.flatMap((part) => part.episodes);
			const seasonIds = new Set(ids),
				seasonCompacts = new Set(
					episodes.map((e) => e.providerEpisodeIdentifier),
				);
			if (
				ids.length > page.range.total ||
				seasonIds.size !== ids.length ||
				seasonCompacts.size !== ids.length ||
				ids.some((id) => fullIds.has(id)) ||
				[...seasonCompacts].some((id) => compactIds.has(id))
			) {
				complete = false;
				continue;
			}
			if (
				observed.full === seed.selected.full &&
				(!seed.episodeFullIds.every((id) => seasonIds.has(id)) ||
					!seed.season.episodes.every((e) =>
						seasonCompacts.has(e.providerEpisodeIdentifier),
					))
			)
				return null;
			if (fullIds.size + ids.length > WATCH_CATALOG_MAX_EPISODES) return null;
			for (const id of ids) fullIds.add(id);
			for (const compact of seasonCompacts) compactIds.add(compact);
			// Prime can list an unavailable cut beside a playable edition with the
			// same episode number. Count all provider IDs for page completeness,
			// but expose the playable edition(s) for that number in the grid.
			const playableNumbers = new Set(
				episodes.filter((episode) => episode.available).map((episode) => episode.episodeNumber),
			);
			seasons.push({
				...page.season,
				episodes: episodes.filter((episode) => episode.available || !playableNumbers.has(episode.episodeNumber))
					.map((episode, order) => ({ ...episode, order })),
			});
			complete &&=
				page.hasSeasonRoster &&
				ids.length === page.range.total &&
				parts.size === Math.max(1, page.range.tokens.length);
		}
		if (
			!seasons.some((s) => s.providerSeasonIdentifier === seed.selected.compact)
		) {
			if (
				seed.episodeFullIds.some((id) => fullIds.has(id)) ||
				seed.season.episodes.some((e) =>
					compactIds.has(e.providerEpisodeIdentifier),
				)
			)
				return null;
			seasons.push(seed.season);
			seasons.sort((a, b) => a.order - b.order);
			complete = false;
		}
		const identity = initial.metadata.identity;
		if (
			identity?.kind !== "episode" ||
			!seasons.some(
				(season) =>
					season.providerSeasonIdentifier ===
						identity.providerSeasonIdentifier &&
					season.episodes.some(
						(episode) =>
							episode.providerEpisodeIdentifier ===
							identity.providerEpisodeIdentifier,
					),
			)
		)
			return null;
		const final = readPrimeCatalogPage(documentValue, origin);
		if (
			!alive() ||
			!final ||
			!matchesSnapshot(final, initial) ||
			primeSeasonMapping(final) !== primeSeasonMapping(seed) ||
			JSON.stringify(final) !== JSON.stringify(seed)
		)
			return null;
		const parsed = WatchCatalogSnapshotInputSchema.safeParse({
			schemaVersion: 3,
			provider: "primevideo",
			titleKey: `primevideo:series:${seed.anchor}`,
			providerSeriesId: seed.anchor,
			title: initial.metadata.title,
			completeness: complete ? "complete" : "partial",
			context: initial.metadata.context,
			seasons,
		});
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
		signal.removeEventListener("abort", cancel);
		controller.abort();
	}
}
