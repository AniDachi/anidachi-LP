import {
  RoomSessionAdmissionInputSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryRoomRecreationResponseSchema,
  type WatchHistoryRoomRecreationResponse,
  type WatchHistoryDeletionAck,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchHistoryTitleEpisodesResponse,
  type WatchProgressAck,
  type WatchCatalogBeginAck,
  type WatchCatalogCommitAck,
  type ActiveRoomConflictResponse,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "./api-session";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import {
  createRoomWithActiveSession,
  getUserById,
  roomCapabilitiesFromRoom,
} from "./db";
import { activeRoomConflictResponse } from "./active-room-session";
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
  applyWatchProgressV3,
  applyWatchCatalogV3,
  beginWatchCatalogV3,
  decodeWatchHistoryCursor,
  deleteWatchHistoryV3,
  getWatchHistoryPreferencesV3,
  listWatchHistoryTitleEpisodesV3,
  listWatchHistoryV3,
  parseWatchProgressEventV3,
  supabaseWatchHistoryV3Store,
  updateWatchHistoryPreferencesV3,
  WatchHistoryV3ApiError,
  type WatchHistoryCursor,
} from "./watch-history-v3";

const PROGRESS_BODY_BYTES = 64 * 1_024;
const CATALOG_BODY_BYTES = 1_024 * 1_024 + 64 * 1_024;
const MUTATION_BODY_BYTES = 16 * 1_024;
const SMALL_BODY_BYTES = 4 * 1_024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WatchHistoryV3RouteDependencies = {
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
  beginCatalog(params: { userId: string; input: unknown }): Promise<WatchCatalogBeginAck>;
  applyCatalog(params: { userId: string; input: unknown }): Promise<WatchCatalogCommitAck>;
  getPreferences(params: { userId: string }): Promise<WatchHistoryPreferencesResponse>;
  updatePreferences(params: {
    userId: string;
    input: unknown;
  }): Promise<WatchHistoryPreferencesResponse>;
  deleteHistory(params: { userId: string; input: unknown }): Promise<WatchHistoryDeletionAck>;
  createRoomFromSession(params: {
    session: ApiSession;
    sessionId: string;
    participantSessionId: string;
    clientRequestId?: string;
    origin: string;
  }): Promise<
    | WatchHistoryRoomRecreationResponse
    | {
        outcome: "conflict";
        activeRoom: ActiveRoomConflictResponse["activeRoom"];
      }
  >;
};

const productionDependencies: WatchHistoryV3RouteDependencies = {
  getSession: getApiSession,
  listHistory: listWatchHistoryV3,
  listTitleEpisodes: listWatchHistoryTitleEpisodesV3,
  applyProgress: applyWatchProgressV3,
  beginCatalog: beginWatchCatalogV3,
  applyCatalog: applyWatchCatalogV3,
  getPreferences: getWatchHistoryPreferencesV3,
  updatePreferences: updateWatchHistoryPreferencesV3,
  deleteHistory: deleteWatchHistoryV3,
  createRoomFromSession: createRoomFromV3Session,
};

export function createWatchHistoryV3RouteHandlers(
  dependencies: WatchHistoryV3RouteDependencies = productionDependencies,
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
        parseWatchProgressEventV3(input);
        return NextResponse.json(
          await dependencies.applyProgress({ userId: session.userId, input }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async postCatalogAttempt(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = await readBoundedJson(request, MUTATION_BODY_BYTES);
        return NextResponse.json(
          await dependencies.beginCatalog({ userId: session.userId, input }),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },

    async postCatalog(request: NextRequest) {
      const session = await dependencies.getSession(request);
      if (!session) return unauthorizedResponse();
      try {
        const input = await readBoundedJson(request, CATALOG_BODY_BYTES);
        return NextResponse.json(
          await dependencies.applyCatalog({ userId: session.userId, input }),
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
        validateMutationOwner(request, session);
        const input = await readBoundedJson(request, SMALL_BODY_BYTES);
        if (!WatchHistoryPreferencesUpdateSchema.safeParse(input).success) {
          throw new WatchHistoryV3ApiError(
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
        validateMutationOwner(request, session);
        const input = await readBoundedJson(request, MUTATION_BODY_BYTES);
        if (!WatchHistoryDeletionRequestSchema.safeParse(input).success) {
          throw new WatchHistoryV3ApiError(
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
          throw new WatchHistoryV3ApiError(
            400,
            "INVALID_REQUEST",
            "Invalid watch session request",
          );
        }
        const creation = await dependencies.createRoomFromSession({
            session,
            sessionId: input.sessionId,
            participantSessionId: input.participantSessionId,
            clientRequestId: input.clientRequestId,
            origin: request.nextUrl.origin,
        });
        if ("outcome" in creation && creation.outcome === "conflict") {
          return NextResponse.json(
            activeRoomConflictResponse(creation.activeRoom),
            { status: 409 },
          );
        }
        return NextResponse.json(
          WatchHistoryRoomRecreationResponseSchema.parse(creation),
        );
      } catch (error) {
        return watchHistoryErrorResponse(error);
      }
    },
  };
}

function validateMutationOwner(request: NextRequest, session: ApiSession): void {
  const owner = request.headers.get(WATCH_HISTORY_OWNER_HEADER);
  // Extension requests already carry the captured owner's bearer token.
  if (owner === null && session.source === "extension") return;
  if (owner === null || !UUID_PATTERN.test(owner)) {
    throw new WatchHistoryV3ApiError(400, "INVALID_REQUEST", "Expected watch history owner is required");
  }
  if (owner !== session.userId) {
    throw new WatchHistoryV3ApiError(409, "OWNER_MISMATCH", "Watch history owner changed");
  }
}

function parseRoomRecreationRequest(
  value: unknown,
): {
  sessionId: string;
  participantSessionId: string;
  clientRequestId?: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.some(
      (key) =>
        key !== "sessionId" &&
        key !== "participantSessionId" &&
        key !== "clientRequestId",
    ) ||
    typeof record.sessionId !== "string" ||
    !UUID_PATTERN.test(record.sessionId) ||
    (record.clientRequestId !== undefined &&
      (typeof record.clientRequestId !== "string" ||
        !UUID_PATTERN.test(record.clientRequestId)))
  ) {
    return null;
  }
  const admission = RoomSessionAdmissionInputSchema.safeParse({
    participantSessionId: record.participantSessionId,
  });
  if (!admission.success) return null;
  return record.clientRequestId === undefined
    ? {
        sessionId: record.sessionId,
        participantSessionId: admission.data.participantSessionId,
      }
    : {
        sessionId: record.sessionId,
        participantSessionId: admission.data.participantSessionId,
        clientRequestId: record.clientRequestId as string,
      };
}

const productionRoutes = createWatchHistoryV3RouteHandlers();

export const handleWatchHistoryV3Get = productionRoutes.getHistory;
export const handleWatchHistoryV3TitleEpisodesGet = productionRoutes.getTitleEpisodes;
export const handleWatchHistoryV3ProgressPost = productionRoutes.postProgress;
export const handleWatchHistoryV3CatalogAttemptPost = productionRoutes.postCatalogAttempt;
export const handleWatchHistoryV3CatalogPost = productionRoutes.postCatalog;
export const handleWatchHistoryV3PreferencesGet = productionRoutes.getPreferences;
export const handleWatchHistoryV3PreferencesPatch = productionRoutes.patchPreferences;
export const handleWatchHistoryV3DeletePost = productionRoutes.postDelete;
export const handleWatchHistoryV3RoomPost = productionRoutes.postRoom;

async function createRoomFromV3Session(params: {
  session: ApiSession;
  sessionId: string;
  participantSessionId: string;
  clientRequestId?: string;
  origin: string;
}): Promise<
  | WatchHistoryRoomRecreationResponse
  | {
      outcome: "conflict";
      activeRoom: ActiveRoomConflictResponse["activeRoom"];
    }
> {
  const source = await supabaseWatchHistoryV3Store.getRoomSource(
    params.session.userId,
    params.sessionId,
  );
  if (!source) {
    throw new WatchHistoryV3ApiError(404, "SESSION_NOT_FOUND", "Watch session was not found");
  }
  const user = await getUserById(params.session.userId);
  if (!user) throw new WatchHistoryV3ApiError(404, "ACCOUNT_NOT_FOUND", "Account was not found");
  const hostPlan = user.plan ?? params.session.plan;
  const quota = await getHostQuotaView(params.session.userId, hostPlan, new Date());
  if (!canStartHostSession(quota)) {
    const body = quotaExhaustedResponseBody(quota);
    throw new WatchHistoryV3ApiError(403, body.code, body.error);
  }
  const admission = await createRoomWithActiveSession({
    hostUserId: params.session.userId,
    participantSessionId: params.participantSessionId,
    capabilities: roomCapabilitiesForPlan(hostPlan),
    showId: source.showId,
    episodeId: source.episodeId,
    sourceUrl: source.sourceUrl,
    title: source.title,
    clientRequestId: params.clientRequestId,
  });
  if (admission.outcome === "conflict") return admission;
  const { room } = admission;
  const reused = admission.outcome === "reused";
  const capabilities = roomCapabilitiesFromRoom(room);
  const roomToken = await signRoomToken(
    {
      sub: params.session.userId,
      roomId: room.room_id,
      role: "host",
      participantSessionId: params.participantSessionId,
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
    throw new WatchHistoryV3ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
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
          throw new WatchHistoryV3ApiError(
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
    throw new WatchHistoryV3ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

function validateEmptyQuery(searchParams: URLSearchParams): void {
  if (searchParams.size > 0) {
    throw new WatchHistoryV3ApiError(
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
      throw new WatchHistoryV3ApiError(
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

function invalidTitleEpisodesQuery(): WatchHistoryV3ApiError {
  return new WatchHistoryV3ApiError(
    400,
    "INVALID_QUERY",
    "History detail query is invalid",
  );
}

function parseLimit(value: string | null): number {
  if (value === null || value === "") return 50;
  if (!/^\d{1,3}$/.test(value)) {
    throw new WatchHistoryV3ApiError(400, "INVALID_LIMIT", "History limit must be from 1 to 100");
  }
  const limit = Number(value);
  if (limit < 1 || limit > 100) {
    throw new WatchHistoryV3ApiError(400, "INVALID_LIMIT", "History limit must be from 1 to 100");
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
  if (error instanceof WatchHistoryV3ApiError) {
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
