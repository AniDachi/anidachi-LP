import {
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryRoomRecreationResponseSchema,
  type WatchHistoryRoomRecreationResponse,
  type WatchHistoryDeletionAck,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchHistoryTitleEpisodesResponse,
  type WatchProgressAck,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "./api-session";
import {
  createRoom,
  getUserById,
  roomCapabilitiesFromRoom,
} from "./db";
import { signRoomToken } from "./jwt";
import { roomCapabilitiesForPlan } from "./plan-entitlements";
import {
  getHostQuotaView,
  quotaExhaustedResponseBody,
  quotaSummaryForResponse,
} from "./room-usage";
import {
  canStartHostSession,
  hostRoomTokenTtlSeconds,
} from "../room-quota";
import {
  applyWatchProgressV2,
  decodeWatchHistoryCursor,
  deleteWatchHistoryV2,
  getWatchHistoryPreferencesV2,
  listWatchHistoryTitleEpisodesV2,
  listWatchHistoryV2,
  parseWatchProgressEventV2,
  supabaseWatchHistoryV2Store,
  updateWatchHistoryPreferencesV2,
  WatchHistoryV2ApiError,
  type WatchHistoryCursor,
} from "./watch-history-v2";

const PROGRESS_BODY_BYTES = 64 * 1_024;
const MUTATION_BODY_BYTES = 16 * 1_024;
const SMALL_BODY_BYTES = 4 * 1_024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WatchHistoryV2RouteDependencies = {
  getSession(request: NextRequest): Promise<ApiSession | null>;
  listHistory(params: {
    userId: string;
    limit: number;
    cursor: WatchHistoryCursor | null;
  }): Promise<WatchHistoryResponse>;
  listTitleEpisodes(params: {
    userId: string;
    provider: "crunchyroll" | "youtube";
    titleKey: string;
    limit: number;
    cursor: string | null;
  }): Promise<WatchHistoryTitleEpisodesResponse>;
  applyProgress(params: { userId: string; input: unknown }): Promise<WatchProgressAck>;
  getPreferences(params: { userId: string }): Promise<WatchHistoryPreferencesResponse>;
  updatePreferences(params: {
    userId: string;
    input: unknown;
  }): Promise<WatchHistoryPreferencesResponse>;
  deleteHistory(params: { userId: string; input: unknown }): Promise<WatchHistoryDeletionAck>;
  createRoomFromSession(params: {
    session: ApiSession;
    sessionId: string;
    clientRequestId?: string;
    origin: string;
  }): Promise<WatchHistoryRoomRecreationResponse>;
};

const productionDependencies: WatchHistoryV2RouteDependencies = {
  getSession: getApiSession,
  listHistory: listWatchHistoryV2,
  listTitleEpisodes: listWatchHistoryTitleEpisodesV2,
  applyProgress: applyWatchProgressV2,
  getPreferences: getWatchHistoryPreferencesV2,
  updatePreferences: updateWatchHistoryPreferencesV2,
  deleteHistory: deleteWatchHistoryV2,
  createRoomFromSession: createRoomFromV2Session,
};

export function createWatchHistoryV2RouteHandlers(
  dependencies: WatchHistoryV2RouteDependencies = productionDependencies,
) {
  return {
    async getHistory(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        validateHistoryQuery(request.nextUrl.searchParams);
        const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
        const rawCursor = request.nextUrl.searchParams.get("cursor");
        const cursor = rawCursor ? decodeWatchHistoryCursor(rawCursor) : null;
        return NextResponse.json(
          await dependencies.listHistory({ userId: session.userId, limit, cursor }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async getTitleEpisodes(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const query = parseTitleEpisodesQuery(request.nextUrl.searchParams);
        return NextResponse.json(
          await dependencies.listTitleEpisodes({ userId: session.userId, ...query }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async postProgress(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = await readBoundedJson(request, PROGRESS_BODY_BYTES);
        parseWatchProgressEventV2(input);
        return NextResponse.json(
          await dependencies.applyProgress({ userId: session.userId, input }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async getPreferences(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        validateEmptyQuery(request.nextUrl.searchParams);
        return NextResponse.json(
          await dependencies.getPreferences({ userId: session.userId }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async patchPreferences(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = await readBoundedJson(request, SMALL_BODY_BYTES);
        if (!WatchHistoryPreferencesUpdateSchema.safeParse(input).success) {
          throw new WatchHistoryV2ApiError(
            400,
            "INVALID_REQUEST",
            "Invalid watch history preferences",
          );
        }
        return NextResponse.json(
          await dependencies.updatePreferences({ userId: session.userId, input }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async postDelete(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = await readBoundedJson(request, MUTATION_BODY_BYTES);
        if (!WatchHistoryDeletionRequestSchema.safeParse(input).success) {
          throw new WatchHistoryV2ApiError(
            400,
            "INVALID_REQUEST",
            "Invalid watch history deletion",
          );
        }
        return NextResponse.json(
          await dependencies.deleteHistory({ userId: session.userId, input }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async postRoom(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = parseRoomRecreationRequest(
          await readBoundedJson(request, SMALL_BODY_BYTES),
        );
        if (!input) {
          throw new WatchHistoryV2ApiError(
            400,
            "INVALID_REQUEST",
            "Invalid watch session request",
          );
        }
        return NextResponse.json(
          WatchHistoryRoomRecreationResponseSchema.parse(
            await dependencies.createRoomFromSession({
            session,
            sessionId: input.sessionId,
            clientRequestId: input.clientRequestId,
            origin: request.nextUrl.origin,
            }),
          ),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },
  };
}

function parseRoomRecreationRequest(
  value: unknown,
): { sessionId: string; clientRequestId?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.some((key) => key !== "sessionId" && key !== "clientRequestId") ||
    typeof record.sessionId !== "string" ||
    !UUID_PATTERN.test(record.sessionId) ||
    (record.clientRequestId !== undefined &&
      (typeof record.clientRequestId !== "string" ||
        !UUID_PATTERN.test(record.clientRequestId)))
  ) {
    return null;
  }
  return record.clientRequestId === undefined
    ? { sessionId: record.sessionId }
    : { sessionId: record.sessionId, clientRequestId: record.clientRequestId as string };
}

const productionRoutes = createWatchHistoryV2RouteHandlers();

export const handleWatchHistoryV2Get = productionRoutes.getHistory;
export const handleWatchHistoryV2TitleEpisodesGet = productionRoutes.getTitleEpisodes;
export const handleWatchHistoryV2ProgressPost = productionRoutes.postProgress;
export const handleWatchHistoryV2PreferencesGet = productionRoutes.getPreferences;
export const handleWatchHistoryV2PreferencesPatch = productionRoutes.patchPreferences;
export const handleWatchHistoryV2DeletePost = productionRoutes.postDelete;
export const handleWatchHistoryV2RoomPost = productionRoutes.postRoom;

async function createRoomFromV2Session(params: {
  session: ApiSession;
  sessionId: string;
  clientRequestId?: string;
  origin: string;
}): Promise<WatchHistoryRoomRecreationResponse> {
  const source = await supabaseWatchHistoryV2Store.getRoomSource(
    params.session.userId,
    params.sessionId,
  );
  if (!source) {
    throw new WatchHistoryV2ApiError(404, "SESSION_NOT_FOUND", "Watch session was not found");
  }
  const user = await getUserById(params.session.userId);
  if (!user) throw new WatchHistoryV2ApiError(404, "ACCOUNT_NOT_FOUND", "Account was not found");
  const hostPlan = user.plan ?? params.session.plan;
  const quota = await getHostQuotaView(params.session.userId, hostPlan, new Date());
  if (!canStartHostSession(quota)) {
    const body = quotaExhaustedResponseBody(quota);
    throw new WatchHistoryV2ApiError(403, body.code, body.error);
  }
  const { room, reused } = await createRoom({
    hostUserId: params.session.userId,
    capabilities: roomCapabilitiesForPlan(hostPlan),
    showId: source.showId,
    episodeId: source.episodeId,
    sourceUrl: source.sourceUrl,
    title: source.title,
    clientRequestId: params.clientRequestId,
  });
  const capabilities = roomCapabilitiesFromRoom(room);
  const roomToken = await signRoomToken(
    {
      sub: params.session.userId,
      roomId: room.room_id,
      role: "host",
      capabilities,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    },
    hostRoomTokenTtlSeconds(quota),
  );
  return {
    roomId: room.room_id,
    roomToken,
    shareableLink: `${params.origin}/room/${room.room_id}`,
    reused,
    capabilities,
    quota: quotaSummaryForResponse(hostPlan, quota),
  };
}

async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new WatchHistoryV2ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new WatchHistoryV2ApiError(
            413,
            "PAYLOAD_TOO_LARGE",
            "Request body is too large",
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch {
    throw new WatchHistoryV2ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

function validateEmptyQuery(searchParams: URLSearchParams): void {
  if (searchParams.size > 0) {
    throw new WatchHistoryV2ApiError(
      400,
      "INVALID_QUERY",
      "Preferences query is invalid",
    );
  }
}

function validateHistoryQuery(searchParams: URLSearchParams): void {
  const allowed = new Set(["limit", "cursor"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length > 1) {
      throw new WatchHistoryV2ApiError(
        400,
        "INVALID_QUERY",
        "History query is invalid",
      );
    }
  }
}

function parseTitleEpisodesQuery(searchParams: URLSearchParams): {
  provider: "crunchyroll" | "youtube";
  titleKey: string;
  limit: number;
  cursor: string | null;
} {
  const allowed = new Set(["provider", "titleKey", "limit", "cursor"]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key) || searchParams.getAll(key).length !== 1) {
      throw invalidTitleEpisodesQuery();
    }
  }
  const provider = searchParams.get("provider");
  const titleKey = searchParams.get("titleKey");
  const rawLimit = searchParams.get("limit");
  const cursor = searchParams.get("cursor");
  if (
    (provider !== "crunchyroll" && provider !== "youtube") ||
    titleKey === null ||
    titleKey !== titleKey.trim() ||
    titleKey.length < 1 ||
    titleKey.length > 220 ||
    (rawLimit !== null && !/^\d{1,2}$/.test(rawLimit)) ||
    (cursor !== null &&
      (cursor.length < 1 || cursor.length > 2_048 || !/^[A-Za-z0-9_-]+$/.test(cursor)))
  ) {
    throw invalidTitleEpisodesQuery();
  }
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (limit < 1 || limit > 50) throw invalidTitleEpisodesQuery();
  return { provider, titleKey, limit, cursor };
}

function invalidTitleEpisodesQuery(): WatchHistoryV2ApiError {
  return new WatchHistoryV2ApiError(
    400,
    "INVALID_QUERY",
    "History detail query is invalid",
  );
}

function parseLimit(value: string | null): number {
  if (value === null || value === "") return 50;
  if (!/^\d{1,3}$/.test(value)) {
    throw new WatchHistoryV2ApiError(400, "INVALID_LIMIT", "History limit must be from 1 to 100");
  }
  const limit = Number(value);
  if (limit < 1 || limit > 100) {
    throw new WatchHistoryV2ApiError(400, "INVALID_LIMIT", "History limit must be from 1 to 100");
  }
  return limit;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required", code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

function watchHistoryErrorResponse(error: unknown): NextResponse {
  if (error instanceof WatchHistoryV2ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: "Watch history is temporarily unavailable", code: "HISTORY_UNAVAILABLE" },
    { status: 503 },
  );
}
