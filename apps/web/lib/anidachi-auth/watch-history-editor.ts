import {
  WatchHistoryEditorQuerySchema, WatchHistoryEditRequestSchema,
  WatchHistoryEditorResponseSchema, WatchHistoryEditAckSchema,
  type WatchHistoryEditorQuery, type WatchHistoryEditRequest,
} from "@anidachi/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "./db";
import { getAccountAccessSession, HISTORY_PRIVATE_HEADERS } from "./watch-history-access";
import { publicDatabaseError, WatchHistoryV3ApiError } from "./watch-history-v3";
import { readBoundedJson } from "./watch-history-v3-routes";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";

export type WatchHistoryEditorStore = {
  read(owner: string, query: WatchHistoryEditorQuery): Promise<unknown>;
  edit(owner: string, request: WatchHistoryEditRequest): Promise<unknown>;
};
const productionStore: WatchHistoryEditorStore = {
  async read(owner, query) {
    const result = await db().rpc("get_watch_history_editor_v1", {
      p_user_id: owner, p_generation: query.accountGeneration,
      p_provider: query.provider, p_title_key: query.titleKey,
    }).abortSignal(AbortSignal.timeout(20_000));
    if (result.error) throw result.error;
    return result.data;
  },
  async edit(owner, request) {
    const result = await db().rpc("edit_watch_history_v1", { p_user_id: owner, p_request: request })
      .abortSignal(AbortSignal.timeout(35_000));
    if (result.error) throw result.error;
    return result.data;
  },
};
const fail = (status: number, code: string, message: string) => new WatchHistoryV3ApiError(status, code, message);
export function historyEditorError(error: unknown): WatchHistoryV3ApiError {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  for (const [code, status, text] of [
    ["HISTORY_EDIT_CONFLICT", 409, "Your progress changed elsewhere. Review the latest progress before saving."],
    ["HISTORY_TITLE_NOT_FOUND", 404, "This title is no longer in your history."],
    ["HISTORY_EPISODE_UNAVAILABLE", 409, "An episode is no longer available. Refresh the catalog."],
    ["HISTORY_EDITOR_TOO_LARGE", 422, "This title exceeds the editor's 2,000 episode limit."],
    ["HISTORY_EDIT_INVALID", 400, "Invalid history edit."],
  ] as const) if (message.includes(code)) return fail(status, code, text);
  return publicDatabaseError(error);
}

export function createWatchHistoryEditorHandlers(deps: {
  getSession?: typeof getAccountAccessSession; store?: WatchHistoryEditorStore;
} = {}) {
  const store = deps.store ?? productionStore;
  const handler = (write: boolean) => async (request: NextRequest) => {
    try {
      const session = await (deps.getSession ?? getAccountAccessSession)(request);
      if (!session) throw fail(401, "UNAUTHORIZED", "Sign in to view your library.");
      // Both operations require the owner captured by the mounted account page.
      // The custom header also prevents a cross-origin form from writing edits.
      const owner = request.headers.get(WATCH_HISTORY_OWNER_HEADER);
      if (!owner) throw fail(400, "INVALID_REQUEST", "Expected history owner is required.");
      if (owner !== session.userId) throw fail(409, "OWNER_MISMATCH", "The signed-in account changed.");
      if (write && request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin)
        throw fail(403, "INVALID_ORIGIN", "This edit must be made from your account.");
      if (write) {
        if (request.nextUrl.search) throw fail(400, "INVALID_REQUEST", "Unexpected query parameters.");
        const parsed = WatchHistoryEditRequestSchema.safeParse(await readBoundedJson(request, 600_000));
        if (!parsed.success) throw fail(400, "INVALID_REQUEST", "Invalid history edit.");
        const ack = WatchHistoryEditAckSchema.safeParse(await store.edit(owner, parsed.data));
        if (!ack.success || ack.data.meta.ownerUserId !== owner || ack.data.meta.accountGeneration !== parsed.data.accountGeneration || ack.data.clientMutationId !== parsed.data.clientMutationId)
          throw fail(502, "INVALID_RESPONSE", "Could not confirm the saved progress. Retry to check the result.");
        return NextResponse.json(ack.data, { headers: HISTORY_PRIVATE_HEADERS });
      }
      const values: Record<string, unknown> = {};
      for (const [key, value] of request.nextUrl.searchParams) {
        if (key in values) throw fail(400, "INVALID_REQUEST", "Duplicate query parameter.");
        values[key] = key === "accountGeneration" ? Number(value) : value;
      }
      const parsed = WatchHistoryEditorQuerySchema.safeParse(values);
      if (!parsed.success) throw fail(400, "INVALID_REQUEST", "Invalid title query.");
      const result = WatchHistoryEditorResponseSchema.safeParse(await store.read(owner, parsed.data));
      if (!result.success || result.data.meta.ownerUserId !== owner || result.data.meta.accountGeneration !== parsed.data.accountGeneration || result.data.provider !== parsed.data.provider || result.data.titleKey !== parsed.data.titleKey)
        throw fail(502, "INVALID_RESPONSE", "Could not load the title's progress.");
      return NextResponse.json(result.data, { headers: HISTORY_PRIVATE_HEADERS });
    } catch (error) {
      const failure = historyEditorError(error);
      return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status, headers: HISTORY_PRIVATE_HEADERS });
    }
  };
  return { GET: handler(false), POST: handler(true) };
}
