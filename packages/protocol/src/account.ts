import { z } from "zod";

export const ACCOUNT_RESPONSE_SCHEMA_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });
const DurableIdSchema = z.uuid();
const RoomIdSchema = z.string().trim().min(1).max(128);
const HttpUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);
const NullableHttpUrlSchema = HttpUrlSchema.nullable();
const PlaybackSecondsSchema = z.number().finite().nonnegative();
const PlaybackProgressSchema = z.number().finite().min(0).max(1);

export const AccountResponseMetaSchema = z.strictObject({
  serverTime: TimestampSchema,
  schemaVersion: z.literal(ACCOUNT_RESPONSE_SCHEMA_VERSION),
});

export const PublicProfileSchema = z.strictObject({
  userId: DurableIdSchema,
  handle: z.string().trim().min(3).max(24).nullable(),
  displayName: z.string().trim().min(1).max(80),
  avatarUrl: NullableHttpUrlSchema,
});

export const FriendshipStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "blocked",
  "removed",
]);

export const FriendshipDirectionSchema = z.enum([
  "incoming",
  "outgoing",
  "mutual",
  "blocked-by-me",
  "blocked-me",
]);

export const InviteRecipientStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const WatchProviderSchema = z.enum([
  "crunchyroll",
  "netflix",
  "youtube",
  "amazon",
]);
export const WatchItemKindSchema = z.enum(["series", "movie"]);
export const AccountPlanCodeSchema = z.enum(["free", "plus", "pro"]);

export const FriendListItemSchema = z.strictObject({
  friendshipId: DurableIdSchema,
  user: PublicProfileSchema,
  status: FriendshipStatusSchema,
  direction: FriendshipDirectionSchema,
  requestedAt: TimestampSchema,
  respondedAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
});

export const FriendGroupSchema = z.strictObject({
  id: DurableIdSchema,
  name: z.string().trim().min(1).max(80),
  archivedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  members: z
    .array(
      z.strictObject({
        user: PublicProfileSchema,
        addedAt: TimestampSchema,
      }),
    )
    .max(100),
});

export const FriendListResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  friends: z.array(FriendListItemSchema),
  incomingRequests: z.array(FriendListItemSchema),
  outgoingRequests: z.array(FriendListItemSchema),
  blocked: z.array(FriendListItemSchema),
});

export const FriendGroupsResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  groups: z.array(FriendGroupSchema),
});

export const RecentPersonSchema = z.strictObject({
  user: PublicProfileSchema,
  lastWatchedAt: TimestampSchema,
  sharedRoomCount: z.number().int().positive(),
});

export const RecentPeopleResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  people: z.array(RecentPersonSchema),
});

export const SocialDirectorySchema = z.strictObject({
  friends: z.array(FriendListItemSchema),
  incomingRequests: z.array(FriendListItemSchema),
  outgoingRequests: z.array(FriendListItemSchema),
  groups: z.array(FriendGroupSchema),
  recentPeople: z.array(RecentPersonSchema),
});

export const InviteTargetsSchema = z.strictObject({
  friends: z.array(FriendListItemSchema),
  groups: z.array(FriendGroupSchema),
});

export const RoomInviteSchema = z.strictObject({
  id: DurableIdSchema,
  roomId: RoomIdSchema,
  sender: PublicProfileSchema,
  targetKind: z.enum(["direct", "group"]),
  targetGroupId: DurableIdSchema.nullable(),
  message: z.string().trim().max(180).nullable(),
  roomTitle: z.string().trim().max(300).nullable(),
  sourceUrl: NullableHttpUrlSchema,
  videoFingerprint: z.string().trim().max(400).nullable(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
  recipients: z
    .array(
      z.strictObject({
        user: PublicProfileSchema,
        status: InviteRecipientStatusSchema,
        updatedAt: TimestampSchema,
        respondedAt: TimestampSchema.nullable(),
      }),
    )
    .max(100),
});

export const RoomInvitesResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  inbox: z.array(RoomInviteSchema),
  sent: z.array(RoomInviteSchema),
});

export const AcceptedRoomInviteResponseSchema = z.strictObject({
  invite: RoomInviteSchema,
  roomId: RoomIdSchema,
  joinUrl: HttpUrlSchema,
});

export const SocialSnapshotSchema = z.strictObject({
  directory: SocialDirectorySchema,
  invites: RoomInvitesResponseSchema,
});

export const WatchLibraryParticipantSchema = z.strictObject({
  user: PublicProfileSchema,
  role: z.enum(["host", "viewer"]),
  currentTime: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  joinedAt: TimestampSchema,
  leftAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema,
});

export const WatchLibrarySessionSchema = z.strictObject({
  id: DurableIdSchema,
  roomId: RoomIdSchema.nullable(),
  hostUserId: DurableIdSchema,
  kind: z.enum(["solo", "shared"]),
  currentTime: PlaybackSecondsSchema,
  duration: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  startedAt: TimestampSchema,
  endedAt: TimestampSchema.nullable(),
  lastWatchedAt: TimestampSchema,
  participants: z.array(WatchLibraryParticipantSchema),
});

export const WatchLibraryEpisodeSchema = z.strictObject({
  episodeKey: z.string().trim().min(1).max(220),
  episodeTitle: z.string().trim().min(1).max(300),
  seasonId: z.string().trim().min(1).max(220).nullable(),
  seasonTitle: z.string().trim().min(1).max(300).nullable(),
  seasonNumber: z.number().int().nonnegative().nullable(),
  sourceUrl: HttpUrlSchema,
  currentTime: PlaybackSecondsSchema,
  duration: PlaybackSecondsSchema,
  progress: PlaybackProgressSchema,
  lastWatchedAt: TimestampSchema,
  sessions: z.array(WatchLibrarySessionSchema),
});

export const WatchLibraryItemSchema = z.strictObject({
  provider: WatchProviderSchema,
  itemKey: z.string().trim().min(1).max(220),
  itemKind: WatchItemKindSchema,
  itemTitle: z.string().trim().min(1).max(300),
  sourceUrl: HttpUrlSchema,
  artworkUrl: NullableHttpUrlSchema,
  active: z.boolean(),
  lastWatchedAt: TimestampSchema,
  episodes: z.array(WatchLibraryEpisodeSchema),
});

export const WatchLibraryLimitsSchema = z.strictObject({
  planCode: AccountPlanCodeSchema,
  maxActiveTrackedTitles: z.number().int().nonnegative(),
  activeTrackedTitleCount: z.number().int().nonnegative(),
  historyRetentionDays: z.number().int().nonnegative(),
  retainedSince: TimestampSchema,
});

export const WatchLibraryResponseSchema = z.strictObject({
  meta: AccountResponseMetaSchema,
  generatedAt: TimestampSchema,
  limits: WatchLibraryLimitsSchema,
  items: z.array(WatchLibraryItemSchema),
});

export type AccountResponseMeta = z.infer<typeof AccountResponseMetaSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;
export type FriendshipDirection = z.infer<typeof FriendshipDirectionSchema>;
export type InviteRecipientStatus = z.infer<typeof InviteRecipientStatusSchema>;
export type WatchProvider = z.infer<typeof WatchProviderSchema>;
export type WatchItemKind = z.infer<typeof WatchItemKindSchema>;
export type AccountPlanCode = z.infer<typeof AccountPlanCodeSchema>;
export type FriendListItem = z.infer<typeof FriendListItemSchema>;
export type FriendGroup = z.infer<typeof FriendGroupSchema>;
export type FriendListResponse = z.infer<typeof FriendListResponseSchema>;
export type FriendGroupsResponse = z.infer<typeof FriendGroupsResponseSchema>;
export type RecentPerson = z.infer<typeof RecentPersonSchema>;
export type RecentPeopleResponse = z.infer<typeof RecentPeopleResponseSchema>;
export type SocialDirectory = z.infer<typeof SocialDirectorySchema>;
export type InviteTargets = z.infer<typeof InviteTargetsSchema>;
export type RoomInvite = z.infer<typeof RoomInviteSchema>;
export type RoomInvitesResponse = z.infer<typeof RoomInvitesResponseSchema>;
export type AcceptedRoomInviteResponse = z.infer<
  typeof AcceptedRoomInviteResponseSchema
>;
export type SocialSnapshot = z.infer<typeof SocialSnapshotSchema>;
export type WatchLibraryParticipant = z.infer<typeof WatchLibraryParticipantSchema>;
export type WatchLibrarySession = z.infer<typeof WatchLibrarySessionSchema>;
export type WatchLibraryEpisode = z.infer<typeof WatchLibraryEpisodeSchema>;
export type WatchLibraryItem = z.infer<typeof WatchLibraryItemSchema>;
export type WatchLibraryLimits = z.infer<typeof WatchLibraryLimitsSchema>;
export type WatchLibraryResponse = z.infer<typeof WatchLibraryResponseSchema>;
