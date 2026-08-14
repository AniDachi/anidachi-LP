import {
  WatchHistoryCursorSchema,
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryResponseSchema,
  WatchHistorySessionSchema,
  WatchProgressAckSchema,
  WatchProgressEventSchema,
  type WatchHistoryCursor,
  type WatchHistoryDeletionAck,
  type WatchHistoryDeletionRequest,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryPreferencesUpdate,
  type WatchHistoryResponse,
  type WatchHistorySession,
  type WatchProgressAck,
  type WatchProgressEvent,
  type WatchSharedRoomAuthority,
} from "@anidachi/protocol";
import { db } from "./db";
import {
  verifyWatchHistoryAuthority,
  type ValidatedWatchHistoryAuthority,
} from "./watch-history-authority";

const MAX_CURSOR_CHARS = 512;
const MAX_SESSION_IDS = 2_000;
const MVP_PROVIDERS = new Set(["crunchyroll", "youtube"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WatchHistoryProgressRow = {
  user_id: string;
  provider: "crunchyroll" | "youtube";
  title_key: string;
  episode_key: string;
  item_kind: "series" | "movie";
  title: string;
  artwork_url: string | null;
  episode_title: string;
  season_key: string | null;
  season_title: string | null;
  season_number: number | null;
  episode_number: number | null;
  source_url: string;
  current_time: number;
  duration: number;
  progress: number;
  completed_at: string | null;
  latest_session_id: string | null;
  observed_at: string;
  history_generation: number;
};

type SessionDatabaseRow = {
  id: string;
  provider: "crunchyroll" | "youtube";
  item_key: string;
  episode_key: string;
  room_id: string | null;
  room_generation: number | null;
  host_user_id: string;
  source_generation: number | null;
  current_time_seconds: number;
  duration_seconds: number;
  progress: number;
  started_at: string;
  ended_at: string | null;
  last_checkpoint_at: string;
};

type WatchHistorySessionRecord = {
  session: WatchHistorySession;
  provider: "crunchyroll" | "youtube" | null;
  titleKey: string | null;
  episodeKey: string | null;
};

type ParticipantDatabaseRow = {
  session_id: string;
  user_id: string;
  role: "host" | "viewer";
  current_time_seconds: number;
  progress: number;
  joined_at: string;
  left_at: string | null;
  updated_at: string;
};

export type WatchHistoryV2Store = {
  applyProgress(
    userId: string,
    event: Record<string, unknown>,
    authority: ValidatedWatchHistoryAuthority | null,
  ): Promise<unknown>;
  loadHistory(userId: string): Promise<{
    accountGeneration: number;
    progressRows: unknown[];
    sessions: unknown[];
  }>;
  getPreferences(userId: string): Promise<{
    accountGeneration: number;
    youtubeHistoryEnabled: boolean;
  }>;
  setPreferences(userId: string, preferences: WatchHistoryPreferencesUpdate): Promise<unknown>;
  deleteHistory(userId: string, request: WatchHistoryDeletionRequest): Promise<unknown>;
  getRoomSource(userId: string, sessionId: string): Promise<WatchHistoryV2RoomSource | null>;
};

export type WatchHistoryV2RoomSource = {
  sessionId: string;
  showId: string;
  episodeId: string;
  sourceUrl: string;
  title: string;
};

export class WatchHistoryV2ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function parseWatchProgressEventV2(input: unknown): WatchProgressEvent {
  const parsed = WatchProgressEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new WatchHistoryV2ApiError(400, "INVALID_REQUEST", "Invalid watch progress event");
  }
  if (!MVP_PROVIDERS.has(parsed.data.provider)) {
    throw new WatchHistoryV2ApiError(400, "UNSUPPORTED_PROVIDER", "Provider is not supported");
  }

  let url: URL;
  try {
    url = new URL(parsed.data.sourceUrl);
  } catch {
    throw new WatchHistoryV2ApiError(400, "PROVIDER_DOMAIN_MISMATCH", "Provider source is invalid");
  }
  const validOrigin =
    (parsed.data.provider === "crunchyroll" &&
      url.origin === "https://www.crunchyroll.com" &&
      url.pathname.startsWith("/watch/")) ||
    (parsed.data.provider === "youtube" &&
      url.origin === "https://www.youtube.com" &&
      url.pathname === "/watch" &&
      url.searchParams.has("v"));
  if (!validOrigin) {
    throw new WatchHistoryV2ApiError(
      400,
      "PROVIDER_DOMAIN_MISMATCH",
      "Provider source does not match the event",
    );
  }
  return parsed.data;
}

export async function applyWatchProgressV2(params: {
  userId: string;
  input: unknown;
  store?: WatchHistoryV2Store;
  verifyAuthority?: (params: {
    authenticatedUserId: string;
    authority: WatchSharedRoomAuthority;
  }) => Promise<ValidatedWatchHistoryAuthority>;
}): Promise<WatchProgressAck> {
  const event = parseWatchProgressEventV2(params.input);
  let validatedAuthority: ValidatedWatchHistoryAuthority | null = null;
  if (event.sharedRoom) {
    try {
      validatedAuthority = await (params.verifyAuthority ?? verifyWatchHistoryAuthority)({
        authenticatedUserId: params.userId,
        authority: event.sharedRoom,
      });
    } catch {
      throw new WatchHistoryV2ApiError(403, "INVALID_AUTHORITY", "Shared room authority is invalid");
    }
  }

  const rpcEvent: Record<string, unknown> = event.sharedRoom
    ? {
        ...event,
        sharedRoom: {
          roomId: event.sharedRoom.roomId,
          participantSessionId: event.sharedRoom.participantSessionId,
          roomGeneration: event.sharedRoom.roomGeneration,
          sourceGeneration: event.sharedRoom.sourceGeneration,
        },
      }
    : event;

  try {
    const value = await (params.store ?? supabaseWatchHistoryV2Store).applyProgress(
      params.userId,
      rpcEvent,
      validatedAuthority,
    );
    const parsed = WatchProgressAckSchema.safeParse(value);
    if (!parsed.success || parsed.data.meta.ownerUserId !== params.userId) {
      throw new WatchHistoryV2ApiError(
        502,
        "INVALID_DATABASE_RESPONSE",
        "Watch history response is invalid",
      );
    }
    return parsed.data;
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export async function listWatchHistoryV2(params: {
  userId: string;
  limit?: number;
  cursor?: WatchHistoryCursor | null;
  store?: WatchHistoryV2Store;
  now?: Date;
}): Promise<WatchHistoryResponse> {
  try {
    const snapshot = await (params.store ?? supabaseWatchHistoryV2Store).loadHistory(params.userId);
    return buildWatchHistoryV2Response({
      userId: params.userId,
      accountGeneration: snapshot.accountGeneration,
      progressRows: snapshot.progressRows,
      sessions: snapshot.sessions,
      limit: params.limit ?? 50,
      cursor: params.cursor,
      generatedAt: params.now ?? new Date(),
    });
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export function buildWatchHistoryV2Response(params: {
  userId: string;
  accountGeneration: number;
  progressRows: unknown[];
  sessions: unknown[];
  limit: number;
  cursor?: WatchHistoryCursor | null;
  generatedAt: Date;
}): WatchHistoryResponse {
  if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100) {
    throw new WatchHistoryV2ApiError(400, "INVALID_LIMIT", "History limit must be from 1 to 100");
  }
  if (!Number.isInteger(params.accountGeneration) || params.accountGeneration < 1) {
    throw new WatchHistoryV2ApiError(
      502,
      "INVALID_DATABASE_RESPONSE",
      "Watch history response is invalid",
    );
  }

  const rows = params.progressRows.map(parseProgressRow);
  if (
    rows.some(
      (row) =>
        row.user_id !== params.userId || row.history_generation !== params.accountGeneration,
    )
  ) {
    throw new WatchHistoryV2ApiError(
      502,
      "INVALID_DATABASE_RESPONSE",
      "Watch history response is invalid",
    );
  }
  const sessionRecords = params.sessions.map(parseHistorySessionRecord);
  const groups = new Map<string, WatchHistoryProgressRow[]>();
  for (const row of rows) {
    const stableId = `${row.provider}:${row.title_key}`;
    const group = groups.get(stableId) ?? [];
    group.push(row);
    groups.set(stableId, group);
  }

  const summaries = Array.from(groups.entries()).map(([stableId, titleRows]) => {
    titleRows.sort(compareEpisodeRows);
    const latest = [...titleRows].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]!;
    const seasonRows = new Map<string, WatchHistoryProgressRow[]>();
    if (latest.item_kind === "series") {
      for (const row of titleRows) {
        const seasonKey = row.season_key ?? "observed";
        const group = seasonRows.get(seasonKey) ?? [];
        group.push(row);
        seasonRows.set(seasonKey, group);
      }
    }
    const latestSessionIds = new Set(
      titleRows.flatMap((row) => (row.latest_session_id ? [row.latest_session_id] : [])),
    );
    const titleSessions = sessionRecords
      .filter(
        (record) =>
          (record.provider === latest.provider && record.titleKey === latest.title_key) ||
          (record.provider === null && latestSessionIds.has(record.session.id)),
      )
      .map((record) => record.session)
      .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
      .slice(0, 20);
    const completedEpisodes = titleRows.filter((row) => row.completed_at !== null).length;

    return {
      cursor: { lastWatchedAt: latest.observed_at, stableId },
      item: {
        provider: latest.provider,
        titleKey: latest.title_key,
        itemKind: latest.item_kind,
        title: latest.title,
        sourceUrl: latest.source_url,
        artworkUrl: latest.artwork_url,
        catalogState: "unavailable" as const,
        aggregate: {
          completedEpisodes,
          availableEpisodes: null,
          progress: null,
        },
        seasons: Array.from(seasonRows.entries())
          .map(([seasonKey, observedRows], order) => {
            const first = observedRows[0]!;
            const observedCompleted = observedRows.filter((row) => row.completed_at !== null).length;
            return {
              seasonKey,
              seasonTitle: first.season_title ?? "Observed episodes",
              seasonNumber: first.season_number,
              order,
              aggregate: {
                completedEpisodes: observedCompleted,
                availableEpisodes: null,
                progress: null,
              },
              episodes: observedRows.map((row) => ({
                episodeKey: row.episode_key,
                episodeTitle: row.episode_title,
                seasonKey: row.season_key,
                seasonTitle: row.season_title,
                seasonNumber: row.season_number,
                episodeNumber: row.episode_number,
                sourceUrl: row.source_url,
                currentTime: row.current_time,
                duration: row.duration,
                progress: row.progress,
                completedAt: row.completed_at,
                lastWatchedAt: row.observed_at,
                sessions: sessionRecords
                  .filter(
                    (record) =>
                      (record.provider === row.provider &&
                        record.titleKey === row.title_key &&
                        record.episodeKey === row.episode_key) ||
                      (record.provider === null && record.session.id === row.latest_session_id),
                  )
                  .map((record) => record.session)
                  .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
                  .slice(0, 20),
              })),
              nextEpisode: null,
            };
          })
          .sort((a, b) =>
            (a.seasonNumber ?? Number.MAX_SAFE_INTEGER) -
              (b.seasonNumber ?? Number.MAX_SAFE_INTEGER) ||
            a.seasonKey.localeCompare(b.seasonKey),
          )
          .map((season, order) => ({ ...season, order })),
        sessions: titleSessions,
        latestActivity: {
          episodeKey: latest.episode_key,
          currentTime: latest.current_time,
          duration: latest.duration,
          progress: latest.progress,
          completedAt: latest.completed_at,
          lastWatchedAt: latest.observed_at,
        },
        lastWatchedAt: latest.observed_at,
      },
    };
  });

  summaries.sort(
    (a, b) =>
      b.cursor.lastWatchedAt.localeCompare(a.cursor.lastWatchedAt) ||
      a.cursor.stableId.localeCompare(b.cursor.stableId),
  );
  const start = params.cursor
    ? summaries.findIndex(
        (summary) =>
          summary.cursor.lastWatchedAt < params.cursor!.lastWatchedAt ||
          (summary.cursor.lastWatchedAt === params.cursor!.lastWatchedAt &&
            summary.cursor.stableId > params.cursor!.stableId),
      )
    : 0;
  const pageStart = start < 0 ? summaries.length : start;
  const page = summaries.slice(pageStart, pageStart + params.limit);
  const hasMore = pageStart + page.length < summaries.length;
  const response = {
    meta: {
      serverTime: params.generatedAt.toISOString(),
      schemaVersion: 2 as const,
      ownerUserId: params.userId,
      accountGeneration: params.accountGeneration,
    },
    generatedAt: params.generatedAt.toISOString(),
    totalTitleCount: summaries.length,
    items: page.map((summary) => summary.item),
    nextCursor: hasMore && page.length > 0 ? page.at(-1)!.cursor : null,
  };
  const parsed = WatchHistoryResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new WatchHistoryV2ApiError(
      502,
      "INVALID_DATABASE_RESPONSE",
      "Watch history response is invalid",
    );
  }
  return parsed.data;
}

export function encodeWatchHistoryCursor(cursor: WatchHistoryCursor): string {
  const parsed = WatchHistoryCursorSchema.parse(cursor);
  return Buffer.from(
    JSON.stringify([parsed.lastWatchedAt, parsed.stableId]),
    "utf8",
  ).toString("base64url");
}

export function decodeWatchHistoryCursor(value: string): WatchHistoryCursor {
  try {
    if (
      value.length < 1 ||
      value.length > MAX_CURSOR_CHARS ||
      !/^[A-Za-z0-9_-]+$/.test(value)
    ) {
      throw new Error("invalid");
    }
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) throw new Error("invalid");
    return WatchHistoryCursorSchema.parse({
      lastWatchedAt: decoded[0],
      stableId: decoded[1],
    });
  } catch {
    throw new WatchHistoryV2ApiError(400, "INVALID_CURSOR", "History cursor is invalid");
  }
}

export async function getWatchHistoryPreferencesV2(params: {
  userId: string;
  store?: WatchHistoryV2Store;
  now?: Date;
}): Promise<WatchHistoryPreferencesResponse> {
  try {
    const value = await (params.store ?? supabaseWatchHistoryV2Store).getPreferences(params.userId);
    return WatchHistoryPreferencesResponseSchema.parse({
      meta: {
        serverTime: (params.now ?? new Date()).toISOString(),
        schemaVersion: 2,
        ownerUserId: params.userId,
        accountGeneration: value.accountGeneration,
      },
      preferences: { youtubeHistoryEnabled: value.youtubeHistoryEnabled },
    });
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export async function updateWatchHistoryPreferencesV2(params: {
  userId: string;
  input: unknown;
  store?: WatchHistoryV2Store;
}): Promise<WatchHistoryPreferencesResponse> {
  const parsedInput = WatchHistoryPreferencesUpdateSchema.safeParse(params.input);
  if (!parsedInput.success) {
    throw new WatchHistoryV2ApiError(400, "INVALID_REQUEST", "Invalid watch history preferences");
  }
  try {
    const value = await (params.store ?? supabaseWatchHistoryV2Store).setPreferences(
      params.userId,
      parsedInput.data,
    );
    const response = WatchHistoryPreferencesResponseSchema.safeParse(value);
    if (!response.success || response.data.meta.ownerUserId !== params.userId) {
      throw new WatchHistoryV2ApiError(
        502,
        "INVALID_DATABASE_RESPONSE",
        "Watch history response is invalid",
      );
    }
    return response.data;
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export async function deleteWatchHistoryV2(params: {
  userId: string;
  input: unknown;
  store?: WatchHistoryV2Store;
}): Promise<WatchHistoryDeletionAck> {
  const request = WatchHistoryDeletionRequestSchema.safeParse(params.input);
  if (!request.success || !MVP_PROVIDERS.has(request.data.target.scope === "all" ? "crunchyroll" : request.data.target.provider)) {
    throw new WatchHistoryV2ApiError(400, "INVALID_REQUEST", "Invalid watch history deletion");
  }
  try {
    const value = await (params.store ?? supabaseWatchHistoryV2Store).deleteHistory(
      params.userId,
      request.data,
    );
    const response = WatchHistoryDeletionAckSchema.safeParse(value);
    if (!response.success || response.data.meta.ownerUserId !== params.userId) {
      throw new WatchHistoryV2ApiError(
        502,
        "INVALID_DATABASE_RESPONSE",
        "Watch history response is invalid",
      );
    }
    return response.data;
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export const supabaseWatchHistoryV2Store: WatchHistoryV2Store = {
  async applyProgress(userId, event, authority) {
    const result = await db().rpc("apply_watch_progress_v2", {
      p_user_id: userId,
      p_event: event,
      p_room_authority: authority,
    });
    if (result.error) throw result.error;
    return result.data;
  },

  async loadHistory(userId) {
    const preferences = await this.getPreferences(userId);
    const progressResult = await db()
      .from("watch_episode_progress")
      .select(
        "user_id,provider,title_key,episode_key,item_kind,title,artwork_url,episode_title,season_key,season_title,season_number,episode_number,source_url,current_time,duration,progress,completed_at,latest_session_id,observed_at,history_generation",
      )
      .eq("user_id", userId)
      .eq("history_generation", preferences.accountGeneration)
      .order("observed_at", { ascending: false });
    if (progressResult.error) throw progressResult.error;
    const progressRows = (progressResult.data as unknown[] | null) ?? [];
    progressRows.forEach(parseProgressRow);
    const ownerSessionsResult = await db()
      .from("watch_session_participants")
      .select("session_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_SESSION_IDS);
    if (ownerSessionsResult.error) throw ownerSessionsResult.error;
    const sessionIds = Array.from(
      new Set(
        ((ownerSessionsResult.data as Array<{ session_id?: unknown }> | null) ?? []).map(
          (row) => {
            if (!isUuid(row.session_id)) throw invalidDatabaseResponse();
            return row.session_id;
          },
        ),
      ),
    );
    const sessions = sessionIds.length > 0 ? await loadCanonicalSessions(userId, sessionIds) : [];
    return {
      accountGeneration: preferences.accountGeneration,
      progressRows,
      sessions,
    };
  },

  async getPreferences(userId) {
    const insertResult = await db()
      .from("user_watch_settings")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (insertResult.error) throw insertResult.error;
    const result = await db()
      .from("user_watch_settings")
      .select("history_generation,youtube_history_enabled")
      .eq("user_id", userId)
      .single();
    if (result.error) throw result.error;
    if (
      !isRecord(result.data) ||
      !isPositiveInteger(result.data.history_generation) ||
      typeof result.data.youtube_history_enabled !== "boolean"
    ) {
      throw invalidDatabaseResponse();
    }
    return {
      accountGeneration: result.data.history_generation,
      youtubeHistoryEnabled: result.data.youtube_history_enabled,
    };
  },

  async setPreferences(userId, preferences) {
    const result = await db().rpc("set_watch_preferences_v2", {
      p_user_id: userId,
      p_preferences: preferences,
    });
    if (result.error) throw result.error;
    return result.data;
  },

  async deleteHistory(userId, request) {
    const result = await db().rpc("delete_watch_history_v2", {
      p_user_id: userId,
      p_request: request,
    });
    if (result.error) throw result.error;
    return result.data;
  },

  async getRoomSource(userId, sessionId) {
    const participant = await db()
      .from("watch_session_participants")
      .select("session_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!participant.data) return null;
    const result = await db()
      .from("watch_sessions")
      .select("id,item_key,episode_key,source_url,item_title,episode_title,schema_version")
      .eq("id", sessionId)
      .eq("schema_version", 2)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!isRecord(result.data)) return null;
    const row = result.data;
    if (
      !isUuid(row.id) ||
      !isBoundedString(row.item_key, 220) ||
      !isBoundedString(row.episode_key, 220) ||
      !isHttpsUrl(row.source_url, 2048) ||
      !isBoundedString(row.item_title, 300) ||
      !isBoundedString(row.episode_title, 300) ||
      row.schema_version !== 2
    ) {
      return null;
    }
    return {
      sessionId: row.id,
      showId: row.item_key,
      episodeId: row.episode_key,
      sourceUrl: row.source_url,
      title: `${row.item_title} - ${row.episode_title}`,
    };
  },
};

async function loadCanonicalSessions(
  userId: string,
  sessionIds: string[],
): Promise<WatchHistorySessionRecord[]> {
  const participantResult = await db()
    .from("watch_session_participants")
    .select("session_id,user_id,role,current_time_seconds,progress,joined_at,left_at,updated_at")
    .in("session_id", sessionIds);
  if (participantResult.error) throw participantResult.error;
  const participantRows = ((participantResult.data as unknown[] | null) ?? []).map(
    parseParticipantDatabaseRow,
  );
  const visibleSessionIds = new Set(
    participantRows.filter((row) => row.user_id === userId).map((row) => row.session_id),
  );
  const boundedIds = sessionIds.filter((id) => visibleSessionIds.has(id));
  if (boundedIds.length === 0) return [];
  const sessionResult = await db()
    .from("watch_sessions")
    .select(
      "id,provider,item_key,episode_key,room_id,room_generation,host_user_id,source_generation,current_time_seconds,duration_seconds,progress,started_at,ended_at,last_checkpoint_at",
    )
    .in("id", boundedIds)
    .eq("schema_version", 2);
  if (sessionResult.error) throw sessionResult.error;
  const sessionRows = ((sessionResult.data as unknown[] | null) ?? []).map(
    parseSessionDatabaseRow,
  );
  const participantUserIds = Array.from(
    new Set(
      participantRows
        .filter((row) => visibleSessionIds.has(row.session_id))
        .map((row) => row.user_id),
    ),
  );
  const [usersResult, profilesResult] = await Promise.all([
    db().from("users").select("id,display_name,avatar_url").in("id", participantUserIds),
    db().from("profiles").select("user_id,handle,display_name,avatar_url").in("user_id", participantUserIds),
  ]);
  if (usersResult.error) throw usersResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const users = new Map(
    ((usersResult.data as Array<Record<string, unknown>> | null) ?? []).map((row) => [row.id, row]),
  );
  const profiles = new Map(
    ((profilesResult.data as Array<Record<string, unknown>> | null) ?? []).map((row) => [row.user_id, row]),
  );
  return sessionRows.map((row) => {
    const participants = participantRows
      .filter((participant) => participant.session_id === row.id)
      .map((participant) => {
        const user = users.get(participant.user_id);
        const profile = profiles.get(participant.user_id);
        const displayName = profile?.display_name ?? user?.display_name;
        if (typeof displayName !== "string") throw invalidDatabaseResponse();
        return {
          user: {
            userId: participant.user_id,
            handle: typeof profile?.handle === "string" ? profile.handle : null,
            displayName,
            avatarUrl:
              typeof profile?.avatar_url === "string"
                ? profile.avatar_url
                : typeof user?.avatar_url === "string"
                  ? user.avatar_url
                  : null,
          },
          role: participant.role,
          currentTime: participant.current_time_seconds,
          progress: participant.progress,
          joinedAt: participant.joined_at,
          leftAt: participant.left_at,
          updatedAt: participant.updated_at,
        };
      });
    const session = WatchHistorySessionSchema.parse({
      id: row.id,
      roomId: row.room_id,
      roomGeneration: row.room_generation,
      hostUserId: row.host_user_id,
      kind: row.room_id === null ? "solo" : "shared",
      sourceGeneration: row.source_generation,
      currentTime: row.current_time_seconds,
      duration: row.duration_seconds,
      progress: row.progress,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastWatchedAt: row.last_checkpoint_at,
      participants,
    });
    return {
      session,
      provider: row.provider,
      titleKey: row.item_key,
      episodeKey: row.episode_key,
    };
  });
}

function compareEpisodeRows(a: WatchHistoryProgressRow, b: WatchHistoryProgressRow): number {
  return (
    (a.season_number ?? Number.MAX_SAFE_INTEGER) -
      (b.season_number ?? Number.MAX_SAFE_INTEGER) ||
    (a.episode_number ?? Number.MAX_SAFE_INTEGER) -
      (b.episode_number ?? Number.MAX_SAFE_INTEGER) ||
    b.observed_at.localeCompare(a.observed_at) ||
    a.episode_key.localeCompare(b.episode_key)
  );
}

function parseHistorySessionRecord(value: unknown): WatchHistorySessionRecord {
  if (
    isRecord(value) &&
    hasOnlyKeys(value, ["session", "provider", "titleKey", "episodeKey"])
  ) {
    const session = WatchHistorySessionSchema.safeParse(value.session);
    if (
      !session.success ||
      (value.provider !== "crunchyroll" && value.provider !== "youtube") ||
      !isBoundedString(value.titleKey, 220) ||
      !isBoundedString(value.episodeKey, 220)
    ) {
      throw invalidDatabaseResponse();
    }
    return {
      session: session.data,
      provider: value.provider,
      titleKey: value.titleKey,
      episodeKey: value.episodeKey,
    };
  }
  const session = WatchHistorySessionSchema.safeParse(value);
  if (!session.success) throw invalidDatabaseResponse();
  return {
    session: session.data,
    provider: null,
    titleKey: null,
    episodeKey: null,
  };
}

function parseProgressRow(value: unknown): WatchHistoryProgressRow {
  if (!isRecord(value)) throw invalidDatabaseResponse();
  const row = value;
  if (
    !hasOnlyKeys(row, [
      "user_id",
      "provider",
      "title_key",
      "episode_key",
      "item_kind",
      "title",
      "artwork_url",
      "episode_title",
      "season_key",
      "season_title",
      "season_number",
      "episode_number",
      "source_url",
      "current_time",
      "duration",
      "progress",
      "completed_at",
      "latest_session_id",
      "observed_at",
      "history_generation",
    ]) ||
    !isUuid(row.user_id) ||
    (row.provider !== "crunchyroll" && row.provider !== "youtube") ||
    !isBoundedString(row.title_key, 220) ||
    !isBoundedString(row.episode_key, 220) ||
    (row.item_kind !== "series" && row.item_kind !== "movie") ||
    !isBoundedString(row.title, 300) ||
    !(row.artwork_url === null || isHttpUrl(row.artwork_url, 2048)) ||
    !isBoundedString(row.episode_title, 300) ||
    !(row.season_key === null || isBoundedString(row.season_key, 220)) ||
    !(row.season_title === null || isBoundedString(row.season_title, 300)) ||
    !(row.season_number === null || isNonnegativeInteger(row.season_number)) ||
    !(row.episode_number === null || isNonnegativeNumber(row.episode_number)) ||
    !isHttpUrl(row.source_url, 2048) ||
    !isNonnegativeNumber(row.current_time) ||
    !isNonnegativeNumber(row.duration) ||
    !isProgress(row.progress) ||
    !(row.completed_at === null || isTimestamp(row.completed_at)) ||
    !(row.latest_session_id === null || isUuid(row.latest_session_id)) ||
    !isTimestamp(row.observed_at) ||
    !isPositiveInteger(row.history_generation)
  ) {
    throw invalidDatabaseResponse();
  }
  return row as WatchHistoryProgressRow;
}

function parseSessionDatabaseRow(value: unknown): SessionDatabaseRow {
  if (!isRecord(value)) throw invalidDatabaseResponse();
  const row = value;
  if (
    !hasOnlyKeys(row, [
      "id",
      "provider",
      "item_key",
      "episode_key",
      "room_id",
      "room_generation",
      "host_user_id",
      "source_generation",
      "current_time_seconds",
      "duration_seconds",
      "progress",
      "started_at",
      "ended_at",
      "last_checkpoint_at",
    ]) ||
    !isUuid(row.id) ||
    (row.provider !== "crunchyroll" && row.provider !== "youtube") ||
    !isBoundedString(row.item_key, 220) ||
    !isBoundedString(row.episode_key, 220) ||
    !(row.room_id === null || isBoundedString(row.room_id, 128)) ||
    !(row.room_generation === null || isPositiveInteger(row.room_generation)) ||
    !isUuid(row.host_user_id) ||
    !(row.source_generation === null || isPositiveInteger(row.source_generation)) ||
    !isNonnegativeNumber(row.current_time_seconds) ||
    !isNonnegativeNumber(row.duration_seconds) ||
    !isProgress(row.progress) ||
    !isTimestamp(row.started_at) ||
    !(row.ended_at === null || isTimestamp(row.ended_at)) ||
    !isTimestamp(row.last_checkpoint_at)
  ) {
    throw invalidDatabaseResponse();
  }
  return row as SessionDatabaseRow;
}

function parseParticipantDatabaseRow(value: unknown): ParticipantDatabaseRow {
  if (!isRecord(value)) throw invalidDatabaseResponse();
  const row = value;
  if (
    !hasOnlyKeys(row, [
      "session_id",
      "user_id",
      "role",
      "current_time_seconds",
      "progress",
      "joined_at",
      "left_at",
      "updated_at",
    ]) ||
    !isUuid(row.session_id) ||
    !isUuid(row.user_id) ||
    (row.role !== "host" && row.role !== "viewer") ||
    !isNonnegativeNumber(row.current_time_seconds) ||
    !isProgress(row.progress) ||
    !isTimestamp(row.joined_at) ||
    !(row.left_at === null || isTimestamp(row.left_at)) ||
    !isTimestamp(row.updated_at)
  ) {
    throw invalidDatabaseResponse();
  }
  return row as ParticipantDatabaseRow;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(record).length === keys.length && Object.keys(record).every((key) => expected.has(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return isNonnegativeNumber(value) && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isNonnegativeInteger(value) && value > 0;
}

function isProgress(value: unknown): value is number {
  return isNonnegativeNumber(value) && value <= 1;
}

function isHttpUrl(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string" || value.length > maxLength) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value: unknown, maxLength: number): value is string {
  if (!isHttpUrl(value, maxLength)) return false;
  return new URL(value).protocol === "https:";
}

function invalidDatabaseResponse(): WatchHistoryV2ApiError {
  return new WatchHistoryV2ApiError(
    502,
    "INVALID_DATABASE_RESPONSE",
    "Watch history response is invalid",
  );
}

function publicDatabaseError(error: unknown): WatchHistoryV2ApiError {
  if (error instanceof WatchHistoryV2ApiError) return error;
  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const mappings: Array<[string, number, string, string]> = [
    ["watch_history_room_unknown", 404, "UNKNOWN_ROOM", "Shared room was not found"],
    ["watch_history_room_member_required", 403, "ROOM_MEMBERSHIP_REQUIRED", "Room membership is required"],
    ["watch_history_authority_after_end", 403, "AUTHORITY_AFTER_ROOM_END", "Shared room authority is outside the room lifecycle"],
    ["watch_history_authority_before_join", 403, "AUTHORITY_BEFORE_JOIN", "Shared room authority is outside the room lifecycle"],
    ["watch_history_authority_before_room", 403, "AUTHORITY_BEFORE_JOIN", "Shared room authority is outside the room lifecycle"],
    ["watch_history_client_id_conflict", 409, "CLIENT_ID_CONFLICT", "Client operation identifier conflicts with existing history"],
    ["watch_history_generation_mismatch", 409, "GENERATION_MISMATCH", "Watch history generation changed"],
    ["watch_history_observation_stale", 409, "STALE_OBSERVATION", "A newer watch observation already exists"],
    ["watch_history_deleted", 409, "DELETED_HISTORY", "This watch observation is behind a deletion fence"],
    ["watch_history_provider_domain_mismatch", 400, "PROVIDER_DOMAIN_MISMATCH", "Provider source does not match the event"],
    ["watch_history_authority_mismatch", 403, "INVALID_AUTHORITY", "Shared room authority is invalid"],
    ["watch_history_authority_unexpected", 400, "INVALID_REQUEST", "Invalid watch progress event"],
    ["watch_history_event_invalid", 400, "INVALID_REQUEST", "Invalid watch progress event"],
    ["watch_history_delete_invalid", 400, "INVALID_REQUEST", "Invalid watch history deletion"],
    ["watch_history_preferences_invalid", 400, "INVALID_REQUEST", "Invalid watch history preferences"],
  ];
  const mapping = mappings.find(([databaseCode]) => message.includes(databaseCode));
  if (mapping) return new WatchHistoryV2ApiError(mapping[1], mapping[2], mapping[3]);
  return new WatchHistoryV2ApiError(503, "HISTORY_UNAVAILABLE", "Watch history is temporarily unavailable");
}
