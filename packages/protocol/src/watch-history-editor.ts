import { z } from "zod";
import { WatchHistoryResponseMetaSchema } from "./watch-history";

import { historyEpisodeSourceMatches, historyKeyMatchesProvider } from "./history-provider-validation";

const Key = z.string().min(1).max(220);
const Provider = z.enum(["crunchyroll", "youtube", "netflix"]);
const Revision = z.string().regex(/^[a-f0-9]{32}$/);
export const WATCH_HISTORY_EDITOR_LIMIT = 2000;

export const WatchHistoryEditorQuerySchema = z.strictObject({
  provider: Provider, titleKey: Key, accountGeneration: z.number().int().positive(),
}).superRefine((value, context) => {
  if (!historyKeyMatchesProvider(value.provider, value.titleKey, ["series", "movie", "video"]))
    context.addIssue({ code: "custom", message: "Editor query must match provider" });
});
export const WatchHistoryEditRequestSchema = WatchHistoryEditorQuerySchema.safeExtend({
  clientMutationId: z.uuid(), revision: Revision,
  changes: z.array(z.strictObject({ episodeKey: Key, watched: z.boolean() }))
    .min(1).max(WATCH_HISTORY_EDITOR_LIMIT),
}).superRefine((value, ctx) => {
  if (!historyKeyMatchesProvider(value.provider, value.titleKey, ["series", "movie", "video"]) ||
    value.changes.some(change => !historyKeyMatchesProvider(value.provider, change.episodeKey, ["episode", "movie", "video"]) ||
      (value.provider === "netflix" && (value.titleKey.startsWith("netflix:movie:") ? change.episodeKey !== value.titleKey : !change.episodeKey.startsWith("netflix:episode:")))))
    ctx.addIssue({ code: "custom", message: "Edit identities must match provider and title" });
  if (new Set(value.changes.map(change => change.episodeKey)).size !== value.changes.length)
    ctx.addIssue({ code: "custom", message: "Duplicate episode change" });
});
export const WatchHistoryEditorEpisodeSchema = z.strictObject({
  episodeKey: Key, episodeTitle: z.string().min(1).max(300),
  episodeNumber: z.number().finite().nonnegative().nullable(),
  seasonKey: Key.nullable(), seasonTitle: z.string().max(300).nullable(),
  seasonNumber: z.number().int().nonnegative().nullable(),
  seasonOrder: z.number().int().nonnegative(), order: z.number().finite().nonnegative(),
  sourceUrl: z.url().max(2048), available: z.boolean(), watched: z.boolean(),
  currentTime: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(),
  progress: z.number().finite().min(0).max(1),
});
export const WatchHistoryEditorResponseSchema = z.strictObject({
  meta: WatchHistoryResponseMetaSchema,
  provider: Provider, titleKey: Key, revision: Revision, catalogComplete: z.boolean(),
  episodes: z.array(WatchHistoryEditorEpisodeSchema).min(1).max(WATCH_HISTORY_EDITOR_LIMIT),
}).superRefine((value, ctx) => {
  if (new Set(value.episodes.map(episode => episode.episodeKey)).size !== value.episodes.length)
    ctx.addIssue({ code: "custom", message: "Duplicate editor episode" });
  if (!historyKeyMatchesProvider(value.provider, value.titleKey, ["series", "movie", "video"]))
    ctx.addIssue({ code: "custom", message: "Editor title must match provider" });
  for (const episode of value.episodes) {
    if (!historyEpisodeSourceMatches(value.provider, episode) ||
      (value.provider === "youtube" && !/^[\w-]{11}$/.test(new URL(episode.sourceUrl).searchParams.get("v") ?? "")) ||
      (value.provider === "netflix" && (value.titleKey.startsWith("netflix:movie:")
        ? episode.episodeKey !== value.titleKey || episode.seasonTitle !== null || episode.seasonNumber !== null || episode.episodeNumber !== null
        : !episode.episodeKey.startsWith("netflix:episode:"))))
      ctx.addIssue({ code: "custom", message: "Invalid episode source or identity" });
  }
});
export const WatchHistoryEditAckSchema = z.strictObject({
  meta: WatchHistoryResponseMetaSchema, clientMutationId: z.uuid(), revision: Revision,
});
export type WatchHistoryEditorQuery = z.infer<typeof WatchHistoryEditorQuerySchema>;
export type WatchHistoryEditRequest = z.infer<typeof WatchHistoryEditRequestSchema>;
export type WatchHistoryEditorResponse = z.infer<typeof WatchHistoryEditorResponseSchema>;
export type WatchHistoryEditorEpisode = z.infer<typeof WatchHistoryEditorEpisodeSchema>;
export type WatchHistoryEditAck = z.infer<typeof WatchHistoryEditAckSchema>;
