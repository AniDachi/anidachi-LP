import {
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryRoomRecreationResponseSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryResponseSchema,
  WatchProgressAckSchema,
  WatchProgressEventSchema,
} from "@anidachi/protocol";
import type { ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import {
  acknowledgeWatchHistoryEvent,
  enqueueWatchHistoryEvent,
  orderWatchHistoryOutbox,
  removeWatchHistoryEventsForDeletion,
  type WatchHistoryOutboxPartition,
} from "./watch-history-outbox";
import {
  createWatchHistoryStorage,
  watchHistoryPartitionKey,
  type WatchHistoryAccountPartition,
} from "./watch-history-storage";

const WATCH_HISTORY_MESSAGE_TYPE = "ANIDACHI_WATCH_HISTORY_V2";
const FLUSH_LIMIT = 20;

export type WatchHistoryLocalStatus =
  | "unauthenticated"
  | "invalid-request"
  | "invalid-response"
  | "retryable"
  | "generation-mismatch"
  | "deleted-history"
  | "invalid-room-authority"
  | "upgrade-required"
  | "storage-full"
  | "rejected";

export type WatchHistoryMessage =
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "list"; limit?: number; cursor?: string }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "enqueue-progress"; event: unknown }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "flush" }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "get-preferences" }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "update-preferences"; input: unknown }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "delete"; input: unknown }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "create-room";
      sessionId: string;
      clientRequestId?: string;
    }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "other-owner-pending" }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "discard-old-owner";
      ownerUserId: string;
      confirmed: boolean;
    };

export type WatchHistoryMessageResponse =
  | { ok: true; data?: unknown; flushed?: number; hasPendingWork?: boolean; byteUse?: number }
  | { ok: false; status: WatchHistoryLocalStatus };

type WatchHistoryStorage = ReturnType<typeof createWatchHistoryStorage>;

export type WatchHistoryClientDependencies = {
  getCurrentSession: () => Promise<ExtensionAuthTokens | null>;
  storage?: WatchHistoryStorage;
  fetch?: typeof fetch;
};

export function createListWatchHistoryMessage(input: {
  limit?: number;
  cursor?: string;
} = {}): WatchHistoryMessage {
  return { type: WATCH_HISTORY_MESSAGE_TYPE, command: "list", ...input };
}

export function createWatchHistoryMessage(message: WatchHistoryMessage): WatchHistoryMessage {
  return message;
}

export function isWatchHistoryMessage(value: unknown): value is WatchHistoryMessage {
  if (!isRecord(value) || value.type !== WATCH_HISTORY_MESSAGE_TYPE) return false;
  if ("accessToken" in value) return false;
  switch (value.command) {
    case "list":
      return optionalNumber(value.limit) && optionalString(value.cursor);
    case "enqueue-progress":
      return "event" in value;
    case "update-preferences":
    case "delete":
      return "input" in value;
    case "flush":
    case "get-preferences":
    case "other-owner-pending":
      return true;
    case "create-room":
      return typeof value.sessionId === "string" && optionalString(value.clientRequestId);
    case "discard-old-owner":
      return typeof value.ownerUserId === "string" && typeof value.confirmed === "boolean";
    default:
      return false;
  }
}

export function createWatchHistoryClient(dependencies: WatchHistoryClientDependencies) {
  const storage = dependencies.storage ?? createWatchHistoryStorage();
  const request = dependencies.fetch ?? fetch;

  async function handle(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse> {
    if (message.command === "other-owner-pending") {
      const session = await dependencies.getCurrentSession();
      if (!session) return { ok: false, status: "unauthenticated" };
      const summary = await storage.otherOwnerPendingSummary(session.user.id);
      return { ok: true, ...summary };
    }

    const session = await dependencies.getCurrentSession();
    if (!session) return { ok: false, status: "unauthenticated" };

    if (message.command === "discard-old-owner") {
      const result = await storage.discardOtherOwnerOutbox(
        session.user.id,
        message.ownerUserId,
        message.confirmed,
      );
      return result.ok ? { ok: true } : result;
    }
    if (message.command === "list") return list(session, message);
    if (message.command === "enqueue-progress") return enqueue(session, message.event);
    if (message.command === "flush") return flush(session);
    if (message.command === "get-preferences") return getPreferences(session);
    if (message.command === "update-preferences") return updatePreferences(session, message.input);
    if (message.command === "delete") return deleteHistory(session, message.input);
    return createRoom(session, message);
  }

  async function list(
    session: ExtensionAuthTokens,
    message: Extract<WatchHistoryMessage, { command: "list" }>,
  ): Promise<WatchHistoryMessageResponse> {
    const query = new URLSearchParams();
    if (message.limit !== undefined) query.set("limit", String(message.limit));
    if (message.cursor) query.set("cursor", message.cursor);
    const response = await authenticatedRequest(session, `/api/watch-history/v2${query.size ? `?${query}` : ""}`);
    if (!response.ok) return response.error;
    const parsed = WatchHistoryResponseSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await updateCurrentPartition(session, parsed.data.meta.accountGeneration, (partition) => ({
      ...partition,
      cache: parsed.data,
    }));
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    void flush(session).catch(() => undefined);
    return saved.ok ? { ok: true, data: parsed.data } : saved;
  }

  async function enqueue(
    session: ExtensionAuthTokens,
    rawEvent: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const parsed = WatchProgressEventSchema.safeParse(rawEvent);
    if (!parsed.success) return { ok: false, status: "invalid-request" };
    const event = parsed.data;
    const saved = await updateCurrentPartition(session, event.accountGeneration, (partition) => ({
      ...partition,
      currentObservation: event,
      outbox: enqueueWatchHistoryEvent(partition.outbox, event),
    }));
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) return saved;
    return flush(session);
  }

  async function flush(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const root = await storage.readRoot();
    const partitions = Object.values(root.partitions)
      .filter((partition) => partition.ownerUserId === session.user.id)
      .sort((left, right) => left.accountGeneration - right.accountGeneration);
    let flushed = 0;
    for (const partition of partitions) {
      for (const entry of orderWatchHistoryOutbox(partition.outbox)) {
        if (flushed >= FLUSH_LIMIT) return { ok: true, flushed };
        const current = await dependencies.getCurrentSession();
        if (!sameSession(session, current)) return { ok: true, flushed };
        const response = await authenticatedRequest(session, "/api/watch-history/v2/progress", {
          method: "POST",
          body: JSON.stringify(entry.event),
        });
        if (!response.ok) return response.error;
        const ack = WatchProgressAckSchema.safeParse(response.body);
        if (!ack.success || ack.data.accountGeneration !== partition.accountGeneration) {
          return { ok: false, status: "invalid-response" };
        }
        const saved = await updateCurrentPartition(session, partition.accountGeneration, (candidate) => ({
          ...candidate,
          outbox: acknowledgeWatchHistoryEvent(candidate.outbox, ack.data.acceptedEventId),
        }));
        if (saved.stale) return { ok: false, status: "generation-mismatch" };
        if (!saved.ok) return saved;
        flushed += 1;
      }
    }
    return { ok: true, flushed };
  }

  async function getPreferences(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const response = await authenticatedRequest(session, "/api/watch-history/v2/preferences");
    if (!response.ok) return response.error;
    const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await updateCurrentPartition(session, parsed.data.meta.accountGeneration, (partition) => ({
      ...partition,
      preferences: parsed.data.preferences,
    }));
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    return saved.ok ? { ok: true, data: parsed.data } : saved;
  }

  async function updatePreferences(
    session: ExtensionAuthTokens,
    rawInput: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const input = WatchHistoryPreferencesUpdateSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, status: "invalid-request" };
    const response = await authenticatedRequest(session, "/api/watch-history/v2/preferences", {
      method: "PATCH",
      body: JSON.stringify(input.data),
    });
    if (!response.ok) return response.error;
    const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await updateCurrentPartition(session, parsed.data.meta.accountGeneration, (partition) => ({
      ...partition,
      preferences: parsed.data.preferences,
    }));
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    return saved.ok ? { ok: true, data: parsed.data } : saved;
  }

  async function deleteHistory(
    session: ExtensionAuthTokens,
    rawInput: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const input = WatchHistoryDeletionRequestSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, status: "invalid-request" };
    const response = await authenticatedRequest(session, "/api/watch-history/v2/delete", {
      method: "POST",
      body: JSON.stringify(input.data),
    });
    if (!response.ok) return response.error;
    const parsed = WatchHistoryDeletionAckSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await updateCurrentPartition(session, parsed.data.accountGeneration, (partition) => ({
      ...partition,
      cache: null,
      currentObservation: null,
      outbox: removeWatchHistoryEventsForDeletion(partition.outbox, parsed.data.target),
    }));
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    return saved.ok ? { ok: true, data: parsed.data } : saved;
  }

  async function createRoom(
    session: ExtensionAuthTokens,
    message: Extract<WatchHistoryMessage, { command: "create-room" }>,
  ): Promise<WatchHistoryMessageResponse> {
    const response = await authenticatedRequest(session, "/api/watch-history/v2/rooms", {
      method: "POST",
      body: JSON.stringify({
        sessionId: message.sessionId,
        ...(message.clientRequestId ? { clientRequestId: message.clientRequestId } : {}),
      }),
    });
    if (!response.ok) return response.error;
    const parsed = WatchHistoryRoomRecreationResponseSchema.safeParse(response.body);
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, status: "invalid-response" };
  }

  async function authenticatedRequest(
    session: ExtensionAuthTokens,
    path: string,
    init: RequestInit = {},
  ): Promise<{ ok: true; body: unknown } | { ok: false; error: WatchHistoryMessageResponse }> {
    let response: Response;
    try {
      response = await request(new URL(path, WEB_HTTP_BASE).toString(), {
        ...init,
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      });
    } catch {
      return { ok: false, error: { ok: false, status: "retryable" } };
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: mapHttpFailure(response.status, body) };
    return { ok: true, body };
  }

  async function updateCurrentPartition(
    session: ExtensionAuthTokens,
    generation: number,
    update: (partition: WatchHistoryAccountPartition) => WatchHistoryAccountPartition,
  ): Promise<ReturnType<WatchHistoryStorage["updateRoot"]> extends Promise<infer Result>
    ? Result & { stale?: boolean }
    : never> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: true } as const;
    const key = watchHistoryPartitionKey(session.user.id, generation);
    let stale = false;
    const result = await storage.updateRoot((root) => {
      const latestGeneration = Math.max(
        0,
        ...Object.values(root.partitions)
          .filter((partition) => partition.ownerUserId === session.user.id)
          .map((partition) => partition.accountGeneration),
      );
      if (latestGeneration > generation) {
        stale = true;
        return root;
      }
      const partition = root.partitions[key] ?? emptyPartition(session.user.id, generation);
      return { ...root, partitions: { ...root.partitions, [key]: update(partition) } };
    });
    return stale ? { ...result, stale: true } : result;
  }

  return { handle, flush };
}

function emptyPartition(ownerUserId: string, accountGeneration: number): WatchHistoryAccountPartition {
  const outbox: WatchHistoryOutboxPartition = { ownerUserId, accountGeneration, entries: [] };
  return { ownerUserId, accountGeneration, cache: null, preferences: null, currentObservation: null, outbox };
}

function mapHttpFailure(status: number, body: unknown): WatchHistoryMessageResponse {
  const code = isRecord(body) && typeof body.code === "string" ? body.code : "";
  const mapped: Record<string, WatchHistoryLocalStatus> = {
    GENERATION_MISMATCH: "generation-mismatch",
    DELETED_HISTORY: "deleted-history",
    INVALID_ROOM_AUTHORITY: "invalid-room-authority",
    UPGRADE_REQUIRED: "upgrade-required",
  };
  if (mapped[code]) return { ok: false, status: mapped[code] };
  if (status >= 500 || status === 429) return { ok: false, status: "retryable" };
  return { ok: false, status: "rejected" };
}

function sameSession(expected: ExtensionAuthTokens, current: ExtensionAuthTokens | null): boolean {
  return current?.user.id === expected.user.id && current.refreshToken === expected.refreshToken;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isInteger(value));
}

export async function handleWatchHistoryHttpMessage(
  message: WatchHistoryMessage,
): Promise<WatchHistoryMessageResponse> {
  const { getCurrentExtensionSession } = await import("./auth-client");
  return createWatchHistoryClient({ getCurrentSession: getCurrentExtensionSession }).handle(message);
}

export async function handleWatchHistoryAuthSessionChange(
  previous: ExtensionAuthTokens | null,
  next: ExtensionAuthTokens | null,
): Promise<void> {
  const storage = createWatchHistoryStorage();
  if (previous && previous.user.id !== next?.user.id) {
    await storage.clearRebuildableAccountData(previous.user.id);
  }
  if (next) await flushWatchHistoryInBackground();
}

export async function flushWatchHistoryInBackground(): Promise<void> {
  const { getCurrentExtensionSession } = await import("./auth-client");
  const client = createWatchHistoryClient({ getCurrentSession: getCurrentExtensionSession });
  const session = await getCurrentExtensionSession();
  if (session) await client.flush(session);
}

export function requestWatchHistory(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse> {
  return chrome.runtime.sendMessage(message);
}
