import {
  createRoom,
  db,
  getRoomById,
  getUserById,
  isRoomMember,
  type RoomRow,
  type UserRow,
} from "./db";
import {
  getPlanEntitlements,
  roomCapabilitiesForPlan,
  type PlanCode,
} from "./plan-entitlements";
import {
  publicProfileFromRows,
  type ProfileRow,
  type PublicProfile,
} from "./social";

export type WatchProvider = "crunchyroll" | "netflix" | "youtube" | "amazon";
export type WatchItemKind = "series" | "movie";
export type WatchCheckpointKind =
  | "local"
  | "room"
  | "pause"
  | "seeked"
  | "ended"
  | "pagehide"
  | "reconcile"
  | "manual";

type WatchProgressKind = "movie" | "episode";

export type WatchProgressReconcileEntry = {
  provider: WatchProvider;
  kind: WatchProgressKind;
  itemId: string;
  itemTitle: string;
  contentId?: string;
  seriesId?: string;
  episodeId?: string;
  episodeTitle?: string;
  artworkUrl?: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  roomId?: string;
  watchedWithCount?: number;
  checkpointKind?: WatchCheckpointKind;
  observedAt?: string | number;
};

type CleanWatchProgressEntry = {
  provider: WatchProvider;
  itemKind: WatchItemKind;
  itemKey: string;
  itemTitle: string;
  contentId: string | null;
  seriesId: string | null;
  episodeKey: string;
  episodeTitle: string;
  sourceUrl: string;
  artworkUrl: string | null;
  currentTimeSeconds: number;
  durationSeconds: number;
  progress: number;
  roomId: string | null;
  watchedWithCount: number;
  checkpointKind: WatchCheckpointKind;
  observedAt: string;
};

type WatchSessionRow = {
  id: string;
  room_id: string | null;
  host_user_id: string;
  provider: WatchProvider;
  item_key: string;
  item_kind: WatchItemKind;
  item_title: string;
  content_id: string | null;
  series_id: string | null;
  episode_key: string;
  episode_title: string;
  source_url: string;
  artwork_url: string | null;
  duration_seconds: number;
  current_time_seconds: number;
  progress: number;
  started_at: string;
  ended_at: string | null;
  last_checkpoint_at: string;
  updated_at: string;
};

type WatchSessionParticipantRow = {
  session_id: string;
  user_id: string;
  role: "host" | "viewer";
  joined_at: string;
  left_at: string | null;
  current_time_seconds: number;
  progress: number;
  updated_at: string;
};

type UserTrackedTitleRow = {
  user_id: string;
  provider: WatchProvider;
  title_key: string;
  item_kind: WatchItemKind;
  item_title: string;
  source_url: string;
  artwork_url: string | null;
  active: boolean;
  archived_reason: string | null;
  latest_session_id: string | null;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
};

export type WatchLibraryParticipant = {
  user: PublicProfile;
  role: "host" | "viewer";
  currentTime: number;
  progress: number;
  joinedAt: string;
  leftAt: string | null;
  updatedAt: string;
};

export type WatchLibrarySession = {
  id: string;
  roomId: string | null;
  hostUserId: string;
  kind: "solo" | "shared";
  currentTime: number;
  duration: number;
  progress: number;
  startedAt: string;
  endedAt: string | null;
  lastWatchedAt: string;
  participants: WatchLibraryParticipant[];
};

export type WatchLibraryEpisode = {
  episodeKey: string;
  episodeTitle: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastWatchedAt: string;
  sessions: WatchLibrarySession[];
};

export type WatchLibraryItem = {
  provider: WatchProvider;
  itemKey: string;
  itemKind: WatchItemKind;
  itemTitle: string;
  sourceUrl: string;
  artworkUrl: string | null;
  active: boolean;
  lastWatchedAt: string;
  episodes: WatchLibraryEpisode[];
};

export type WatchLibraryResponse = {
  generatedAt: string;
  limits: {
    planCode: PlanCode;
    maxActiveTrackedTitles: number;
    activeTrackedTitleCount: number;
    historyRetentionDays: number;
    retainedSince: string;
  };
  items: WatchLibraryItem[];
};

export type WatchSessionRoomSource = {
  sessionId: string;
  showId: string;
  episodeId: string;
  sourceUrl: string;
  title: string;
  roomId: string | null;
};

export class WatchLibraryApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const PROVIDERS = new Set<WatchProvider>([
  "crunchyroll",
  "netflix",
  "youtube",
  "amazon",
]);
const CHECKPOINT_KINDS = new Set<WatchCheckpointKind>([
  "local",
  "room",
  "pause",
  "seeked",
  "ended",
  "pagehide",
  "reconcile",
  "manual",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOLO_SESSION_REUSE_MS = 12 * 60 * 60 * 1000;
const MAX_RECONCILE_ENTRIES = 100;

export function cleanWatchProgressEntry(value: unknown): CleanWatchProgressEntry | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<WatchProgressReconcileEntry>;
  const provider = cleanProvider(input.provider);
  const progressKind = input.kind === "episode" || input.kind === "movie" ? input.kind : null;
  const itemKey = cleanString(input.itemId, 220);
  const itemTitle = cleanString(input.itemTitle, 240);
  const sourceUrl = cleanHttpUrl(input.sourceUrl, 2000);
  if (!provider || !progressKind || !itemKey || !itemTitle || !sourceUrl) return null;

  const durationSeconds = normalizeSeconds(input.duration);
  const currentTimeSeconds = clampSeconds(input.currentTime, durationSeconds);
  const progress = durationSeconds > 0 ? currentTimeSeconds / durationSeconds : 0;
  const episodeKey =
    progressKind === "episode"
      ? cleanString(input.episodeId, 220) ??
        cleanString(input.contentId, 220) ??
        itemKey
      : itemKey;

  return {
    provider,
    itemKind: progressKind === "episode" ? "series" : "movie",
    itemKey,
    itemTitle,
    contentId: cleanString(input.contentId, 220) ?? null,
    seriesId: cleanString(input.seriesId, 220) ?? null,
    episodeKey,
    episodeTitle:
      cleanString(input.episodeTitle, 240) ??
      (progressKind === "episode" ? itemTitle : "Movie"),
    sourceUrl,
    artworkUrl: cleanHttpUrl(input.artworkUrl, 2000) ?? null,
    currentTimeSeconds,
    durationSeconds,
    progress: clampProgress(progress),
    roomId: cleanString(input.roomId, 160) ?? null,
    watchedWithCount: normalizeWatchedWithCount(input.watchedWithCount),
    checkpointKind: cleanCheckpointKind(input.checkpointKind),
    observedAt: cleanObservedAt(input.observedAt),
  };
}

export function cleanWatchProgressEntries(value: unknown): CleanWatchProgressEntry[] {
  const rawEntries =
    value && typeof value === "object" && Array.isArray((value as { entries?: unknown }).entries)
      ? (value as { entries: unknown[] }).entries
      : Array.isArray(value)
        ? value
        : [];

  return rawEntries
    .map((entry) => cleanWatchProgressEntry(entry))
    .filter((entry): entry is CleanWatchProgressEntry => entry !== null)
    .slice(0, MAX_RECONCILE_ENTRIES);
}

export function historyRetentionCutoff(now: Date, planCode: PlanCode): Date {
  const days = getPlanEntitlements(planCode).account.historyRetentionDays;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function reconcileWatchProgressBatch(params: {
  userId: string;
  entries: unknown;
}): Promise<WatchLibraryResponse> {
  const user = await getUserById(params.userId);
  if (!user) throw new WatchLibraryApiError(404, "User not found");

  const entries = cleanWatchProgressEntries(params.entries);
  for (const entry of entries) {
    await reconcileWatchProgressEntry(user, entry);
  }

  return listWatchLibrary(params.userId);
}

export async function listWatchLibrary(userId: string): Promise<WatchLibraryResponse> {
  const user = await getUserById(userId);
  if (!user) throw new WatchLibraryApiError(404, "User not found");

  const now = new Date();
  const entitlements = getPlanEntitlements(user.plan);
  const retainedSince = historyRetentionCutoff(now, user.plan).toISOString();

  const [{ data: trackedData, error: trackedError }, activeCount] = await Promise.all([
    db()
      .from("user_tracked_titles")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("last_watched_at", { ascending: false })
      .limit(entitlements.account.maxActiveTrackedTitles),
    countActiveTrackedTitles(userId),
  ]);
  if (trackedError) {
    throw new Error(`Failed to load tracked titles: ${trackedError.message}`);
  }

  const participantRows = await listViewerSessionParticipants(userId, retainedSince);
  const sessionIds = participantRows.map((row) => row.session_id);
  const sessions = await listWatchSessionsByIds(sessionIds);
  const allParticipants = await listParticipantsForSessions(sessionIds);
  const profiles = await publicProfilesForParticipants(allParticipants);

  return {
    generatedAt: now.toISOString(),
    limits: {
      planCode: entitlements.planCode,
      maxActiveTrackedTitles: entitlements.account.maxActiveTrackedTitles,
      activeTrackedTitleCount: activeCount,
      historyRetentionDays: entitlements.account.historyRetentionDays,
      retainedSince,
    },
    items: buildWatchLibraryItems({
      viewerUserId: userId,
      trackedTitles: (trackedData as UserTrackedTitleRow[] | null) ?? [],
      viewerParticipants: participantRows,
      sessions,
      allParticipants,
      profiles,
    }),
  };
}

export async function getWatchSessionRoomSourceForViewer(params: {
  userId: string;
  sessionId: string;
}): Promise<WatchSessionRoomSource> {
  if (!UUID_PATTERN.test(params.sessionId)) {
    throw new WatchLibraryApiError(400, "Invalid watch session");
  }

  const { data: participant, error: participantError } = await db()
    .from("watch_session_participants")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (participantError) {
    throw new Error(`Failed to load watch session participant: ${participantError.message}`);
  }
  if (!participant) throw new WatchLibraryApiError(404, "Watch session not found");

  const { data, error } = await db()
    .from("watch_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load watch session: ${error.message}`);
  if (!data) throw new WatchLibraryApiError(404, "Watch session not found");

  const session = data as WatchSessionRow;
  return {
    sessionId: session.id,
    showId: session.item_key,
    episodeId: session.episode_key,
    sourceUrl: session.source_url,
    title:
      session.item_kind === "series"
        ? `${session.item_title} - ${session.episode_title}`
        : session.item_title,
    roomId: session.room_id,
  };
}

export async function createRoomFromWatchSession(params: {
  userId: string;
  sessionId: string;
  clientRequestId?: string;
}): Promise<{ room: RoomRow; reused: boolean }> {
  const user = await getUserById(params.userId);
  if (!user) throw new WatchLibraryApiError(404, "User not found");

  const source = await getWatchSessionRoomSourceForViewer({
    userId: params.userId,
    sessionId: params.sessionId,
  });
  const capabilities = roomCapabilitiesForPlan(user.plan);
  return createRoom({
    hostUserId: params.userId,
    capabilities,
    showId: source.showId,
    episodeId: source.episodeId,
    sourceUrl: source.sourceUrl,
    title: source.title,
    clientRequestId: params.clientRequestId,
  });
}

async function reconcileWatchProgressEntry(
  user: UserRow,
  entry: CleanWatchProgressEntry
): Promise<void> {
  const room = entry.roomId ? await getVisibleRoomForProgress(user.id, entry.roomId) : null;
  const now = new Date().toISOString();
  const session = await upsertWatchSession({
    user,
    entry,
    room,
    now,
  });

  await Promise.all([
    upsertWatchSessionParticipant({
      sessionId: session.id,
      userId: user.id,
      role: room?.host_user_id === user.id ? "host" : room ? "viewer" : "host",
      entry,
      now,
    }),
    insertWatchCheckpoint({
      sessionId: session.id,
      userId: user.id,
      roomId: room?.room_id ?? null,
      entry,
    }),
    upsertTrackedTitle({
      user,
      entry,
      sessionId: session.id,
      now,
    }),
  ]);
}

async function getVisibleRoomForProgress(
  userId: string,
  roomId: string
): Promise<RoomRow | null> {
  const room = await getRoomById(roomId);
  if (!room) return null;
  if (room.host_user_id === userId) return room;
  return (await isRoomMember(roomId, userId)) ? room : null;
}

async function upsertWatchSession(params: {
  user: UserRow;
  entry: CleanWatchProgressEntry;
  room: RoomRow | null;
  now: string;
}): Promise<WatchSessionRow> {
  const existing = params.room
    ? await getLatestRoomWatchSession(params.room.room_id, params.entry)
    : await getReusableSoloWatchSession(params.user.id, params.entry);
  const payload = {
    room_id: params.room?.room_id ?? null,
    host_user_id: params.room?.host_user_id ?? params.user.id,
    provider: params.entry.provider,
    item_key: params.entry.itemKey,
    item_kind: params.entry.itemKind,
    item_title: params.entry.itemTitle,
    content_id: params.entry.contentId,
    series_id: params.entry.seriesId,
    episode_key: params.entry.episodeKey,
    episode_title: params.entry.episodeTitle,
    source_url: params.entry.sourceUrl,
    artwork_url: params.entry.artworkUrl,
    duration_seconds: params.entry.durationSeconds,
    current_time_seconds: params.entry.currentTimeSeconds,
    progress: params.entry.progress,
    last_checkpoint_at: params.entry.observedAt,
    updated_at: params.now,
    ...(params.entry.checkpointKind === "ended" ? { ended_at: params.now } : {}),
  };

  if (existing) {
    const { data, error } = await db()
      .from("watch_sessions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`Failed to update watch session: ${error.message}`);
    return data as WatchSessionRow;
  }

  const { data, error } = await db()
    .from("watch_sessions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create watch session: ${error.message}`);
  return data as WatchSessionRow;
}

async function getLatestRoomWatchSession(
  roomId: string,
  entry: CleanWatchProgressEntry
): Promise<WatchSessionRow | null> {
  const { data, error } = await db()
    .from("watch_sessions")
    .select("*")
    .eq("room_id", roomId)
    .eq("provider", entry.provider)
    .eq("item_key", entry.itemKey)
    .eq("episode_key", entry.episodeKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load room watch session: ${error.message}`);
  return (data as WatchSessionRow | null) ?? null;
}

async function getReusableSoloWatchSession(
  userId: string,
  entry: CleanWatchProgressEntry
): Promise<WatchSessionRow | null> {
  const { data, error } = await db()
    .from("watch_sessions")
    .select("*")
    .eq("host_user_id", userId)
    .is("room_id", null)
    .eq("provider", entry.provider)
    .eq("item_key", entry.itemKey)
    .eq("episode_key", entry.episodeKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load solo watch session: ${error.message}`);
  const session = (data as WatchSessionRow | null) ?? null;
  if (!session) return null;
  return Date.now() - new Date(session.updated_at).getTime() <= SOLO_SESSION_REUSE_MS
    ? session
    : null;
}

async function upsertWatchSessionParticipant(params: {
  sessionId: string;
  userId: string;
  role: "host" | "viewer";
  entry: CleanWatchProgressEntry;
  now: string;
}): Promise<void> {
  const { error } = await db()
    .from("watch_session_participants")
    .upsert(
      {
        session_id: params.sessionId,
        user_id: params.userId,
        role: params.role,
        left_at: null,
        current_time_seconds: params.entry.currentTimeSeconds,
        progress: params.entry.progress,
        updated_at: params.now,
      },
      { onConflict: "session_id,user_id" }
    );
  if (error) throw new Error(`Failed to upsert watch session participant: ${error.message}`);
}

async function insertWatchCheckpoint(params: {
  sessionId: string;
  userId: string;
  roomId: string | null;
  entry: CleanWatchProgressEntry;
}): Promise<void> {
  const { error } = await db().from("watch_progress_checkpoints").insert({
    session_id: params.sessionId,
    user_id: params.userId,
    room_id: params.roomId,
    kind: params.entry.checkpointKind,
    current_time_seconds: params.entry.currentTimeSeconds,
    duration_seconds: params.entry.durationSeconds,
    progress: params.entry.progress,
    observed_at: params.entry.observedAt,
  });
  if (error) throw new Error(`Failed to insert watch checkpoint: ${error.message}`);
}

async function upsertTrackedTitle(params: {
  user: UserRow;
  entry: CleanWatchProgressEntry;
  sessionId: string;
  now: string;
}): Promise<void> {
  const existing = await getTrackedTitle(params.user.id, params.entry);
  if (!existing || !existing.active) {
    await archiveOldestTrackedTitlesOverLimit(params.user.id, params.user.plan, params.entry);
  }

  const { error } = await db()
    .from("user_tracked_titles")
    .upsert(
      {
        user_id: params.user.id,
        provider: params.entry.provider,
        title_key: params.entry.itemKey,
        item_kind: params.entry.itemKind,
        item_title: params.entry.itemTitle,
        source_url: params.entry.sourceUrl,
        artwork_url: params.entry.artworkUrl,
        active: true,
        archived_reason: null,
        latest_session_id: params.sessionId,
        last_watched_at: params.now,
        updated_at: params.now,
      },
      { onConflict: "user_id,provider,title_key" }
    );
  if (error) throw new Error(`Failed to upsert tracked title: ${error.message}`);
}

async function getTrackedTitle(
  userId: string,
  entry: CleanWatchProgressEntry
): Promise<UserTrackedTitleRow | null> {
  const { data, error } = await db()
    .from("user_tracked_titles")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", entry.provider)
    .eq("title_key", entry.itemKey)
    .maybeSingle();
  if (error) throw new Error(`Failed to load tracked title: ${error.message}`);
  return (data as UserTrackedTitleRow | null) ?? null;
}

async function archiveOldestTrackedTitlesOverLimit(
  userId: string,
  planCode: PlanCode,
  entry: CleanWatchProgressEntry
): Promise<void> {
  const maxActive = getPlanEntitlements(planCode).account.maxActiveTrackedTitles;
  const { data, error } = await db()
    .from("user_tracked_titles")
    .select("provider,title_key")
    .eq("user_id", userId)
    .eq("active", true)
    .order("last_watched_at", { ascending: true });
  if (error) throw new Error(`Failed to count tracked titles: ${error.message}`);

  const activeRows = ((data as Array<Pick<UserTrackedTitleRow, "provider" | "title_key">> | null) ?? [])
    .filter((row) => !(row.provider === entry.provider && row.title_key === entry.itemKey));
  const archiveCount = activeRows.length - maxActive + 1;
  if (archiveCount <= 0) return;

  const rowsToArchive = activeRows.slice(0, archiveCount);
  for (const row of rowsToArchive) {
    const { error: archiveError } = await db()
      .from("user_tracked_titles")
      .update({
        active: false,
        archived_reason: "plan_limit",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", row.provider)
      .eq("title_key", row.title_key);
    if (archiveError) {
      throw new Error(`Failed to archive tracked title: ${archiveError.message}`);
    }
  }
}

async function countActiveTrackedTitles(userId: string): Promise<number> {
  const { count, error } = await db()
    .from("user_tracked_titles")
    .select("title_key", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error(`Failed to count active tracked titles: ${error.message}`);
  return count ?? 0;
}

async function listViewerSessionParticipants(
  userId: string,
  retainedSince: string
): Promise<WatchSessionParticipantRow[]> {
  const { data, error } = await db()
    .from("watch_session_participants")
    .select("*")
    .eq("user_id", userId)
    .gte("updated_at", retainedSince)
    .order("updated_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(`Failed to load watch participants: ${error.message}`);
  return (data as WatchSessionParticipantRow[] | null) ?? [];
}

async function listWatchSessionsByIds(sessionIds: string[]): Promise<WatchSessionRow[]> {
  const uniqueIds = Array.from(new Set(sessionIds));
  if (!uniqueIds.length) return [];
  const { data, error } = await db()
    .from("watch_sessions")
    .select("*")
    .in("id", uniqueIds);
  if (error) throw new Error(`Failed to load watch sessions: ${error.message}`);
  return (data as WatchSessionRow[] | null) ?? [];
}

async function listParticipantsForSessions(
  sessionIds: string[]
): Promise<WatchSessionParticipantRow[]> {
  const uniqueIds = Array.from(new Set(sessionIds));
  if (!uniqueIds.length) return [];
  const { data, error } = await db()
    .from("watch_session_participants")
    .select("*")
    .in("session_id", uniqueIds)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load watch session participants: ${error.message}`);
  return (data as WatchSessionParticipantRow[] | null) ?? [];
}

async function publicProfilesForParticipants(
  participants: WatchSessionParticipantRow[]
): Promise<Map<string, PublicProfile>> {
  const userIds = Array.from(new Set(participants.map((participant) => participant.user_id)));
  if (!userIds.length) return new Map();

  const [{ data: profileData, error: profileError }, { data: userData, error: userError }] =
    await Promise.all([
      db().from("profiles").select("*").in("user_id", userIds),
      db().from("users").select("*").in("id", userIds),
    ]);
  if (profileError) throw new Error(`Failed to load watch profiles: ${profileError.message}`);
  if (userError) throw new Error(`Failed to load watch users: ${userError.message}`);

  const profiles = new Map(
    ((profileData as ProfileRow[] | null) ?? []).map((profile) => [
      profile.user_id,
      profile,
    ])
  );
  const users = new Map(
    ((userData as UserRow[] | null) ?? []).map((user) => [user.id, user])
  );

  return new Map(
    userIds.map((userId) => [
      userId,
      publicProfileFromRows(userId, profiles.get(userId), users.get(userId)),
    ])
  );
}

function buildWatchLibraryItems(params: {
  viewerUserId: string;
  trackedTitles: UserTrackedTitleRow[];
  viewerParticipants: WatchSessionParticipantRow[];
  sessions: WatchSessionRow[];
  allParticipants: WatchSessionParticipantRow[];
  profiles: Map<string, PublicProfile>;
}): WatchLibraryItem[] {
  const sessionsById = new Map(params.sessions.map((session) => [session.id, session]));
  const viewerParticipantBySessionId = new Map(
    params.viewerParticipants.map((participant) => [participant.session_id, participant])
  );
  const participantsBySessionId = groupBy(params.allParticipants, (participant) =>
    participant.session_id
  );
  const itemMap = new Map<string, WatchLibraryItem>();

  for (const tracked of params.trackedTitles) {
    itemMap.set(itemMapKey(tracked.provider, tracked.title_key), {
      provider: tracked.provider,
      itemKey: tracked.title_key,
      itemKind: tracked.item_kind,
      itemTitle: tracked.item_title,
      sourceUrl: tracked.source_url,
      artworkUrl: tracked.artwork_url,
      active: tracked.active,
      lastWatchedAt: tracked.last_watched_at,
      episodes: [],
    });
  }

  for (const viewerParticipant of params.viewerParticipants) {
    const session = sessionsById.get(viewerParticipant.session_id);
    if (!session) continue;

    const key = itemMapKey(session.provider, session.item_key);
    const item = itemMap.get(key) ?? {
      provider: session.provider,
      itemKey: session.item_key,
      itemKind: session.item_kind,
      itemTitle: session.item_title,
      sourceUrl: session.source_url,
      artworkUrl: session.artwork_url,
      active: true,
      lastWatchedAt: viewerParticipant.updated_at,
      episodes: [],
    };

    const sessionParticipants = participantsBySessionId.get(session.id) ?? [];
    const librarySession: WatchLibrarySession = {
      id: session.id,
      roomId: session.room_id,
      hostUserId: session.host_user_id,
      kind: sessionParticipants.length > 1 ? "shared" : "solo",
      currentTime: viewerParticipant.current_time_seconds,
      duration: session.duration_seconds,
      progress: viewerParticipant.progress,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      lastWatchedAt: viewerParticipant.updated_at,
      participants: sessionParticipants.map((participant) => ({
        user:
          params.profiles.get(participant.user_id) ??
          publicProfileFromRows(participant.user_id, null, null),
        role: participant.role,
        currentTime: participant.current_time_seconds,
        progress: participant.progress,
        joinedAt: participant.joined_at,
        leftAt: participant.left_at,
        updatedAt: participant.updated_at,
      })),
    };

    const episode =
      item.episodes.find((candidate) => candidate.episodeKey === session.episode_key) ??
      null;
    if (episode) {
      episode.sessions.push(librarySession);
      if (viewerParticipant.updated_at > episode.lastWatchedAt) {
        episode.currentTime = viewerParticipant.current_time_seconds;
        episode.duration = session.duration_seconds;
        episode.progress = viewerParticipant.progress;
        episode.sourceUrl = session.source_url;
        episode.lastWatchedAt = viewerParticipant.updated_at;
      }
    } else {
      item.episodes.push({
        episodeKey: session.episode_key,
        episodeTitle: session.episode_title,
        sourceUrl: session.source_url,
        currentTime: viewerParticipant.current_time_seconds,
        duration: session.duration_seconds,
        progress: viewerParticipant.progress,
        lastWatchedAt: viewerParticipant.updated_at,
        sessions: [librarySession],
      });
    }

    if (viewerParticipant.updated_at > item.lastWatchedAt) {
      item.lastWatchedAt = viewerParticipant.updated_at;
      item.sourceUrl = session.source_url;
      item.artworkUrl = session.artwork_url ?? item.artworkUrl;
    }
    itemMap.set(key, item);
  }

  return Array.from(itemMap.values())
    .map((item) => ({
      ...item,
      episodes: item.episodes
        .map((episode) => ({
          ...episode,
          sessions: episode.sessions.sort((a, b) =>
            b.lastWatchedAt.localeCompare(a.lastWatchedAt)
          ),
        }))
        .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt)),
    }))
    .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt));
}

function itemMapKey(provider: WatchProvider, itemKey: string): string {
  return `${provider}:${itemKey}`;
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function cleanProvider(value: unknown): WatchProvider | null {
  return typeof value === "string" && PROVIDERS.has(value as WatchProvider)
    ? (value as WatchProvider)
    : null;
}

function cleanCheckpointKind(value: unknown): WatchCheckpointKind {
  return typeof value === "string" && CHECKPOINT_KINDS.has(value as WatchCheckpointKind)
    ? (value as WatchCheckpointKind)
    : "reconcile";
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function cleanHttpUrl(value: unknown, maxLength: number): string | null {
  const raw = cleanString(value, maxLength);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeSeconds(value: unknown): number {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds);
}

function clampSeconds(value: unknown, durationSeconds: number): number {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const safe = Math.floor(seconds);
  return durationSeconds > 0 ? Math.min(safe, durationSeconds) : safe;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeWatchedWithCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(50, Math.floor(count)));
}

function cleanObservedAt(value: unknown): string {
  const date =
    typeof value === "number" || typeof value === "string" ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}
