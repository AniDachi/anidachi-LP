import {
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryRoomRecreationResponseSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryResponseSchema,
  WatchProgressAckSchema,
  WatchProgressEventSchema,
  type WatchHistoryPreferences,
  type WatchProgressEvent,
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
  withoutWatchHistoryAttestation,
  type WatchHistoryObservationDisplayMode,
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
  | "stale-observation"
  | "deleted-history"
  | "invalid-room-authority"
  | "upgrade-required"
  | "storage-full"
  | "rejected";

export type WatchHistoryMessage =
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "list"; limit?: number; cursor?: string }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "enqueue-progress";
      expectedOwnerUserId: string;
      event: unknown;
    }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "observe-progress";
      expectedOwnerUserId: string;
      event: unknown;
      meaningfulSolo?: boolean;
      displayMode?: WatchHistoryObservationDisplayMode | null;
      queueForSync?: boolean;
      flushNow?: boolean;
    }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "flush" }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "content-reconnect" }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "get-preferences" }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "bootstrap";
      expectedOwnerUserId: string;
    }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "bootstrap-cache";
      expectedOwnerUserId: string;
    }
  | { type: typeof WATCH_HISTORY_MESSAGE_TYPE; command: "recover-storage" }
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
      command: "discard-old-owner-work";
      confirmed: boolean;
    }
  | {
      type: typeof WATCH_HISTORY_MESSAGE_TYPE;
      command: "discard-old-owner";
      ownerUserId: string;
      confirmed: boolean;
    };

export type WatchHistoryMessageResponse =
  | {
      ok: true;
      data?: unknown;
      flushed?: number;
      hasPendingWork?: boolean;
      byteUse?: number;
    }
  | { ok: false; status: WatchHistoryLocalStatus; capturePausedPersisted?: boolean };

export type WatchHistoryStorage = ReturnType<typeof createWatchHistoryStorage>;

export type WatchHistoryBootstrapData = {
  ownerUserId: string;
  accountGeneration: number;
  preferences: { youtubeHistoryEnabled: boolean };
  capturePaused: boolean;
  source: "network" | "cache";
};

export type WatchHistoryCaptureResult =
  | { ok: true }
  | { ok: false; status: WatchHistoryLocalStatus; capturePausedPersisted?: boolean };

const unpersistedCapturePauses = new Set<string>();
let preferenceSyncTail: Promise<void> = Promise.resolve();

export function parseWatchHistoryBootstrapData(value: unknown): WatchHistoryBootstrapData | null {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["ownerUserId", "accountGeneration", "preferences", "capturePaused", "source"]) ||
    typeof value.ownerUserId !== "string" ||
    value.ownerUserId.length === 0 ||
    value.ownerUserId.length > 128 ||
    typeof value.accountGeneration !== "number" ||
    !Number.isInteger(value.accountGeneration) ||
    value.accountGeneration < 1 ||
    typeof value.capturePaused !== "boolean" ||
    (value.source !== "network" && value.source !== "cache")) {
    return null;
  }
  const preferences = WatchHistoryPreferencesSchema.safeParse(value.preferences);
  return preferences.success
      ? {
        ownerUserId: value.ownerUserId,
        accountGeneration: value.accountGeneration,
        preferences: preferences.data,
        capturePaused: value.capturePaused,
        source: value.source,
      }
    : null;
}

export type WatchHistoryClientDependencies = {
  getCurrentSession: () => Promise<ExtensionAuthTokens | null>;
  getRequestSession?: () => Promise<ExtensionAuthTokens | null>;
  storage?: WatchHistoryStorage;
  fetch?: typeof fetch;
};

export type WatchHistoryBackgroundDependencies = Partial<WatchHistoryClientDependencies>;

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
      return hasExactKeys(value, ["type", "command", "limit", "cursor"]) &&
        (value.limit === undefined || (typeof value.limit === "number" && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= 100)) &&
        (value.cursor === undefined || (typeof value.cursor === "string" && value.cursor.length > 0 && value.cursor.length <= 512));
    case "enqueue-progress":
      return hasExactKeys(value, ["type", "command", "expectedOwnerUserId", "event"]) &&
        typeof value.expectedOwnerUserId === "string" &&
        value.expectedOwnerUserId.length > 0 &&
        value.expectedOwnerUserId.length <= 128 &&
        "event" in value;
    case "observe-progress":
      return hasExactKeys(value, [
        "type",
        "command",
        "expectedOwnerUserId",
        "event",
        "meaningfulSolo",
        "displayMode",
        "queueForSync",
        "flushNow",
      ]) &&
        typeof value.expectedOwnerUserId === "string" &&
        value.expectedOwnerUserId.length > 0 &&
        value.expectedOwnerUserId.length <= 128 &&
        "event" in value &&
        (value.meaningfulSolo === undefined || typeof value.meaningfulSolo === "boolean") &&
        (value.displayMode === undefined || value.displayMode === null ||
          value.displayMode === "mine" || value.displayMode === "together") &&
        (value.queueForSync === undefined || typeof value.queueForSync === "boolean") &&
        (value.flushNow === undefined || typeof value.flushNow === "boolean");
    case "update-preferences":
    case "delete":
      return hasExactKeys(value, ["type", "command", "input"]) && "input" in value;
    case "flush":
    case "content-reconnect":
    case "get-preferences":
    case "recover-storage":
    case "other-owner-pending":
      return hasExactKeys(value, ["type", "command"]);
    case "bootstrap":
    case "bootstrap-cache":
      return hasExactKeys(value, ["type", "command", "expectedOwnerUserId"]) &&
        typeof value.expectedOwnerUserId === "string" &&
        value.expectedOwnerUserId.length > 0 &&
        value.expectedOwnerUserId.length <= 128;
    case "create-room":
      return hasExactKeys(value, ["type", "command", "sessionId", "clientRequestId"]) &&
        typeof value.sessionId === "string" && value.sessionId.length > 0 && value.sessionId.length <= 128 &&
        (value.clientRequestId === undefined || (typeof value.clientRequestId === "string" && value.clientRequestId.length > 0 && value.clientRequestId.length <= 128));
    case "discard-old-owner":
      return hasExactKeys(value, ["type", "command", "ownerUserId", "confirmed"]) &&
        typeof value.ownerUserId === "string" && value.ownerUserId.length > 0 && value.ownerUserId.length <= 128 && typeof value.confirmed === "boolean";
    case "discard-old-owner-work":
      return hasExactKeys(value, ["type", "command", "confirmed"]) &&
        typeof value.confirmed === "boolean";
    default:
      return false;
  }
}

export function createWatchHistoryClient(dependencies: WatchHistoryClientDependencies) {
  const storage = dependencies.storage ?? createWatchHistoryStorage();
  const request = dependencies.fetch ?? fetch;
  const getRequestSession = dependencies.getRequestSession ?? dependencies.getCurrentSession;

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
      try {
        const result = await storage.discardOtherOwnerOutbox(
          session.user.id,
          message.ownerUserId,
          message.confirmed,
        );
        return result.ok ? { ok: true } : result;
      } catch {
        return { ok: false, status: "invalid-request" };
      }
    }
    if (message.command === "discard-old-owner-work") {
      try {
        const result = await storage.discardAllOtherOwnerOutboxes(
          session.user.id,
          message.confirmed,
        );
        return result.ok ? { ok: true } : result;
      } catch {
        return { ok: false, status: "invalid-request" };
      }
    }
    if (message.command === "list") return refresh(session, message);
    if (message.command === "bootstrap" || message.command === "bootstrap-cache") {
      if (message.expectedOwnerUserId !== session.user.id) {
        return { ok: false, status: "rejected" };
      }
      return message.command === "bootstrap-cache"
        ? cachedBootstrap(session)
        : bootstrap(session);
    }
    if (message.command === "recover-storage") return recoverStorage(session);
    if (message.command === "enqueue-progress" || message.command === "observe-progress") {
      if (message.expectedOwnerUserId !== session.user.id) {
        return { ok: false, status: "rejected" };
      }
      return message.command === "enqueue-progress"
        ? enqueue(session, message.event)
        : observe(
            session,
            message.event,
            message.meaningfulSolo === true,
            message.displayMode ?? null,
            message.queueForSync === true,
            message.flushNow === true,
          );
    }
    if (message.command === "flush" || message.command === "content-reconnect") return flush(session);
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
    if (!parsed.success || parsed.data.meta.ownerUserId !== response.session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await replaceCanonicalPartition(response.session, parsed.data.meta.accountGeneration, (partition) => ({
      ...partition,
      cache: parsed.data,
    }));
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    return saved.ok ? { ok: true, data: parsed.data } : saved;
  }

  async function enqueue(
    session: ExtensionAuthTokens,
    rawEvent: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const parsed = WatchProgressEventSchema.safeParse(rawEvent);
    if (!parsed.success) return { ok: false, status: "invalid-request" };
    const event = parsed.data;
    const captureAuthorityFailure = await validateCaptureAuthority(session, event);
    if (captureAuthorityFailure) return captureAuthorityFailure;
    const paused = await capturePauseState(session, event.accountGeneration);
    if (paused.capturePaused) {
      return { ok: false, status: "storage-full", capturePausedPersisted: paused.persisted };
    }
    const persist = () => updateCurrentPartition(session, event.accountGeneration, (partition) => ({
      ...partition,
      currentObservation: withoutWatchHistoryAttestation(event),
      currentObservationMeaningfulSolo: !event.sharedRoom,
      currentObservationDisplayMode: partition.currentObservation?.clientEventId === event.clientEventId
        ? partition.currentObservationDisplayMode === undefined
          ? inferredObservationDisplayMode(event)
          : partition.currentObservationDisplayMode
        : inferredObservationDisplayMode(event),
      outbox: enqueueWatchHistoryEvent(partition.outbox, event),
    }), event.provider);
    let saved = await persist();
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) {
      await flush(session).catch(() => undefined);
      saved = await persist();
      if (saved.authorityRejected) return { ok: false, status: "rejected" };
      if (saved.stale) return { ok: false, status: "generation-mismatch" };
      if (!saved.ok) {
        const capturePausedPersisted = await markCapturePaused(session, event.accountGeneration);
        return { ...saved, capturePausedPersisted };
      }
    }
    return flush(session);
  }

  async function observe(
    session: ExtensionAuthTokens,
    rawEvent: unknown,
    meaningfulSolo: boolean,
    displayMode: WatchHistoryObservationDisplayMode | null,
    queueForSync: boolean,
    flushNow: boolean,
  ): Promise<WatchHistoryMessageResponse> {
    const parsed = WatchProgressEventSchema.safeParse(rawEvent);
    if (!parsed.success) return { ok: false, status: "invalid-request" };
    const captureAuthorityFailure = await validateCaptureAuthority(session, parsed.data);
    if (captureAuthorityFailure) return captureAuthorityFailure;
    const paused = await capturePauseState(session, parsed.data.accountGeneration);
    if (paused.capturePaused) {
      return { ok: false, status: "storage-full", capturePausedPersisted: paused.persisted };
    }
    const persist = () => updateCurrentPartition(session, parsed.data.accountGeneration, (partition) => ({
      ...partition,
      currentObservation: withoutWatchHistoryAttestation(parsed.data),
      currentObservationMeaningfulSolo: meaningfulSolo && !parsed.data.sharedRoom,
      currentObservationDisplayMode: displayMode,
      outbox: queueForSync
        ? enqueueWatchHistoryEvent(partition.outbox, parsed.data)
        : partition.outbox,
    }), parsed.data.provider);
    let saved = await persist();
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) {
      await flush(session).catch(() => undefined);
      saved = await persist();
      if (saved.authorityRejected) return { ok: false, status: "rejected" };
      if (saved.stale) return { ok: false, status: "generation-mismatch" };
      if (!saved.ok) {
        const capturePausedPersisted = await markCapturePaused(session, parsed.data.accountGeneration);
        return { ...saved, capturePausedPersisted };
      }
    }
    if (!flushNow) return { ok: true };
    const drained = await flush(session);
    return !drained.ok && drained.status === "retryable" ? { ok: true } : drained;
  }

  async function flush(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const root = await storage.readRoot();
    const generation = root.activeGenerations?.[session.user.id];
    if (generation === undefined) return { ok: true, flushed: 0 };
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, generation)];
    if (!partition) return { ok: true, flushed: 0 };
    const pendingPreferences = WatchHistoryPreferencesSchema.safeParse(partition.preferences);
    if (partition.preferencesSyncPending === true && pendingPreferences.success) {
      queuePreferenceSync(session, generation, pendingPreferences.data);
    }
    let flushed = 0;
    let activeSession = session;
    for (const entry of orderWatchHistoryOutbox(partition.outbox)) {
        if (flushed >= FLUSH_LIMIT) return { ok: true, flushed };
        const current = await dependencies.getCurrentSession();
        if (!sameSession(activeSession, current)) return { ok: true, flushed };
        const response = await authenticatedRequest(activeSession, "/api/watch-history/v2/progress", {
          method: "POST",
          body: JSON.stringify(entry.event),
        });
        if (!response.ok) {
          if (!isPermanentObservationRejection(response.error)) return response.error;
          activeSession = response.session ?? activeSession;
          const saved = await consumeRejectedEvent(activeSession, generation, entry.event.clientEventId);
          if (!saved.ok) return saved.error;
          flushed += 1;
          continue;
        }
        activeSession = response.session;
        const ack = WatchProgressAckSchema.safeParse(response.body);
        if (!ack.success ||
          ack.data.meta.ownerUserId !== activeSession.user.id ||
          ack.data.accountGeneration !== generation ||
          ack.data.acceptedEventId !== entry.event.clientEventId) {
          return { ok: false, status: "invalid-response" };
        }
        const saved = await updateCurrentPartition(activeSession, generation, (candidate) => {
          const acceptedCurrent = candidate.currentObservation?.clientEventId ===
            ack.data.acceptedEventId;
          const acceptedDisplayMode = candidate.currentObservationDisplayMode === "mine" ||
              candidate.currentObservationDisplayMode === "together"
            ? candidate.currentObservationDisplayMode
            : entry.event.sharedRoom ? "together" : "mine";
          return {
            ...candidate,
            capturePaused: false,
            captureMarkersReady: true,
            outbox: acknowledgeWatchHistoryEvent(candidate.outbox, ack.data.acceptedEventId),
            currentObservation: candidate.currentObservation,
            currentObservationMeaningfulSolo: acceptedCurrent
              ? false
              : candidate.currentObservationMeaningfulSolo === true,
            currentObservationDisplayMode: acceptedCurrent
              ? acceptedDisplayMode
              : candidate.currentObservationDisplayMode ?? null,
          };
        });
        if (saved.stale) return { ok: false, status: "generation-mismatch" };
        if (saved.authorityRejected) return { ok: false, status: "rejected" };
        if (!saved.ok) return saved;
        await clearUnpersistedPauseIfReady(activeSession, generation);
        flushed += 1;
    }
    return { ok: true, flushed };
  }

  async function getPreferences(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const pending = await readPendingPreferences(session);
    if (pending) {
      queuePreferenceSync(session, pending.accountGeneration, pending.preferences);
      return {
        ok: true,
        data: localPreferencesResponse(session.user.id, pending.accountGeneration, pending.preferences),
      };
    }
    const explicitLocalChoice = await readConfirmedPreferences(session);
    if (explicitLocalChoice && explicitLocalChoice.localRevision > 0) {
      return {
        ok: true,
        data: localPreferencesResponse(
          session.user.id,
          explicitLocalChoice.accountGeneration,
          explicitLocalChoice.preferences,
        ),
      };
    }
    const startedPreference = await readPreferenceRevision(session);
    const response = await authenticatedRequest(session, "/api/watch-history/v2/preferences");
    if (!response.ok) return response.error;
    const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== response.session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    let localWon = false;
    const saved = await replaceCanonicalPartition(response.session, parsed.data.meta.accountGeneration, (partition) => {
      const changedWhileReading = startedPreference?.accountGeneration === partition.accountGeneration &&
        partition.preferencesLocalRevision !== startedPreference.localRevision;
      if (partition.preferencesSyncPending === true || changedWhileReading) {
        localWon = true;
        return partition;
      }
      return {
        ...partition,
        preferences: parsed.data.preferences,
        preferencesConfirmed: true,
        preferencesSyncPending: false,
        captureMarkersReady: true,
      };
    });
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) return saved;
    if (localWon) {
      const latest = await readPendingPreferences(response.session);
      if (latest) {
        queuePreferenceSync(response.session, latest.accountGeneration, latest.preferences);
      }
      const local = await readConfirmedPreferences(response.session);
      return local
        ? {
            ok: true,
            data: localPreferencesResponse(
              response.session.user.id,
              local.accountGeneration,
              local.preferences,
            ),
          }
        : { ok: false, status: "rejected" };
    }
    return { ok: true, data: parsed.data };
  }

  async function bootstrap(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const pending = await readPendingPreferences(session);
    if (pending) {
      queuePreferenceSync(session, pending.accountGeneration, pending.preferences);
      return cachedBootstrap(session);
    }
    const explicitLocalChoice = await readConfirmedPreferences(session);
    if (explicitLocalChoice && explicitLocalChoice.localRevision > 0) {
      return cachedBootstrap(session);
    }
    const startedPreference = await readPreferenceRevision(session);
    const response = await authenticatedRequest(session, "/api/watch-history/v2/preferences");
    if (!response.ok) {
      if (!isFailureStatus(response.error, "retryable")) return response.error;
      return cachedBootstrap(response.session ?? session);
    }
    const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== response.session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const generation = parsed.data.meta.accountGeneration;
    let localWon = false;
    const saved = await replaceCanonicalPartition(response.session, generation, (partition) => {
      const changedWhileReading = startedPreference?.accountGeneration === partition.accountGeneration &&
        partition.preferencesLocalRevision !== startedPreference.localRevision;
      if (partition.preferencesSyncPending === true || changedWhileReading) {
        localWon = true;
        return partition;
      }
      return {
        ...partition,
        preferences: parsed.data.preferences,
        preferencesConfirmed: true,
        preferencesSyncPending: false,
        captureMarkersReady: true,
      };
    });
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) return saved;
    if (localWon) {
      const latest = await readPendingPreferences(response.session);
      if (latest) {
        queuePreferenceSync(response.session, latest.accountGeneration, latest.preferences);
      }
      return cachedBootstrap(response.session);
    }
    const paused = await capturePauseState(response.session, generation);
    if (!sameSession(response.session, await dependencies.getCurrentSession())) {
      return { ok: false, status: "rejected" };
    }
    return {
      ok: true,
      data: {
        ownerUserId: response.session.user.id,
        accountGeneration: generation,
        preferences: parsed.data.preferences,
        capturePaused: paused.capturePaused,
        source: "network",
      } satisfies WatchHistoryBootstrapData,
    };
  }

  async function cachedBootstrap(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: false, status: "rejected" };
    const root = await storage.readRoot();
    const generation = root.activeGenerations?.[session.user.id];
    if (generation === undefined) return { ok: false, status: "retryable" };
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, generation)];
    const preferences = WatchHistoryPreferencesSchema.safeParse(partition?.preferences);
    if (!partition ||
      partition.ownerUserId !== session.user.id ||
      partition.accountGeneration !== generation ||
      partition.captureMarkersReady !== true ||
      partition.preferencesConfirmed !== true ||
      !preferences.success) {
      return { ok: false, status: "retryable" };
    }
    const paused = await capturePauseState(session, generation);
    if (!sameSession(session, await dependencies.getCurrentSession())) {
      return { ok: false, status: "rejected" };
    }
    return {
      ok: true,
      data: {
        ownerUserId: session.user.id,
        accountGeneration: generation,
        preferences: preferences.data,
        capturePaused: paused.capturePaused,
        source: "cache",
      } satisfies WatchHistoryBootstrapData,
    };
  }

  async function recoverStorage(session: ExtensionAuthTokens): Promise<WatchHistoryMessageResponse> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: false, status: "retryable" };
    const root = await storage.readRoot();
    const generation = root.activeGenerations?.[session.user.id];
    if (generation === undefined) {
      return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
    }
    const key = watchHistoryPartitionKey(session.user.id, generation);
    const partition = root.partitions[key];
    if (!partition || partition.ownerUserId !== session.user.id || partition.accountGeneration !== generation) {
      return { ok: false, status: "generation-mismatch" };
    }
    const memoryKey = capturePauseKey(session.user.id, generation);
    if (partition.captureMarkersReady === true && partition.capturePaused !== true && !unpersistedCapturePauses.has(memoryKey)) {
      return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
    }
    let matched = false;
    const recovered = await storage.updateRoot((candidate) => {
      if (candidate.activeGenerations?.[session.user.id] !== generation) return candidate;
      const active = candidate.partitions[key];
      if (!active || active.ownerUserId !== session.user.id || active.accountGeneration !== generation) {
        return candidate;
      }
      matched = true;
      return {
        ...candidate,
        partitions: {
          ...candidate.partitions,
          [key]: {
            ...active,
            preferencesConfirmed: active.preferencesConfirmed === true,
            capturePaused: false,
            captureMarkersReady: true,
          },
        },
      };
    });
    if (!matched) return { ok: false, status: "generation-mismatch" };
    if (!recovered.ok) {
      unpersistedCapturePauses.add(memoryKey);
      return { ...recovered, capturePausedPersisted: false };
    }
    unpersistedCapturePauses.delete(memoryKey);
    return { ok: true, data: { capturePaused: false, capturePausedPersisted: false } };
  }

  async function updatePreferences(
    session: ExtensionAuthTokens,
    rawInput: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const input = WatchHistoryPreferencesUpdateSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, status: "invalid-request" };
    const root = await storage.readRoot();
    const generation = root.activeGenerations?.[session.user.id];
    if (generation === undefined) return { ok: false, status: "retryable" };
    let queuedFinalObservation = false;
    const saved = await updateCurrentPartition(session, generation, (partition) => {
      const disablingYouTube = partition.preferences?.youtubeHistoryEnabled === true &&
        !input.data.youtubeHistoryEnabled;
      const clearingYouTubeObservation = disablingYouTube &&
        partition.currentObservation?.provider === "youtube";
      const queueMeaningfulSoloObservation = clearingYouTubeObservation &&
        partition.currentObservationMeaningfulSolo === true;
      queuedFinalObservation ||= queueMeaningfulSoloObservation;
      return {
        ...partition,
        preferences: input.data,
        preferencesConfirmed: true,
        preferencesSyncPending: true,
        preferencesLocalRevision: (partition.preferencesLocalRevision ?? 0) + 1,
        currentObservation: clearingYouTubeObservation ? null : partition.currentObservation,
        currentObservationMeaningfulSolo: clearingYouTubeObservation
          ? false
          : partition.currentObservationMeaningfulSolo === true,
        currentObservationDisplayMode: clearingYouTubeObservation
          ? null
          : partition.currentObservationDisplayMode ?? null,
        outbox: queueMeaningfulSoloObservation && partition.currentObservation
          ? enqueueWatchHistoryEvent(partition.outbox, partition.currentObservation)
          : partition.outbox,
        captureMarkersReady: true,
      };
    });
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
    if (saved.stale) return { ok: false, status: "generation-mismatch" };
    if (!saved.ok) return saved;
    queuePreferenceSync(session, generation, input.data);
    if (queuedFinalObservation) void flush(session).catch(() => undefined);
    return { ok: true };
  }

  async function readPendingPreferences(session: ExtensionAuthTokens): Promise<{
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
  } | null> {
    if (!sameSession(session, await dependencies.getCurrentSession())) return null;
    const root = await storage.readRoot();
    const accountGeneration = root.activeGenerations?.[session.user.id];
    if (accountGeneration === undefined) return null;
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, accountGeneration)];
    const preferences = WatchHistoryPreferencesSchema.safeParse(partition?.preferences);
    if (!partition ||
      partition.ownerUserId !== session.user.id ||
      partition.accountGeneration !== accountGeneration ||
      partition.preferencesConfirmed !== true ||
      partition.preferencesSyncPending !== true ||
      !preferences.success ||
      !sameSession(session, await dependencies.getCurrentSession())) {
      return null;
    }
    return { accountGeneration, preferences: preferences.data };
  }

  async function readPreferenceRevision(session: ExtensionAuthTokens): Promise<{
    accountGeneration: number;
    localRevision: number;
  } | null> {
    if (!sameSession(session, await dependencies.getCurrentSession())) return null;
    const root = await storage.readRoot();
    const accountGeneration = root.activeGenerations?.[session.user.id];
    if (accountGeneration === undefined) return null;
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, accountGeneration)];
    if (!partition ||
      partition.ownerUserId !== session.user.id ||
      partition.accountGeneration !== accountGeneration ||
      !sameSession(session, await dependencies.getCurrentSession())) {
      return null;
    }
    return {
      accountGeneration,
      localRevision: partition.preferencesLocalRevision ?? 0,
    };
  }

  async function readConfirmedPreferences(session: ExtensionAuthTokens): Promise<{
    accountGeneration: number;
    preferences: WatchHistoryPreferences;
    localRevision: number;
  } | null> {
    if (!sameSession(session, await dependencies.getCurrentSession())) return null;
    const root = await storage.readRoot();
    const accountGeneration = root.activeGenerations?.[session.user.id];
    if (accountGeneration === undefined) return null;
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, accountGeneration)];
    const preferences = WatchHistoryPreferencesSchema.safeParse(partition?.preferences);
    if (!partition ||
      partition.ownerUserId !== session.user.id ||
      partition.accountGeneration !== accountGeneration ||
      partition.preferencesConfirmed !== true ||
      !preferences.success ||
      !sameSession(session, await dependencies.getCurrentSession())) {
      return null;
    }
    return {
      accountGeneration,
      preferences: preferences.data,
      localRevision: partition.preferencesLocalRevision ?? 0,
    };
  }

  function queuePreferenceSync(
    session: ExtensionAuthTokens,
    accountGeneration: number,
    preferences: WatchHistoryPreferences,
  ): void {
    const run = () => syncPreferences(session, accountGeneration, preferences);
    preferenceSyncTail = preferenceSyncTail.then(run, run);
  }

  async function syncPreferences(
    session: ExtensionAuthTokens,
    accountGeneration: number,
    preferences: WatchHistoryPreferences,
  ): Promise<void> {
    try {
      const pending = await readPendingPreferences(session);
      if (!pending ||
        pending.accountGeneration !== accountGeneration ||
        pending.preferences.youtubeHistoryEnabled !== preferences.youtubeHistoryEnabled) {
        return;
      }
      const response = await authenticatedRequest(session, "/api/watch-history/v2/preferences", {
        method: "PATCH",
        body: JSON.stringify(preferences),
      });
      if (!response.ok) return;
      const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.body);
      if (!parsed.success ||
        parsed.data.meta.ownerUserId !== response.session.user.id ||
        parsed.data.meta.accountGeneration !== accountGeneration ||
        parsed.data.preferences.youtubeHistoryEnabled !== preferences.youtubeHistoryEnabled) {
        return;
      }
      await updateCurrentPartition(response.session, accountGeneration, (partition) => {
        const current = WatchHistoryPreferencesSchema.safeParse(partition.preferences);
        if (partition.preferencesSyncPending !== true ||
          !current.success ||
          current.data.youtubeHistoryEnabled !== preferences.youtubeHistoryEnabled) {
          return partition;
        }
        return {
          ...partition,
          preferences: parsed.data.preferences,
          preferencesConfirmed: true,
          preferencesSyncPending: false,
          captureMarkersReady: true,
        };
      });
    } catch {
      // The durable local choice remains pending for the next event-driven retry.
    }
  }

  async function deleteHistory(
    session: ExtensionAuthTokens,
    rawInput: unknown,
  ): Promise<WatchHistoryMessageResponse> {
    const input = WatchHistoryDeletionRequestSchema.safeParse(rawInput);
    if (!input.success) return { ok: false, status: "invalid-request" };
    const root = await storage.readRoot();
    if (root.activeGenerations?.[session.user.id] !== input.data.accountGeneration) {
      return { ok: false, status: "generation-mismatch" };
    }
    const response = await authenticatedRequest(session, "/api/watch-history/v2/delete", {
      method: "POST",
      body: JSON.stringify(input.data),
    });
    if (!response.ok) return response.error;
    const parsed = WatchHistoryDeletionAckSchema.safeParse(response.body);
    if (!parsed.success || parsed.data.meta.ownerUserId !== response.session.user.id) {
      return { ok: false, status: "invalid-response" };
    }
    const saved = await replaceCanonicalPartition(response.session, parsed.data.accountGeneration, (partition) => ({
      ...partition,
      cache: null,
      currentObservation: null,
      currentObservationMeaningfulSolo: false,
      currentObservationDisplayMode: null,
      outbox: removeWatchHistoryEventsForDeletion(partition.outbox, parsed.data.target),
    }));
    if (saved.authorityRejected) return { ok: false, status: "rejected" };
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
  ): Promise<
    | { ok: true; body: unknown; session: ExtensionAuthTokens }
    | { ok: false; error: WatchHistoryMessageResponse; session?: ExtensionAuthTokens }
  > {
    let response: Response;
    try {
      response = await request(new URL(path, WEB_HTTP_BASE).toString(), {
        ...init,
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      });
    } catch {
      return { ok: false, error: { ok: false, status: "retryable" }, session };
    }
    let body = await response.json().catch(() => null);
    if (response.status === 401) {
      let refreshed: ExtensionAuthTokens | null;
      try {
        refreshed = await getRequestSession();
      } catch {
        return { ok: false, error: { ok: false, status: "retryable" }, session };
      }
      if (!refreshed) {
        return { ok: false, error: { ok: false, status: "unauthenticated" } };
      }
      if (refreshed.user.id !== session.user.id) {
        return { ok: false, error: { ok: false, status: "rejected" } };
      }
      if (refreshed.accessToken === session.accessToken) {
        return { ok: false, error: { ok: false, status: "retryable" }, session: refreshed };
      }
      try {
        response = await request(new URL(path, WEB_HTTP_BASE).toString(), {
          ...init,
          headers: {
            Authorization: `Bearer ${refreshed.accessToken}`,
            "Content-Type": "application/json",
          },
        });
      } catch {
        return { ok: false, error: { ok: false, status: "retryable" }, session: refreshed };
      }
      body = await response.json().catch(() => null);
      if (response.status === 401) {
        return { ok: false, error: { ok: false, status: "retryable" }, session: refreshed };
      }
      if (!response.ok) {
        return { ok: false, error: mapHttpFailure(response.status, body), session: refreshed };
      }
      return { ok: true, body, session: refreshed };
    }
    if (!response.ok) return { ok: false, error: mapHttpFailure(response.status, body), session };
    return { ok: true, body, session };
  }

  async function capturePauseState(session: ExtensionAuthTokens, generation: number): Promise<{
    capturePaused: boolean;
    persisted: boolean;
  }> {
    const memoryKey = capturePauseKey(session.user.id, generation);
    if (unpersistedCapturePauses.has(memoryKey)) {
      return { capturePaused: true, persisted: false };
    }
    const root = await storage.readRoot();
    if (root.activeGenerations?.[session.user.id] !== generation) {
      return { capturePaused: false, persisted: false };
    }
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, generation)];
    if (!partition || partition.ownerUserId !== session.user.id || partition.accountGeneration !== generation) {
      return { capturePaused: false, persisted: false };
    }
    const markerReady = partition.captureMarkersReady === true;
    return {
      capturePaused: !markerReady || partition.capturePaused === true,
      persisted: markerReady && partition.capturePaused === true,
    };
  }

  async function validateCaptureAuthority(
    session: ExtensionAuthTokens,
    event: { accountGeneration: number; provider: string },
  ): Promise<WatchHistoryMessageResponse | null> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: false, status: "rejected" };
    const root = await storage.readRoot();
    if (root.activeGenerations?.[session.user.id] !== event.accountGeneration) {
      return { ok: false, status: "generation-mismatch" };
    }
    const partition = root.partitions[watchHistoryPartitionKey(session.user.id, event.accountGeneration)];
    if (!partition ||
      partition.ownerUserId !== session.user.id ||
      partition.accountGeneration !== event.accountGeneration) {
      return { ok: false, status: "generation-mismatch" };
    }
    if (event.provider !== "youtube") return null;
    const preferences = WatchHistoryPreferencesSchema.safeParse(partition.preferences);
    return partition.preferencesConfirmed === true &&
      preferences.success &&
      preferences.data.youtubeHistoryEnabled
      ? null
      : { ok: false, status: "rejected" };
  }

  async function consumeRejectedEvent(
    session: ExtensionAuthTokens,
    generation: number,
    clientEventId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; error: WatchHistoryMessageResponse }
  > {
    const saved = await updateCurrentPartition(session, generation, (candidate) => ({
      ...candidate,
      capturePaused: false,
      captureMarkersReady: true,
      outbox: acknowledgeWatchHistoryEvent(candidate.outbox, clientEventId),
      currentObservation: candidate.currentObservation?.clientEventId === clientEventId
        ? null
        : candidate.currentObservation,
      currentObservationMeaningfulSolo: candidate.currentObservation?.clientEventId === clientEventId
        ? false
        : candidate.currentObservationMeaningfulSolo === true,
      currentObservationDisplayMode: candidate.currentObservation?.clientEventId === clientEventId
        ? null
        : candidate.currentObservationDisplayMode ?? null,
    }));
    if (saved.stale) {
      return { ok: false, error: { ok: false, status: "generation-mismatch" } };
    }
    if (saved.authorityRejected) {
      return { ok: false, error: { ok: false, status: "rejected" } };
    }
    if (!saved.ok) return { ok: false, error: saved };
    await clearUnpersistedPauseIfReady(session, generation);
    return { ok: true };
  }

  async function markCapturePaused(session: ExtensionAuthTokens, generation: number): Promise<boolean> {
    const key = watchHistoryPartitionKey(session.user.id, generation);
    const memoryKey = capturePauseKey(session.user.id, generation);
    unpersistedCapturePauses.add(memoryKey);
    let matched = false;
    try {
      const saved = await storage.updateRoot((root) => {
        if (root.activeGenerations?.[session.user.id] !== generation) return root;
        const partition = root.partitions[key];
        if (!partition || partition.ownerUserId !== session.user.id || partition.accountGeneration !== generation) {
          return root;
        }
        matched = true;
        if (partition.capturePaused && partition.captureMarkersReady) return root;
        return {
          ...root,
          partitions: {
            ...root.partitions,
            [key]: { ...partition, capturePaused: true, captureMarkersReady: true },
          },
        };
      });
      if (!matched || !saved.ok) return false;
      unpersistedCapturePauses.delete(memoryKey);
      return true;
    } catch {
      return false;
    }
  }

  async function clearUnpersistedPauseIfReady(
    session: ExtensionAuthTokens,
    generation: number,
  ): Promise<void> {
    const memoryKey = capturePauseKey(session.user.id, generation);
    if (!unpersistedCapturePauses.has(memoryKey)) return;
    try {
      const root = await storage.readRoot();
      const partition = root.partitions[watchHistoryPartitionKey(session.user.id, generation)];
      if (root.activeGenerations?.[session.user.id] !== generation ||
        !partition ||
        partition.ownerUserId !== session.user.id ||
        partition.accountGeneration !== generation ||
        partition.captureMarkersReady !== true ||
        partition.capturePaused === true) {
        return;
      }
      unpersistedCapturePauses.delete(memoryKey);
    } catch {
      // A read failure cannot prove that the active owner/generation is ready.
    }
  }

  async function updateCurrentPartition(
    session: ExtensionAuthTokens,
    generation: number,
    update: (partition: WatchHistoryAccountPartition) => WatchHistoryAccountPartition,
    captureProvider?: string,
  ): Promise<ReturnType<WatchHistoryStorage["updateRoot"]> extends Promise<infer Result>
    ? Result & { stale?: boolean; authorityRejected?: boolean }
    : never> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: true, authorityRejected: true } as const;
    const key = watchHistoryPartitionKey(session.user.id, generation);
    let stale = false;
    let authorityRejected = false;
    const result = await storage.updateRoot((root) => {
      const active = root.activeGenerations?.[session.user.id];
      if (active !== generation) {
        stale = true;
        return root;
      }
      const partition = root.partitions[key];
      if (!partition ||
        partition.ownerUserId !== session.user.id ||
        partition.accountGeneration !== generation) {
        stale = true;
        return root;
      }
      if (captureProvider === "youtube") {
        const confirmed = WatchHistoryPreferencesSchema.safeParse(partition.preferences);
        if (partition.preferencesConfirmed !== true ||
          !confirmed.success ||
          !confirmed.data.youtubeHistoryEnabled) {
          authorityRejected = true;
          return root;
        }
      }
      return {
        ...root,
        activeGenerations: { ...root.activeGenerations, [session.user.id]: generation },
        partitions: { ...root.partitions, [key]: update(partition) },
      };
    });
    const currentAfterWrite = await dependencies.getCurrentSession();
    if (!sameSession(session, currentAfterWrite)) {
      return { ...result, authorityRejected: true };
    }
    if (stale) return { ...result, stale: true };
    return authorityRejected ? { ...result, authorityRejected: true } : result;
  }

  async function replaceCanonicalPartition(
    session: ExtensionAuthTokens,
    generation: number,
    update: (partition: WatchHistoryAccountPartition) => WatchHistoryAccountPartition,
  ): Promise<ReturnType<WatchHistoryStorage["updateRoot"]> extends Promise<infer Result>
    ? Result & { stale?: boolean; authorityRejected?: boolean }
    : never> {
    const current = await dependencies.getCurrentSession();
    if (!sameSession(session, current)) return { ok: true, authorityRejected: true } as const;
    const key = watchHistoryPartitionKey(session.user.id, generation);
    let stale = false;
    const result = await storage.updateRoot((root) => {
      const active = root.activeGenerations?.[session.user.id];
      if (active !== undefined && active > generation) {
        stale = true;
        return root;
      }
      const partitions = Object.fromEntries(
        Object.entries(root.partitions).flatMap(([partitionKey, partition]) => {
          if (partition.ownerUserId !== session.user.id || partition.accountGeneration === generation) {
            return [[partitionKey, partition]];
          }
          const cleared = {
            ...partition,
            cache: null,
            preferences: null,
            preferencesConfirmed: false,
            preferencesSyncPending: false,
            currentObservation: null,
            currentObservationMeaningfulSolo: false,
            currentObservationDisplayMode: null,
            outbox: { ...partition.outbox, entries: [] },
          };
          return [];
        }),
      );
      const partition = partitions[key] ?? emptyPartition(session.user.id, generation);
      return {
        ...root,
        activeGenerations: { ...root.activeGenerations, [session.user.id]: generation },
        partitions: { ...partitions, [key]: update(partition) },
      };
    });
    const currentAfterWrite = await dependencies.getCurrentSession();
    if (!sameSession(session, currentAfterWrite)) {
      return { ...result, authorityRejected: true };
    }
    return stale ? { ...result, stale: true } : result;
  }

  async function reconcile(
    session: ExtensionAuthTokens,
    message: Extract<WatchHistoryMessage, { command: "list" }> = { type: WATCH_HISTORY_MESSAGE_TYPE, command: "list" },
  ): Promise<WatchHistoryMessageResponse> {
    return list(session, message);
  }

  async function refresh(
    session: ExtensionAuthTokens,
    message: Extract<WatchHistoryMessage, { command: "list" }> = { type: WATCH_HISTORY_MESSAGE_TYPE, command: "list" },
  ): Promise<WatchHistoryMessageResponse> {
    const drained = await flush(session);
    const reconciled = await reconcile(session, message);
    if (!drained.ok) return drained;
    return reconciled.ok ? { ...reconciled, flushed: drained.flushed } : reconciled;
  }

  return { handle, flush, reconcile, refresh };
}

function emptyPartition(ownerUserId: string, accountGeneration: number): WatchHistoryAccountPartition {
  const outbox: WatchHistoryOutboxPartition = { ownerUserId, accountGeneration, entries: [] };
  return {
    ownerUserId,
    accountGeneration,
    cache: null,
    preferences: null,
    preferencesConfirmed: false,
    preferencesSyncPending: false,
    preferencesLocalRevision: 0,
    currentObservation: null,
    currentObservationMeaningfulSolo: false,
    currentObservationDisplayMode: null,
    capturePaused: false,
    captureMarkersReady: true,
    outbox,
  };
}

function localPreferencesResponse(
  ownerUserId: string,
  accountGeneration: number,
  preferences: WatchHistoryPreferences,
) {
  return {
    meta: {
      serverTime: new Date().toISOString(),
      schemaVersion: 2 as const,
      ownerUserId,
      accountGeneration,
    },
    preferences,
  };
}

function capturePauseKey(ownerUserId: string, accountGeneration: number): string {
  return `${watchHistoryPartitionKey(ownerUserId, accountGeneration)}\u0000capture-paused`;
}

function isFailureStatus(
  response: WatchHistoryMessageResponse,
  status: WatchHistoryLocalStatus,
): response is { ok: false; status: WatchHistoryLocalStatus } {
  return !response.ok && response.status === status;
}

function mapHttpFailure(status: number, body: unknown): WatchHistoryMessageResponse {
  const code = isRecord(body) && typeof body.code === "string" ? body.code : "";
  if (status === 409 && code === "STALE_OBSERVATION") {
    return { ok: false, status: "stale-observation" };
  }
  if (status === 409 && code === "DELETED_HISTORY") {
    return { ok: false, status: "deleted-history" };
  }
  const mapped: Record<string, WatchHistoryLocalStatus> = {
    GENERATION_MISMATCH: "generation-mismatch",
    INVALID_ROOM_AUTHORITY: "invalid-room-authority",
    UPGRADE_REQUIRED: "upgrade-required",
  };
  if (mapped[code]) return { ok: false, status: mapped[code] };
  if (status >= 500 || status === 429) return { ok: false, status: "retryable" };
  return { ok: false, status: "rejected" };
}

function isPermanentObservationRejection(
  response: WatchHistoryMessageResponse,
): response is { ok: false; status: "stale-observation" | "deleted-history" } {
  return !response.ok &&
    (response.status === "stale-observation" || response.status === "deleted-history");
}

function sameSession(expected: ExtensionAuthTokens, current: ExtensionAuthTokens | null): boolean {
  return current?.user.id === expected.user.id && current.refreshToken === expected.refreshToken;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function inferredObservationDisplayMode(
  event: WatchProgressEvent,
): WatchHistoryObservationDisplayMode | null {
  if (event.kind === "source_change" ||
    event.kind === "pagehide" ||
    event.kind === "room_leave" ||
    event.kind === "room_end" ||
    event.kind === "ended") {
    return null;
  }
  return event.sharedRoom ? "together" : "mine";
}

export async function handleWatchHistoryHttpMessage(
  message: WatchHistoryMessage,
): Promise<WatchHistoryMessageResponse> {
  const { getCurrentExtensionSession } = await import("./auth-client");
  const { getStoredAuthTokens } = await import("./auth-tokens");
  const getCurrentSession = usesStoredWatchHistorySession(message.command)
    ? getStoredAuthTokens
    : async () => getCurrentExtensionSession().catch(getStoredAuthTokens);
  return createWatchHistoryClient({
    getCurrentSession,
    getRequestSession: getCurrentExtensionSession,
  }).handle(message);
}

export function usesStoredWatchHistorySession(
  command: WatchHistoryMessage["command"],
): boolean {
  return command === "enqueue-progress" ||
    command === "observe-progress" ||
    command === "bootstrap" ||
    command === "bootstrap-cache" ||
    command === "flush" ||
    command === "content-reconnect" ||
    command === "recover-storage" ||
    command === "get-preferences" ||
    command === "update-preferences" ||
    command === "other-owner-pending" ||
    command === "discard-old-owner" ||
    command === "discard-old-owner-work";
}

export async function handleWatchHistoryAuthSessionChange(
  previous: ExtensionAuthTokens | null,
  next: ExtensionAuthTokens | null,
  dependencies: WatchHistoryBackgroundDependencies = {},
): Promise<WatchHistoryMessageResponse> {
  const storage = dependencies.storage ?? createWatchHistoryStorage();
  try {
    if (previous && previous.user.id !== next?.user.id) {
      const cleared = await storage.clearRebuildableAccountData(previous.user.id);
      if (!cleared.ok) return { ok: false, status: "retryable" };
    }
    if (!next) return { ok: true };
    const getCurrentSession = dependencies.getCurrentSession ?? await defaultWatchHistorySession();
    const current = await getCurrentSession();
    if (!current || !sameSession(next, current)) return { ok: false, status: "retryable" };
    const client = createWatchHistoryClient({ ...dependencies, storage, getCurrentSession });
    const reconciled = await client.reconcile(current);
    if (!reconciled.ok) return { ok: false, status: "retryable" };
    return client.flush(current);
  } catch {
    return { ok: false, status: "retryable" };
  }
}

export async function flushWatchHistoryInBackground(
  dependencies: WatchHistoryBackgroundDependencies = {},
): Promise<void> {
  const getCurrentSession = dependencies.getCurrentSession ?? await defaultWatchHistorySession();
  const client = createWatchHistoryClient({ ...dependencies, getCurrentSession });
  const session = await getCurrentSession();
  if (session) {
    await reconcileWatchHistoryThenDrain(
      () => client.reconcile(session),
      () => client.flush(session),
    );
  }
}

export async function bestEffortFlushWatchHistoryBeforeSignOut(
  expectedSession: ExtensionAuthTokens,
  dependencies: WatchHistoryBackgroundDependencies & { timeoutMs?: number } = {},
): Promise<void> {
  const getCurrentSession = dependencies.getCurrentSession ?? await defaultStoredWatchHistorySession();
  const current = await getCurrentSession().catch(() => null);
  if (!sameSession(expectedSession, current)) return;
  const client = createWatchHistoryClient({ ...dependencies, getCurrentSession });
  const timeoutMs = dependencies.timeoutMs ?? 1_500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.flush(expectedSession).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function reconcileWatchHistoryThenDrain(
  reconcile: () => Promise<unknown>,
  drain: () => Promise<unknown>,
): Promise<void> {
  await reconcile().catch(() => undefined);
  await drain();
}

async function defaultWatchHistorySession(): Promise<WatchHistoryClientDependencies["getCurrentSession"]> {
  const { getCurrentExtensionSession } = await import("./auth-client");
  return getCurrentExtensionSession;
}

async function defaultStoredWatchHistorySession(): Promise<WatchHistoryClientDependencies["getCurrentSession"]> {
  const { getStoredAuthTokens } = await import("./auth-tokens");
  return getStoredAuthTokens;
}

export function createWatchHistoryContentReconnectMessage(): WatchHistoryMessage {
  return { type: WATCH_HISTORY_MESSAGE_TYPE, command: "content-reconnect" };
}

export function requestWatchHistory(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse> {
  return chrome.runtime.sendMessage(message);
}
