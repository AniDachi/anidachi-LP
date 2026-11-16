import {
	PrimeVideoProviderIdSchema,
	primeVideoSourceUrl,
	WATCH_CATALOG_MAX_EPISODES,
	type WatchCatalogSnapshotInput,
} from "@anidachi/protocol";
import { object, ordinal, text, type ObjectValue } from "./metadata";

export const PRIME_CATALOG_PAGE_BYTES = 8_000_000;
type SeasonReference = { full: string; compact: string; number: number };
export type PrimeCatalogPage = {
	anchor: string;
	locale: string;
	selected: SeasonReference;
	seasons: SeasonReference[];
	season: WatchCatalogSnapshotInput["seasons"][number];
	episodeFullIds: string[];
};
const fullId = (value: unknown): value is string =>
	typeof value === "string" && /^amzn1\.dv\.gti\.[a-z0-9-]{1,100}$/.test(value);

/** Only observed relative detail links, stripped of all query parameters. */
export function primeCatalogLink(
	value: unknown,
	origin: string,
): string | null {
	if (
		typeof value !== "string" ||
		value.length > 2048 ||
		!/^\/detail\/[A-Z0-9]+(?:\?[^#\\\s]*)?$/.test(value)
	)
		return null;
	try {
		const base = new URL(origin);
		if (
			base.protocol !== "https:" ||
			base.hostname !== "www.primevideo.com" ||
			base.port ||
			base.username ||
			base.password
		)
			return null;
		const url = new URL(value, base.origin);
		const compact = url.pathname.slice("/detail/".length);
		return PrimeVideoProviderIdSchema.safeParse(compact).success
			? `${base.origin}/detail/${compact}`
			: null;
	} catch {
		return null;
	}
}
export function primeCatalogLocale(value: unknown): string | null {
	if (typeof value !== "string" || !/^[a-z]{2,3}[-_][a-z]{2}$/i.test(value))
		return null;
	const [language, region] = value.replace("_", "-").split("-");
	return `${language!.toLowerCase()}-${region!.toUpperCase()}`;
}
export function primeSeasonMapping(page: PrimeCatalogPage): string {
	return JSON.stringify(page.seasons);
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
	const records = new Map<
		string,
		{
			full: string;
			compact: string;
			type: unknown;
			number: number | null;
			launched: boolean;
		}
	>();
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
			const item = object(value),
				link = primeCatalogLink(item.link, origin);
			if (
				!fullId(key) ||
				item.gti !== key ||
				!link ||
				link.split("/").at(-1) !== item.compactGTI
			)
				return null;
			const record = {
				full: key,
				compact: item.compactGTI as string,
				type: item.titleType,
				number: ordinal(item.sequenceNumber),
				launched: item.isLaunched === true,
			};
			const prior = records.get(key);
			if (prior && JSON.stringify(prior) !== JSON.stringify(record))
				return null;
			records.set(key, record);
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
					!fullId(row.seasonId) ||
					!link ||
					!number ||
					typeof row.isSelected !== "boolean"
				)
					return null;
				const reference = {
					full: row.seasonId,
					compact: link.split("/").at(-1)!,
					number,
				};
				const record = records.get(reference.full);
				if (
					record &&
					(record.compact !== reference.compact ||
						record.number !== number ||
						record.type !== "season")
				)
					return null;
				if (
					[...records.values()].some(
						(other) =>
							other.compact === reference.compact &&
							other.full !== reference.full,
					)
				)
					return null;
				mapping.push(reference);
				if (row.isSelected) {
					if (chosen) return null;
					chosen = reference;
				}
			}
			if (!chosen || chosen.full !== key || state.pageTitleId !== key)
				return null;
			if (
				new Set(mapping.map((row) => row.full)).size !== mapping.length ||
				new Set(mapping.map((row) => row.compact)).size !== mapping.length ||
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
	if (!seasons || !selected || seasons[0]?.number !== 1) return null;
	if (states.some((state) => state.pageTitleId !== selected!.full)) return null;
	const seasonRecord = records.get(selected.full),
		seasonDetail = details.get(selected.full);
	if (
		!seasonRecord?.launched ||
		seasonRecord.type !== "season" ||
		seasonRecord.compact !== selected.compact ||
		seasonRecord.number !== selected.number ||
		!seasonDetail?.title ||
		!seasonDetail.parent ||
		seasonDetail.type !== "season" ||
		seasonDetail.season !== selected.number
	)
		return null;
	let members: string[] | null = null;
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
			!Array.isArray(actions.pagination) ||
			actions.pagination.length !== 0 ||
			!Array.isArray(actions.episodePages) ||
			actions.episodePages.length > 1 ||
			actions.episodePages.some((page) => object(page).isSelected !== true)
		)
			return null;
		if (
			!Array.isArray(list.cardTitleIds) ||
			list.cardTitleIds.length < 1 ||
			list.cardTitleIds.length > WATCH_CATALOG_MAX_EPISODES ||
			!list.cardTitleIds.every(fullId) ||
			new Set(list.cardTitleIds).size !== list.cardTitleIds.length ||
			list.totalCardSize !== list.cardTitleIds.length ||
			actions.episodePages.length !== 1
		)
			return null;
		if (
			members &&
			JSON.stringify(members) !== JSON.stringify(list.cardTitleIds)
		)
			return null;
		members = list.cardTitleIds as string[];
	}
	if (!members) return null;
	const episodes: WatchCatalogSnapshotInput["seasons"][number]["episodes"] = [];
	const episodeNumbers = new Set<number>();
	for (const [order, full] of members.entries()) {
		const record = records.get(full),
			detail = details.get(full);
		if (
			!record?.launched ||
			record.type !== "episode" ||
			!detail?.title ||
			detail.type !== "episode" ||
			!detail.episode ||
			detail.episode !== record.number ||
			episodeNumbers.has(detail.episode)
		)
			return null;
		episodeNumbers.add(detail.episode);
		// Read only the observed, typed availability fields. Do not retain payloads,
		// correlation/session material, translated labels or playback envelopes.
		const action = object(object(object(states[1]!.action).btf)[full]);
		if (
			object(action.messages).entitlementType !== "Entitled" ||
			!Array.isArray(action.primaryActions) ||
			action.primaryActions.length > 32
		)
			return null;
		const plays = action.primaryActions
			.map(object)
			.filter((item) => item.actionType === "PLAY");
		if (plays.length !== 1) return null;
		const payload = object(plays[0]!.payload),
			playback = object(payload.playback);
		if (
			payload.payloadType !== "PLAYBACK" ||
			playback.playbackID !== full ||
			playback.isTrailer !== false ||
			playback.videoMaterialType !== "Feature" ||
			primeCatalogLink(playback.playbackURL, origin) !==
				`${origin}/detail/${record.compact}`
		)
			return null;
		const playbackUrl = new URL(playback.playbackURL as string, origin);
		if (
			playbackUrl.searchParams.getAll("autoplay").length !== 1 ||
			playbackUrl.searchParams.get("autoplay") !== "1"
		)
			return null;
		episodes.push({
			episodeKey: `primevideo:episode:${record.compact}`,
			providerEpisodeIdentifier: record.compact,
			title: detail.title,
			episodeNumber: detail.episode,
			order,
			releasedAt: null,
			available: true,
			watchVariants: [
				{
					providerContentId: record.compact,
					audioLocale: null,
					original: true,
					order: 0,
					sourceUrl: primeVideoSourceUrl(record.compact),
				},
			],
		});
	}
	// All observed episode self records must be accounted for by exact membership.
	if (
		[...records.values()].some(
			(record) => record.type === "episode" && !members.includes(record.full),
		)
	)
		return null;
	return {
		anchor: seasons[0]!.compact,
		locale: language,
		selected,
		seasons,
		episodeFullIds: members,
		season: {
			seasonKey: `primevideo:season:${selected.compact}`,
			providerSeasonIdentifier: selected.compact,
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
	const raw = documentValue.getElementById(
		"dv-web-page-hydration-data",
	)?.textContent;
	return raw
		? parsePage(raw, documentValue.documentElement.lang, origin)
		: null;
}
/** Extract inert JSON only: never build a fetched DOM that can load resources. */
export function readPrimeCatalogHtml(
	html: string,
	origin: string,
): PrimeCatalogPage | null {
	const locale = /<html\b[^>]*\blang\s*=\s*(["'])([^"']+)\1/i.exec(html)?.[2];
	const scripts = [
		...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
	].filter((match) =>
		/\bid\s*=\s*(["'])dv-web-page-hydration-data\1/i.test(match[1]!),
	);
	if (scripts.length !== 1) return null;
	return parsePage(scripts[0]![2]!, locale, origin);
}
