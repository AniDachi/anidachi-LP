import { DisneyPlusHistoryIdentitySchema, DisneyPlusProviderIdSchema, disneyPlusNamedSeasonId, disneyPlusHistoryKeys, disneyPlusSeasonIdentifier, disneyPlusSourceUrl, isDisneyPlusArtworkUrl } from "./disneyplus-identity";
import { PrimeNavigationSchema, primeNavigationMatches, primeNavigationTreeMatches } from "./prime-video-navigation";
import { z } from "zod";
import {
  AccountOwnedResponseMetaSchema,
  PublicProfileSchema,
  WatchItemKindSchema,
  WatchProviderSchema,
} from "./account";
import { historyEpisodeSourceMatches, historyKeyMatchesProvider, historyReadReferencesMatchProvider } from "./history-provider-validation";
import { NetflixHistoryIdentitySchema, NetflixProviderIdSchema } from "./netflix-identity";
import { PrimeVideoHistoryIdentitySchema, PrimeVideoProviderIdSchema, primeVideoHistoryKeys, primeVideoSourceUrl } from "./prime-video-identity";
import { canonicalizeRoomSourceUrl, hasDisneyPlusHostname, hasPrimeVideoHostname } from "./source-url";
import { RoomCapabilitiesSchema, RoomHistoryAuthoritySchema } from "./types";

export const WATCH_HISTORY_SCHEMA_VERSION = 3 as const;
export const WATCH_CATALOG_MAX_BYTES = 1_024 * 1_024;
export const WATCH_HISTORY_CATALOG_PROJECTION_MAX_BYTES = 256 * 1_024;
export const WATCH_CATALOG_MAX_EPISODES = 2_000;
export const WATCH_CATALOG_MAX_VARIANTS_PER_EPISODE = 32;
export const WATCH_CATALOG_MAX_VARIANTS_PER_TITLE = 10_000;
export const WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT = 8;
export const WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT = 50;

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

export const WatchHistoryEpisodeOpaqueCursorSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .regex(/^[A-Za-z0-9_-]+$/);

export const WatchHistoryResponseMetaSchema =
  AccountOwnedResponseMetaSchema.extend({
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
  region: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  requestedLocale: z.string().trim().min(2).max(35),
  audioLocale: z.string().trim().min(2).max(35).nullable(),
  subtitleLocales: z.array(z.string().trim().min(2).max(35)).max(32),
  observedAt: TimestampSchema,
});

const catalogIdSchemas = {
  crunchyroll: StableKeySchema, netflix: NetflixProviderIdSchema,
  primevideo: PrimeVideoProviderIdSchema, disneyplus: DisneyPlusProviderIdSchema,
};
type CatalogProvider = keyof typeof catalogIdSchemas;

function catalogPlaybackUrl(provider: CatalogProvider, id: string): string {
  if (provider === "disneyplus") return disneyPlusSourceUrl(id);
  if (provider === "primevideo") return primeVideoSourceUrl(id);
  return `https://www.${provider}.com/watch/${id}`;
}

function catalogVariantSchema(provider: CatalogProvider) {
  return z
    .strictObject({
      providerContentId: catalogIdSchemas[provider],
      audioLocale: z.string().trim().min(2).max(35).nullable(),
      original: z.boolean(),
      order: z.number().int().nonnegative(),
      sourceUrl: HttpUrlSchema,
    primeNavigation: PrimeNavigationSchema.optional(),
    })
    .superRefine((variant, context) => {
      if(!primeNavigationMatches(variant.primeNavigation,variant.sourceUrl,provider)) context.addIssue({code:"custom",message:"Prime navigation source mismatch"});
      const canonical = canonicalizeRoomSourceUrl(
        variant.sourceUrl,
        provider,
      );
      if (
        !canonical.ok ||
        canonical.source.sourceUrl !== variant.sourceUrl ||
        canonical.source.sourceUrl !== catalogPlaybackUrl(provider, variant.providerContentId)
      ) {
        context.addIssue({
          code: "custom",
          message: "Variant URL must exactly match its provider content ID",
          path: ["sourceUrl"],
        });
      }
    });
}

function catalogEpisodeSchema(provider: CatalogProvider) {
  return z
    .strictObject({
      episodeKey: StableKeySchema,
      providerEpisodeIdentifier: catalogIdSchemas[provider],
      title: DisplayTitleSchema,
      episodeNumber: z.number().finite().nonnegative().nullable(),
      order: z.number().int().nonnegative(),
      releasedAt: TimestampSchema.nullable(),
      available: z.boolean(),
      watchVariants: z
        .array(catalogVariantSchema(provider))
        .min(1)
        .max(WATCH_CATALOG_MAX_VARIANTS_PER_EPISODE),
    })
    .superRefine((episode, context) => {
      if (
        episode.episodeKey !==
        `${provider}:episode:${episode.providerEpisodeIdentifier}`
      ) {
        context.addIssue({
          code: "custom",
          message: "Episode key must derive from the provider identifier",
          path: ["episodeKey"],
        });
      }
      if (
        episode.watchVariants.filter((variant) => variant.original).length > 1
      ) {
        context.addIssue({
          code: "custom",
          message: "At most one variant may be original",
          path: ["watchVariants"],
        });
      }
      if ((provider === "disneyplus" || provider === "netflix" || provider === "primevideo") && (episode.watchVariants.length !== 1 ||
        episode.watchVariants[0]?.providerContentId !== episode.providerEpisodeIdentifier)) {
        context.addIssue({ code: "custom", message: `${provider} requires one exact episode variant`, path: ["watchVariants"] });
      }
      const ids = new Set<string>();
      for (const [index, variant] of episode.watchVariants.entries()) {
        if (ids.has(variant.providerContentId))
          context.addIssue({
            code: "custom",
            message: "Variant content IDs must be unique",
            path: ["watchVariants", index, "providerContentId"],
          });
        ids.add(variant.providerContentId);
      }
    });
}

function catalogSeasonSchema(provider: CatalogProvider) {
  return z
    .strictObject({
      seasonKey: StableKeySchema,
      providerSeasonIdentifier: provider === "disneyplus" ? StableKeySchema : catalogIdSchemas[provider],
      title: DisplayTitleSchema,
      seasonNumber: SeasonNumberSchema.nullable(),
      order: z.number().int().nonnegative(),
      episodes: z
        .array(catalogEpisodeSchema(provider))
        .max(WATCH_CATALOG_MAX_EPISODES),
    })
    .superRefine((season, context) => {
      if (
        season.seasonKey !==
        `${provider}:season:${season.providerSeasonIdentifier}`
      ) {
        context.addIssue({
          code: "custom",
          message: "Season key must derive from the provider identifier",
          path: ["seasonKey"],
        });
      }
    });
}

export const WatchCatalogVariantSchema = z.union([catalogVariantSchema("crunchyroll"), catalogVariantSchema("netflix"), catalogVariantSchema("primevideo"), catalogVariantSchema("disneyplus")]);
export const WatchCatalogEpisodeSchema = z.union([catalogEpisodeSchema("crunchyroll"), catalogEpisodeSchema("netflix"), catalogEpisodeSchema("primevideo"), catalogEpisodeSchema("disneyplus")]);
const CatalogSeasonSchemas = { crunchyroll: catalogSeasonSchema("crunchyroll"), netflix: catalogSeasonSchema("netflix"), primevideo: catalogSeasonSchema("primevideo"), disneyplus: catalogSeasonSchema("disneyplus") };
export const WatchCatalogSeasonSchema = z.union([CatalogSeasonSchemas.crunchyroll, CatalogSeasonSchemas.netflix, CatalogSeasonSchemas.primevideo, CatalogSeasonSchemas.disneyplus]);

export const WatchCatalogSnapshotInputSchema = z
  .strictObject({
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    provider: z.enum(["crunchyroll", "netflix", "primevideo", "disneyplus"]),
    titleKey: StableKeySchema,
    providerSeriesId: StableKeySchema,
    title: DisplayTitleSchema,
    completeness: WatchCatalogCompletenessSchema,
    context: WatchCatalogLocaleContextSchema,
    seasons: z.array(WatchCatalogSeasonSchema).max(100),
  })
  .superRefine((snapshot, context) => {
    if (snapshot.provider === "disneyplus" && !DisneyPlusProviderIdSchema.safeParse(snapshot.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Disney+ series ID must be a canonical UUID", path: ["providerSeriesId"] });
    if (snapshot.provider === "netflix" && !NetflixProviderIdSchema.safeParse(snapshot.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Netflix series ID must be numeric", path: ["providerSeriesId"] });
    // Prime providerSeriesId is the verified season-1 compactGTI anchor.
    if (snapshot.provider === "primevideo" && !PrimeVideoProviderIdSchema.safeParse(snapshot.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Prime series anchor must be a compactGTI", path: ["providerSeriesId"] });
    snapshot.seasons.forEach((season, index) => {
      if (snapshot.provider === "disneyplus" && (season.seasonNumber === null
        ? !disneyPlusNamedSeasonId(snapshot.providerSeriesId, season.seasonKey)
        : season.seasonNumber < 1 || season.providerSeasonIdentifier !== disneyPlusSeasonIdentifier(snapshot.providerSeriesId, season.seasonNumber))) {
        context.addIssue({ code: "custom", message: "Disney+ season must match its series and season number", path: ["seasons", index] });
      }
      if (!CatalogSeasonSchemas[snapshot.provider].safeParse(season).success)
        context.addIssue({ code: "custom", message: "Catalog season must match its declared provider", path: ["seasons", index] });
    });
    const episodeCount = snapshot.seasons.reduce(
      (total, season) => total + season.episodes.length,
      0,
    );
    const variantCount = snapshot.seasons.reduce(
      (total, season) =>
        total +
        season.episodes.reduce(
          (sum, episode) => sum + episode.watchVariants.length,
          0,
        ),
      0,
    );
    if (
      snapshot.titleKey !== `${snapshot.provider}:series:${snapshot.providerSeriesId}`
    ) {
      context.addIssue({
        code: "custom",
        message: "Title key must derive from the provider series ID",
        path: ["titleKey"],
      });
    }
    if (
      snapshot.completeness === "complete" &&
      snapshot.context.region === null
    ) {
      context.addIssue({
        code: "custom",
        message: "Complete catalogs require a known region",
        path: ["context", "region"],
      });
    }
    if (episodeCount > WATCH_CATALOG_MAX_EPISODES) {
      context.addIssue({
        code: "too_big",
        maximum: WATCH_CATALOG_MAX_EPISODES,
        origin: "array",
        inclusive: true,
        message: `Catalog snapshots may contain at most ${WATCH_CATALOG_MAX_EPISODES} episodes`,
        path: ["seasons"],
      });
    }
    if (variantCount > WATCH_CATALOG_MAX_VARIANTS_PER_TITLE)
      context.addIssue({
        code: "custom",
        message: "Catalog snapshot contains too many variants",
        path: ["seasons"],
      });

    const seasonKeys = new Set<string>();
    const episodeKeys = new Set<string>();
    const variantOwners = new Map<string, string>();
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
            path: [
              "seasons",
              seasonIndex,
              "episodes",
              episodeIndex,
              "episodeKey",
            ],
          });
        }
        episodeKeys.add(episode.episodeKey);
        for (const [variantIndex, variant] of episode.watchVariants.entries()) {
          const previous = variantOwners.get(variant.providerContentId);
          if (previous && previous !== episode.episodeKey)
            context.addIssue({
              code: "custom",
              message: "A raw content ID may map to only one canonical episode",
              path: [
                "seasons",
                seasonIndex,
                "episodes",
                episodeIndex,
                "watchVariants",
                variantIndex,
              ],
            });
          variantOwners.set(variant.providerContentId, episode.episodeKey);
        }
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
        message: "Catalog snapshot exceeds the 1 MiB limit",
        path: [],
      });
    }
  });

/** Optional only for inactive legacy compatibility. Active catalog SQL requires
 * this proof and binds it to the durable attempt before accepting a commit. */
export const WatchCatalogHistoryAccessSchema = z.strictObject({
  accessVersion: z.literal(1),
  accessEpoch: z.number().int().nonnegative(),
});

const CatalogRequestBaseSchema = z
  .strictObject({
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    accountGeneration: AccountGenerationSchema,
    provider: z.enum(["crunchyroll", "netflix", "primevideo", "disneyplus"]),
    titleKey: StableKeySchema,
    providerSeriesId: StableKeySchema,
    context: WatchCatalogLocaleContextSchema,
    historyAccess: WatchCatalogHistoryAccessSchema.optional(),
  })
  .superRefine((request, context) => {
    if (request.provider === "disneyplus" && !DisneyPlusProviderIdSchema.safeParse(request.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Disney+ series ID must be a canonical UUID", path: ["providerSeriesId"] });
    if (request.provider === "netflix" && !NetflixProviderIdSchema.safeParse(request.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Netflix series ID must be numeric", path: ["providerSeriesId"] });
    if (request.provider === "primevideo" && !PrimeVideoProviderIdSchema.safeParse(request.providerSeriesId).success)
      context.addIssue({ code: "custom", message: "Prime series anchor must be a compactGTI", path: ["providerSeriesId"] });
    if (request.titleKey !== `${request.provider}:series:${request.providerSeriesId}`)
      context.addIssue({
        code: "custom",
        message: "Title key must derive from provider series ID",
        path: ["titleKey"],
      });
  });

export const WatchCatalogBeginRequestSchema = CatalogRequestBaseSchema;
export const WatchCatalogBeginAckSchema = z
  .strictObject({
    meta: WatchHistoryResponseMetaSchema,
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    provider: z.enum(["crunchyroll", "netflix", "primevideo", "disneyplus"]),
    titleKey: StableKeySchema,
    accountGeneration: AccountGenerationSchema,
    revision: z.number().int().positive(),
    refreshRequired: z.boolean(),
    availabilityChanged: z.boolean(),
    effectiveCatalogState: WatchCatalogStateSchema,
    projectionRevision: z.number().int().positive().nullable(),
    acceptedHash: z.string().trim().min(8).max(160).nullable(),
    acceptedAt: TimestampSchema.nullable(),
  })
  .refine((ack) => historyKeyMatchesProvider(ack.provider, ack.titleKey, ["series"]), {
    message: "Catalog acknowledgement identity must match provider", path: ["titleKey"],
  })
  .refine((ack) => primeNavigationTreeMatches(ack) && ack.meta.accountGeneration === ack.accountGeneration, {
    message: "Acknowledgement generation must match response metadata",
    path: ["accountGeneration"],
  });

export const WatchCatalogCommitRequestSchema =
  CatalogRequestBaseSchema.safeExtend({
    revision: z.number().int().positive(),
    snapshot: WatchCatalogSnapshotInputSchema,
  }).superRefine((request, context) => {
    if (
      request.snapshot.provider !== request.provider ||
      request.snapshot.titleKey !== request.titleKey ||
      request.snapshot.providerSeriesId !== request.providerSeriesId ||
      JSON.stringify(request.snapshot.context) !==
        JSON.stringify(request.context)
    )
      context.addIssue({
        code: "custom",
        message: "Commit snapshot must match its issued immutable context",
        path: ["snapshot"],
      });
  });

export const WatchCatalogCommitAckSchema = z
  .strictObject({
    meta: WatchHistoryResponseMetaSchema,
    schemaVersion: z.literal(WATCH_HISTORY_SCHEMA_VERSION),
    provider: z.enum(["crunchyroll", "netflix", "primevideo", "disneyplus"]),
    titleKey: StableKeySchema,
    accountGeneration: AccountGenerationSchema,
    revision: z.number().int().positive(),
    outcome: z.enum(["applied", "superseded"]),
    effectiveCatalogState: WatchCatalogStateSchema,
    projectionRevision: z.number().int().positive().nullable(),
    acceptedHash: z.string().trim().min(8).max(160).nullable(),
    acceptedAt: TimestampSchema.nullable(),
  })
  .refine((ack) => historyKeyMatchesProvider(ack.provider, ack.titleKey, ["series"]), {
    message: "Catalog acknowledgement identity must match provider", path: ["titleKey"],
  })
  .refine((ack) => primeNavigationTreeMatches(ack) && ack.meta.accountGeneration === ack.accountGeneration, {
    message: "Acknowledgement generation must match response metadata",
    path: ["accountGeneration"],
  });

export const WatchSharedRoomAuthoritySchema = RoomHistoryAuthoritySchema;

export const CrunchyrollHistoryIdentitySchema = z.strictObject({
  providerSeriesId: StableKeySchema,
  providerSeasonIdentifier: StableKeySchema,
  providerEpisodeIdentifier: StableKeySchema,
  providerContentId: StableKeySchema,
  audioLocale: z.string().trim().min(2).max(35).nullable(),
});

export const WatchProgressEventSchema = z
  .strictObject({
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
    primeNavigation: PrimeNavigationSchema.optional(),
    currentTime: PlaybackSecondsSchema,
    duration: PlaybackSecondsSchema,
    progress: PlaybackProgressSchema,
    observedAt: TimestampSchema,
    kind: WatchProgressEventKindSchema,
    sharedRoom: WatchSharedRoomAuthoritySchema.nullable().optional(),
    crunchyrollIdentity: CrunchyrollHistoryIdentitySchema.optional(),
    netflixIdentity: NetflixHistoryIdentitySchema.optional(),
    disneyplusIdentity: DisneyPlusHistoryIdentitySchema.optional(),
    primevideoIdentity: PrimeVideoHistoryIdentitySchema.optional(),
    youtubeVideoId: StableKeySchema.optional(),
  })
  .superRefine((event, context) => {
    if(!primeNavigationMatches(event.primeNavigation,event.sourceUrl,event.provider)) context.addIssue({code:"custom",message:"Prime navigation source mismatch"});
    if (event.provider !== "disneyplus" && (event.disneyplusIdentity !== undefined || hasDisneyPlusHostname(event.sourceUrl) ||
      [event.titleKey, event.episodeKey, event.seasonKey].some(key => key?.startsWith("disneyplus:")))) {
      context.addIssue({ code: "custom", message: "Disney+ identity requires Disney+ provider", path: ["provider"] });
    }
    if (event.provider !== "primevideo" &&
      ([event.titleKey, event.episodeKey, event.seasonKey].some(key => key?.startsWith("primevideo:")) ||
        hasPrimeVideoHostname(event.sourceUrl)))
      context.addIssue({ code: "custom", message: "Prime identity requires Prime provider", path: ["provider"] });
    if (event.provider !== "netflix" &&
      ([event.titleKey, event.episodeKey, event.seasonKey].some(key => key?.startsWith("netflix:")) ||
        event.sourceUrl.startsWith("https://www.netflix.com/"))) {
      context.addIssue({ code: "custom", message: "Netflix source identity requires Netflix provider", path: ["provider"] });
    }
    if (event.provider === "crunchyroll") {
      const identity = event.crunchyrollIdentity;
      if (!identity || event.youtubeVideoId !== undefined || event.netflixIdentity !== undefined || event.primevideoIdentity !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Crunchyroll progress requires only Crunchyroll identity",
          path: ["crunchyrollIdentity"],
        });
        return;
      }
      if (
        event.titleKey !== `crunchyroll:series:${identity.providerSeriesId}` ||
        event.seasonKey !==
          `crunchyroll:season:${identity.providerSeasonIdentifier}` ||
        event.episodeKey !==
          `crunchyroll:episode:${identity.providerEpisodeIdentifier}` ||
        event.sourceUrl !==
          `https://www.crunchyroll.com/watch/${identity.providerContentId}`
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Crunchyroll progress identity and source URL must match exactly",
          path: ["crunchyrollIdentity"],
        });
      }
      const canonical = canonicalizeRoomSourceUrl(event.sourceUrl, "crunchyroll");
      if (
        !canonical.ok ||
        canonical.source.sourceUrl !== event.sourceUrl ||
        canonical.source.videoFingerprint !==
          `crunchyroll|watch/${identity.providerContentId}`
      ) {
        context.addIssue({
          code: "custom",
          message: "Crunchyroll progress source must be an exact canonical URL",
          path: ["sourceUrl"],
        });
      }
    } else if (event.provider === "youtube") {
      if (
        !event.youtubeVideoId ||
        event.crunchyrollIdentity !== undefined ||
        event.netflixIdentity !== undefined ||
        event.primevideoIdentity !== undefined ||
        event.titleKey !== `youtube:video:${event.youtubeVideoId}` ||
        event.episodeKey !== `youtube:video:${event.youtubeVideoId}` ||
        event.sourceUrl !==
          `https://www.youtube.com/watch?v=${event.youtubeVideoId}`
      ) {
        context.addIssue({
          code: "custom",
          message: "YouTube progress requires exact video identity",
          path: ["youtubeVideoId"],
        });
      }
    } else if (event.provider === "netflix") {
      const identity = event.netflixIdentity;
      if (!identity || event.crunchyrollIdentity !== undefined || event.youtubeVideoId !== undefined || event.primevideoIdentity !== undefined) {
        context.addIssue({ code: "custom", message: "Netflix requires only Netflix identity", path: ["netflixIdentity"] });
        return;
      }
      const episode = identity.kind === "episode";
      const id = episode ? identity.providerEpisodeIdentifier : identity.providerMovieId;
      if (event.itemKind !== (episode ? "series" : "movie") ||
        event.titleKey !== (episode ? `netflix:series:${identity.providerSeriesId}` : `netflix:movie:${id}`) ||
        event.episodeKey !== `netflix:${episode ? "episode" : "movie"}:${id}` ||
        event.seasonKey !== (episode ? `netflix:season:${identity.providerSeasonIdentifier}` : null) ||
        (!episode && (event.seasonTitle !== null || event.seasonNumber !== null || event.episodeNumber !== null)) ||
        event.sourceUrl !== `https://www.netflix.com/watch/${id}`) {
        context.addIssue({ code: "custom", message: "Netflix identity and source must match exactly", path: ["netflixIdentity"] });
      }
    } else if (event.provider === "disneyplus") {
      const identity = event.disneyplusIdentity;
      if (!identity || event.crunchyrollIdentity || event.netflixIdentity || event.primevideoIdentity || event.youtubeVideoId !== undefined) {
        context.addIssue({ code: "custom", message: "Disney+ requires only Disney+ identity", path: ["disneyplusIdentity"] });
        return;
      }
      const named = identity.kind === "episode" && event.seasonNumber === null ? disneyPlusNamedSeasonId(identity.providerSeriesId, event.seasonKey) : undefined;
      const keys = disneyPlusHistoryKeys(identity, event.seasonNumber, named);
      const id = identity.kind === "movie" ? identity.providerMovieId : identity.providerEpisodeIdentifier;
      if (event.titleKey !== keys.titleKey || event.episodeKey !== keys.episodeKey || event.seasonKey !== keys.seasonKey ||
        event.itemKind !== keys.itemKind || !isDisneyPlusArtworkUrl(event.artworkUrl) || event.sourceUrl !== disneyPlusSourceUrl(id) || event.seasonNumber === 0 ||
        (event.seasonKey === null && event.seasonTitle !== null) ||
        (identity.kind === "movie" && (event.seasonNumber !== null || event.episodeNumber !== null))) {
        context.addIssue({ code: "custom", message: "Disney+ identity must match progress keys and playback URL", path: ["disneyplusIdentity"] });
      }
    } else if (event.provider === "primevideo") {
      const identity = event.primevideoIdentity;
      if (!identity || event.crunchyrollIdentity !== undefined || event.youtubeVideoId !== undefined || event.netflixIdentity !== undefined) {
        context.addIssue({ code: "custom", message: "Prime requires only Prime identity", path: ["primevideoIdentity"] });
        return;
      }
      const keys = primeVideoHistoryKeys(identity);
      const id = identity.kind === "movie" ? identity.providerMovieId : identity.providerEpisodeIdentifier;
      if (event.itemKind !== keys.itemKind || event.titleKey !== keys.titleKey ||
        event.episodeKey !== keys.episodeKey || event.seasonKey !== keys.seasonKey ||
        (identity.kind === "movie" && (event.seasonTitle !== null || event.seasonNumber !== null || event.episodeNumber !== null)) ||
        event.sourceUrl !== primeVideoSourceUrl(id))
        context.addIssue({ code: "custom", message: "Prime identity and source must match exactly", path: ["primevideoIdentity"] });
    } else if (
      event.primevideoIdentity !== undefined ||
      event.netflixIdentity !== undefined ||
      event.youtubeVideoId !== undefined ||
      event.crunchyrollIdentity !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Provider-specific identity does not match provider",
        path: ["provider"],
      });
    }
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
        message:
          "Shared sessions require roomId, roomGeneration, and sourceGeneration",
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
    primeNavigation: PrimeNavigationSchema.optional(),
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
    primeNavigation: PrimeNavigationSchema.optional(),
  releasedAt: TimestampSchema.nullable(),
});

const WatchHistoryExactAggregateSchema = z
  .strictObject({
    completedEpisodes: z.number().int().nonnegative(),
    availableEpisodes: z.number().int().nonnegative(),
    progress: PlaybackProgressSchema,
  })
  .superRefine((aggregate, context) => {
    if (aggregate.completedEpisodes > aggregate.availableEpisodes) {
      context.addIssue({
        code: "custom",
        message: "Completed episodes cannot exceed available episodes",
        path: ["completedEpisodes"],
      });
    }
    const expected =
      aggregate.availableEpisodes === 0
        ? 0
        : aggregate.completedEpisodes / aggregate.availableEpisodes;
    if (Math.abs(aggregate.progress - expected) > 1e-6) {
      context.addIssue({
        code: "custom",
        message: "Catalog progress must match exact episode totals",
        path: ["progress"],
      });
    }
  });

export const WatchHistoryCatalogSeasonProjectionSchema = z.strictObject({
  seasonKey: StableKeySchema,
  seasonTitle: DisplayTitleSchema,
  seasonNumber: SeasonNumberSchema.nullable(),
  order: z.number().int().nonnegative(),
  aggregate: WatchHistoryExactAggregateSchema,
  nextEpisode: WatchHistoryNextEpisodeSchema.nullable(),
});

export const WatchHistoryCatalogProjectionSchema = z
  .strictObject({
    state: WatchCatalogStateSchema,
    title: DisplayTitleSchema.nullable(),
    aggregate: WatchHistoryExactAggregateSchema.nullable(),
    seasons: z.array(WatchHistoryCatalogSeasonProjectionSchema).max(
      WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT,
    ),
  })
  .superRefine((catalog, context) => {
    if (
      new TextEncoder().encode(JSON.stringify(catalog)).byteLength >
      WATCH_HISTORY_CATALOG_PROJECTION_MAX_BYTES
    ) {
      context.addIssue({
        code: "custom",
        message: "Catalog projection exceeds the 256 KiB limit",
        path: [],
      });
    }
    const exact =
      catalog.title !== null &&
      catalog.aggregate !== null;
    if (catalog.state === "complete" && !exact) {
      context.addIssue({
        code: "custom",
        message: "Complete catalog projections require exact metadata",
        path: ["state"],
      });
    }
    if (
      catalog.state !== "complete" &&
      (exact || catalog.title !== null || catalog.aggregate !== null || catalog.seasons.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Incomplete catalog projections cannot claim exact metadata",
        path: ["state"],
      });
    }
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
  episodes: z
    .array(WatchHistoryEpisodeSchema)
    .max(WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT),
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

export const WatchHistoryEpisodePageSchema = z
  .strictObject({
    complete: z.boolean(),
    nextCursor: WatchHistoryEpisodeOpaqueCursorSchema.nullable(),
  })
  .superRefine((page, context) => {
    if(!primeNavigationTreeMatches(page))context.addIssue({code:"custom",message:"Invalid navigation binding"});
    if (page.complete && page.nextCursor !== null) {
      context.addIssue({
        code: "custom",
        message: "Complete episode slices cannot include a continuation cursor",
        path: ["nextCursor"],
      });
    }
    if (!page.complete && page.nextCursor === null) {
      context.addIssue({
        code: "custom",
        message: "Incomplete episode slices require a continuation cursor",
        path: ["nextCursor"],
      });
    }
  });

export const WatchHistoryItemSchema = z
  .strictObject({
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
    observedEpisodeCount: z.number().int().nonnegative(),
    completedEpisodeCount: z.number().int().nonnegative(),
    episodePage: WatchHistoryEpisodePageSchema,
    itemKind: WatchItemKindSchema,
    title: DisplayTitleSchema,
    sourceUrl: HttpUrlSchema,
    primeNavigation: PrimeNavigationSchema.optional(),
    artworkUrl: NullableHttpUrlSchema,
    catalogState: WatchCatalogStateSchema,
    aggregate: WatchHistoryAggregateSchema,
    seasons: z
      .array(WatchHistorySeasonSchema)
      .max(WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT),
    sessions: z.array(WatchHistorySessionSchema).max(20),
    latestActivity: WatchHistoryLatestActivitySchema,
    lastWatchedAt: TimestampSchema,
  })
  .superRefine((item, context) => {
    if(!primeNavigationTreeMatches(item))context.addIssue({code:"custom",message:"Invalid navigation binding"});
    if(!primeNavigationMatches(item.primeNavigation,item.sourceUrl,item.provider)) context.addIssue({code:"custom",message:"Prime navigation source mismatch"});
    const references = item.seasons.flatMap(season => [...season.episodes, ...(season.nextEpisode ? [season.nextEpisode] : [])]);
    if (!historyReadReferencesMatchProvider(item.provider,
      [item.titleKey, item.latestActivity.episodeKey, ...item.seasons.map(season => season.seasonKey),
        ...references.flatMap(episode => [episode.episodeKey, episode.seasonKey])],
      [item.sourceUrl, ...references.map(episode => episode.sourceUrl)]))
      context.addIssue({ code: "custom", message: "Title read references must match provider" });
    if (item.provider === "disneyplus" || item.provider === "netflix" || item.provider === "primevideo") {
      const provider = item.provider;
      if (!historyKeyMatchesProvider(provider, item.titleKey, [item.itemKind === "movie" ? "movie" : "series"]) ||
        !historyKeyMatchesProvider(provider, item.latestActivity.episodeKey, [item.itemKind === "movie" ? "movie" : "episode"]) ||
        item.sourceUrl !== catalogPlaybackUrl(provider, item.latestActivity.episodeKey.split(":")[2]!) || (item.itemKind === "movie" && (item.latestActivity.episodeKey !== item.titleKey || item.seasons.length !== 0)))
        context.addIssue({ code: "custom", message: "Provider title identity must match source", path: ["titleKey"] });
      for (const season of item.seasons) {
        const unknownDisneySeason = provider === "disneyplus" && season.seasonKey === "observed";
        if ((!unknownDisneySeason && !historyKeyMatchesProvider(provider, season.seasonKey, ["season"])) ||
          season.episodes.some(episode => episode.seasonKey !== (unknownDisneySeason ? null : season.seasonKey) || !historyEpisodeSourceMatches(provider, episode)) ||
          (season.nextEpisode && (season.nextEpisode.seasonKey !== season.seasonKey || !historyEpisodeSourceMatches(provider, season.nextEpisode))))
          context.addIssue({ code: "custom", message: "Provider title seasons must match source", path: ["seasons"] });
      }
    }
    const episodeKeys = new Set<string>();
    let returnedEpisodeCount = 0;
    item.seasons.forEach((season, seasonIndex) => {
      season.episodes.forEach((episode, episodeIndex) => {
        returnedEpisodeCount += 1;
        if (episodeKeys.has(episode.episodeKey)) {
          context.addIssue({
            code: "custom",
            message: "Episode slice identities must be unique across seasons",
            path: [
              "seasons",
              seasonIndex,
              "episodes",
              episodeIndex,
              "episodeKey",
            ],
          });
        }
        episodeKeys.add(episode.episodeKey);
      });
    });
    const representedEpisodeCount =
      item.itemKind === "movie" && returnedEpisodeCount === 0
        ? Math.min(1, item.observedEpisodeCount)
        : returnedEpisodeCount;
    if (returnedEpisodeCount > WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT) {
      context.addIssue({
        code: "too_big",
        maximum: WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT,
        origin: "array",
        inclusive: true,
        message: `Title snapshots may contain at most ${WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT} episodes`,
        path: ["seasons"],
      });
    }
    if (
      item.completedEpisodeCount > item.observedEpisodeCount ||
      representedEpisodeCount > item.observedEpisodeCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Episode slice and exact title counts are inconsistent",
        path: ["observedEpisodeCount"],
      });
    }
    if (
      item.episodePage.complete &&
      representedEpisodeCount !== item.observedEpisodeCount
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A complete episode slice must represent every observed episode",
        path: ["episodePage", "complete"],
      });
    }
    addAggregateIssues(item.aggregate, context, ["aggregate"]);
    const hasExactTitleTotals =
      item.aggregate.availableEpisodes !== null &&
      item.aggregate.progress !== null;
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
          message:
            "Partial or unavailable catalogs cannot claim exact season totals",
          path: ["seasons", seasonIndex, "aggregate"],
        });
      }
      if (item.catalogState !== "complete" && season.nextEpisode !== null) {
        context.addIssue({
          code: "custom",
          message:
            "Only complete catalogs can provide a canonical next episode",
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

export const WatchHistoryTitleEpisodesResponseSchema = z
  .strictObject({
    meta: WatchHistoryResponseMetaSchema,
    generatedAt: TimestampSchema,
    provider: WatchProviderSchema,
    titleKey: StableKeySchema,
    observedEpisodeCount: z.number().int().nonnegative(),
    completedEpisodeCount: z.number().int().nonnegative(),
    episodes: z
      .array(WatchHistoryEpisodeSchema)
      .max(WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT),
    catalog: WatchHistoryCatalogProjectionSchema,
    complete: z.boolean(),
    nextCursor: WatchHistoryEpisodeOpaqueCursorSchema.nullable(),
  })
  .superRefine((page, context) => {
    if(!primeNavigationTreeMatches(page))context.addIssue({code:"custom",message:"Invalid navigation binding"});
    if (
      page.completedEpisodeCount > page.observedEpisodeCount ||
      page.episodes.length > page.observedEpisodeCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Episode page and exact title counts are inconsistent",
        path: ["observedEpisodeCount"],
      });
    }
    if (page.complete && page.nextCursor !== null) {
      context.addIssue({
        code: "custom",
        message: "Complete episode pages cannot include a continuation cursor",
        path: ["nextCursor"],
      });
    }
    if (!page.complete && page.nextCursor === null) {
      context.addIssue({
        code: "custom",
        message: "Incomplete episode pages require a continuation cursor",
        path: ["nextCursor"],
      });
    }
    const references = [...page.episodes, ...page.catalog.seasons.flatMap(season => season.nextEpisode ? [season.nextEpisode] : [])];
    if (!historyReadReferencesMatchProvider(page.provider,
      [page.titleKey, ...page.catalog.seasons.map(season => season.seasonKey),
        ...references.flatMap(episode => [episode.episodeKey, episode.seasonKey])],
      references.map(episode => episode.sourceUrl)))
      context.addIssue({ code: "custom", message: "Episode page read references must match provider" });
    if (page.provider === "disneyplus" || page.provider === "netflix" || page.provider === "primevideo") {
      const provider = page.provider;
      const movie = page.titleKey.startsWith(`${provider}:movie:`);
      if (movie && (page.catalog.seasons.length !== 0 || page.episodes.some(episode =>
        episode.seasonKey !== null || episode.seasonTitle !== null || episode.seasonNumber !== null || episode.episodeNumber !== null)))
        context.addIssue({ code: "custom", message: "Provider movies cannot contain season or episode metadata" });
      if (!historyKeyMatchesProvider(provider, page.titleKey, ["series", "movie"]) ||
        page.episodes.some(episode => !historyEpisodeSourceMatches(provider, episode) ||
          (page.titleKey.startsWith(`${provider}:movie:`) ? episode.episodeKey !== page.titleKey : !episode.episodeKey.startsWith(`${provider}:episode:`))))
        context.addIssue({ code: "custom", message: "Provider episode page must match provider and title" });
      for (const season of page.catalog.seasons) {
        if (!historyKeyMatchesProvider(provider, season.seasonKey, ["season"]) ||
          (season.nextEpisode && (season.nextEpisode.seasonKey !== season.seasonKey || !historyEpisodeSourceMatches(provider, season.nextEpisode))))
          context.addIssue({ code: "custom", message: "Provider catalog projection must match provider" });
      }
    }
    const identities = new Set<string>();
    page.episodes.forEach((episode, index) => {
      if (identities.has(episode.episodeKey)) {
        context.addIssue({
          code: "custom",
          message: "Episode page identities must be unique",
          path: ["episodes", index, "episodeKey"],
        });
      }
      identities.add(episode.episodeKey);
    });
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
  .refine((ack) => primeNavigationTreeMatches(ack) && ack.meta.accountGeneration === ack.accountGeneration, {
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

export const WatchHistoryRoomRecreationResponseSchema = z.strictObject({
  roomId: RoomIdSchema,
  roomToken: z.string().trim().min(1).max(4096),
  shareableLink: HttpUrlSchema,
  reused: z.boolean(),
  capabilities: RoomCapabilitiesSchema,
  quota: z
    .strictObject({
      remainingSeconds: z.number().finite().nonnegative(),
      resetAt: TimestampSchema,
    })
    .nullable(),
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
  .refine((ack) => primeNavigationTreeMatches(ack) && ack.meta.accountGeneration === ack.accountGeneration, {
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
export type WatchProgressEventKind = z.infer<
  typeof WatchProgressEventKindSchema
>;
export type WatchHistoryDeleteScope = z.infer<
  typeof WatchHistoryDeleteScopeSchema
>;
export type WatchCatalogLocaleContext = z.infer<
  typeof WatchCatalogLocaleContextSchema
>;
export type WatchCatalogEpisode = z.infer<typeof WatchCatalogEpisodeSchema>;
export type WatchCatalogSeason = z.infer<typeof WatchCatalogSeasonSchema>;
export type WatchCatalogSnapshotInput = z.infer<
  typeof WatchCatalogSnapshotInputSchema
>;
export type WatchCatalogBeginRequest = z.infer<
  typeof WatchCatalogBeginRequestSchema
>;
export type WatchCatalogBeginAck = z.infer<typeof WatchCatalogBeginAckSchema>;
export type WatchCatalogCommitRequest = z.infer<
  typeof WatchCatalogCommitRequestSchema
>;
export type WatchCatalogCommitAck = z.infer<typeof WatchCatalogCommitAckSchema>;
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
export type WatchHistoryCatalogProjection = z.infer<
  typeof WatchHistoryCatalogProjectionSchema
>;
export type WatchHistoryAggregate = z.infer<typeof WatchHistoryAggregateSchema>;
export type WatchHistorySeason = z.infer<typeof WatchHistorySeasonSchema>;
export type WatchHistoryLatestActivity = z.infer<
  typeof WatchHistoryLatestActivitySchema
>;
export type WatchHistoryItem = z.infer<typeof WatchHistoryItemSchema>;
export type WatchHistoryResponse = z.infer<typeof WatchHistoryResponseSchema>;
export type WatchHistoryEpisodePage = z.infer<
  typeof WatchHistoryEpisodePageSchema
>;
export type WatchHistoryTitleEpisodesResponse = z.infer<
  typeof WatchHistoryTitleEpisodesResponseSchema
>;
export type WatchProgressAck = z.infer<typeof WatchProgressAckSchema>;
export type WatchHistoryPreferences = z.infer<
  typeof WatchHistoryPreferencesSchema
>;
export type WatchHistoryPreferencesUpdate = z.infer<
  typeof WatchHistoryPreferencesUpdateSchema
>;
export type WatchHistoryPreferencesResponse = z.infer<
  typeof WatchHistoryPreferencesResponseSchema
>;
export type WatchHistoryRoomRecreationResponse = z.infer<
  typeof WatchHistoryRoomRecreationResponseSchema
>;
export type WatchHistoryDeletionRequest = z.infer<
  typeof WatchHistoryDeletionRequestSchema
>;
export type WatchHistoryDeletionAck = z.infer<
  typeof WatchHistoryDeletionAckSchema
>;
