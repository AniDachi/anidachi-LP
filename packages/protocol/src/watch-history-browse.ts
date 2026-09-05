import { z } from "zod";
import {
	WatchHistoryOpaqueCursorSchema,
	WatchHistoryResponseMetaSchema,
	WatchHistoryResponseSchema,
	WatchHistorySessionSchema,
	WatchHistoryTitleEpisodesResponseSchema,
	WatchHistoryCatalogProjectionSchema,
} from "./watch-history";

const Timestamp = z.iso.datetime({ offset: true });
const Provider = z.enum(["crunchyroll", "youtube"]);
const Key = z.string().trim().min(1).max(220);
const filters = {
	mode: z.enum(["solo", "shared"]),
	search: z.string().trim().min(1).max(200).optional(),
	groupId: z.uuid().optional(),
	participantUserId: z.uuid().optional(),
	from: Timestamp.optional(),
	until: Timestamp.optional(),
	limit: z.number().int().min(1).max(50).default(20),
	cursor: WatchHistoryOpaqueCursorSchema.optional(),
};
function validateFilters(
	value: {
		mode: string;
		groupId?: string | undefined;
		participantUserId?: string | undefined;
		from?: string | undefined;
		until?: string | undefined;
	},
	ctx: z.RefinementCtx,
) {
	if (value.mode === "solo" && (value.groupId || value.participantUserId))
		ctx.addIssue({
			code: "custom",
			message: "Solo history cannot have social filters",
			path: ["mode"],
		});
	if (
		value.from &&
		value.until &&
		Date.parse(value.from) >= Date.parse(value.until)
	)
		ctx.addIssue({
			code: "custom",
			message: "Period end must follow its start",
			path: ["until"],
		});
}
export const WatchHistoryBrowseQuerySchema = z
	.strictObject(filters)
	.superRefine(validateFilters);
export const WatchHistoryBrowseTitleEpisodesQuerySchema = z
	.strictObject({ ...filters, provider: Provider, titleKey: Key })
	.superRefine(validateFilters);
export const WatchHistoryBrowseSessionsQuerySchema = z
	.strictObject({
		...filters,
		provider: Provider,
		titleKey: Key,
		episodeKey: Key,
	})
	.superRefine(validateFilters);
export const WatchHistoryBrowseOptionsQuerySchema = z.strictObject({
	mode: z.literal("shared"),
	limit: filters.limit,
	cursor: filters.cursor,
});

export const WatchHistoryBrowseGroupSchema = z.strictObject({
	id: z.uuid(),
	name: z.string().min(1).max(100),
});
const GroupContext = z.strictObject({
	sessionId: z.uuid(),
	groups: z.array(WatchHistoryBrowseGroupSchema).max(100),
});
export const WatchHistoryBrowseResponseSchema = z.strictObject({
	history: WatchHistoryResponseSchema,
	matches: z
		.array(
			z.strictObject({
				provider: Provider,
				titleKey: Key,
				lastWatchedAt: Timestamp,
				matchingEpisodeCount: z.number().int().nonnegative(),
				matchingSessionCount: z.number().int().nonnegative(),
			}),
		)
		.max(50),
});
export const WatchHistoryBrowseTitleEpisodesResponseSchema = z.strictObject({
	detail: WatchHistoryTitleEpisodesResponseSchema,
	matches: z
		.array(
			z.strictObject({
				episodeKey: Key,
				lastWatchedAt: Timestamp,
				matchingSessionCount: z.number().int().nonnegative(),
				sessionsComplete: z.boolean(),
			}),
		)
		.max(50),
	groups: z.array(GroupContext).max(1000),
});
export const WatchHistoryBrowseSessionsResponseSchema = z.strictObject({
	meta: WatchHistoryResponseMetaSchema,
	sessions: z.array(WatchHistorySessionSchema).max(50),
	groups: z.array(GroupContext).max(50),
	totalSessionCount: z.number().int().nonnegative(),
	nextCursor: WatchHistoryOpaqueCursorSchema.nullable(),
});
export const WatchHistoryBrowseOptionsResponseSchema = z.strictObject({
	meta: WatchHistoryResponseMetaSchema,
	options: z
		.array(
			z.strictObject({
				kind: z.enum(["group", "participant"]),
				id: z.uuid(),
				label: z.string().min(1).max(300),
			}),
		)
		.max(50),
	nextCursor: WatchHistoryOpaqueCursorSchema.nullable(),
});

// Server database boundary, exported so the web plane uses the same validator
// without introducing another Zod dependency. These are never client inputs.
export const WatchHistoryBrowseDatabasePageSchema = z.strictObject({
	accountGeneration: z.number().int().positive(),
	totalTitleCount: z.number().int().nonnegative(),
	totalSessionCount: z.number().int().nonnegative(),
	hasMore: z.boolean(),
	nextCursor: WatchHistoryOpaqueCursorSchema.nullable(),
	matches: z.array(z.unknown()).max(50),
	progressRows: z.array(z.unknown()).max(400),
	sessionIds: z.array(z.uuid()).max(1000),
	sessionTimes: z
		.array(z.strictObject({ sessionId: z.uuid(), lastWatchedAt: Timestamp }))
		.max(1000),
	sessions: z
		.array(
			z.strictObject({
				session: WatchHistorySessionSchema,
				provider: Provider,
				titleKey: Key,
				episodeKey: Key,
			}),
		)
		.max(1000),
	groups: z.array(z.unknown()).max(1000),
	titleSummaries: z.array(z.unknown()).max(50),
	catalog: WatchHistoryCatalogProjectionSchema.nullable(),
	observedEpisodeCount: z.number().int().nonnegative(),
	completedEpisodeCount: z.number().int().nonnegative(),
});
export const WatchHistoryBrowseDatabaseOptionsSchema = z.strictObject({
	accountGeneration: z.number().int().positive(),
	options: WatchHistoryBrowseOptionsResponseSchema.shape.options,
	nextCursor: WatchHistoryOpaqueCursorSchema.nullable(),
});

export type WatchHistoryBrowseQuery = z.infer<
	typeof WatchHistoryBrowseQuerySchema
>;
export type WatchHistoryBrowseTitleEpisodesQuery = z.infer<
	typeof WatchHistoryBrowseTitleEpisodesQuerySchema
>;
export type WatchHistoryBrowseSessionsQuery = z.infer<
	typeof WatchHistoryBrowseSessionsQuerySchema
>;
export type WatchHistoryBrowseOptionsQuery = z.infer<
	typeof WatchHistoryBrowseOptionsQuerySchema
>;
export type WatchHistoryBrowseResponse = z.infer<
	typeof WatchHistoryBrowseResponseSchema
>;
export type WatchHistoryBrowseTitleEpisodesResponse = z.infer<
	typeof WatchHistoryBrowseTitleEpisodesResponseSchema
>;
export type WatchHistoryBrowseSessionsResponse = z.infer<
	typeof WatchHistoryBrowseSessionsResponseSchema
>;
export type WatchHistoryBrowseOptionsResponse = z.infer<
	typeof WatchHistoryBrowseOptionsResponseSchema
>;
