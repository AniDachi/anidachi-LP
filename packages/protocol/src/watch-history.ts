import { z } from "zod";
import {
  AccountOwnedResponseMetaSchema,
  PublicProfileSchema,
  WatchItemKindSchema,
  WatchProviderSchema,
} from "./account";
import { RoomHistoryAuthoritySchema } from "./types";

export const WATCH_HISTORY_SCHEMA_VERSION = 2 as const;
export const WATCH_CATALOG_MAX_BYTES = 512 * 1_024;

const TimestampSchema = z.iso.datetime({ offset: true });
const DurableIdSchema = z.uuid();
const RoomIdSchema = z.string().trim().min(1).max(128);
const StableKeySchema = z.string().trim().min(1).max(220);
const DisplayTitleSchema = z.string().trim().min(1).max(300);
const NullableDisplayTitleSchema = DisplayTitleSchema.nullable();
const HttpUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);
const NullableHttpUrlSchema = HttpUrlSchema.nullable();
const PlaybackSecondsSchema = z.number().finite().nonnegative();
const PlaybackProgressSchema = z.number().finite().min(0).max(1);
const AccountGenerationSchema = z.number().int().positive();
const SeasonNumberSchema = z.number().int().min(0).max(1000);

export const WatchHistoryOpaqueCursorSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export const WatchHistoryResponseMetaSchema = AccountOwnedResponseMetaSchema.extend({
  schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
  accountGeneration: AccountGenerationSchema,
});

export const WatchCatalogCompletenessSchema = z.enum(["complete", "partial"]);
export const WatchCatalogStateSchema = z.enum([
  "complete",
  "partial",
  "unavailable",
]);
export const WatchProgressEventKindSchema = z.enum([
  "heartbeat",
  "pause",
  "seek",
  "source_change",
  "pagehide",
  "room_leave",
  "room_end",
  "ended",
]);

export const WatchHistoryDeleteScopeSchema = z.discriminatedUnion("scope", [
  z.strictObject({
    scope: z.literal("episode"),
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
    episodeKey: StableKeySchema,
  }),
  z.strictObject({
    scope: z.literal("title"),
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
  }),
  z.strictObject({ scope: z.literal("all") }),
]);

export const WatchCatalogLocaleContextSchema = z.strictObject({
  locale: z.string().trim().min(2).max(35).nullable(),
  audioLocale: z.string().trim().min(2).max(35).nullable(),
  subtitleLocales: z.array(z.string().trim().min(2).max(35)).max(32),
});

export const WatchCatalogEpisodeSchema = z.strictObject({
  episodeKey: StableKeySchema,
  providerEpisodeId: StableKeySchema,
  variantKey: StableKeySchema.nullable(),
  title: DisplayTitleSchema,
  episodeNumber: z.number().finite().nonnegative().nullable(),
  order: z.number().int().nonnegative(),
  sourceUrl: HttpUrlSchema,
  releasedAt: TimestampSchema.nullable(),
  available: z.boolean(),
});

export const WatchCatalogSeasonSchema = z.strictObject({
  seasonKey: StableKeySchema,
  providerSeasonId: StableKeySchema.nullable(),
  title: DisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  order: z.number().int().nonnegative(),
  episodes: z.array(WatchCatalogEpisodeSchema).max(500),
});

export const WatchCatalogSnapshotInputSchema = z
  .strictObject({
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
    providerSeriesId: StableKeySchema.nullable(),
    itemKind: WatchItemKindSchema,
    title: DisplayTitleSchema,
    sourceUrl: HttpUrlSchema,
    artworkUrl: NullableHttpUrlSchema,
    completeness: WatchCatalogCompletenessSchema,
    localeContext: WatchCatalogLocaleContextSchema,
    fetchedAt: TimestampSchema,
    lastAttemptAt: TimestampSchema,
    contentHash: z.string().trim().min(8).max(160),
    seasons: z.array(WatchCatalogSeasonSchema).max(100),
  })
  .superRefine((snapshot, context) => {
    const episodeCount = snapshot.seasons.reduce(
      (total, season) => total + season.episodes.length,
      0,
    );
    if (episodeCount > 500) {
      context.addIssue({
        code: "too_big",
        maximum: 500,
        origin: "array",
        inclusive: true,
        message: "Catalog snapshots may contain at most 500 episodes",
        path: ["seasons"],
      });
    }

    const seasonKeys = new Set<string>();
    const episodeKeys = new Set<string>();
    for (const [seasonIndex, season] of snapshot.seasons.entries()) {
      if (seasonKeys.has(season.seasonKey)) {
        context.addIssue({
          code: "custom",
          message: "Catalog season keys must be unique",
          path: ["seasons", seasonIndex, "seasonKey"],
        });
      }
      seasonKeys.add(season.seasonKey);

      for (const [episodeIndex, episode] of season.episodes.entries()) {
        if (episodeKeys.has(episode.episodeKey)) {
          context.addIssue({
            code: "custom",
            message: "Catalog episode keys must be unique across seasons",
            path: ["seasons", seasonIndex, "episodes", episodeIndex, "episodeKey"],
          });
        }
        episodeKeys.add(episode.episodeKey);
      }
    }

    if (snapshot.completeness === "complete") {
      if (snapshot.seasons.length === 0 || episodeCount === 0) {
        context.addIssue({
          code: "custom",
          message: "Complete catalogs must contain at least one episode",
          path: ["seasons"],
        });
      }
      snapshot.seasons.forEach((season, seasonIndex) => {
        if (season.episodes.length === 0) {
          context.addIssue({
            code: "custom",
            message: "Complete catalogs cannot contain empty seasons",
            path: ["seasons", seasonIndex, "episodes"],
          });
        }
      });
    }

    if (
      new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >
      WATCH_CATALOG_MAX_BYTES
    ) {
      context.addIssue({
        code: "custom",
        message: "Catalog snapshot exceeds the 512 KiB limit",
        path: [],
      });
    }
  });

export const WatchCatalogAckSchema = z.strictObject({
  meta: WatchHistoryResponseMetaSchema,
  schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
  provider: WatchProviderSchema,
  titleKey: StableKeySchema,
  acceptedHash: z.string().trim().min(8).max(160),
  completeness: WatchCatalogCompletenessSchema,
  fetchedAt: TimestampSchema,
  retainedOlderComplete: z.boolean(),
});

export const WatchSharedRoomAuthoritySchema = RoomHistoryAuthoritySchema;

export const WatchProgressEventSchema = z.strictObject({
  schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
  clientEventId: DurableIdSchema,
  clientSessionKey: z.string().trim().min(1).max(220),
  accountGeneration: AccountGenerationSchema,
  provider: WatchProviderSchema,
  titleKey: StableKeySchema,
  itemKind: WatchItemKindSchema,
  title: DisplayTitleSchema,
  artworkUrl: NullableHttpUrlSchema,
  episodeKey: StableKeySchema,
  episodeTitle: DisplayTitleSchema,
  seasonKey: StableKeySchema.nullable(),
  seasonTitle: NullableDisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  episodeNumber: z.number().finite().nonnegative().nullable(),
  sourceUrl: HttpUrlSchema,
  currentTime: PlaybackSecondsSchema,
  duration: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  observedAt: TimestampSchema,
  kind: WatchProgressEventKindSchema,
  sharedRoom: WatchSharedRoomAuthoritySchema.nullable().optional(),
});

export const WatchHistoryParticipantSchema = z.strictObject({
  user: PublicProfileSchema,
  role: z.enum(["host", "viewer"]),
  currentTime: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  joinedAt: TimestampSchema,
  leftAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
});

export const WatchHistorySessionSchema = z
  .strictObject({
    id: DurableIdSchema,
    roomId: RoomIdSchema.nullable(),
    roomGeneration: z.number().int().positive().nullable(),
    hostUserId: DurableIdSchema,
    kind: z.enum(["solo", "shared"]),
    sourceGeneration: z.number().int().positive().nullable(),
    currentTime: PlaybackSecondsSchema,
    duration: PlaybackSecondsSchema,
    progress: PlaybackProgressSchema,
    startedAt: TimestampSchema,
    endedAt: TimestampSchema.nullable(),
    lastWatchedAt: TimestampSchema,
    participants: z.array(WatchHistoryParticipantSchema).max(15),
  })
  .superRefine((session, context) => {
    const hasSharedIdentity =
      session.roomId !== null &&
      session.roomGeneration !== null &&
      session.sourceGeneration !== null;
    if (session.kind === "shared" && !hasSharedIdentity) {
      context.addIssue({
        code: "custom",
        message: "Shared sessions require roomId, roomGeneration, and sourceGeneration",
        path: ["roomId"],
      });
    }
    if (
      session.kind === "solo" &&
      (session.roomId !== null ||
        session.roomGeneration !== null ||
        session.sourceGeneration !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Solo sessions cannot include shared-room identity",
        path: ["roomId"],
      });
    }
  });

export const WatchHistoryEpisodeSchema = z.strictObject({
  episodeKey: StableKeySchema,
  episodeTitle: DisplayTitleSchema,
  seasonKey: StableKeySchema.nullable(),
  seasonTitle: NullableDisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  episodeNumber: z.number().finite().nonnegative().nullable(),
  sourceUrl: HttpUrlSchema,
  currentTime: PlaybackSecondsSchema,
  duration: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  completedAt: TimestampSchema.nullable(),
  lastWatchedAt: TimestampSchema,
  sessions: z.array(WatchHistorySessionSchema).max(20),
});

export const WatchHistoryNextEpisodeSchema = z.strictObject({
  episodeKey: StableKeySchema,
  episodeTitle: DisplayTitleSchema,
  seasonKey: StableKeySchema.nullable(),
  seasonTitle: NullableDisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  episodeNumber: z.number().finite().nonnegative().nullable(),
  sourceUrl: HttpUrlSchema,
  releasedAt: TimestampSchema.nullable(),
});

export const WatchHistoryAggregateSchema = z.strictObject({
  completedEpisodes: z.number().int().nonnegative(),
  availableEpisodes: z.number().int().nonnegative().nullable(),
  progress: PlaybackProgressSchema.nullable(),
});

function addAggregateIssues(
  aggregate: z.infer<typeof WatchHistoryAggregateSchema>,
  context: z.RefinementCtx,
  path: PropertyKey[],
) {
  if (aggregate.availableEpisodes === null) {
    if (aggregate.progress !== null) {
      context.addIssue({
        code: "custom",
        message: "Aggregate progress requires an exact available episode count",
        path,
      });
    }
    return;
  }
  if (aggregate.completedEpisodes > aggregate.availableEpisodes) {
    context.addIssue({
      code: "custom",
      message: "Completed episodes cannot exceed available episodes",
      path,
    });
  }
  if (aggregate.progress === null) {
    context.addIssue({
      code: "custom",
      message: "Exact episode totals require aggregate progress",
      path,
    });
    return;
  }
  const expectedProgress =
    aggregate.availableEpisodes === 0
      ? 0
      : aggregate.completedEpisodes / aggregate.availableEpisodes;
  if (Math.abs(aggregate.progress - expectedProgress) > 1e-6) {
    context.addIssue({
      code: "custom",
      message: "Aggregate progress must match completed and available episodes",
      path,
    });
  }
}

export const WatchHistorySeasonSchema = z.strictObject({
  seasonKey: StableKeySchema,
  seasonTitle: DisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  order: z.number().int().nonnegative(),
  aggregate: WatchHistoryAggregateSchema,
  episodes: z.array(WatchHistoryEpisodeSchema),
  nextEpisode: WatchHistoryNextEpisodeSchema.nullable(),
});

export const WatchHistoryLatestActivitySchema = z.strictObject({
  episodeKey: StableKeySchema,
  currentTime: PlaybackSecondsSchema,
  duration: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  completedAt: TimestampSchema.nullable(),
  lastWatchedAt: TimestampSchema,
});

export const WatchHistoryItemSchema = z
  .strictObject({
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
    itemKind: WatchItemKindSchema,
    title: DisplayTitleSchema,
    sourceUrl: HttpUrlSchema,
    artworkUrl: NullableHttpUrlSchema,
    catalogState: WatchCatalogStateSchema,
    aggregate: WatchHistoryAggregateSchema,
    seasons: z.array(WatchHistorySeasonSchema),
    sessions: z.array(WatchHistorySessionSchema).max(20),
    latestActivity: WatchHistoryLatestActivitySchema,
    lastWatchedAt: TimestampSchema,
  })
  .superRefine((item, context) => {
    addAggregateIssues(item.aggregate, context, ["aggregate"]);
    const hasExactTitleTotals =
      item.aggregate.availableEpisodes !== null && item.aggregate.progress !== null;
    if (item.catalogState === "complete" && !hasExactTitleTotals) {
      context.addIssue({
        code: "custom",
        message: "Complete catalogs require exact aggregate totals",
        path: ["aggregate"],
      });
    }
    if (item.catalogState !== "complete" && hasExactTitleTotals) {
      context.addIssue({
        code: "custom",
        message: "Partial or unavailable catalogs cannot claim exact totals",
        path: ["aggregate"],
      });
    }
    item.seasons.forEach((season, seasonIndex) => {
      addAggregateIssues(season.aggregate, context, [
        "seasons",
        seasonIndex,
        "aggregate",
      ]);
      const hasExactSeasonTotals =
        season.aggregate.availableEpisodes !== null &&
        season.aggregate.progress !== null;
      if (item.catalogState === "complete" && !hasExactSeasonTotals) {
        context.addIssue({
          code: "custom",
          message: "Complete catalogs require exact season totals",
          path: ["seasons", seasonIndex, "aggregate"],
        });
      }
      if (item.catalogState !== "complete" && hasExactSeasonTotals) {
        context.addIssue({
          code: "custom",
          message: "Partial or unavailable catalogs cannot claim exact season totals",
          path: ["seasons", seasonIndex, "aggregate"],
        });
      }
      if (item.catalogState !== "complete" && season.nextEpisode !== null) {
        context.addIssue({
          code: "custom",
          message: "Only complete catalogs can provide a canonical next episode",
          path: ["seasons", seasonIndex, "nextEpisode"],
        });
      }
    });
  });

export const WatchHistoryResponseSchema = z.strictObject({
  meta: WatchHistoryResponseMetaSchema,
  generatedAt: TimestampSchema,
  totalTitleCount: z.number().int().nonnegative(),
  items: z.array(WatchHistoryItemSchema).max(100),
  nextCursor: WatchHistoryOpaqueCursorSchema.nullable(),
});

export const WatchProgressAckSchema = z
  .strictObject({
    meta: WatchHistoryResponseMetaSchema,
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    acceptedEventId: DurableIdSchema,
    acceptedAt: TimestampSchema,
    accountGeneration: AccountGenerationSchema,
    duplicate: z.boolean(),
    episode: WatchHistoryEpisodeSchema,
  })
  .refine((ack) => ack.meta.accountGeneration === ack.accountGeneration, {
    message: "Acknowledgement generation must match response metadata",
    path: ["meta", "accountGeneration"],
  });

export const WatchHistoryPreferencesSchema = z.strictObject({
  youtubeHistoryEnabled: z.boolean().default(false),
});

export const WatchHistoryPreferencesUpdateSchema = z.strictObject({
  youtubeHistoryEnabled: z.boolean(),
});

export const WatchHistoryPreferencesResponseSchema = z.strictObject({
  meta: WatchHistoryResponseMetaSchema,
  preferences: WatchHistoryPreferencesSchema,
});

export const WatchHistoryDeletionRequestSchema = z.strictObject({
  schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
  clientMutationId: DurableIdSchema,
  accountGeneration: AccountGenerationSchema,
  target: WatchHistoryDeleteScopeSchema,
  requestedAt: TimestampSchema,
});

export const WatchHistoryDeletionAckSchema = z
  .strictObject({
    meta: WatchHistoryResponseMetaSchema,
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    clientMutationId: DurableIdSchema,
    accountGeneration: AccountGenerationSchema,
    target: WatchHistoryDeleteScopeSchema,
    deletedAt: TimestampSchema,
  })
  .refine((ack) => ack.meta.accountGeneration === ack.accountGeneration, {
    message: "Deletion generation must match response metadata",
    path: ["meta", "accountGeneration"],
  });

export type WatchHistoryResponseMeta = z.infer<
  typeof WatchHistoryResponseMetaSchema
>;
export type WatchCatalogCompleteness = z.infer<
  typeof WatchCatalogCompletenessSchema
>;
export type WatchCatalogState = z.infer<typeof WatchCatalogStateSchema>;
export type WatchProgressEventKind = z.infer<typeof WatchProgressEventKindSchema>;
export type WatchHistoryDeleteScope = z.infer<typeof WatchHistoryDeleteScopeSchema>;
export type WatchCatalogLocaleContext = z.infer<
  typeof WatchCatalogLocaleContextSchema
>;
export type WatchCatalogEpisode = z.infer<typeof WatchCatalogEpisodeSchema>;
export type WatchCatalogSeason = z.infer<typeof WatchCatalogSeasonSchema>;
export type WatchCatalogSnapshotInput = z.infer<
  typeof WatchCatalogSnapshotInputSchema
>;
export type WatchCatalogAck = z.infer<typeof WatchCatalogAckSchema>;
export type WatchSharedRoomAuthority = z.infer<
  typeof WatchSharedRoomAuthoritySchema
>;
export type WatchProgressEvent = z.infer<typeof WatchProgressEventSchema>;
export type WatchHistoryParticipant = z.infer<
  typeof WatchHistoryParticipantSchema
>;
export type WatchHistorySession = z.infer<typeof WatchHistorySessionSchema>;
export type WatchHistoryEpisode = z.infer<typeof WatchHistoryEpisodeSchema>;
export type WatchHistoryNextEpisode = z.infer<
  typeof WatchHistoryNextEpisodeSchema
>;
export type WatchHistoryAggregate = z.infer<typeof WatchHistoryAggregateSchema>;
export type WatchHistorySeason = z.infer<typeof WatchHistorySeasonSchema>;
export type WatchHistoryLatestActivity = z.infer<
  typeof WatchHistoryLatestActivitySchema
>;
export type WatchHistoryItem = z.infer<typeof WatchHistoryItemSchema>;
export type WatchHistoryResponse = z.infer<typeof WatchHistoryResponseSchema>;
export type WatchProgressAck = z.infer<typeof WatchProgressAckSchema>;
export type WatchHistoryPreferences = z.infer<typeof WatchHistoryPreferencesSchema>;
export type WatchHistoryPreferencesUpdate = z.infer<
  typeof WatchHistoryPreferencesUpdateSchema
>;
export type WatchHistoryPreferencesResponse = z.infer<
  typeof WatchHistoryPreferencesResponseSchema
>;
export type WatchHistoryDeletionRequest = z.infer<
  typeof WatchHistoryDeletionRequestSchema
>;
export type WatchHistoryDeletionAck = z.infer<
  typeof WatchHistoryDeletionAckSchema
>;
