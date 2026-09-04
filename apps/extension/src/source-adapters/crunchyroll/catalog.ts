import {
	WATCH_CATALOG_MAX_BYTES,
	WATCH_CATALOG_MAX_EPISODES,
	WATCH_CATALOG_MAX_VARIANTS_PER_EPISODE,
	WATCH_CATALOG_MAX_VARIANTS_PER_TITLE,
	WATCH_HISTORY_SCHEMA_VERSION,
	type WatchCatalogSnapshotInput,
	WatchCatalogSnapshotInputSchema,
} from "@anidachi/protocol";

export type CrunchyrollCatalogPartialReason =
	| "ALIAS_CONFLICT"
	| "CONTEXT_CHANGED"
	| "COUNT_LIMIT"
	| "INVALID_IDENTITY"
	| "MALFORMED_RESPONSE"
	| "MISSING_REGION"
	| "RAW_COUNT_MISMATCH"
	| "TRAVERSAL_FAILED"
	| "UNKNOWN_AVAILABILITY"
	| "VARIANTS_NOT_CONSIDERED";

export type CrunchyrollCatalogInput = {
	seriesId: string;
	title: string;
	region: string | null;
	requestedLocale: string;
	audioLocale: string | null;
	subtitleLocales: string[];
	observedAt: string;
	contextUnchanged: boolean;
	seasonsResponse: unknown;
	episodeResponses: Record<string, unknown>;
};

export type CrunchyrollCatalogResult = {
	completeness: "complete" | "partial";
	reasons: CrunchyrollCatalogPartialReason[];
	snapshot: WatchCatalogSnapshotInput;
	hashInput: string;
};

type JsonRecord = Record<string, unknown>;
type Availability =
	| "available"
	| "known-unavailable"
	| "excluded-non-episode"
	| "unknown";

const STABLE_KEY_MAX = 220;
const SENTINEL_YEAR = 9998;

export function normalizeCrunchyrollCatalog(
	input: CrunchyrollCatalogInput,
): CrunchyrollCatalogResult {
	const reasons = new Set<CrunchyrollCatalogPartialReason>();
	if (!/^[A-Z]{2}$/.test(input.region ?? "")) reasons.add("MISSING_REGION");
	if (!input.contextUnchanged) reasons.add("CONTEXT_CHANGED");

	const seasonsEnvelope = envelope(input.seasonsResponse, reasons);
	const rawSeasons = seasonsEnvelope?.data ?? [];
	if (rawSeasons.length > 100) reasons.add("COUNT_LIMIT");
	const seasonsByIdentifier = new Map<
		string,
		{ row: JsonRecord; rawIds: Set<string> }
	>();

	for (const raw of rawSeasons) {
		const row = record(raw);
		const identifier = boundedString(row?.identifier);
		const id = boundedString(row?.id);
		if (
			!row ||
			!identifier ||
			!id ||
			!identifier.startsWith(`${input.seriesId}|`)
		) {
			reasons.add("INVALID_IDENTITY");
			continue;
		}
		const rawIds = new Set([
			id,
			...array(row.versions)
				.map((value) => boundedString(record(value)?.guid))
				.filter(isString),
		]);
		const existing = seasonsByIdentifier.get(identifier);
		if (existing) {
			if (!compatibleSeason(existing.row, row)) reasons.add("ALIAS_CONFLICT");
			for (const rawId of rawIds) existing.rawIds.add(rawId);
		} else {
			seasonsByIdentifier.set(identifier, { row, rawIds });
		}
	}

	const normalizedSeasons = [...seasonsByIdentifier.entries()]
		.sort((a, b) =>
			compareOrder(a[1].row, b[1].row, a[0], b[0], "season_number"),
		)
		.map(([identifier, seasonEntry], seasonOrder) => {
			const responseEntries = [...seasonEntry.rawIds]
				.map((rawId) => ({ rawId, value: input.episodeResponses[rawId] }))
				.filter((entry) => entry.value !== undefined);
			if (responseEntries.length === 0) reasons.add("TRAVERSAL_FAILED");
			const episodeRows = responseEntries
				.sort((a, b) => a.rawId.localeCompare(b.rawId))
				.flatMap((entry) => envelope(entry.value, reasons)?.data ?? []);
			const episodes = normalizeEpisodes(
				episodeRows,
				identifier,
				seasonEntry.rawIds,
				input.observedAt,
				reasons,
			);
			return {
				seasonKey: `crunchyroll:season:${identifier}`,
				providerSeasonIdentifier: identifier,
				title: boundedString(seasonEntry.row.title) ?? identifier,
				seasonNumber: finiteNonnegative(seasonEntry.row.season_number),
				order: seasonOrder,
				episodes,
			};
		})
		.filter((season) => season.episodes.length > 0);

	const episodeCount = normalizedSeasons.reduce(
		(sum, season) => sum + season.episodes.length,
		0,
	);
	const variantCount = normalizedSeasons.reduce(
		(sum, season) =>
			sum +
			season.episodes.reduce(
				(count, episode) => count + episode.watchVariants.length,
				0,
			),
		0,
	);
	if (
		episodeCount > WATCH_CATALOG_MAX_EPISODES ||
		variantCount > WATCH_CATALOG_MAX_VARIANTS_PER_TITLE
	)
		reasons.add("COUNT_LIMIT");
	if (normalizedSeasons.length === 0) reasons.add("TRAVERSAL_FAILED");

	const base = {
		schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
		provider: "crunchyroll" as const,
		titleKey: `crunchyroll:series:${input.seriesId}`,
		providerSeriesId: input.seriesId,
		title: input.title,
		context: {
			region: input.region,
			requestedLocale: input.requestedLocale,
			audioLocale: input.audioLocale,
			subtitleLocales: input.subtitleLocales,
			observedAt: input.observedAt,
		},
		seasons: normalizedSeasons,
	};
	let completeness: "complete" | "partial" =
		reasons.size === 0 ? "complete" : "partial";
	let candidate = { ...base, completeness };
	const parsed = WatchCatalogSnapshotInputSchema.safeParse(candidate);
	if (!parsed.success) {
		reasons.add(
			serializedBytes(candidate) > WATCH_CATALOG_MAX_BYTES
				? "COUNT_LIMIT"
				: "MALFORMED_RESPONSE",
		);
		completeness = "partial";
		candidate = { ...base, completeness };
	}
	const snapshot = WatchCatalogSnapshotInputSchema.parse(candidate);
	return {
		completeness,
		reasons: [...reasons].sort(),
		snapshot,
		hashInput: JSON.stringify(snapshot),
	};
}

function normalizeEpisodes(
	rows: unknown[],
	seasonIdentifier: string,
	seasonRawIds: Set<string>,
	observedAt: string,
	reasons: Set<CrunchyrollCatalogPartialReason>,
) {
	const byIdentifier = new Map<string, ReturnType<typeof normalizedEpisode>>();
	const aliasOwners = new Map<string, string>();
	const sortedRows = [...rows].sort((left, right) => {
		const a = record(left) ?? {};
		const b = record(right) ?? {};
		return compareOrder(
			a,
			b,
			boundedString(a.identifier) ?? "",
			boundedString(b.identifier) ?? "",
			"sequence_number",
		);
	});
	for (const raw of sortedRows) {
		const row = record(raw);
		const identifier = boundedString(row?.identifier);
		if (!row || !identifier || !identifier.startsWith(`${seasonIdentifier}|`)) {
			reasons.add("INVALID_IDENTITY");
			continue;
		}
		const availability = classifyAvailability(row, observedAt);
		if (availability === "excluded-non-episode") continue;
		if (availability === "unknown") reasons.add("UNKNOWN_AVAILABILITY");
		const episode = normalizedEpisode(
			row,
			identifier,
			seasonRawIds,
			availability,
			reasons,
		);
		if (!episode) continue;
		let aliasConflict = false;
		for (const variant of episode.watchVariants) {
			const owner = aliasOwners.get(variant.providerContentId);
			if (owner && owner !== identifier) aliasConflict = true;
		}
		if (aliasConflict) {
			reasons.add("ALIAS_CONFLICT");
			continue;
		}
		for (const variant of episode.watchVariants)
			aliasOwners.set(variant.providerContentId, identifier);
		const existing = byIdentifier.get(identifier);
		if (existing && JSON.stringify(existing) !== JSON.stringify(episode))
			reasons.add("ALIAS_CONFLICT");
		else byIdentifier.set(identifier, episode);
	}
	return [...byIdentifier.values()]
		.filter(
			(episode): episode is NonNullable<typeof episode> => episode !== null,
		)
		.sort(
			(a, b) =>
				a.order - b.order ||
				a.providerEpisodeIdentifier.localeCompare(b.providerEpisodeIdentifier),
		)
		.map((episode, order) => ({ ...episode, order }));
}

function normalizedEpisode(
	row: JsonRecord,
	identifier: string,
	seasonRawIds: Set<string>,
	availability: Availability,
	reasons: Set<CrunchyrollCatalogPartialReason>,
) {
	const variants = array(row.versions)
		.map(record)
		.filter((value): value is JsonRecord => value !== null)
		.map((variant) => ({
			providerContentId: boundedString(variant.guid),
			audioLocale: locale(variant.audio_locale),
			original: variant.original === true,
			seasonGuid: boundedString(variant.season_guid),
		}))
		.filter(
			(
				variant,
			): variant is typeof variant & {
				providerContentId: string;
				seasonGuid: string;
			} => {
				const valid =
					variant.providerContentId &&
					variant.seasonGuid &&
					seasonRawIds.has(variant.seasonGuid);
				if (!valid) reasons.add("INVALID_IDENTITY");
				return Boolean(valid);
			},
		)
		.sort(
			(a, b) =>
				Number(b.original) - Number(a.original) ||
				(a.audioLocale ?? "").localeCompare(b.audioLocale ?? "") ||
				a.providerContentId.localeCompare(b.providerContentId),
		);
	const ids = new Set<string>();
	const deduped = variants.filter((variant) => {
		if (ids.has(variant.providerContentId)) {
			reasons.add("ALIAS_CONFLICT");
			return false;
		}
		ids.add(variant.providerContentId);
		return true;
	});
	if (
		deduped.length === 0 ||
		deduped.length > WATCH_CATALOG_MAX_VARIANTS_PER_EPISODE ||
		deduped.filter((variant) => variant.original).length > 1
	) {
		reasons.add(
			deduped.length > WATCH_CATALOG_MAX_VARIANTS_PER_EPISODE
				? "COUNT_LIMIT"
				: "ALIAS_CONFLICT",
		);
		return null;
	}
	return {
		episodeKey: `crunchyroll:episode:${identifier}`,
		providerEpisodeIdentifier: identifier,
		title:
			boundedString(row.title) ??
			`Episode ${boundedString(row.episode) ?? ""}`.trim(),
		episodeNumber: finiteNonnegative(row.episode_number),
		order: finiteNonnegative(row.sequence_number) ?? Number.MAX_SAFE_INTEGER,
		releasedAt: normalDate(row.episode_air_date),
		available: availability === "available",
		watchVariants: deduped.map((variant, order) => ({
			providerContentId: variant.providerContentId,
			audioLocale: variant.audioLocale,
			original: variant.original,
			order,
			sourceUrl: `https://www.crunchyroll.com/watch/${variant.providerContentId}`,
		})),
	};
}

function envelope(
	value: unknown,
	reasons: Set<CrunchyrollCatalogPartialReason>,
): { data: unknown[] } | null {
	const row = record(value);
	if (!row || !Array.isArray(row.data)) {
		reasons.add("TRAVERSAL_FAILED");
		return null;
	}
	if (
		typeof row.total === "number" &&
		(row.total < 0 ||
			!Number.isInteger(row.total) ||
			row.total !== row.data.length)
	)
		reasons.add("RAW_COUNT_MISMATCH");
	const meta = record(row.meta);
	if (
		meta &&
		"versions_considered" in meta &&
		meta.versions_considered !== true
	)
		reasons.add("VARIANTS_NOT_CONSIDERED");
	return { data: row.data };
}

function classifyAvailability(
	row: JsonRecord,
	observedAt: string,
): Availability {
	if (row.type === "clip" || row.type === "trailer" || row.type === "preview")
		return "excluded-non-episode";
	if (row.type !== undefined && row.type !== "episode") return "unknown";
	const now = Date.parse(observedAt);
	if (!Number.isFinite(now)) return "unknown";
	const end = providerDate(row.availability_ends);
	if (end.kind === "invalid") return "unknown";
	if (end.kind === "date" && end.time <= now) return "known-unavailable";
	const start = providerDate(row.availability_starts);
	if (start.kind === "invalid") return "unknown";
	if (start.kind === "date" && start.time > now) return "known-unavailable";
	const air = providerDate(row.episode_air_date);
	if (air.kind === "invalid") return "unknown";
	if (air.kind === "date" && air.time > now) return "known-unavailable";
	const premium = providerDate(row.premium_available_date);
	if (premium.kind === "invalid") return "unknown";
	if (premium.kind === "date")
		return premium.time <= now ? "available" : "known-unavailable";
	if (air.kind === "date" || row.type === "episode") return "available";
	return "unknown";
}

function providerDate(
	value: unknown,
):
	| { kind: "absent" | "sentinel" }
	| { kind: "date"; time: number }
	| { kind: "invalid" } {
	if (value === undefined || value === null) return { kind: "absent" };
	if (typeof value !== "string") return { kind: "invalid" };
	const time = Date.parse(value);
	if (!Number.isFinite(time)) return { kind: "invalid" };
	if (new Date(time).getUTCFullYear() === SENTINEL_YEAR)
		return { kind: "sentinel" };
	return { kind: "date", time };
}

function normalDate(value: unknown): string | null {
	const parsed = providerDate(value);
	return parsed.kind === "date" ? new Date(parsed.time).toISOString() : null;
}
function compatibleSeason(a: JsonRecord, b: JsonRecord): boolean {
	return (
		boundedString(a.title) === boundedString(b.title) &&
		finiteNonnegative(a.season_number) === finiteNonnegative(b.season_number)
	);
}
function compareOrder(
	a: JsonRecord,
	b: JsonRecord,
	aId: string,
	bId: string,
	field: string,
): number {
	return (
		(finiteNonnegative(a[field]) ?? Number.MAX_SAFE_INTEGER) -
			(finiteNonnegative(b[field]) ?? Number.MAX_SAFE_INTEGER) ||
		aId.localeCompare(bId)
	);
}
function serializedBytes(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function record(value: unknown): JsonRecord | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}
function array(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}
function boundedString(value: unknown): string | null {
	return typeof value === "string" &&
		value.trim() === value &&
		value.length > 0 &&
		value.length <= STABLE_KEY_MAX &&
		!/[\0-\x1f\x7f]/.test(value)
		? value
		: null;
}
function finiteNonnegative(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}
function locale(value: unknown): string | null {
	return typeof value === "string" && value.length >= 2 && value.length <= 35
		? value
		: null;
}
function isString(value: string | null): value is string {
	return value !== null;
}
