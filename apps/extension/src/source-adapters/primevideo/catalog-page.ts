import { parsePrimePageUrl, primeObservedLink, primeRouteMatches } from "./url";
import { readPrimePageState } from "./page-state";
import { primePublicRecord, type PublicRecord } from "./metadata";
import {
	PrimeVideoProviderIdSchema,
	WATCH_CATALOG_MAX_EPISODES,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import { object, ordinal, text, type ObjectValue } from "./metadata";

import {
	readCatalogEpisode,
	readEpisodeRange,
	type EpisodeRange,
} from "./catalog-episodes";

export const PRIME_CATALOG_PAGE_BYTES = 8_000_000;
type SeasonReference = {
	id: string;
	compact: string | null;
	number: number;
	url: string;
};
export type PrimeCatalogPage = {
	anchor: string | null;
	hasSeasonRoster: boolean;
	locale: string;
	selected: SeasonReference;
	seasons: SeasonReference[];
	season: WatchCatalogSnapshotInput["seasons"][number];
	episodeFullIds: string[];
	range: EpisodeRange;
	pageTitleId: string;
};
const fullId = (value: unknown): value is string =>
	typeof value === "string" && /^amzn1\.dv\.gti\.[a-z0-9-]{1,100}$/.test(value);

/** Observed same-origin detail links, stripped of query, ref suffix and hash. */
export function primeCatalogLink(
	value: unknown,
	origin: string,
): string | null {
	return primeObservedLink(value, origin);
}
export function primeCatalogLocale(value: unknown): string | null {
	if (typeof value !== "string" || !/^[a-z]{2,3}[-_][a-z]{2}$/i.test(value))
		return null;
	const [language, region] = value.replace("_", "-").split("-");
	return `${language!.toLowerCase()}-${region!.toUpperCase()}`;
}
// Unselected retail seasons may expose only the ASIN in their same-origin link.
// Once both pages provide canonical IDs, those IDs must agree too.
export function samePrimeSeason(a: SeasonReference, b: SeasonReference): boolean {
	return (
		a.url === b.url &&
		a.number === b.number &&
		(a.compact === null || b.compact === null ||
			(a.id === b.id && a.compact === b.compact))
	);
}

/** Parse metadata independently of the playing SDK. Never copy action envelopes. */
function parsePage(
	raw: string,
	locale: unknown,
	origin: string,
): PrimeCatalogPage | null {
	if (raw.length > PRIME_CATALOG_PAGE_BYTES) return null;
	const language = primeCatalogLocale(locale);
	if (!language) return null;
	let data: ObjectValue;
	try {
		data = object(JSON.parse(raw));
	} catch {
		return null;
	}
	const body = object(object(object(data.init).preparations).body);
	const states = [
		object(object(body.atf).state),
		object(object(body.btf).state),
	];
	return parseStates(states, language, origin);
}

function parseStates(
	states: ObjectValue[],
	language: string,
	origin: string,
): PrimeCatalogPage | null {
	const records = new Map<string, PublicRecord>();
	const details = new Map<
		string,
		{
			title: string | null;
			parent: string | null;
			type: unknown;
			season: number | null;
			episode: number | null;
		}
	>();
	for (const state of states) {
		const entries = Object.entries(object(state.self));
		if (entries.length > WATCH_CATALOG_MAX_EPISODES + 100) return null;
		for (const [key, value] of entries) {
			const parsed = primePublicRecord(value, key, origin);
			if (!parsed) return null;
			const record = parsed;
			const prior = records.get(parsed.id);
			if (
				prior &&
				(prior.compact !== record.compact ||
					prior.type !== record.type ||
					prior.linkUrl !== record.linkUrl ||
					prior.sequence !== record.sequence ||
					prior.launched !== record.launched)
			)
				return null;
			record.aliases = [
				...new Set([...(prior?.aliases ?? []), ...record.aliases]),
			];
			records.set(parsed.id, record);
		}
		const detail = object(state.detail);
		for (const collection of [detail.headerDetail, detail.detail]) {
			const entries = Object.entries(object(collection));
			if (entries.length > WATCH_CATALOG_MAX_EPISODES + 100) return null;
			for (const [key, value] of entries) {
				const item = object(value);
				const parsed = {
					title: text(item.title),
					parent: text(item.parentTitle),
					type: item.titleType,
					season: ordinal(item.seasonNumber),
					episode: ordinal(item.episodeNumber),
				};
				const prior = details.get(key);
				if (prior && JSON.stringify(prior) !== JSON.stringify(parsed))
					return null;
				details.set(key, parsed);
			}
		}
	}
	const aliases = new Map<string, string | null>();
	for (const record of records.values())
		for (const alias of [
			record.id,
			record.compact,
			record.linkToken,
			...record.aliases,
		]) {
			const prior = aliases.get(alias);
			aliases.set(
				alias,
				prior === undefined || prior === record.id ? record.id : null,
			);
		}
	const resolve = (key: unknown) =>
		typeof key === "string" ? (aliases.get(key) ?? null) : null;
	for (const [key, value] of [...details]) {
		const full = resolve(key);
		if (full) details.set(full, value);
	}
	if (
		new Set([...records.values()].map((row) => row.compact)).size !==
		records.size
	)
		return null;
	let seasons: SeasonReference[] | null = null,
		selected: SeasonReference | null = null;
	for (const state of states) {
		const lists = Object.entries(object(state.seasons));
		if (lists.length > 1) return null;
		for (const [key, value] of lists) {
			if (!Array.isArray(value) || value.length < 1 || value.length > 100)
				return null;
			const mapping: SeasonReference[] = [];
			let chosen: SeasonReference | null = null;
			for (const valueRow of value) {
				const row = object(valueRow),
					link = primeCatalogLink(row.seasonLink, origin),
					number = ordinal(row.sequenceNumber);
				if (
					!link || !number ||
					typeof row.seasonId !== "string" ||
					typeof row.isSelected !== "boolean"
				) return null;
				const route = parsePrimePageUrl(link)!;
				const id = resolve(row.seasonId) ?? row.seasonId;
				const record = records.get(id);
				const retailReference =
					id === route.token && /^[A-Z0-9]{10}$/.test(id) && !aliases.has(id);
				if (!fullId(id) && !retailReference) return null;
				const compact = record && primeRouteMatches(route.token, record)
					? record.compact
					: PrimeVideoProviderIdSchema.safeParse(route.token).success
						? route.token
						: null;
				if (!compact && (!retailReference || row.isSelected)) return null;
				if (record && (record.compact !== compact || record.type !== "season" || record.sequence !== number)) return null;
				if ([...records.values()].some(other => other.compact === compact && other.id !== id)) return null;
				const reference = { id, compact, number, url: link };
				mapping.push(reference);
				if (row.isSelected) {
					if (chosen) return null;
					chosen = reference;
				}
			}
			if (
				!chosen ||
				chosen.id !== resolve(key) ||
				resolve(state.pageTitleId) !== chosen.id
			)
				return null;
			if (
				new Set(mapping.map((row) => row.id)).size !== mapping.length ||
				new Set(mapping.map((row) => row.compact ?? row.id)).size !== mapping.length ||
				new Set(mapping.map((row) => row.url)).size !== mapping.length ||
				new Set(mapping.map((row) => row.number)).size !== mapping.length
			)
				return null;
			mapping.sort((a, b) => a.number - b.number);
			if (
				(seasons && JSON.stringify(seasons) !== JSON.stringify(mapping)) ||
				(selected && JSON.stringify(selected) !== JSON.stringify(chosen))
			)
				return null;
			seasons = mapping;
			selected = chosen;
		}
	}
	const hasSeasonRoster = seasons !== null;
	// Season-1 titles may omit the switcher entirely. Use the same explicit
	// season-1 proof as playback metadata, never an inferred ordinal/title label.
	if (
		!seasons &&
		states.every((state) => Object.keys(object(state.seasons)).length === 0)
	) {
		const pageIds = states.map((state) => resolve(state.pageTitleId));
		const pageId = pageIds[0];
		const record = pageId ? records.get(pageId) : null;
		if (
			record?.type === "season" &&
			record.sequence === 1 &&
			pageIds.every((id) => id === record.id) &&
			details.get(record.id)?.season === 1
		) {
			selected = {
				id: record.id,
				compact: record.compact,
				number: 1,
				url: record.linkUrl,
			};
			seasons = [selected];
		}
	}
	if (!seasons || !selected || seasons[0]?.number !== 1) return null;
	if (states.some((state) => resolve(state.pageTitleId) !== selected!.id))
		return null;
	const seasonRecord = records.get(selected.id),
		seasonDetail = details.get(selected.id);
	if (
		!seasonRecord?.launched ||
		seasonRecord.type !== "season" ||
		seasonRecord.compact !== selected.compact ||
		seasonRecord.sequence !== selected.number ||
		!seasonDetail?.title ||
		!seasonDetail.parent ||
		seasonDetail.type !== "season" ||
		seasonDetail.season !== selected.number
	)
		return null;
	let members: string[] | null = null;
	let range: EpisodeRange | null = null;
	for (const state of states) {
		// ATF can omit episodeList or contain only an empty placeholder. It is
		// not positive membership evidence; the actual BTF collection must still
		// prove every member, count and selected page below.
		if (state.episodeList === undefined) continue;
		if (
			!state.episodeList ||
			typeof state.episodeList !== "object" ||
			Array.isArray(state.episodeList)
		)
			return null;
		const list = object(state.episodeList),
			actions = object(list.actions);
		if (
			list.actions !== undefined &&
			(!list.actions ||
				typeof list.actions !== "object" ||
				Array.isArray(list.actions))
		)
			return null;
		if (list.cardTitleIds === undefined) {
			if (
				list.totalCardSize !== undefined ||
				(actions.pagination !== undefined &&
					(!Array.isArray(actions.pagination) ||
						actions.pagination.length !== 0)) ||
				(actions.episodePages !== undefined &&
					(!Array.isArray(actions.episodePages) ||
						actions.episodePages.length !== 0))
			)
				return null;
			continue;
		}
		if (
			!Array.isArray(list.cardTitleIds) ||
			!list.cardTitleIds.every((value) => !!resolve(value)) ||
			new Set(list.cardTitleIds).size !== list.cardTitleIds.length
		)
			return null;
		const slice = readEpisodeRange(
			actions,
			list.totalCardSize,
			list.cardTitleIds.length,
		);
		if (!slice || (range && JSON.stringify(range) !== JSON.stringify(slice)))
			return null;
		range = slice;
		if (
			members &&
			JSON.stringify(members) !==
				JSON.stringify(list.cardTitleIds.map((value) => resolve(value)))
		)
			return null;
		members = list.cardTitleIds.map((value) => resolve(value)!);
	}
	if (!members || !range) return null;
	const episodes: WatchCatalogSnapshotInput["seasons"][number]["episodes"] = [];
	for (const [order, full] of members.entries()) {
		const record = records.get(full),
			detail = details.get(full);
		if (
			!record ||
			detail?.type !== "episode" ||
			!detail.episode
		)
			return null;
		const actions = object(object(states[1]!.action).btf);
		const keys = Object.keys(actions).filter((key) => resolve(key) === full);
		if (keys.length !== 1) return null;
		const episode = readCatalogEpisode(
			record,
			detail.title,
			detail.episode,
			actions[keys[0]!],
			order,
			origin,
			(value) => resolve(value) === full,
		);
		if (!episode) return null;
		episodes.push(episode);
	}
	// All observed episode self records must be accounted for by exact membership.
	if (
		[...records.values()].some(
			(record) => record.type === "episode" && !members.includes(record.id),
		)
	)
		return null;
	return {
		anchor: seasons[0]!.compact,
		hasSeasonRoster,
		locale: language,
		selected,
		seasons,
		episodeFullIds: members,
		range,
		pageTitleId: states[0]!.pageTitleId as string,
		season: {
			seasonKey: `primevideo:season:${seasonRecord.compact}`,
			providerSeasonIdentifier: seasonRecord.compact,
			title: seasonDetail.title,
			seasonNumber: selected.number,
			order: selected.number - 1,
			episodes,
		},
	};
}
export function readPrimeCatalogPage(
	documentValue: Document,
	origin: string,
): PrimeCatalogPage | null {
	const pageState = readPrimePageState(documentValue);
	const language = primeCatalogLocale(documentValue.documentElement.lang);
	return pageState && language
		? parseStates(pageState.states, language, origin)
		: null;
}
/** Extract inert JSON only: never build a fetched DOM that can load resources. */
export function readPrimeCatalogHtml(
	html: string,
	origin: string,
): PrimeCatalogPage | null {
	const locale = /<html\b[^>]*\blang\s*=\s*(["'])([^"']+)\1/i.exec(html)?.[2];
	const raw = readPrimeHydrationJson(html);
	return raw ? parsePage(raw, locale, origin) : null;
}

export function readPrimeHydrationJson(html: string): string | null {
	if (html.length > PRIME_CATALOG_PAGE_BYTES) return null;
	const scripts = [
		...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
	].filter((match) =>
		/\bid\s*=\s*(["'])dv-web-page-hydration-data\1/i.test(match[1]!),
	);
	return scripts.length === 1 ? scripts[0]![2]! : null;
}
