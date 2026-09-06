import { createHash } from "node:crypto";
import {
	WatchCatalogSnapshotInputSchema,
	WatchHistoryEpisodeSchema,
	WatchHistoryGridQuerySchema,
	WatchHistoryGridResponseSchema,
	WatchHistoryCatalogSeasonProjectionSchema,
	isWatchSpecialSeasonLabel,
	type WatchHistoryGridQuery,
	type WatchHistoryGridResponse,
	type WatchHistoryGridSeason,
} from "@anidachi/protocol";
import { db } from "./db";
import { WatchHistoryV3ApiError } from "./watch-history-v3";

type RecordValue = Record<string, unknown>;
export type WatchHistoryGridStore = {
	settings(owner: string): Promise<RecordValue | null>;
	catalog(
		owner: string,
		generation: number,
		title: string,
		snapshot: boolean,
	): Promise<RecordValue | null>;
	progress(
		owner: string,
		generation: number,
		title: string,
		episodes: string[],
	): Promise<RecordValue[]>;
};
const fail = (code = "INVALID_RESPONSE", status = 502) =>
	new WatchHistoryV3ApiError(
		status,
		code,
		"Could not read the episode catalog",
	);
const metadataColumns =
	"user_id,history_generation,title_key,revision,accepted_revision,accepted_hash,context,accepted_context,projection,preferred_audio_locale";

export const supabaseWatchHistoryGridStore: WatchHistoryGridStore = {
	async settings(owner) {
		const result = await db()
			.from("user_watch_settings")
			.select("history_generation,write_schema_version")
			.eq("user_id", owner)
			.maybeSingle();
		if (result.error) throw result.error;
		return result.data as RecordValue | null;
	},
	async catalog(owner, generation, title, snapshot) {
		const result = await db()
			.from("watch_catalog_snapshots")
			.select(`${metadataColumns}${snapshot ? ",snapshot" : ""}`)
			.eq("user_id", owner)
			.eq("history_generation", generation)
			.eq("provider", "crunchyroll")
			.eq("title_key", title)
			.maybeSingle();
		if (result.error) throw result.error;
		return result.data as unknown as RecordValue | null;
	},
	async progress(owner, generation, title, episodes) {
		if (!episodes.length) return [];
		const result = await db()
			.from("watch_episode_progress")
			.select(
				"user_id,history_generation,provider,title_key,episode_key,episode_title,season_key,season_title,season_number,episode_number,source_url,current_time_seconds,duration,progress,completed_at,observed_at",
			)
			.eq("user_id", owner)
			.eq("history_generation", generation)
			.eq("provider", "crunchyroll")
			.eq("title_key", title)
			.in("episode_key", episodes)
			.limit(50);
		if (result.error) throw result.error;
		return result.data ?? [];
	},
};

function fingerprint(row: RecordValue | null): string | null {
	return (
		row &&
		createHash("sha256")
			.update(
				JSON.stringify([
					row.revision,
					row.accepted_revision,
					row.accepted_hash,
					row.context,
					row.accepted_context,
					row.projection,
					row.preferred_audio_locale,
				]),
			)
			.digest("hex")
	);
}
function progressFingerprint(rows: RecordValue[]): string {
	return createHash("sha256")
		.update(
			JSON.stringify(
				rows
					.toSorted((a, b) =>
						String(a.episode_key).localeCompare(String(b.episode_key)),
					)
					.map((row) =>
						Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
					),
			),
		)
		.digest("hex");
}
function aggregate(seasons: WatchHistoryGridSeason[]) {
	const completedEpisodes = seasons.reduce(
		(sum, s) => sum + s.aggregate.completedEpisodes,
		0,
	);
	const availableEpisodes = seasons.reduce(
		(sum, s) => sum + s.aggregate.availableEpisodes,
		0,
	);
	return {
		completedEpisodes,
		availableEpisodes,
		progress: availableEpisodes ? completedEpisodes / availableEpisodes : 0,
	};
}

// Snapshot reads are bounded by the existing 1 MiB / 2,000 episode contract.
// Only one selected season page and at most 50 personal progress rows leave the server.
export async function readWatchHistoryGrid(params: {
	userId: string;
	input: unknown;
	store?: WatchHistoryGridStore;
	now?: Date;
}): Promise<WatchHistoryGridResponse> {
	const parsed = WatchHistoryGridQuerySchema.safeParse(params.input);
	if (!parsed.success) throw fail("INVALID_REQUEST", 400);
	const query: WatchHistoryGridQuery = parsed.data;
	const store = params.store ?? supabaseWatchHistoryGridStore;
	const settings = await store.settings(params.userId);
	if (settings?.write_schema_version !== 3) throw fail("UPGRADE_REQUIRED", 426);
	const generation = settings.history_generation;
	if (
		typeof generation !== "number" ||
		!Number.isSafeInteger(generation) ||
		generation < 1
	)
		throw fail();
	const row = await store.catalog(
		params.userId,
		generation,
		query.titleKey,
		true,
	);
	if (
		row &&
		(row.user_id !== params.userId ||
			row.history_generation !== generation ||
			row.title_key !== query.titleKey)
	)
		throw fail();
	const revision = fingerprint(row);
	let progressRead: { keys: string[]; fingerprint: string } | undefined;
	const now = params.now ?? new Date();
	const result: WatchHistoryGridResponse = {
		meta: {
			schemaVersion: 3,
			ownerUserId: params.userId,
			accountGeneration: generation,
			serverTime: now.toISOString(),
		},
		provider: "crunchyroll",
		titleKey: query.titleKey,
		state: row ? "partial" : "unavailable",
		revision: null,
		seasonKey: query.seasonKey ?? null,
		seasons: [],
		mainAggregate: null,
		specialsAggregate: null,
		episodes: [],
		nextCursor: null,
	};
	const context = row?.context as RecordValue | null;
	const accepted = row?.accepted_context as RecordValue | null;
	if (
		row?.projection &&
		accepted &&
		typeof accepted.region === "string" &&
		context?.region === accepted.region
	) {
		const snapshot = WatchCatalogSnapshotInputSchema.safeParse(row.snapshot);
		const projection = row.projection as RecordValue;
		if (
			!snapshot.success ||
			snapshot.data.titleKey !== query.titleKey ||
			snapshot.data.completeness !== "complete" ||
			!Array.isArray(projection.seasons)
		)
			throw fail();
		const seasons = projection.seasons
			.map((value) => {
				const season = WatchHistoryCatalogSeasonProjectionSchema.parse(value);
				return {
					...season,
					kind: isWatchSpecialSeasonLabel(season.seasonTitle)
						? ("specials" as const)
						: ("season" as const),
				};
			})
			.sort(
				(a, b) => a.order - b.order || a.seasonKey.localeCompare(b.seasonKey),
			);
		if (
			seasons.length !== snapshot.data.seasons.length ||
			seasons.some(
				(season) =>
					!snapshot.data.seasons.some(
						(entry) =>
							entry.seasonKey === season.seasonKey &&
							entry.title === season.seasonTitle &&
							entry.order === season.order &&
							entry.seasonNumber === season.seasonNumber,
					),
			)
		)
			throw fail();
		const seasonKey = query.seasonKey ?? seasons[0]?.seasonKey ?? null;
		const entries = (
			snapshot.data.seasons.find((s) => s.seasonKey === seasonKey)?.episodes ??
			[]
		).toSorted(
			(a, b) => a.order - b.order || a.episodeKey.localeCompare(b.episodeKey),
		);
		let offset = 0;
		const binding = [
			params.userId,
			generation,
			query.titleKey,
			seasonKey,
			revision,
		];
		if (query.cursor) {
			let decoded: unknown;
			try {
				decoded = JSON.parse(
					Buffer.from(query.cursor, "base64url").toString("utf8"),
				);
			} catch {
				throw fail("INVALID_CURSOR", 400);
			}
			if (
				!Array.isArray(decoded) ||
				decoded.length !== 6 ||
				!binding.every((v, i) => v === decoded[i]) ||
				!Number.isInteger(decoded[5]) ||
				decoded[5] < 0 ||
				decoded[5] >= entries.length
			)
				throw fail("INVALID_CURSOR", 409);
			offset = decoded[5];
		}
		const slice = entries.slice(offset, offset + query.limit);
		const keys = slice.map((e) => e.episodeKey);
		const rows = await store.progress(
			params.userId,
			generation,
			query.titleKey,
			keys,
		);
		if (rows.length > keys.length) throw fail();
		progressRead = { keys, fingerprint: progressFingerprint(rows) };
		const personal = new Map<
			string,
			ReturnType<typeof WatchHistoryEpisodeSchema.parse>
		>();
		for (const progress of rows) {
			if (
				progress.user_id !== params.userId ||
				progress.history_generation !== generation ||
				progress.provider !== "crunchyroll" ||
				progress.title_key !== query.titleKey ||
				typeof progress.episode_key !== "string" ||
				!keys.includes(progress.episode_key) ||
				personal.has(progress.episode_key)
			)
				throw fail();
			personal.set(
				progress.episode_key,
				WatchHistoryEpisodeSchema.parse({
					episodeKey: progress.episode_key,
					episodeTitle: progress.episode_title,
					seasonKey: progress.season_key,
					seasonTitle: progress.season_title,
					seasonNumber: progress.season_number,
					episodeNumber: progress.episode_number,
					sourceUrl: progress.source_url,
					currentTime: progress.current_time_seconds,
					duration: progress.duration,
					progress: progress.progress,
					completedAt: progress.completed_at,
					lastWatchedAt: progress.observed_at,
					sessions: [],
				}),
			);
		}
		result.state = "complete";
		result.revision = revision;
		result.seasonKey = seasonKey;
		result.seasons = seasons;
		result.mainAggregate = aggregate(
			seasons.filter((s) => s.kind === "season"),
		);
		const specialSeasons = seasons.filter((s) => s.kind === "specials");
		result.specialsAggregate = specialSeasons.length
			? aggregate(specialSeasons)
			: null;
		result.episodes = slice.map((episode) => {
			const observed = personal.get(episode.episodeKey);
			const season = seasons.find((value) => value.seasonKey === seasonKey)!;
			const history = observed
				? {
						...observed,
						episodeTitle: episode.title,
						episodeNumber: episode.episodeNumber,
						seasonKey: season.seasonKey,
						seasonTitle: season.seasonTitle,
						seasonNumber: season.seasonNumber,
					}
				: null;
			const variants = episode.watchVariants.toSorted(
				(a, b) =>
					a.order - b.order ||
					a.providerContentId.localeCompare(b.providerContentId),
			);
			const variant =
				variants.find((v) => v.sourceUrl === history?.sourceUrl) ??
				variants.find((v) => v.audioLocale === row.preferred_audio_locale) ??
				variants.find((v) => v.original) ??
				variants[0]!;
			return {
				episodeKey: episode.episodeKey,
				episodeTitle: episode.title,
				episodeNumber: episode.episodeNumber,
				seasonKey: seasonKey!,
				order: episode.order,
				releasedAt: episode.releasedAt,
				available:
					episode.available &&
					(!episode.releasedAt ||
						Date.parse(episode.releasedAt) <= now.getTime()),
				sourceUrl: variant.sourceUrl,
				history: history ? { ...history, sourceUrl: variant.sourceUrl } : null,
			};
		});
		result.nextCursor =
			offset + slice.length < entries.length
				? Buffer.from(
						JSON.stringify([...binding, offset + slice.length]),
					).toString("base64url")
				: null;
	}
	const [latestSettings, latestCatalog, latestProgress] = await Promise.all([
		store.settings(params.userId),
		store.catalog(params.userId, generation, query.titleKey, false),
		progressRead
			? store.progress(
					params.userId,
					generation,
					query.titleKey,
					progressRead.keys,
				)
			: null,
	]);
	if (
		latestSettings?.history_generation !== generation ||
		latestSettings.write_schema_version !== 3
	)
		throw fail("GENERATION_MISMATCH", 409);
	if (
		latestCatalog &&
		(latestCatalog.user_id !== params.userId ||
			latestCatalog.history_generation !== generation ||
			latestCatalog.title_key !== query.titleKey)
	)
		throw fail();
	if (fingerprint(latestCatalog) !== revision)
		throw fail("CATALOG_CHANGED", 409);
	// Deleting an unfinished episode need not change any catalog aggregate.
	// Fence the bounded personal page too, so that read cannot resurrect it.
	if (
		progressRead &&
		latestProgress &&
		progressFingerprint(latestProgress) !== progressRead.fingerprint
	)
		throw fail("HISTORY_CHANGED", 409);
	return WatchHistoryGridResponseSchema.parse(result);
}
