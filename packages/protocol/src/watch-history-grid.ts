import { z } from "zod";
import {
	WatchCatalogStateSchema,
	WatchHistoryAggregateSchema,
	WatchHistoryCatalogSeasonProjectionSchema,
	WatchHistoryEpisodeSchema,
	WatchHistoryResponseMetaSchema,
} from "./watch-history";

const Key = z.string().trim().min(1).max(220);
export const WATCH_HISTORY_GRID_PAGE_SIZE = 50;

export const WatchHistoryGridQuerySchema = z.strictObject({
	provider: z.literal("crunchyroll"),
	titleKey: Key,
	seasonKey: Key.optional(),
	limit: z
		.number()
		.int()
		.min(1)
		.max(WATCH_HISTORY_GRID_PAGE_SIZE)
		.default(WATCH_HISTORY_GRID_PAGE_SIZE),
	cursor: z.string().min(1).max(2048).optional(),
});

// Classification requires an explicit provider group label. In particular,
// episode 0, fractional episode numbers, and season 0 do not imply a special.
export function isWatchSpecialSeasonLabel(label: string): boolean {
	return /^(specials?|special episodes?|ovas?|oads?|спецвыпуски|специальные выпуски)$/iu.test(
		label.trim(),
	);
}

export const WatchHistoryGridSeasonSchema =
	WatchHistoryCatalogSeasonProjectionSchema.extend({
		kind: z.enum(["season", "specials"]),
	});

export const WatchHistoryGridEpisodeSchema = z.strictObject({
	episodeKey: Key,
	episodeTitle: z.string().min(1).max(300),
	episodeNumber: z.number().finite().nonnegative().nullable(),
	seasonKey: Key,
	order: z.number().int().nonnegative(),
	releasedAt: z.iso.datetime({ offset: true }).nullable(),
	available: z.boolean(),
	sourceUrl: z
		.string()
		.max(2048)
		.regex(/^https:\/\/www\.crunchyroll\.com\/watch\/[A-Za-z0-9_-]+$/),
	history: WatchHistoryEpisodeSchema.extend({
		sessions: WatchHistoryEpisodeSchema.shape.sessions.max(0),
	}).nullable(),
});

export const WatchHistoryGridResponseSchema = z
	.strictObject({
		meta: WatchHistoryResponseMetaSchema,
		provider: z.literal("crunchyroll"),
		titleKey: Key,
		state: WatchCatalogStateSchema,
		revision: z.string().min(1).max(64).nullable(),
		seasonKey: Key.nullable(),
		seasons: z.array(WatchHistoryGridSeasonSchema).max(100),
		mainAggregate: WatchHistoryAggregateSchema.nullable(),
		specialsAggregate: WatchHistoryAggregateSchema.nullable(),
		episodes: z
			.array(WatchHistoryGridEpisodeSchema)
			.max(WATCH_HISTORY_GRID_PAGE_SIZE),
		nextCursor: z.string().min(1).max(2048).nullable(),
	})
	.superRefine((value, context) => {
		if (
			value.state !== "complete" &&
			(value.revision ||
				value.seasons.length ||
				value.episodes.length ||
				value.nextCursor ||
				value.mainAggregate ||
				value.specialsAggregate)
		) {
			context.addIssue({
				code: "custom",
				message: "Incomplete catalogs cannot expose exact grid data",
			});
		}
		if (
			value.state === "complete" &&
			(!value.revision || !value.mainAggregate || !value.seasons.length)
		) {
			context.addIssue({
				code: "custom",
				message: "Complete grids require a revision and overall aggregate",
			});
		}
		const seasonKeys = new Set<string>();
		for (const season of value.seasons) {
			if (seasonKeys.has(season.seasonKey))
				context.addIssue({ code: "custom", message: "Duplicate grid season" });
			seasonKeys.add(season.seasonKey);
		}
		for (const aggregate of [value.mainAggregate, value.specialsAggregate]) {
			if (
				aggregate &&
				(aggregate.availableEpisodes === null ||
					aggregate.availableEpisodes > 2000 ||
					aggregate.progress === null ||
					aggregate.completedEpisodes > aggregate.availableEpisodes ||
					Math.abs(
						aggregate.progress -
							(aggregate.availableEpisodes
								? aggregate.completedEpisodes / aggregate.availableEpisodes
								: 0),
					) > 1e-9)
			) {
				context.addIssue({
					code: "custom",
					message: "Grid aggregates must be exact",
				});
			}
		}
		if (value.episodes.length && !seasonKeys.has(value.seasonKey!))
			context.addIssue({ code: "custom", message: "Grid season is missing" });
		const keys = new Set<string>();
		for (const episode of value.episodes) {
			if (
				episode.seasonKey !== value.seasonKey ||
				keys.has(episode.episodeKey) ||
				(episode.history &&
					(episode.history.episodeKey !== episode.episodeKey ||
						episode.history.seasonKey !== episode.seasonKey))
			) {
				context.addIssue({
					code: "custom",
					message: "Grid episode identity mismatch",
				});
			}
			keys.add(episode.episodeKey);
		}
	});

export type WatchHistoryGridQuery = z.infer<typeof WatchHistoryGridQuerySchema>;
export type WatchHistoryGridResponse = z.infer<
	typeof WatchHistoryGridResponseSchema
>;
export type WatchHistoryGridEpisode = z.infer<
	typeof WatchHistoryGridEpisodeSchema
>;
export type WatchHistoryGridSeason = z.infer<
	typeof WatchHistoryGridSeasonSchema
>;
