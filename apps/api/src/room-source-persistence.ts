import {
  RoomSourcePersistenceCallbackSchema,
  type RoomSourcePersistenceCallback,
} from "@anidachi/protocol";
import {
  ROOM_LIFECYCLE_STORAGE_KEY,
  parseRoomLifecycleState,
  type RoomLifecycleState,
} from "./room-lifecycle";
import {
  PARTICIPANT_DISCONNECT_STORAGE_KEY,
  nextParticipantDisconnectAlarmAt,
  parseParticipantDisconnectState,
  type ParticipantDisconnectState,
} from "./participant-disconnect";

export const ROOM_SOURCE_PENDING_STORAGE_KEY = "room_source_pending_v1";
export const ROOM_SOURCE_ACKNOWLEDGED_GENERATION_STORAGE_KEY =
  "room_source_acknowledged_generation_v1";
export const MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS = 32;
export const ROOM_SOURCE_RETRY_BASE_MS = 5_000;
export const ROOM_SOURCE_RETRY_MAX_MS = 5 * 60_000;

export interface PendingRoomSourcePersistence {
  schemaVersion: 1;
  callback: RoomSourcePersistenceCallback;
  attempts: number;
  nextAttemptAt: number;
}

export function parsePendingRoomSourcePersistence(
  value: unknown,
): PendingRoomSourcePersistence | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (!hasExactKeys(value, ["attempts", "callback", "nextAttemptAt", "schemaVersion"])) {
    return null;
  }
  const callback = RoomSourcePersistenceCallbackSchema.safeParse(value.callback);
  if (
    !callback.success ||
    !Number.isSafeInteger(value.attempts) ||
    (value.attempts as number) < 0 ||
    (value.attempts as number) > MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS ||
    !isTimestamp(value.nextAttemptAt)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    callback: callback.data,
    attempts: value.attempts as number,
    nextAttemptAt: value.nextAttemptAt,
  };
}

export async function readStoredRoomSourcePersistence(
  storage: DurableObjectStorage,
): Promise<PendingRoomSourcePersistence | null> {
  return parsePendingRoomSourcePersistence(
    await storage.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY),
  );
}

export async function readStoredRoomSourceAcknowledgedGeneration(
  storage: DurableObjectStorage,
): Promise<number> {
  return parseAcknowledgedGeneration(
    await storage.get<unknown>(ROOM_SOURCE_ACKNOWLEDGED_GENERATION_STORAGE_KEY),
  );
}

export async function enqueueStoredRoomSource(
  storage: DurableObjectStorage,
  callback: RoomSourcePersistenceCallback,
  now: number,
): Promise<PendingRoomSourcePersistence> {
  const parsedCallback = RoomSourcePersistenceCallbackSchema.safeParse(callback);
  if (!parsedCallback.success || !isTimestamp(now)) {
    throw new Error("Invalid room source persistence callback");
  }

  return storage.transaction((transaction) =>
    putPendingRoomSource(transaction, parsedCallback.data, now));
}

export async function ensureStoredRoomSourcePending(
  storage: DurableObjectStorage,
  current: RoomSourcePersistenceCallback,
  now: number,
): Promise<PendingRoomSourcePersistence | null> {
  const parsedCallback = RoomSourcePersistenceCallbackSchema.safeParse(current);
  if (!parsedCallback.success || !isTimestamp(now)) {
    throw new Error("Invalid room source persistence callback");
  }
  return storage.transaction(async (transaction) => {
    const acknowledgedGeneration = parseAcknowledgedGeneration(
      await transaction.get<unknown>(
        ROOM_SOURCE_ACKNOWLEDGED_GENERATION_STORAGE_KEY,
      ),
    );
    if (acknowledgedGeneration >= parsedCallback.data.sourceGeneration) {
      await reconcileStoredRoomAlarm(transaction);
      return null;
    }
    return putPendingRoomSource(transaction, parsedCallback.data, now);
  });
}

export async function claimStoredRoomSourceAttempt(
  storage: DurableObjectStorage,
  now: number,
  options: { force?: boolean } = {},
): Promise<PendingRoomSourcePersistence | null> {
  if (!isTimestamp(now)) throw new Error("Invalid room source persistence claim time");
  return storage.transaction(async (transaction) => {
    const raw = await transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY);
    const current = parsePendingRoomSourcePersistence(raw);
    if (!current) {
      if (raw !== undefined) await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
      await reconcileStoredRoomAlarm(transaction);
      return null;
    }
    if (!options.force && now < current.nextAttemptAt) {
      await reconcileStoredRoomAlarm(transaction);
      return null;
    }

    const attempts = Math.min(
      MAX_ROOM_SOURCE_PERSISTENCE_ATTEMPTS,
      current.attempts + 1,
    );
    const claimed: PendingRoomSourcePersistence = {
      ...current,
      attempts,
      nextAttemptAt: roomSourceRetryAt(attempts, now),
    };
    await transaction.put(ROOM_SOURCE_PENDING_STORAGE_KEY, claimed);
    await reconcileStoredRoomAlarm(transaction);
    return claimed;
  });
}

export async function acknowledgeStoredRoomSourceAttempt(
  storage: DurableObjectStorage,
  sourceGeneration: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(sourceGeneration) || sourceGeneration < 1) return false;
  return storage.transaction(async (transaction) => {
    const raw = await transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY);
    const current = parsePendingRoomSourcePersistence(raw);
    if (!current) {
      if (raw !== undefined) await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
      await reconcileStoredRoomAlarm(transaction);
      return false;
    }
    if (current.callback.sourceGeneration !== sourceGeneration) {
      await reconcileStoredRoomAlarm(transaction);
      return false;
    }
    await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
    const acknowledgedGeneration = parseAcknowledgedGeneration(
      await transaction.get<unknown>(
        ROOM_SOURCE_ACKNOWLEDGED_GENERATION_STORAGE_KEY,
      ),
    );
    await transaction.put(
      ROOM_SOURCE_ACKNOWLEDGED_GENERATION_STORAGE_KEY,
      Math.max(acknowledgedGeneration, sourceGeneration),
    );
    await reconcileStoredRoomAlarm(transaction);
    return true;
  });
}

export function roomSourceRetryAt(attempts: number, now: number): number {
  const exponent = Math.max(0, Math.min(16, Math.floor(attempts) - 1));
  const delay = Math.min(
    ROOM_SOURCE_RETRY_MAX_MS,
    ROOM_SOURCE_RETRY_BASE_MS * (2 ** exponent),
  );
  return Math.min(Number.MAX_SAFE_INTEGER, now + delay);
}

export function nextRoomAlarmAt(
  lifecycle: RoomLifecycleState | null,
  pendingSource: PendingRoomSourcePersistence | null,
  participantDisconnects: ParticipantDisconnectState | null = null,
): number | null {
  const lifecycleAt = lifecycle?.status === "empty"
    ? lifecycle.alarmAt
    : lifecycle?.status === "ending"
      ? lifecycle.nextAttemptAt
      : null;
  const candidates = [
    lifecycleAt,
    pendingSource?.nextAttemptAt ?? null,
    nextParticipantDisconnectAlarmAt(participantDisconnects),
  ].filter((value): value is number => value !== null);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export async function reconcileStoredRoomAlarm(
  transaction: DurableObjectTransaction,
  fallbackAt: number | null = null,
  options: { ignoreLifecycle?: boolean } = {},
): Promise<number | null> {
  const [rawLifecycle, rawPendingSource, rawParticipantDisconnects] = await Promise.all([
    transaction.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY),
    transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY),
    transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
  ]);
  const lifecycle = parseRoomLifecycleState(rawLifecycle);
  const pendingSource = parsePendingRoomSourcePersistence(rawPendingSource);
  if (rawPendingSource !== undefined && !pendingSource) {
    await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
  }
  const participantDisconnects = rawParticipantDisconnects === undefined
    ? null
    : parseParticipantDisconnectState(rawParticipantDisconnects);
  if (rawParticipantDisconnects !== undefined && !participantDisconnects) {
    throw new Error("Invalid persisted participant disconnect state");
  }
  const logicalAlarmAt = nextRoomAlarmAt(
    options.ignoreLifecycle ? null : lifecycle,
    pendingSource,
    participantDisconnects,
  );
  const alarmAt = logicalAlarmAt === null
    ? fallbackAt
    : fallbackAt === null
      ? logicalAlarmAt
      : Math.min(logicalAlarmAt, fallbackAt);
  if (alarmAt === null) {
    await transaction.deleteAlarm();
  } else {
    await transaction.setAlarm(alarmAt);
  }
  return alarmAt;
}

function sameCallback(
  left: RoomSourcePersistenceCallback,
  right: RoomSourcePersistenceCallback,
): boolean {
  return left.roomId === right.roomId &&
    left.sourceGeneration === right.sourceGeneration &&
    left.source.provider === right.source.provider &&
    left.source.sourceUrl === right.source.sourceUrl &&
    left.source.canonicalUrl === right.source.canonicalUrl &&
    left.source.videoFingerprint === right.source.videoFingerprint;
}

async function putPendingRoomSource(
  transaction: DurableObjectTransaction,
  callback: RoomSourcePersistenceCallback,
  now: number,
): Promise<PendingRoomSourcePersistence> {
  const raw = await transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY);
  const current = parsePendingRoomSourcePersistence(raw);
  if (raw !== undefined && !current) {
    await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
  }
  if (current) {
    if (current.callback.roomId !== callback.roomId) {
      throw new Error("Conflicting room source persistence room");
    }
    const currentGeneration = current.callback.sourceGeneration;
    const nextGeneration = callback.sourceGeneration;
    if (nextGeneration < currentGeneration) {
      await reconcileStoredRoomAlarm(transaction);
      return current;
    }
    if (nextGeneration === currentGeneration) {
      if (!sameCallback(current.callback, callback)) {
        throw new Error("Conflicting room source persistence generation");
      }
      await reconcileStoredRoomAlarm(transaction);
      return current;
    }
  }

  const pending: PendingRoomSourcePersistence = {
    schemaVersion: 1,
    callback,
    attempts: 0,
    nextAttemptAt: now,
  };
  await transaction.put(ROOM_SOURCE_PENDING_STORAGE_KEY, pending);
  await reconcileStoredRoomAlarm(transaction);
  return pending;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseAcknowledgedGeneration(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 1
    ? value as number
    : 0;
}
