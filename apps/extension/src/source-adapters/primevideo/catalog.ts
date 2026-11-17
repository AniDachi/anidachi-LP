import {
	WATCH_CATALOG_MAX_EPISODES,
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import type { PrimeSnapshot } from "./contract";
import {
	PRIME_CATALOG_PAGE_BYTES,
	primeCatalogLocale,
	primeSeasonMapping,
	readPrimeCatalogHtml,
	readPrimeCatalogPage,
	type PrimeCatalogPage,
} from "./catalog-page";

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
		page.season.episodes.some(
			(episode) =>
				episode.providerEpisodeIdentifier ===
				identity.providerEpisodeIdentifier,
		)
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
	let totalBytes = 0;
	const alive = () =>
		!controller.signal.aborted && !signal.aborted && isCurrent();
	try {
		const seasons: WatchCatalogSnapshotInput["seasons"] = [],
			fullIds = new Set<string>();
		let count = 0;
		let hasSeasonRoster = seed.hasSeasonRoster;
		for (const observed of seed.seasons) {
			if (!alive()) return null;
			const url = observed.url;
			const response = await fetch(url, {
				method: "GET",
				credentials: "same-origin",
				redirect: "error",
				signal: controller.signal,
				headers: { Accept: "text/html" },
			});
			const length = response.headers.get("content-length");
			if (
				!alive() ||
				!response.ok ||
				response.redirected ||
				response.url !== url ||
				response.headers
					.get("content-type")
					?.split(";")[0]
					?.trim()
					.toLowerCase() !== "text/html" ||
				(length !== null &&
					(!/^\d+$/.test(length) ||
						Number(length) > PRIME_CATALOG_PAGE_BYTES)) ||
				!response.body
			) {
				await response.body?.cancel();
				return null;
			}
			const reader = response.body.getReader(),
				decoder = new TextDecoder();
			const abortRead = () => {
				void reader.cancel().catch(() => undefined);
			};
			controller.signal.addEventListener("abort", abortRead, { once: true });
			let bytes = 0,
				html = "";
			try {
				while (alive()) {
					const part = await reader.read();
					if (!alive()) return null;
					if (part.done) break;
					bytes += part.value.byteLength;
					totalBytes += part.value.byteLength;
					if (bytes > PRIME_CATALOG_PAGE_BYTES || totalBytes > TOTAL_BYTES)
						return null;
					html += decoder.decode(part.value, { stream: true });
				}
				html += decoder.decode();
			} finally {
				controller.signal.removeEventListener("abort", abortRead);
				await reader.cancel().catch(() => undefined);
				reader.releaseLock();
			}
			if (!alive()) return null;
			const page = readPrimeCatalogHtml(html, origin);
			if (
				!page ||
				page.anchor !== seed.anchor ||
				page.locale !== seed.locale ||
				JSON.stringify(page.selected) !== JSON.stringify(observed) ||
				primeSeasonMapping(page) !== primeSeasonMapping(seed)
			)
				return null;
			hasSeasonRoster = hasSeasonRoster && page.hasSeasonRoster;
			if (
				observed.compact === seed.selected.compact &&
				(!matchesSnapshot(page, initial) ||
					JSON.stringify(page.episodeFullIds) !==
						JSON.stringify(seed.episodeFullIds) ||
					JSON.stringify(
						page.season.episodes.map(
							(episode) => episode.providerEpisodeIdentifier,
						),
					) !==
						JSON.stringify(
							seed.season.episodes.map(
								(episode) => episode.providerEpisodeIdentifier,
							),
						))
			)
				return null;
			for (const full of page.episodeFullIds) {
				if (fullIds.has(full)) return null;
				fullIds.add(full);
			}
			count += page.season.episodes.length;
			if (count > WATCH_CATALOG_MAX_EPISODES) return null;
			seasons.push(page.season);
		}
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
			completeness: hasSeasonRoster ? "complete" : "partial",
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
