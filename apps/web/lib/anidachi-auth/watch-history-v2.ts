import {
  WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT,
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryResponseSchema,
  WatchHistorySessionSchema,
  WatchHistoryTitleEpisodesResponseSchema,
  WatchProgressAckSchema,
  WatchProgressEventSchema,
  type WatchHistoryDeletionAck,
  type WatchHistoryDeletionRequest,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryPreferencesUpdate,
  type WatchHistoryResponse,
  type WatchHistorySession,
  type WatchHistoryTitleEpisodesResponse,
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
const POSTGREST_HISTORY_PAGE_SIZE = 1_000;
const WATCH_HISTORY_QUERY_BATCH_SIZE = 100;
const MVP_PROVIDERS = new Set(["crunchyroll", "youtube"]);
const PUBLIC_HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WatchHistoryRangePage = {
  rows: unknown[];
  total: number | null;
};

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
  current_time_seconds: number;
  duration: number;
  progress: number;
  completed_at: string | null;
  latest_session_id: string | null;
  observed_at: string;
  server_order: number;
  history_generation: number;
};

type SessionDatabaseRow = {
  id: string;
  provider: "crunchyroll" | "youtube";
  item_key: string;
  episode_key: string;
  client_session_key: string | null;
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
  provider: "crunchyroll" | "youtube";
  titleKey: string;
  episodeKey: string;
};

type ParticipantDatabaseRow = {
  session_id: string;
  user_id: string;
  schema_version: 2;
  role: "host" | "viewer";
  current_time_seconds: number;
  progress: number;
  joined_at: string;
  left_at: string | null;
  updated_at: string;
};

export type WatchHistoryCursor = {
  lastWatchedAt: string;
  stableId: string;
};

export type WatchHistoryTitleSummary = {
  provider: "crunchyroll" | "youtube";
  titleKey: string;
  lastWatchedAt: string;
  observedEpisodeCount: number;
  completedEpisodeCount: number;
  episodePage: {
    complete: boolean;
    nextCursor: string | null;
  };
};

type WatchHistoryTitleEpisodePage = {
  accountGeneration: number;
  provider: "crunchyroll" | "youtube";
  titleKey: string;
  observedEpisodeCount: number;
  completedEpisodeCount: number;
  progressRows: unknown[];
  sessions: unknown[];
  complete: boolean;
  nextCursor: string | null;
};

export type WatchHistoryV2Store = {
  getProgressReceipt(userId: string, clientEventId: string): Promise<unknown | null>;
  applyProgress(
    userId: string,
    event: Record<string, unknown>,
    authority: ValidatedWatchHistoryAuthority | null,
  ): Promise<unknown>;
  loadHistory(userId: string, page: {
    limit: number;
    cursor: WatchHistoryCursor | null;
  }): Promise<{
    accountGeneration: number;
    progressRows: unknown[];
    sessions: unknown[];
    totalTitleCount?: number;
    hasMore?: boolean;
    titleSummaries?: unknown[];
  }>;
  loadTitleEpisodes?(userId: string, page: {
    provider: "crunchyroll" | "youtube";
    titleKey: string;
    limit: number;
    cursor: string | null;
  }): Promise<WatchHistoryTitleEpisodePage>;
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

export function isMeaningfulWatchHistoryV2SessionIdentity(identity: {
  roomId: string | null;
  clientSessionKey: string | null;
}): boolean {
  return identity.roomId !== null || identity.clientSessionKey !== null;
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
      (url.origin === "https://youtube.com" || url.origin === "https://www.youtube.com") &&
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
  const store = params.store ?? supabaseWatchHistoryV2Store;
  let validatedAuthority: ValidatedWatchHistoryAuthority | null = null;
  if (event.sharedRoom) {
    try {
      const receipt = await store.getProgressReceipt(params.userId, event.clientEventId);
      if (receipt !== null) {
        const parsedReceipt = WatchProgressAckSchema.safeParse(receipt);
        if (
          !parsedReceipt.success ||
          parsedReceipt.data.meta.ownerUserId !== params.userId ||
          parsedReceipt.data.acceptedEventId !== event.clientEventId
        ) {
          throw invalidDatabaseResponse();
        }
        return parsedReceipt.data;
      }
    } catch (error) {
      throw publicDatabaseError(error);
    }
    try {
      validatedAuthority = await (params.verifyAuthority ?? verifyWatchHistoryAuthority)({
        authenticatedUserId: params.userId,
        authority: event.sharedRoom,
      });
    } catch {
      throw new WatchHistoryV2ApiError(403, "INVALID_ROOM_AUTHORITY", "Shared room authority is invalid");
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
    const value = await store.applyProgress(
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
    const limit = params.limit ?? 50;
    const cursor = params.cursor ?? null;
    const snapshot = await (params.store ?? supabaseWatchHistoryV2Store).loadHistory(
      params.userId,
      { limit, cursor },
    );
    return buildWatchHistoryV2Response({
      userId: params.userId,
      accountGeneration: snapshot.accountGeneration,
      progressRows: snapshot.progressRows,
      sessions: snapshot.sessions,
      limit,
      cursor,
      totalTitleCount: snapshot.totalTitleCount,
      hasMore: snapshot.hasMore,
      titleSummaries: snapshot.titleSummaries,
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
  totalTitleCount?: number;
  hasMore?: boolean;
  titleSummaries?: unknown[];
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

  const isServerBounded = params.totalTitleCount !== undefined || params.hasMore !== undefined;
  const databaseTitleSummaries = params.titleSummaries?.map(parseWatchHistoryTitleSummary);
  if (!isServerBounded && databaseTitleSummaries !== undefined) {
    throw invalidDatabaseResponse();
  }
  const titleSummariesById = new Map<string, WatchHistoryTitleSummary>();
  for (const summary of databaseTitleSummaries ?? []) {
    const stableId = `${summary.provider}:${summary.titleKey}`;
    if (titleSummariesById.has(stableId)) throw invalidDatabaseResponse();
    titleSummariesById.set(stableId, summary);
  }

  const summaries = Array.from(groups.entries()).map(([stableId, titleRows]) => {
    titleRows.sort(compareEpisodeRows);
    const latest = [...titleRows].sort(compareObservationDescending)[0]!;
    const databaseSummary = titleSummariesById.get(stableId);
    const completedInSlice = titleRows.filter((row) => row.completed_at !== null).length;
    const summary = databaseSummary ?? {
      provider: latest.provider,
      titleKey: latest.title_key,
      lastWatchedAt: latest.observed_at,
      observedEpisodeCount: titleRows.length,
      completedEpisodeCount: completedInSlice,
      episodePage: { complete: true, nextCursor: null },
    };
    if (
      summary.provider !== latest.provider ||
      summary.titleKey !== latest.title_key ||
      summary.lastWatchedAt !== latest.observed_at ||
      summary.observedEpisodeCount < titleRows.length ||
      summary.completedEpisodeCount < completedInSlice
    ) {
      throw invalidDatabaseResponse();
    }
    const seasonRows = new Map<string, WatchHistoryProgressRow[]>();
    if (latest.item_kind === "series") {
      for (const row of titleRows) {
        const seasonKey = row.season_key ?? "observed";
        const group = seasonRows.get(seasonKey) ?? [];
        group.push(row);
        seasonRows.set(seasonKey, group);
      }
    }
    const titleSessions = sessionRecords
      .filter(
        (record) =>
          record.provider === latest.provider &&
          record.titleKey === latest.title_key,
      )
      .map((record) => record.session)
      .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
      .slice(0, 20);

    return {
      cursor: { lastWatchedAt: summary.lastWatchedAt, stableId },
      item: {
        provider: latest.provider,
        titleKey: latest.title_key,
        observedEpisodeCount: summary.observedEpisodeCount,
        completedEpisodeCount: summary.completedEpisodeCount,
        episodePage: summary.episodePage,
        itemKind: latest.item_kind,
        title: latest.title,
        sourceUrl: latest.source_url,
        artworkUrl: latest.artwork_url,
        catalogState: "unavailable" as const,
        aggregate: {
          completedEpisodes: summary.completedEpisodeCount,
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
              episodes: observedRows.map((row) =>
                mapProgressRowToEpisode(row, sessionRecords)
              ),
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
          currentTime: latest.current_time_seconds,
          duration: latest.duration,
          progress: latest.progress,
          completedAt: latest.completed_at,
          lastWatchedAt: latest.observed_at,
        },
        lastWatchedAt: latest.observed_at,
      },
    };
  });

  if (
    isServerBounded &&
    databaseTitleSummaries !== undefined &&
    titleSummariesById.size !== groups.size
  ) {
    throw invalidDatabaseResponse();
  }
  if (!isServerBounded) {
    summaries.sort(
      (a, b) =>
        b.cursor.lastWatchedAt.localeCompare(a.cursor.lastWatchedAt) ||
        a.cursor.stableId.localeCompare(b.cursor.stableId),
    );
  }
  if (
    isServerBounded &&
    (!isNonnegativeInteger(params.totalTitleCount) ||
      typeof params.hasMore !== "boolean" ||
      summaries.length > params.limit ||
      params.totalTitleCount < summaries.length ||
      (params.hasMore && summaries.length !== params.limit))
  ) {
    throw invalidDatabaseResponse();
  }
  const start = isServerBounded
    ? 0
    : params.cursor
      ? summaries.findIndex(
          (summary) =>
            summary.cursor.lastWatchedAt < params.cursor!.lastWatchedAt ||
            (summary.cursor.lastWatchedAt === params.cursor!.lastWatchedAt &&
              summary.cursor.stableId > params.cursor!.stableId),
        )
      : 0;
  const pageStart = start < 0 ? summaries.length : start;
  const page = isServerBounded
    ? summaries
    : summaries.slice(pageStart, pageStart + params.limit);
  const hasMore = isServerBounded
    ? params.hasMore!
    : pageStart + page.length < summaries.length;
  const response = {
    meta: {
      serverTime: params.generatedAt.toISOString(),
      schemaVersion: 2 as const,
      ownerUserId: params.userId,
      accountGeneration: params.accountGeneration,
    },
    generatedAt: params.generatedAt.toISOString(),
    totalTitleCount: isServerBounded ? params.totalTitleCount! : summaries.length,
    items: page.map((summary) => summary.item),
    nextCursor:
      hasMore && page.length > 0 ? encodeWatchHistoryCursor(page.at(-1)!.cursor) : null,
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

export async function listWatchHistoryTitleEpisodesV2(params: {
  userId: string;
  provider: "crunchyroll" | "youtube";
  titleKey: string;
  limit?: number;
  cursor?: string | null;
  store?: WatchHistoryV2Store;
  now?: Date;
}): Promise<WatchHistoryTitleEpisodesResponse> {
  const limit = params.limit ?? WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT;
  const cursor = params.cursor ?? null;
  if (
    !isUuid(params.userId) ||
    !MVP_PROVIDERS.has(params.provider) ||
    !isBoundedString(params.titleKey, 220) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT ||
    !(cursor === null || isOpaqueEpisodeCursor(cursor))
  ) {
    throw new WatchHistoryV2ApiError(400, "INVALID_QUERY", "History detail query is invalid");
  }

  try {
    const store = params.store ?? supabaseWatchHistoryV2Store;
    if (!store.loadTitleEpisodes) throw invalidDatabaseResponse();
    const page = await store.loadTitleEpisodes(params.userId, {
      provider: params.provider,
      titleKey: params.titleKey,
      limit,
      cursor,
    });
    if (
      page.provider !== params.provider ||
      page.titleKey !== params.titleKey ||
      page.progressRows.length > limit ||
      page.completedEpisodeCount > page.observedEpisodeCount
    ) {
      throw invalidDatabaseResponse();
    }
    const rows = page.progressRows.map(parseProgressRow);
    if (
      rows.some(
        (row) =>
          row.user_id !== params.userId ||
          row.history_generation !== page.accountGeneration ||
          row.provider !== params.provider ||
          row.title_key !== params.titleKey,
      ) ||
      new Set(rows.map((row) => row.episode_key)).size !== rows.length
    ) {
      throw invalidDatabaseResponse();
    }
    const sessionRecords = page.sessions.map(parseHistorySessionRecord);
    const generatedAt = params.now ?? new Date();
    const response = WatchHistoryTitleEpisodesResponseSchema.safeParse({
      meta: {
        serverTime: generatedAt.toISOString(),
        schemaVersion: 2,
        ownerUserId: params.userId,
        accountGeneration: page.accountGeneration,
      },
      generatedAt: generatedAt.toISOString(),
      provider: page.provider,
      titleKey: page.titleKey,
      observedEpisodeCount: page.observedEpisodeCount,
      completedEpisodeCount: page.completedEpisodeCount,
      episodes: rows.map((row) => mapProgressRowToEpisode(row, sessionRecords)),
      complete: page.complete,
      nextCursor: page.nextCursor,
    });
    if (!response.success) throw invalidDatabaseResponse();
    return response.data;
  } catch (error) {
    throw publicDatabaseError(error);
  }
}

export function encodeWatchHistoryCursor(cursor: WatchHistoryCursor): string {
  const parsed = parseWatchHistoryCursor(cursor);
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
    return parseWatchHistoryCursor({
      lastWatchedAt: decoded[0],
      stableId: decoded[1],
    });
  } catch {
    throw new WatchHistoryV2ApiError(400, "INVALID_CURSOR", "History cursor is invalid");
  }
}

export async function loadAllWatchHistoryProgressRows(
  loadRange: (from: number, to: number) => Promise<WatchHistoryRangePage>,
): Promise<unknown[]> {
  return loadAllWatchHistoryRangePages(loadRange);
}

async function loadAllWatchHistoryRangePages(
  loadRange: (from: number, to: number) => Promise<WatchHistoryRangePage>,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let expectedTotal: number | undefined;
  for (let from = 0; ; ) {
    const page = await loadRange(from, from + POSTGREST_HISTORY_PAGE_SIZE - 1);
    if (
      !isRecord(page) ||
      !Array.isArray(page.rows) ||
      !isNonnegativeInteger(page.total)
    ) {
      throw invalidDatabaseResponse();
    }
    if (expectedTotal === undefined) expectedTotal = page.total;
    if (
      page.total !== expectedTotal ||
      from > expectedTotal ||
      page.rows.length > expectedTotal - from ||
      (page.rows.length === 0 && from < expectedTotal)
    ) {
      throw invalidDatabaseResponse();
    }
    rows.push(...page.rows);
    from += page.rows.length;
    if (from === expectedTotal) return rows;
  }
}

async function loadWatchHistoryBatches(
  ids: string[],
  loadRange: (
    ids: string[],
    from: number,
    to: number,
  ) => Promise<WatchHistoryRangePage>,
  keyOf: (value: unknown) => string,
): Promise<unknown[]> {
  const rows = new Map<string, unknown>();
  for (let offset = 0; offset < ids.length; offset += WATCH_HISTORY_QUERY_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + WATCH_HISTORY_QUERY_BATCH_SIZE);
    const pageRows = await loadAllWatchHistoryRangePages((from, to) =>
      loadRange(batch, from, to),
    );
    for (const value of pageRows) rows.set(keyOf(value), value);
  }
  return Array.from(rows.values());
}

function databaseRowKey(value: unknown, field: string): string {
  if (!isRecord(value) || !isUuid(value[field])) throw invalidDatabaseResponse();
  return value[field];
}

export function normalizeWatchHistoryPublicProfile(params: {
  userId: string;
  profile?: Record<string, unknown>;
  user?: Record<string, unknown>;
}): {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
} {
  if (!isUuid(params.userId)) throw invalidDatabaseResponse();
  const rawHandle = params.profile?.handle;
  const handle = typeof rawHandle === "string" ? rawHandle.trim() : "";
  const displayName = [params.profile?.display_name, params.user?.display_name]
    .flatMap((value) => {
      if (typeof value !== "string") return [];
      const normalized = value.trim();
      return normalized.length >= 1 && normalized.length <= 80 ? [normalized] : [];
    })[0];
  const avatarUrl = [params.profile?.avatar_url, params.user?.avatar_url].find(
    (value): value is string => isHttpUrl(value, 2048),
  );
  return {
    userId: params.userId,
    handle: PUBLIC_HANDLE_PATTERN.test(handle) ? handle : null,
    displayName: displayName ?? "AniDachi user",
    avatarUrl: avatarUrl ?? null,
  };
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
  async getProgressReceipt(userId, clientEventId) {
    const result = await db()
      .from("watch_history_receipts")
      .select("kind,acknowledgement")
      .eq("user_id", userId)
      .eq("client_id", clientEventId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data === null) return null;
    if (!isRecord(result.data) || result.data.kind !== "progress") {
      throw new Error("watch_history_client_id_conflict");
    }
    return result.data.acknowledgement;
  },

  async applyProgress(userId, event, authority) {
    const result = await db().rpc("apply_watch_progress_v2", {
      p_user_id: userId,
      p_event: event,
      p_room_authority: authority,
    });
    if (result.error) throw result.error;
    return result.data;
  },

  async loadHistory(userId, page) {
    const preferences = await this.getPreferences(userId);
    const result = await db().rpc("list_watch_history_v2_bounded_page", {
      p_user_id: userId,
      p_history_generation: preferences.accountGeneration,
      p_limit: page.limit,
      p_cursor_watched_at: page.cursor?.lastWatchedAt ?? null,
      p_cursor_stable_id: page.cursor?.stableId ?? null,
    });
    if (result.error) throw result.error;
    const boundedPage = parseResourceBoundedWatchHistoryPage(result.data);
    boundedPage.progressRows.forEach(parseProgressRow);
    const sessions = await loadCanonicalSessions(userId, boundedPage.sessionIds);
    return {
      accountGeneration: boundedPage.accountGeneration,
      progressRows: boundedPage.progressRows,
      sessions,
      totalTitleCount: boundedPage.totalTitleCount,
      hasMore: boundedPage.hasMore,
      titleSummaries: boundedPage.titleSummaries,
    };
  },

  async loadTitleEpisodes(userId, page) {
    const preferences = await this.getPreferences(userId);
    const result = await db().rpc("list_watch_history_v2_title_episodes_page", {
      p_user_id: userId,
      p_history_generation: preferences.accountGeneration,
      p_provider: page.provider,
      p_title_key: page.titleKey,
      p_limit: page.limit,
      p_cursor: page.cursor,
    });
    if (result.error) throw result.error;
    const episodePage = parseWatchHistoryTitleEpisodesPage(result.data);
    const rows = episodePage.progressRows.map(parseProgressRow);
    if (
      episodePage.accountGeneration !== preferences.accountGeneration ||
      episodePage.provider !== page.provider ||
      episodePage.titleKey !== page.titleKey ||
      rows.length > page.limit ||
      rows.some(
        (row) =>
          row.user_id !== userId ||
          row.history_generation !== preferences.accountGeneration ||
          row.provider !== page.provider ||
          row.title_key !== page.titleKey,
      )
    ) {
      throw invalidDatabaseResponse();
    }
    const sessionIds = Array.from(
      new Set(
        rows.flatMap((row) => row.latest_session_id === null ? [] : [row.latest_session_id]),
      ),
    );
    return {
      ...episodePage,
      progressRows: rows,
      sessions: await loadCanonicalSessions(userId, sessionIds),
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
      .select("session_id,user_id,schema_version")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .eq("schema_version", 2)
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!participant.data) return null;
    const session = await db()
      .from("watch_sessions")
      .select(
        "id,schema_version,room_id,client_session_key,provider,item_key,item_kind,item_title,episode_key,episode_title,source_url",
      )
      .eq("id", sessionId)
      .eq("schema_version", 2)
      .or("room_id.not.is.null,client_session_key.not.is.null")
      .maybeSingle();
    if (session.error) throw session.error;
    if (!session.data) return null;
    return buildHostAuthoritativeWatchHistoryRoomSource({
      userId,
      sessionId,
      participant: participant.data,
      session: session.data,
    });
  },
};

export function buildHostAuthoritativeWatchHistoryRoomSource(params: {
  userId: string;
  sessionId: string;
  participant: unknown;
  session: unknown;
}): WatchHistoryV2RoomSource | null {
  if (
    !isUuid(params.userId) ||
    !isUuid(params.sessionId) ||
    !isRecord(params.participant) ||
    !isRecord(params.session)
  ) {
    return null;
  }
  const participant = params.participant;
  const session = params.session;
  if (
    participant.session_id !== params.sessionId ||
    participant.user_id !== params.userId ||
    participant.schema_version !== 2 ||
    session.id !== params.sessionId ||
    session.schema_version !== 2 ||
    !(session.room_id === null || isBoundedString(session.room_id, 128)) ||
    !(session.client_session_key === null ||
      isBoundedString(session.client_session_key, 220)) ||
    !isMeaningfulWatchHistoryV2SessionIdentity({
      roomId: session.room_id,
      clientSessionKey: session.client_session_key,
    }) ||
    (session.provider !== "crunchyroll" && session.provider !== "youtube") ||
    !isBoundedString(session.item_key, 220) ||
    !isBoundedString(session.episode_key, 220) ||
    !isHttpsUrl(session.source_url, 2048) ||
    !isBoundedString(session.item_title, 300) ||
    !isBoundedString(session.episode_title, 300) ||
    (session.item_kind !== "series" && session.item_kind !== "movie")
  ) {
    return null;
  }
  return {
    sessionId: params.sessionId,
    showId: session.item_key,
    episodeId: session.episode_key,
    sourceUrl: session.source_url,
    title: `${session.item_title} - ${session.episode_title}`,
  };
}

export async function loadExactWatchHistorySessionEnrichment(params: {
  loadOwnerParticipants: (from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadSessions: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadParticipants: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadUsers: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadProfiles: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
}): Promise<{
  sessions: unknown[];
  participants: unknown[];
  users: unknown[];
  profiles: unknown[];
}> {
  const ownerParticipants = await loadAllWatchHistoryRangePages(
    params.loadOwnerParticipants,
  );
  const sessionIds = Array.from(
    new Set(
      ownerParticipants.map((value) => {
        if (!isRecord(value) || !isUuid(value.session_id)) {
          throw invalidDatabaseResponse();
        }
        return value.session_id;
      }),
    ),
  );
  if (sessionIds.length === 0) {
    return { sessions: [], participants: [], users: [], profiles: [] };
  }

  return loadWatchHistorySessionEnrichmentForIds({
    sessionIds,
    loadSessions: params.loadSessions,
    loadParticipants: params.loadParticipants,
    loadUsers: params.loadUsers,
    loadProfiles: params.loadProfiles,
  });
}

async function loadWatchHistorySessionEnrichmentForIds(params: {
  sessionIds: string[];
  loadSessions: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadParticipants: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadUsers: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
  loadProfiles: (ids: string[], from: number, to: number) => Promise<WatchHistoryRangePage>;
}): Promise<{
  sessions: unknown[];
  participants: unknown[];
  users: unknown[];
  profiles: unknown[];
}> {
  if (params.sessionIds.length === 0) {
    return { sessions: [], participants: [], users: [], profiles: [] };
  }

  // These bounded transport requests are exact for a quiescent database. During
  // active playback, independent PostgREST pages are intentionally eventually consistent.
  const sessions = await loadWatchHistoryBatches(
    params.sessionIds,
    params.loadSessions,
    (value) => databaseRowKey(value, "id"),
  );
  const participants = await loadWatchHistoryBatches(
    params.sessionIds,
    params.loadParticipants,
    (value) => `${databaseRowKey(value, "session_id")}:${databaseRowKey(value, "user_id")}`,
  );
  const participantUserIds = Array.from(
    new Set(participants.map((value) => databaseRowKey(value, "user_id"))),
  );
  const [users, profiles] = await Promise.all([
    loadWatchHistoryBatches(
      participantUserIds,
      params.loadUsers,
      (value) => databaseRowKey(value, "id"),
    ),
    loadWatchHistoryBatches(
      participantUserIds,
      params.loadProfiles,
      (value) => databaseRowKey(value, "user_id"),
    ),
  ]);
  return { sessions, participants, users, profiles };
}

async function loadCanonicalSessions(
  userId: string,
  boundedSessionIds?: string[],
): Promise<WatchHistorySessionRecord[]> {
  const loaders = {
    loadOwnerParticipants: async (from: number, to: number) => {
      const result = await db()
        .from("watch_session_participants")
        .select("session_id", { count: "exact" })
        .eq("user_id", userId)
        .eq("schema_version", 2)
        .order("updated_at", { ascending: false })
        .order("session_id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      return { rows: (result.data as unknown[] | null) ?? [], total: result.count };
    },
    loadSessions: async (ids: string[], from: number, to: number) => {
      const result = await db()
        .from("watch_sessions")
        .select(
          "id,provider,item_key,episode_key,client_session_key,room_id,room_generation,host_user_id,source_generation,current_time_seconds,duration_seconds,progress,started_at,ended_at,last_checkpoint_at",
          { count: "exact" },
        )
        .in("id", ids)
        .eq("schema_version", 2)
        .or("room_id.not.is.null,client_session_key.not.is.null")
        .order("id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      return { rows: (result.data as unknown[] | null) ?? [], total: result.count };
    },
    loadParticipants: async (ids: string[], from: number, to: number) => {
      const result = await db()
        .from("watch_session_participants")
        .select(
          "session_id,user_id,schema_version,role,current_time_seconds,progress,joined_at,left_at,updated_at",
          { count: "exact" },
        )
        .in("session_id", ids)
        .eq("schema_version", 2)
        .order("session_id", { ascending: true })
        .order("joined_at", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      return { rows: (result.data as unknown[] | null) ?? [], total: result.count };
    },
    loadUsers: async (ids: string[], from: number, to: number) => {
      const result = await db()
        .from("users")
        .select("id,display_name,avatar_url", { count: "exact" })
        .in("id", ids)
        .order("id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      return { rows: (result.data as unknown[] | null) ?? [], total: result.count };
    },
    loadProfiles: async (ids: string[], from: number, to: number) => {
      const result = await db()
        .from("profiles")
        .select("user_id,handle,display_name,avatar_url", { count: "exact" })
        .in("user_id", ids)
        .order("user_id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      return { rows: (result.data as unknown[] | null) ?? [], total: result.count };
    },
  };
  const enrichment = boundedSessionIds
    ? await loadWatchHistorySessionEnrichmentForIds({
        sessionIds: boundedSessionIds,
        loadSessions: loaders.loadSessions,
        loadParticipants: loaders.loadParticipants,
        loadUsers: loaders.loadUsers,
        loadProfiles: loaders.loadProfiles,
      })
    : await loadExactWatchHistorySessionEnrichment(loaders);
  const participantRows = enrichment.participants.map(parseParticipantDatabaseRow);
  const sessionRows = enrichment.sessions.map(parseSessionDatabaseRow);
  const users = new Map(
    enrichment.users.map((value) => {
      if (!isRecord(value) || !isUuid(value.id)) throw invalidDatabaseResponse();
      return [value.id, value] as const;
    }),
  );
  const profiles = new Map(
    enrichment.profiles.map((value) => {
      if (!isRecord(value) || !isUuid(value.user_id)) throw invalidDatabaseResponse();
      return [value.user_id, value] as const;
    }),
  );
  return sessionRows.map((row) => {
    const participants = participantRows
      .filter((participant) => participant.session_id === row.id)
      .map((participant) => {
        const user = users.get(participant.user_id);
        const profile = profiles.get(participant.user_id);
        return {
          user: normalizeWatchHistoryPublicProfile({
            userId: participant.user_id,
            profile,
            user,
          }),
          role: participant.role,
          currentTime: participant.current_time_seconds,
          progress: participant.progress,
          joinedAt: participant.joined_at,
          leftAt: participant.left_at,
          updatedAt: participant.updated_at,
        };
      })
      .slice(0, 15);
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

export function parseBoundedWatchHistoryPage(value: unknown): {
  accountGeneration: number;
  totalTitleCount: number;
  hasMore: boolean;
  progressRows: unknown[];
  sessionIds: string[];
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "accountGeneration",
      "totalTitleCount",
      "hasMore",
      "progressRows",
      "sessionIds",
    ]) ||
    !isPositiveInteger(value.accountGeneration) ||
    !isNonnegativeInteger(value.totalTitleCount) ||
    typeof value.hasMore !== "boolean" ||
    !Array.isArray(value.progressRows) ||
    !Array.isArray(value.sessionIds) ||
    value.sessionIds.some((id) => !isUuid(id)) ||
    new Set(value.sessionIds).size !== value.sessionIds.length
  ) {
    throw invalidDatabaseResponse();
  }
  return {
    accountGeneration: value.accountGeneration,
    totalTitleCount: value.totalTitleCount,
    hasMore: value.hasMore,
    progressRows: value.progressRows,
    sessionIds: value.sessionIds,
  };
}

export function parseResourceBoundedWatchHistoryPage(value: unknown): {
  accountGeneration: number;
  totalTitleCount: number;
  hasMore: boolean;
  titleSummaries: WatchHistoryTitleSummary[];
  progressRows: unknown[];
  sessionIds: string[];
} {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "accountGeneration",
      "totalTitleCount",
      "hasMore",
      "titleSummaries",
      "progressRows",
      "sessionIds",
    ]) ||
    !isPositiveInteger(value.accountGeneration) ||
    !isNonnegativeInteger(value.totalTitleCount) ||
    typeof value.hasMore !== "boolean" ||
    !Array.isArray(value.titleSummaries) ||
    !Array.isArray(value.progressRows) ||
    !Array.isArray(value.sessionIds) ||
    value.sessionIds.some((id) => !isUuid(id)) ||
    new Set(value.sessionIds).size !== value.sessionIds.length
  ) {
    throw invalidDatabaseResponse();
  }
  const titleSummaries = value.titleSummaries.map(parseWatchHistoryTitleSummary);
  if (
    titleSummaries.length > 100 ||
    titleSummaries.length > value.totalTitleCount ||
    (value.hasMore && titleSummaries.length === 0)
  ) {
    throw invalidDatabaseResponse();
  }
  return {
    accountGeneration: value.accountGeneration,
    totalTitleCount: value.totalTitleCount,
    hasMore: value.hasMore,
    titleSummaries,
    progressRows: value.progressRows,
    sessionIds: value.sessionIds,
  };
}

export function parseWatchHistoryTitleEpisodesPage(value: unknown): Omit<
  WatchHistoryTitleEpisodePage,
  "sessions"
> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "accountGeneration",
      "provider",
      "titleKey",
      "observedEpisodeCount",
      "completedEpisodeCount",
      "complete",
      "nextCursor",
      "progressRows",
    ]) ||
    !isPositiveInteger(value.accountGeneration) ||
    (value.provider !== "crunchyroll" && value.provider !== "youtube") ||
    !isBoundedString(value.titleKey, 220) ||
    !isNonnegativeInteger(value.observedEpisodeCount) ||
    !isNonnegativeInteger(value.completedEpisodeCount) ||
    value.completedEpisodeCount > value.observedEpisodeCount ||
    typeof value.complete !== "boolean" ||
    !(value.nextCursor === null || isOpaqueEpisodeCursor(value.nextCursor)) ||
    (value.complete ? value.nextCursor !== null : value.nextCursor === null) ||
    !Array.isArray(value.progressRows) ||
    value.progressRows.length > WATCH_HISTORY_TITLE_EPISODE_PAGE_LIMIT ||
    value.progressRows.length > value.observedEpisodeCount
  ) {
    throw invalidDatabaseResponse();
  }
  return {
    accountGeneration: value.accountGeneration,
    provider: value.provider,
    titleKey: value.titleKey,
    observedEpisodeCount: value.observedEpisodeCount,
    completedEpisodeCount: value.completedEpisodeCount,
    progressRows: value.progressRows,
    complete: value.complete,
    nextCursor: value.nextCursor,
  };
}

function parseWatchHistoryTitleSummary(value: unknown): WatchHistoryTitleSummary {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "provider",
      "titleKey",
      "lastWatchedAt",
      "observedEpisodeCount",
      "completedEpisodeCount",
      "episodePage",
    ]) ||
    (value.provider !== "crunchyroll" && value.provider !== "youtube") ||
    !isBoundedString(value.titleKey, 220) ||
    !isTimestamp(value.lastWatchedAt) ||
    !isNonnegativeInteger(value.observedEpisodeCount) ||
    !isNonnegativeInteger(value.completedEpisodeCount) ||
    value.completedEpisodeCount > value.observedEpisodeCount ||
    !isRecord(value.episodePage) ||
    !hasOnlyKeys(value.episodePage, ["complete", "nextCursor"]) ||
    typeof value.episodePage.complete !== "boolean" ||
    !(
      value.episodePage.nextCursor === null ||
      isOpaqueEpisodeCursor(value.episodePage.nextCursor)
    ) ||
    (value.episodePage.complete
      ? value.episodePage.nextCursor !== null
      : value.episodePage.nextCursor === null)
  ) {
    throw invalidDatabaseResponse();
  }
  return {
    provider: value.provider,
    titleKey: value.titleKey,
    lastWatchedAt: value.lastWatchedAt,
    observedEpisodeCount: value.observedEpisodeCount,
    completedEpisodeCount: value.completedEpisodeCount,
    episodePage: {
      complete: value.episodePage.complete,
      nextCursor: value.episodePage.nextCursor,
    },
  };
}

function mapProgressRowToEpisode(
  row: WatchHistoryProgressRow,
  sessionRecords: WatchHistorySessionRecord[],
) {
  return {
    episodeKey: row.episode_key,
    episodeTitle: row.episode_title,
    seasonKey: row.season_key,
    seasonTitle: row.season_title,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    sourceUrl: row.source_url,
    currentTime: row.current_time_seconds,
    duration: row.duration,
    progress: row.progress,
    completedAt: row.completed_at,
    lastWatchedAt: row.observed_at,
    sessions: sessionRecords
      .filter(
        (record) =>
          record.provider === row.provider &&
          record.titleKey === row.title_key &&
          record.episodeKey === row.episode_key,
      )
      .map((record) => record.session)
      .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
      .slice(0, 20),
  };
}

function compareEpisodeRows(a: WatchHistoryProgressRow, b: WatchHistoryProgressRow): number {
  return (
    (a.season_number ?? Number.MAX_SAFE_INTEGER) -
      (b.season_number ?? Number.MAX_SAFE_INTEGER) ||
    (a.episode_number ?? Number.MAX_SAFE_INTEGER) -
      (b.episode_number ?? Number.MAX_SAFE_INTEGER) ||
    compareObservationDescending(a, b) ||
    a.episode_key.localeCompare(b.episode_key)
  );
}

function compareObservationDescending(
  a: WatchHistoryProgressRow,
  b: WatchHistoryProgressRow,
): number {
  return (
    b.observed_at.localeCompare(a.observed_at) ||
    b.server_order - a.server_order
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
  throw invalidDatabaseResponse();
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
      "current_time_seconds",
      "duration",
      "progress",
      "completed_at",
      "latest_session_id",
      "observed_at",
      "server_order",
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
    !(
      row.season_number === null ||
      (isNonnegativeInteger(row.season_number) && row.season_number <= 1_000)
    ) ||
    !(row.episode_number === null || isNonnegativeNumber(row.episode_number)) ||
    !isHttpUrl(row.source_url, 2048) ||
    !isNonnegativeNumber(row.current_time_seconds) ||
    !isNonnegativeNumber(row.duration) ||
    !isProgress(row.progress) ||
    !(row.completed_at === null || isTimestamp(row.completed_at)) ||
    !(row.latest_session_id === null || isUuid(row.latest_session_id)) ||
    !isTimestamp(row.observed_at) ||
    !isPositiveInteger(row.server_order) ||
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
      "client_session_key",
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
    !(row.client_session_key === null ||
      isBoundedString(row.client_session_key, 220)) ||
    !(row.room_id === null || isBoundedString(row.room_id, 128)) ||
    !(row.room_generation === null || isPositiveInteger(row.room_generation)) ||
    !isUuid(row.host_user_id) ||
    !(row.source_generation === null || isPositiveInteger(row.source_generation)) ||
    !isNonnegativeNumber(row.current_time_seconds) ||
    !isNonnegativeNumber(row.duration_seconds) ||
    !isProgress(row.progress) ||
    !isTimestamp(row.started_at) ||
    !(row.ended_at === null || isTimestamp(row.ended_at)) ||
    !isTimestamp(row.last_checkpoint_at) ||
    !isMeaningfulWatchHistoryV2SessionIdentity({
      roomId: row.room_id,
      clientSessionKey: row.client_session_key,
    })
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
      "schema_version",
      "role",
      "current_time_seconds",
      "progress",
      "joined_at",
      "left_at",
      "updated_at",
    ]) ||
    !isUuid(row.session_id) ||
    !isUuid(row.user_id) ||
    row.schema_version !== 2 ||
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

function parseWatchHistoryCursor(value: unknown): WatchHistoryCursor {
  if (!isRecord(value) || !hasOnlyKeys(value, ["lastWatchedAt", "stableId"])) {
    throw new WatchHistoryV2ApiError(400, "INVALID_CURSOR", "History cursor is invalid");
  }
  const stableId = typeof value.stableId === "string" ? value.stableId.trim() : "";
  if (
    typeof value.lastWatchedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value.lastWatchedAt,
    ) ||
    !isTimestamp(value.lastWatchedAt) ||
    stableId.length < 3 ||
    stableId.length > 260 ||
    !/^(crunchyroll|netflix|youtube|amazon):[^\s:][^\s]*$/.test(stableId)
  ) {
    throw new WatchHistoryV2ApiError(400, "INVALID_CURSOR", "History cursor is invalid");
  }
  return { lastWatchedAt: value.lastWatchedAt, stableId };
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

function isOpaqueEpisodeCursor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 2_048 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isHttpUrl(value: unknown, maxLength: number): value is string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    /\s/.test(value)
  ) return false;
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
    ["watch_history_cursor_target_mismatch", 400, "INVALID_CURSOR", "History detail cursor is invalid"],
    ["watch_history_invalid_episode_cursor", 400, "INVALID_CURSOR", "History detail cursor is invalid"],
    ["watch_history_invalid_episode_page", 400, "INVALID_QUERY", "History detail query is invalid"],
    ["watch_history_shared_session_pending", 409, "SHARED_SESSION_PENDING", "Shared session is waiting for the host"],
    ["watch_history_shared_source_mismatch", 409, "SHARED_SOURCE_MISMATCH", "Shared source does not match the host session"],
    ["watch_history_room_unknown", 404, "UNKNOWN_ROOM", "Shared room was not found"],
    ["watch_history_room_member_required", 403, "ROOM_MEMBERSHIP_REQUIRED", "Room membership is required"],
    ["watch_history_authority_after_end", 403, "AUTHORITY_AFTER_ROOM_END", "Shared room authority is outside the room lifecycle"],
    ["watch_history_authority_before_join", 403, "AUTHORITY_BEFORE_JOIN", "Shared room authority is outside the room lifecycle"],
    ["watch_history_authority_before_room", 403, "AUTHORITY_BEFORE_JOIN", "Shared room authority is outside the room lifecycle"],
    ["watch_history_authority_expired", 403, "INVALID_ROOM_AUTHORITY", "Shared room authority is invalid"],
    ["watch_history_client_id_conflict", 409, "CLIENT_ID_CONFLICT", "Client operation identifier conflicts with existing history"],
    ["watch_history_generation_mismatch", 409, "GENERATION_MISMATCH", "Watch history generation changed"],
    ["watch_history_observation_stale", 409, "STALE_OBSERVATION", "A newer watch observation already exists"],
    ["watch_history_deleted", 409, "DELETED_HISTORY", "This watch observation is behind a deletion fence"],
    ["watch_history_provider_domain_mismatch", 400, "PROVIDER_DOMAIN_MISMATCH", "Provider source does not match the event"],
    ["watch_history_authority_mismatch", 403, "INVALID_ROOM_AUTHORITY", "Shared room authority is invalid"],
    ["watch_history_authority_unexpected", 400, "INVALID_REQUEST", "Invalid watch progress event"],
    ["watch_history_event_invalid", 400, "INVALID_REQUEST", "Invalid watch progress event"],
    ["watch_history_delete_invalid", 400, "INVALID_REQUEST", "Invalid watch history deletion"],
    ["watch_history_preferences_invalid", 400, "INVALID_REQUEST", "Invalid watch history preferences"],
  ];
  const mapping = mappings.find(([databaseCode]) => message.includes(databaseCode));
  if (mapping) return new WatchHistoryV2ApiError(mapping[1], mapping[2], mapping[3]);
  return new WatchHistoryV2ApiError(503, "HISTORY_UNAVAILABLE", "Watch history is temporarily unavailable");
}
