import { parsePrimePageUrl, primeObservedLink, primeRouteMatches } from "./url";
import { readPrimePageState } from "./page-state";
import {
	PrimeVideoProviderIdSchema,
	primeVideoSourceUrl,
	WatchCatalogSnapshotInputSchema,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import {
	isPrimeArtwork,
	PrimeMetadataSchema,
	type PrimeMetadata,
} from "./contract";
export type ObjectValue = Record<string, unknown>;
export const object = (value: unknown): ObjectValue =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as ObjectValue)
		: {};
export const text = (value: unknown): string | null =>
	typeof value === "string" && value.trim().length > 0 && value.length <= 300
		? value.trim()
		: null;
export const ordinal = (value: unknown): number | null =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value > 0 &&
	value <= 1000
		? value
		: null;
const fullId = (value: unknown): value is string =>
	typeof value === "string" && /^amzn1\.dv\.gti\.[a-z0-9-]{1,100}$/.test(value);
export type PublicRecord = {
	linkToken: string;
	linkUrl: string;
	aliases: string[];
	id: string;
	compact: string;
	type: string;
	sequence: number | null;
	launched: boolean;
};
type Episode = { id: string; title: string; number: number; linkUrl: string };
export type PrimePage = {
	contentId: string;
	metadata: PrimeMetadata;
	catalog: WatchCatalogSnapshotInput | null;
};
export function primePublicRecord(
	value: unknown,
	key: string,
	origin: string,
): PublicRecord | null {
	const item = object(value);
	if (
		!fullId(item.gti) ||
		!PrimeVideoProviderIdSchema.safeParse(item.compactGTI).success ||
		typeof item.link !== "string" ||
		item.link.length > 2048
	)
		return null;
	const compact = item.compactGTI as string;
	const link = primeObservedLink(item.link, origin);
	const route = link ? parsePrimePageUrl(link) : null;
	if (
		!route ||
		(route.token.length === 26
			? route.token !== compact
			: route.token.startsWith("amzn1.")
				? route.token !== item.gti
				: false) ||
		(key !== item.gti && key !== compact && key !== route.token) ||
		!["movie", "episode", "season"].includes(String(item.titleType))
	)
		return null;
	return {
		id: item.gti as string,
		linkToken: route.token,
		linkUrl: link!,
		aliases: [key, route.token],
		compact,
		type: String(item.titleType),
		sequence: ordinal(item.sequenceNumber),
		launched: item.isLaunched === true,
	};
}
function artwork(...values: unknown[]): string | null {
	for (const value of values) {
		const images = object(value);
		for (const key of ["packshot", "covershot", "titleshot"]) {
			const url = images[key];
			if (typeof url === "string" && url.length <= 2048 && isPrimeArtwork(url))
				return url;
		}
	}
	return null;
}
/** History requires agreement across every admitted list and known ID mapping. */
function seriesAnchor(
	lists: { entries: ObjectValue[] }[],
	records: Map<string, PublicRecord>,
	invalidRecords: Set<string>,
	origin: string,
): string | null {
	let confirmed: { full: string; compact: string } | null = null;
	for (const list of lists) {
		const anchors = list.entries.filter((row) => row.sequenceNumber === 1);
		if (anchors.length !== 1) return null;
		const candidate = anchors[0]!;
		if (
			!fullId(candidate.seasonId) ||
			typeof candidate.seasonLink !== "string" ||
			invalidRecords.has(candidate.seasonId)
		)
			return null;
		const link = primeObservedLink(candidate.seasonLink, origin);
		const route = link ? parsePrimePageUrl(link) : null;
		const known = records.get(candidate.seasonId);
		const compact =
			route && known && primeRouteMatches(route.token, known)
				? known.compact
				: route?.token.length === 26
					? route.token
					: null;
		if (
			!compact ||
			invalidRecords.has(compact) ||
			(confirmed &&
				(confirmed.full !== candidate.seasonId ||
					confirmed.compact !== compact))
		)
			return null;
		if (
			known &&
			(known.compact !== compact ||
				known.type !== "season" ||
				known.sequence !== 1)
		)
			return null;
		for (const row of records.values())
			if (row.compact === compact && row.id !== candidate.seasonId) return null;
		confirmed = { full: candidate.seasonId, compact };
	}
	return confirmed?.compact ?? null;
}

/** Reads only public title collections; never serialize the surrounding hydration/account state. */
export function readPrimePage(
	documentValue: Document,
	titleInfo: unknown,
	territory: unknown,
	locale: unknown,
): PrimePage | null {
	const pageRoute = parsePrimePageUrl(
		documentValue.defaultView?.location.href ?? "",
	);
	if (!pageRoute) return null;
	const origin = pageRoute.url.origin;
	const pageState = readPrimePageState(documentValue);
	if (!pageState) return null;
	const { states, canonicalHref } = pageState;
	const invalidRecords = new Set<string>();
	const records = new Map<string, PublicRecord>();
	const details = new Map<string, ObjectValue>();
	for (const state of states) {
		const entries = Object.entries(object(state.self));
		if (entries.length > 2000) return null;
		for (const [key, value] of entries) {
			const parsed = primePublicRecord(value, key, origin),
				prior = parsed ? records.get(parsed.id) : null;
			if (
				!parsed ||
				(prior &&
					(prior.compact !== parsed.compact ||
						prior.type !== parsed.type ||
						prior.sequence !== parsed.sequence))
			) {
				const item = object(value);
				const claimed = item.gti;
				const observedLink = primeObservedLink(item.link, origin);
				const linkAlias = observedLink
					? parsePrimePageUrl(observedLink)?.token
					: null;
				const invalidIds = new Set([
					key,
					...(linkAlias ? [linkAlias] : []),
					...(fullId(claimed) ? [claimed] : []),
					...[...records.values()]
						.filter((row) => primeRouteMatches(key, row))
						.map((row) => row.id),
				]);
				for (const id of invalidIds) {
					invalidRecords.add(id);
					records.delete(id);
				}
				continue;
			}
			if (
				![parsed.id, parsed.compact, ...parsed.aliases].some((alias) =>
					invalidRecords.has(alias),
				)
			) {
				parsed.aliases = [
					...new Set([...(prior?.aliases ?? []), ...parsed.aliases]),
				];
				records.set(parsed.id, parsed);
			} else {
				// Once an alias is contradicted, later full/compact aliases cannot revive it.
				for (const alias of [parsed.id, parsed.compact, ...parsed.aliases])
					invalidRecords.add(alias);
			}
		}
		const detail = object(state.detail);
		for (const collection of [detail.headerDetail, detail.detail]) {
			const entries = Object.entries(object(collection));
			if (entries.length > 2000) return null;
			for (const [key, value] of entries) details.set(key, object(value));
		}
	}
	// A malformed alias can precede or follow its otherwise valid self record.
	// Resolve tombstones against the final mapping rather than relying on state order.
	for (const [id, record] of records)
		if (
			[id, record.compact, ...record.aliases].some((alias) =>
				invalidRecords.has(alias),
			)
		) {
			invalidRecords.add(id);
			records.delete(id);
		}
	// Resolve public collection keys only through the verified full/compact/ASIN mapping.
	const resolve = (key: unknown) => {
		if (typeof key !== "string") return null;
		const matches = [...records.values()].filter((row) =>
			primeRouteMatches(key, row),
		);
		return matches.length === 1 ? matches[0]!.id : null;
	};
	for (const [key, value] of [...details]) {
		const id = resolve(key);
		if (id) details.set(id, value);
	}
	const info = object(titleInfo);
	const id = info.titleId;
	if (!fullId(id)) return null;
	const current = records.get(id);
	if (
		!current ||
		!["episode", "movie"].includes(current.type) ||
		[...records.values()].some(
			(row) => row.id !== current.id && row.compact === current.compact,
		)
	)
		return null;
	const canonicalLink = canonicalHref
		? primeObservedLink(canonicalHref, origin)
		: null;
	if (canonicalHref && !canonicalLink) return null;
	const canonicalRoute = canonicalLink
		? parsePrimePageUrl(canonicalLink)
		: null;
	const mapped = (token: string) =>
		[...records.values()].filter((row) => primeRouteMatches(token, row));
	let routes = mapped(pageRoute.token);
	// A marketplace address ASIN may differ from the public self ASIN. Only its
	// same-origin canonical link can establish that alias; active SDK still must agree.
	if (routes.length === 0 && pageRoute.token.length === 10 && canonicalRoute)
		routes = mapped(canonicalRoute.token);
	if (routes.length !== 1) return null;
	if (canonicalRoute) {
		const canonicalRecords = mapped(canonicalRoute.token);
		if (
			canonicalRecords.length !== 1 ||
			canonicalRecords[0]!.id !== routes[0]!.id
		)
			return null;
	}
	const routeId = routes[0]!.compact;
	const detail = details.get(id) ?? {};
	// Prime's page and SDK can localize/format the same title differently (even
	// "Sadie, Sadie ..." vs "Sadie, Sadie..."). GTI, type, route, membership and
	// ordinals prove identity. Display labels come from the mapped public record.
	const title = text(detail.title);
	if (!title) return null;
	const context =
		typeof territory === "string" &&
		/^[A-Z]{2}$/.test(territory) &&
		typeof locale === "string" &&
		/^[a-z]{2,3}[_-][A-Z]{2}$/.test(locale)
			? {
					region: territory,
					requestedLocale: locale.replace("_", "-"),
					audioLocale: null,
					subtitleLocales: [],
					observedAt: new Date().toISOString(),
				}
			: null;
	if (current.type === "movie") {
		if (
			routeId !== current.compact ||
			info.type !== "MOVIE" ||
			(detail.titleType !== undefined && detail.titleType !== "movie")
		)
			return null;
		const metadata = PrimeMetadataSchema.safeParse({
			identity: { kind: "movie", providerMovieId: current.compact },
   primeNavigation: primeObservedNavigation(current.compact,current.linkUrl),
			title,
			episodeTitle: title,
			seasonTitle: null,
			seasonNumber: null,
			episodeNumber: null,
			artworkUrl: artwork(detail.images),
			context,
		});
		return metadata.success
			? { contentId: current.compact, metadata: metadata.data, catalog: null }
			: null;
	}
	// The selected season and its episode-list membership establish the relationship,
	// even when the address bar remains on that season through native Next Episode.
	const lists: { season: PublicRecord; entries: ObjectValue[] }[] = [];
	for (const state of states)
		for (const [seasonId, value] of Object.entries(object(state.seasons))) {
			const fullSeason = resolve(seasonId);
			const season = fullSeason ? records.get(fullSeason) : null;
			if (
				!season ||
				season.type !== "season" ||
				!Array.isArray(value) ||
				value.length > 100
			)
				continue;
			const entries: ObjectValue[] = value.map((value) => {
				const row = object(value);
				return { ...row, seasonId: resolve(row.seasonId) ?? row.seasonId };
			});
			const selected = entries.filter((row) => row.isSelected === true);
			if (selected.length === 1 && selected[0]!.seasonId === fullSeason)
				lists.push({ season, entries });
		}
	// Some season pages expose no switcher. A proven season-1 page record,
	// matching pageTitleId and header ordinal is an explicit season-1 anchor.
	if (
		!lists.length &&
		states.every((state) => Object.keys(object(state.seasons)).length === 0)
	) {
		const pageIds = states.map((state) => resolve(state.pageTitleId));
		const season = pageIds[0] ? records.get(pageIds[0]) : null;
		if (
			season?.type === "season" &&
			season.sequence === 1 &&
			pageIds.every((id) => id === season.id) &&
			details.get(season.id)?.seasonNumber === 1
		) {
			lists.push({
				season,
				entries: [
					{
						seasonId: season.id,
						seasonLink: season.linkUrl,
						sequenceNumber: 1,
						isSelected: true,
					},
				],
			});
		}
	}
	const selected = lists[0];
	if (!selected || lists.some((list) => list.season.id !== selected.season.id))
		return null;
	const { season, entries } = selected;
	// Ambiguous playback IDs are fatal; unrelated anchor conflicts only suspend history.
	for (const target of [current, season])
		if (
			[...records.values()].some(
				(row) => row.id !== target.id && row.compact === target.compact,
			)
		)
			return null;
	const selectedRow = entries.find((row) => row.isSelected === true)!;
	if (
		typeof selectedRow.seasonLink !== "string" ||
		!(() => {
			const link = primeObservedLink(selectedRow.seasonLink, origin);
			const route = link ? parsePrimePageUrl(link) : null;
			return route && primeRouteMatches(route.token, season);
		})() ||
		selectedRow.sequenceNumber !== season.sequence
	)
		return null;
	if (
		routeId !== season.compact &&
		![...records.values()].some(
			(row) => row.compact === routeId && row.type === "episode",
		)
	)
		return null;
	const memberIds = new Set<string>();
	for (const state of states) {
		const ids = object(state.episodeList).cardTitleIds;
		if (Array.isArray(ids) && ids.length <= 2000)
			for (const value of ids) {
				const id = resolve(value);
				if (id) memberIds.add(id);
			}
	}
	if (
		!memberIds.has(id) ||
		detail.titleType !== "episode"
	)
		return null;
	// An episode route must itself belong to the same observed season, not merely appear in self.
	if (
		routeId !== season.compact &&
		![...memberIds].some((key) => records.get(key)?.compact === routeId)
	)
		return null;
	const seasonDetail = details.get(season.id) ?? {};
	const seasonNumber = ordinal(seasonDetail.seasonNumber),
		episodeNumber = ordinal(detail.episodeNumber);
	if (
		info.type !== "EPISODE" ||
		!seasonNumber ||
		!episodeNumber ||
		season.sequence !== seasonNumber ||
		current.sequence !== episodeNumber ||
		info.seasonNumber !== seasonNumber ||
		info.episodeNumber !== episodeNumber
	)
		return null;
	const seriesTitle = text(seasonDetail.parentTitle),
		seasonTitle = text(seasonDetail.title);
	if (!seriesTitle || !seasonTitle)
		return null;
	const anchor = seriesAnchor(lists, records, invalidRecords, origin);
	const identity = anchor
		? {
				kind: "episode" as const,
				seriesAnchorSeasonId: anchor,
				providerSeasonIdentifier: season.compact,
				providerEpisodeIdentifier: current.compact,
			}
		: null;
	const metadata = PrimeMetadataSchema.safeParse({
  primeNavigation: primeObservedNavigation(current.compact,current.linkUrl),
		identity,
		title: seriesTitle,
		episodeTitle: title,
		seasonTitle,
		seasonNumber,
		episodeNumber,
		artworkUrl: artwork(seasonDetail.images, detail.images),
		context,
	});
	if (!metadata.success) return null;
	// Only observed enabled provider Play actions establish unplayed availability.
	const playable = new Set<string>([current.compact]);
	const actions = documentValue.querySelectorAll<HTMLAnchorElement>(
		'a[data-testid="episodes-playbutton"][role="button"]',
	);
	if (actions.length <= 4000)
		for (const action of actions) {
			if (
				action.hasAttribute("disabled") ||
				![null, "false"].includes(action.getAttribute("aria-disabled"))
			)
				continue;
			try {
				const url = new URL(
					action.getAttribute("href") ?? "",
					documentValue.defaultView?.location.href,
				);
				const safe = primeObservedLink(action.getAttribute("href"), origin);
				const route = safe ? parsePrimePageUrl(safe) : null;
				const matches = route ? mapped(route.token) : [];
				const compact = matches.length === 1 ? matches[0]!.compact : null;
				if (compact && url.searchParams.get("autoplay") === "1")
					playable.add(compact);
			} catch {
				/* Ignore malformed public links. */
			}
		}
	const episodes: Episode[] = [];
	for (const member of memberIds) {
		const row = records.get(member),
			item = details.get(member);
		if (!row || row.type !== "episode" || !item) continue;
		const number = ordinal(item.episodeNumber),
			episodeTitle = text(item.title);
		if (
			(row.compact === current.compact ||
				(row.launched && playable.has(row.compact))) &&
			number &&
			row.sequence === number &&
			episodeTitle &&
			item.titleType === "episode"
		)
			episodes.push({ id: row.compact, title: episodeTitle, number, linkUrl:row.linkUrl });
	}
	const catalog =
		anchor && context
			? WatchCatalogSnapshotInputSchema.safeParse({
					schemaVersion: 3,
					provider: "primevideo",
					titleKey: `primevideo:series:${anchor}`,
					providerSeriesId: anchor,
					title: seriesTitle,
					completeness: "partial",
					context,
					seasons: [
						{
							seasonKey: `primevideo:season:${season.compact}`,
							providerSeasonIdentifier: season.compact,
							title: seasonTitle,
							seasonNumber,
							order: seasonNumber - 1,
							// Unproved entries are omitted; they are never labeled unavailable.
							episodes: episodes.map((episode, order) => ({
								episodeKey: `primevideo:episode:${episode.id}`,
								providerEpisodeIdentifier: episode.id,
								title: episode.title,
								episodeNumber: episode.number,
								order,
								releasedAt: null,
								available: true,
								watchVariants: [
									{
										providerContentId: episode.id,
										audioLocale: null,
										original: true,
										order: 0,
										sourceUrl: primeVideoSourceUrl(episode.id),
          primeNavigation: primeObservedNavigation(episode.id,episode.linkUrl),
									},
								],
							})),
						},
					],
				})
			: null;
	return {
		contentId: current.compact,
		metadata: metadata.data,
		catalog: catalog?.success ? catalog.data : null,
	};
}

/** Public alias mapping for an isolated-world launch; the adapter must separately
 * prove active SDK playback before using the returned canonical identity. */
export function primeDocumentRouteId(
	documentValue: Document,
	href: string,
): string | null {
	const route = parsePrimePageUrl(href);
	const liveRoute = parsePrimePageUrl(
		documentValue.defaultView?.location.href ?? "",
	);
	if (!route || !liveRoute || route.url.origin !== liveRoute.url.origin)
		return null;
	const raw = documentValue.getElementById(
		"dv-web-page-hydration-data",
	)?.textContent;
	if (!raw || raw.length > 8_000_000) return null;
	try {
		const body = object(
			object(object(object(JSON.parse(raw)).init).preparations).body,
		);
		const records = new Map<string, PublicRecord>();
		for (const plane of [body.atf, body.btf]) {
			const entries = Object.entries(object(object(plane).state).self ?? {});
			if (entries.length > 2000) return null;
			for (const [key, value] of entries) {
				const parsed = primePublicRecord(value, key, route.url.origin);
				if (!parsed) return null;
				const prior = records.get(parsed.id);
				if (
					prior &&
					(prior.compact !== parsed.compact ||
						prior.type !== parsed.type ||
						prior.sequence !== parsed.sequence)
				)
					return null;
				parsed.aliases = [
					...new Set([...(prior?.aliases ?? []), ...parsed.aliases]),
				];
				records.set(parsed.id, parsed);
			}
		}
		const matching = (token: string) =>
			[...records.values()].filter((row) => primeRouteMatches(token, row));
		let matches = matching(route.token);
		const canonicalHref = documentValue
			.querySelector<HTMLLinkElement>('link[rel="canonical"]')
			?.getAttribute("href");
		const canonicalLink = canonicalHref
			? primeObservedLink(canonicalHref, route.url.origin)
			: null;
		if (canonicalHref && !canonicalLink) return null;
		const canonical = canonicalLink ? parsePrimePageUrl(canonicalLink) : null;
		// Only the live document route owns its canonical-tag alias proof. An old
		// unknown ASIN must never borrow a new SPA document's canonical identity.
		if (
			!matches.length &&
			route.token === liveRoute.token &&
			route.token.length === 10 &&
			canonical
		)
			matches = matching(canonical.token);
		if (
			matches.length !== 1 ||
			[...records.values()].some(
				(row) =>
					row.id !== matches[0]!.id && row.compact === matches[0]!.compact,
			)
		)
			return null;
		if (route.token !== liveRoute.token) {
			const live = matching(liveRoute.token);
			if (live.length !== 1 || live[0]?.id !== matches[0]?.id) return null;
		}
		if (canonical) {
			const proof = matching(canonical.token);
			if (proof.length !== 1 || proof[0]!.id !== matches[0]!.id) return null;
		}
		return matches[0]!.compact;
	} catch {
		return null;
	}
}

// Stable for repeated inspections of the same exact public mapping. Observation
// time is metadata, not a source generation or playback authority.
const observationTimes = new Map<string,string>();
export function primeObservedNavigation(contentId:string,url:string) {
 if(url===primeVideoSourceUrl(contentId))return undefined;
 const key=JSON.stringify([contentId,url]);let observedAt=observationTimes.get(key);
 if(!observedAt){observedAt=new Date().toISOString();if(observationTimes.size>=10000)observationTimes.delete(observationTimes.keys().next().value!);observationTimes.set(key,observedAt);}
 return {contentId,routes:[{url,observedAt}]};
}
