import {
  MAX_PARTICIPANT_ID_CHARS,
  MAX_SESSION_ID_CHARS,
  ROOM_DISCONNECT_GRACE_MS,
} from "@anidachi/protocol";

export const PARTICIPANT_DISCONNECT_STORAGE_KEY =
  "participant_disconnects_v1";
export const PARTICIPANT_DISCONNECT_RETRY_BASE_MS = 5_000;
export const PARTICIPANT_DISCONNECT_RETRY_MAX_MS = 5 * 60_000;
export const MAX_PARTICIPANT_DISCONNECT_ATTEMPTS = 32;
export const MAX_PERSISTED_PARTICIPANT_DISCONNECTS = 50;

export interface PendingParticipantDisconnect {
  userId: string;
  role: "host" | "member";
  participantSessionId: string;
  disconnectedAt: number;
  deadlineAt: number;
  departureAt: number;
  attempts: number;
  nextAttemptAt: number;
}

export interface ParticipantDisconnectState {
  schemaVersion: 1;
  records: PendingParticipantDisconnect[];
}

export type ParticipantDisconnectAlarmReconciler = (
  transaction: DurableObjectTransaction,
) => Promise<number | null>;

export function createParticipantDisconnect(input: {
  userId: string;
  role: "host" | "member";
  participantSessionId: string;
  disconnectedAt: number;
}): PendingParticipantDisconnect {
  if (
    !isBoundedId(input.userId, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedId(input.participantSessionId, MAX_SESSION_ID_CHARS) ||
    (input.role !== "host" && input.role !== "member") ||
    !isTimestamp(input.disconnectedAt) ||
    input.disconnectedAt > Number.MAX_SAFE_INTEGER - ROOM_DISCONNECT_GRACE_MS
  ) {
    throw new Error("Invalid participant disconnect");
  }
  const deadlineAt = input.disconnectedAt + ROOM_DISCONNECT_GRACE_MS;
  return {
    ...input,
    deadlineAt,
    departureAt: deadlineAt,
    attempts: 0,
    nextAttemptAt: deadlineAt,
  };
}

export function parseParticipantDisconnectState(
  value: unknown,
): ParticipantDisconnectState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !hasExactKeys(value, ["records", "schemaVersion"]) ||
    !Array.isArray(value.records) ||
    value.records.length === 0 ||
    value.records.length > MAX_PERSISTED_PARTICIPANT_DISCONNECTS
  ) {
    return null;
  }

  const records: PendingParticipantDisconnect[] = [];
  const userIds = new Set<string>();
  for (const raw of value.records) {
    const record = parseParticipantDisconnect(raw);
    if (!record || userIds.has(record.userId)) return null;
    userIds.add(record.userId);
    records.push(record);
  }
  return normalizedState(records);
}

export function upsertParticipantDisconnect(
  state: ParticipantDisconnectState | null,
  record: PendingParticipantDisconnect,
  maxRecords: number,
): ParticipantDisconnectState {
  const parsedRecord = parseParticipantDisconnect(record);
  if (
    !parsedRecord ||
    !Number.isSafeInteger(maxRecords) ||
    maxRecords < 1 ||
    maxRecords > MAX_PERSISTED_PARTICIPANT_DISCONNECTS
  ) {
    throw new Error("Invalid participant disconnect state update");
  }
  const current = state?.records ?? [];
  const replacing = current.some((item) => item.userId === parsedRecord.userId);
  if (!replacing && current.length >= maxRecords) {
    throw new Error("Participant disconnect capacity exceeded");
  }
  return normalizedState([
    ...current.filter((item) => item.userId !== parsedRecord.userId),
    parsedRecord,
  ]);
}

export function cancelParticipantDisconnectForJoin(
  state: ParticipantDisconnectState | null,
  userId: string,
  participantSessionId: string,
): {
  outcome: "none" | "reconnected" | "taken_over";
  state: ParticipantDisconnectState | null;
} {
  const current = exactUserRecord(state, userId);
  if (!current) return { outcome: "none", state };
  return {
    outcome: current.participantSessionId === participantSessionId
      ? "reconnected"
      : "taken_over",
    state: withoutUser(state, userId),
  };
}

export function expediteParticipantDisconnect(
  state: ParticipantDisconnectState | null,
  userId: string,
  participantSessionId: string,
  requestedAt: number,
): {
  outcome: "expedited" | "stale";
  state: ParticipantDisconnectState | null;
} {
  if (!isTimestamp(requestedAt)) {
    throw new Error("Invalid participant departure time");
  }
  const current = exactSessionRecord(state, userId, participantSessionId);
  if (!current) return { outcome: "stale", state };
  return {
    outcome: "expedited",
    state: replaceRecord(state, {
      ...current,
      departureAt: Math.min(current.departureAt, requestedAt),
      nextAttemptAt: Math.min(current.nextAttemptAt, requestedAt),
    }),
  };
}

export function claimDueParticipantDisconnects(
  state: ParticipantDisconnectState | null,
  now: number,
): {
  claimed: PendingParticipantDisconnect[];
  state: ParticipantDisconnectState | null;
} {
  if (!isTimestamp(now)) throw new Error("Invalid participant disconnect claim time");
  if (!state) return { claimed: [], state };

  const claimed: PendingParticipantDisconnect[] = [];
  const records = state.records.map((record) => {
    if (record.nextAttemptAt > now) return record;
    const attempts = Math.min(
      MAX_PARTICIPANT_DISCONNECT_ATTEMPTS,
      record.attempts + 1,
    );
    const next = {
      ...record,
      attempts,
      nextAttemptAt: participantDisconnectRetryAt(attempts, now),
    };
    claimed.push(next);
    return next;
  });
  claimed.sort(compareRecords);
  return { claimed, state: normalizedState(records) };
}

export function claimParticipantDisconnect(
  state: ParticipantDisconnectState | null,
  userId: string,
  participantSessionId: string,
  now: number,
  force = false,
): {
  claimed: PendingParticipantDisconnect | null;
  state: ParticipantDisconnectState | null;
} {
  if (!isTimestamp(now)) throw new Error("Invalid participant disconnect claim time");
  const current = exactSessionRecord(state, userId, participantSessionId);
  if (!current || (!force && current.nextAttemptAt > now)) {
    return { claimed: null, state };
  }
  const attempts = Math.min(
    MAX_PARTICIPANT_DISCONNECT_ATTEMPTS,
    current.attempts + 1,
  );
  const claimed = {
    ...current,
    attempts,
    nextAttemptAt: participantDisconnectRetryAt(attempts, now),
  };
  return { claimed, state: replaceRecord(state, claimed) };
}

export function acknowledgeParticipantDisconnect(
  state: ParticipantDisconnectState | null,
  userId: string,
  participantSessionId: string,
): {
  outcome: "acknowledged" | "stale";
  state: ParticipantDisconnectState | null;
} {
  if (!exactSessionRecord(state, userId, participantSessionId)) {
    return { outcome: "stale", state };
  }
  return { outcome: "acknowledged", state: withoutUser(state, userId) };
}

export function nextParticipantDisconnectAlarmAt(
  state: ParticipantDisconnectState | null,
): number | null {
  if (!state) return null;
  return state.records.reduce(
    (earliest, record) => Math.min(earliest, record.nextAttemptAt),
    Number.MAX_SAFE_INTEGER,
  );
}

export function participantDisconnectRetryAt(
  attempts: number,
  now: number,
): number {
  const exponent = Math.max(0, Math.min(16, Math.floor(attempts) - 1));
  const delay = Math.min(
    PARTICIPANT_DISCONNECT_RETRY_MAX_MS,
    PARTICIPANT_DISCONNECT_RETRY_BASE_MS * (2 ** exponent),
  );
  return Math.min(Number.MAX_SAFE_INTEGER, now + delay);
}

export async function readStoredParticipantDisconnects(
  storage: DurableObjectStorage,
): Promise<ParticipantDisconnectState | null> {
  const raw = await storage.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY);
  return strictStoredState(raw);
}

export async function storeParticipantDisconnect(
  storage: DurableObjectStorage,
  record: PendingParticipantDisconnect,
  maxRecords: number,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
): Promise<ParticipantDisconnectState> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const state = upsertParticipantDisconnect(current, record, maxRecords);
    await writeStoredState(transaction, state);
    await reconcileAlarm(transaction);
    return state;
  });
}

export async function cancelStoredParticipantDisconnectForJoin(
  storage: DurableObjectStorage,
  userId: string,
  participantSessionId: string,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
): Promise<"none" | "reconnected" | "taken_over"> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const result = cancelParticipantDisconnectForJoin(
      current,
      userId,
      participantSessionId,
    );
    if (result.outcome !== "none") {
      await writeStoredState(transaction, result.state);
    }
    await reconcileAlarm(transaction);
    return result.outcome;
  });
}

export async function expediteStoredParticipantDisconnect(
  storage: DurableObjectStorage,
  userId: string,
  participantSessionId: string,
  requestedAt: number,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
): Promise<"expedited" | "stale"> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const result = expediteParticipantDisconnect(
      current,
      userId,
      participantSessionId,
      requestedAt,
    );
    if (result.outcome === "expedited") {
      await writeStoredState(transaction, result.state);
    }
    await reconcileAlarm(transaction);
    return result.outcome;
  });
}

export async function claimStoredParticipantDisconnect(
  storage: DurableObjectStorage,
  userId: string,
  participantSessionId: string,
  now: number,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
  force = false,
): Promise<PendingParticipantDisconnect | null> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const result = claimParticipantDisconnect(
      current,
      userId,
      participantSessionId,
      now,
      force,
    );
    if (result.claimed) {
      await writeStoredState(transaction, result.state);
    }
    await reconcileAlarm(transaction);
    return result.claimed;
  });
}

export async function claimDueStoredParticipantDisconnects(
  storage: DurableObjectStorage,
  now: number,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
): Promise<PendingParticipantDisconnect[]> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const result = claimDueParticipantDisconnects(current, now);
    if (result.claimed.length > 0) {
      await writeStoredState(transaction, result.state);
    }
    await reconcileAlarm(transaction);
    return result.claimed;
  });
}

export async function acknowledgeStoredParticipantDisconnect(
  storage: DurableObjectStorage,
  userId: string,
  participantSessionId: string,
  reconcileAlarm: ParticipantDisconnectAlarmReconciler,
): Promise<"acknowledged" | "stale"> {
  return storage.transaction(async (transaction) => {
    const current = strictStoredState(
      await transaction.get<unknown>(PARTICIPANT_DISCONNECT_STORAGE_KEY),
    );
    const result = acknowledgeParticipantDisconnect(
      current,
      userId,
      participantSessionId,
    );
    if (result.outcome === "acknowledged") {
      await writeStoredState(transaction, result.state);
    }
    await reconcileAlarm(transaction);
    return result.outcome;
  });
}

function parseParticipantDisconnect(
  value: unknown,
): PendingParticipantDisconnect | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "attempts",
      "deadlineAt",
      "departureAt",
      "disconnectedAt",
      "nextAttemptAt",
      "participantSessionId",
      "role",
      "userId",
    ]) ||
    !isBoundedId(value.userId, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedId(value.participantSessionId, MAX_SESSION_ID_CHARS) ||
    (value.role !== "host" && value.role !== "member") ||
    !isTimestamp(value.disconnectedAt) ||
    !isTimestamp(value.deadlineAt) ||
    value.deadlineAt !== value.disconnectedAt + ROOM_DISCONNECT_GRACE_MS ||
    !isTimestamp(value.departureAt) ||
    value.departureAt < value.disconnectedAt ||
    value.departureAt > value.deadlineAt ||
    !Number.isSafeInteger(value.attempts) ||
    (value.attempts as number) < 0 ||
    (value.attempts as number) > MAX_PARTICIPANT_DISCONNECT_ATTEMPTS ||
    !isTimestamp(value.nextAttemptAt)
  ) {
    return null;
  }
  return {
    userId: value.userId,
    role: value.role,
    participantSessionId: value.participantSessionId,
    disconnectedAt: value.disconnectedAt,
    deadlineAt: value.deadlineAt,
    departureAt: value.departureAt,
    attempts: value.attempts as number,
    nextAttemptAt: value.nextAttemptAt,
  };
}

function strictStoredState(value: unknown): ParticipantDisconnectState | null {
  if (value === undefined) return null;
  const parsed = parseParticipantDisconnectState(value);
  if (!parsed) {
    throw new Error("Invalid persisted participant disconnect state");
  }
  return parsed;
}

async function writeStoredState(
  transaction: DurableObjectTransaction,
  state: ParticipantDisconnectState | null,
): Promise<void> {
  if (state) {
    await transaction.put(PARTICIPANT_DISCONNECT_STORAGE_KEY, state);
  } else {
    await transaction.delete(PARTICIPANT_DISCONNECT_STORAGE_KEY);
  }
}

function exactUserRecord(
  state: ParticipantDisconnectState | null,
  userId: string,
): PendingParticipantDisconnect | undefined {
  return state?.records.find((record) => record.userId === userId);
}

function exactSessionRecord(
  state: ParticipantDisconnectState | null,
  userId: string,
  participantSessionId: string,
): PendingParticipantDisconnect | undefined {
  const record = exactUserRecord(state, userId);
  return record?.participantSessionId === participantSessionId
    ? record
    : undefined;
}

function withoutUser(
  state: ParticipantDisconnectState | null,
  userId: string,
): ParticipantDisconnectState | null {
  if (!state) return null;
  const records = state.records.filter((record) => record.userId !== userId);
  return records.length > 0 ? normalizedState(records) : null;
}

function replaceRecord(
  state: ParticipantDisconnectState | null,
  replacement: PendingParticipantDisconnect,
): ParticipantDisconnectState {
  return normalizedState([
    ...(state?.records ?? []).filter(
      (record) => record.userId !== replacement.userId,
    ),
    replacement,
  ]);
}

function normalizedState(
  records: PendingParticipantDisconnect[],
): ParticipantDisconnectState {
  return {
    schemaVersion: 1,
    records: [...records].sort(compareRecords),
  };
}

function compareRecords(
  left: PendingParticipantDisconnect,
  right: PendingParticipantDisconnect,
): number {
  return left.nextAttemptAt - right.nextAttemptAt ||
    left.userId.localeCompare(right.userId);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedId(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxChars;
}
