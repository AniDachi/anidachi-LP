import {
  RoomSourcePersistenceCallbackSchema,
  type RoomSourcePersistenceCallback,
} from "@anidachi/protocol";
import {
  ROOM_LIFECYCLE_STORAGE_KEY,
  parseRoomLifecycleState,
  type RoomLifecycleState,
} from "./room-lifecycle";

export const ROOM_SOURCE_PENDING_STORAGE_KEY = "room_source_pending_v1";
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

export async function enqueueStoredRoomSource(
  storage: DurableObjectStorage,
  callback: RoomSourcePersistenceCallback,
  now: number,
): Promise<PendingRoomSourcePersistence> {
  const parsedCallback = RoomSourcePersistenceCallbackSchema.safeParse(callback);
  if (!parsedCallback.success || !isTimestamp(now)) {
    throw new Error("Invalid room source persistence callback");
  }

  return storage.transaction(async (transaction) => {
    const raw = await transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY);
    const current = parsePendingRoomSourcePersistence(raw);
    if (raw !== undefined && !current) {
      await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
    }
    if (current) {
      if (current.callback.roomId !== parsedCallback.data.roomId) {
        throw new Error("Conflicting room source persistence room");
      }
      const currentGeneration = current.callback.sourceGeneration;
      const nextGeneration = parsedCallback.data.sourceGeneration;
      if (nextGeneration < currentGeneration) {
        await reconcileStoredRoomAlarm(transaction);
        return current;
      }
      if (nextGeneration === currentGeneration) {
        if (!sameCallback(current.callback, parsedCallback.data)) {
          throw new Error("Conflicting room source persistence generation");
        }
        await reconcileStoredRoomAlarm(transaction);
        return current;
      }
    }

    const pending: PendingRoomSourcePersistence = {
      schemaVersion: 1,
      callback: parsedCallback.data,
      attempts: 0,
      nextAttemptAt: now,
    };
    await transaction.put(ROOM_SOURCE_PENDING_STORAGE_KEY, pending);
    await reconcileStoredRoomAlarm(transaction);
    return pending;
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
): number | null {
  const lifecycleAt = lifecycle?.status === "empty"
    ? lifecycle.alarmAt
    : lifecycle?.status === "ending"
      ? lifecycle.nextAttemptAt
      : null;
  if (lifecycleAt === null) return pendingSource?.nextAttemptAt ?? null;
  if (!pendingSource) return lifecycleAt;
  return Math.min(lifecycleAt, pendingSource.nextAttemptAt);
}

export async function reconcileStoredRoomAlarm(
  transaction: DurableObjectTransaction,
): Promise<number | null> {
  const [rawLifecycle, rawPendingSource] = await Promise.all([
    transaction.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY),
    transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY),
  ]);
  const lifecycle = parseRoomLifecycleState(rawLifecycle);
  const pendingSource = parsePendingRoomSourcePersistence(rawPendingSource);
  if (rawPendingSource !== undefined && !pendingSource) {
    await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
  }
  const alarmAt = nextRoomAlarmAt(lifecycle, pendingSource);
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
