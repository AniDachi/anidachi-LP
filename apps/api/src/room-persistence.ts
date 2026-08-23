import {
  ParticipantSchema,
  PlaybackStateSchema,
  RoomCapabilitiesSchema,
  RoomUsageSummarySchema,
  WatchSourceDescriptorSchema,
  createEmptyRoomEndEventId,
  type Participant,
} from "@anidachi/protocol";
import type { BufferedP2PSignalEvent } from "./p2p-signal-buffer";
import { parseRoomMeterState, type RoomMeterState } from "./room-metering";
import type { RoomStateSnapshot } from "./room-state";
import {
  ROOM_LIFECYCLE_STORAGE_KEY,
  activeRoomLifecycle,
  emptyRoomLifecycle,
  emptyRoomRetryAt,
  parseEndRoomCommand,
  parseRoomLifecycleState,
  type EndedRoomTombstone,
  type EndingRoomLifecycle,
  type RoomLifecycleState,
} from "./room-lifecycle";
import {
  ROOM_SOURCE_PENDING_STORAGE_KEY,
  parsePendingRoomSourcePersistence,
  reconcileStoredRoomAlarm,
} from "./room-source-persistence";

export const ROOM_STATE_META_KEY = "room_state";
export const NEXT_P2P_SERVER_SEQ_META_KEY = "next_p2p_server_seq";
export const ROOM_ENDED_META_KEY = "room_ended";
export const ROOM_METER_META_KEY = "room_meter";
export const P2P_REPLAY_TTL_MS = 45_000;
export const P2P_REPLAY_MAX_EVENTS = 80;

interface RoomMetaRow {
  [key: string]: ArrayBuffer | number | string | null;
  key: string;
  updated_at: number;
  value_json: string;
}

interface P2PReplayMetadataRow {
  [key: string]: ArrayBuffer | number | string | null;
  dedupe_hash: string;
  room_generation: number;
  server_received_at: number;
  server_seq: number;
  signal_kind: string;
  source_generation: number;
}

export interface StoredP2PReplayMetadata {
  dedupeHash: string;
  roomGeneration: number;
  serverReceivedAt: number;
  serverSeq: number;
  signalKind: BufferedP2PSignalEvent["signal"]["kind"];
  sourceGeneration: number;
}

export function initializeRoomStorage(storage: DurableObjectStorage): void {
  storage.sql.exec(
    `CREATE TABLE IF NOT EXISTS room_meta (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  );
  // Earlier builds stored complete P2P envelopes, including SDP and ICE, in
  // p2p_replay. They cannot be migrated safely, so remove that legacy table
  // before creating the metadata-only replacement.
  storage.sql.exec("DROP TABLE IF EXISTS p2p_replay");
  storage.sql.exec(
    `CREATE TABLE IF NOT EXISTS p2p_replay_meta (
      server_seq INTEGER PRIMARY KEY,
      dedupe_hash TEXT NOT NULL UNIQUE,
      room_generation INTEGER NOT NULL,
      source_generation INTEGER NOT NULL,
      server_received_at INTEGER NOT NULL,
      signal_kind TEXT NOT NULL
    )`,
  );
  storage.sql.exec(
    "CREATE INDEX IF NOT EXISTS idx_p2p_replay_meta_received_at ON p2p_replay_meta (server_received_at)",
  );
}

export function readStoredRoomState(storage: DurableObjectStorage): RoomStateSnapshot | null {
  const row = storage.sql
    .exec<RoomMetaRow>("SELECT value_json, updated_at, key FROM room_meta WHERE key = ?", ROOM_STATE_META_KEY)
    .toArray()[0];
  if (!row) {
    return null;
  }

  try {
    return parseRoomStateSnapshot(JSON.parse(row.value_json));
  } catch {
    return null;
  }
}

export function writeStoredRoomState(
  storage: DurableObjectStorage,
  snapshot: RoomStateSnapshot,
): void {
  writeMeta(storage, ROOM_STATE_META_KEY, snapshot, snapshot.updatedAt);
}

export function readStoredRoomMeter(
  storage: DurableObjectStorage,
): RoomMeterState | null {
  const row = storage.sql
    .exec<RoomMetaRow>(
      "SELECT value_json, updated_at, key FROM room_meta WHERE key = ?",
      ROOM_METER_META_KEY,
    )
    .toArray()[0];
  if (!row) return null;
  try {
    return parseRoomMeterState(JSON.parse(row.value_json));
  } catch {
    return null;
  }
}

export function writeStoredRoomMeter(
  storage: DurableObjectStorage,
  meter: RoomMeterState,
  updatedAt: number,
): void {
  writeMeta(storage, ROOM_METER_META_KEY, meter, updatedAt);
}

export function readNextP2PServerSeq(storage: DurableObjectStorage): number | null {
  const row = storage.sql
    .exec<RoomMetaRow>(
      "SELECT value_json, updated_at, key FROM room_meta WHERE key = ?",
      NEXT_P2P_SERVER_SEQ_META_KEY,
    )
    .toArray()[0];
  if (!row) {
    return null;
  }

  try {
    const value = JSON.parse(row.value_json);
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeNextP2PServerSeq(storage: DurableObjectStorage, nextSeq: number): void {
  writeMeta(storage, NEXT_P2P_SERVER_SEQ_META_KEY, nextSeq, Date.now());
}

export function readEndedRoomTombstone(storage: DurableObjectStorage): EndedRoomTombstone | null {
  const row = storage.sql
    .exec<RoomMetaRow>("SELECT value_json, updated_at, key FROM room_meta WHERE key = ?", ROOM_ENDED_META_KEY)
    .toArray()[0];
  if (!row) return null;
  try {
    const value = JSON.parse(row.value_json) as Record<string, unknown>;
    const command = parseEndRoomCommand(value);
    const usage =
      value.usage === undefined
        ? undefined
        : RoomUsageSummarySchema.safeParse(value.usage);
    return value.schemaVersion === 1 &&
      command &&
      (usage === undefined || usage.success) &&
      (value.usageFinalized === undefined || value.usageFinalized === true)
      ? {
          schemaVersion: 1,
          ...command,
          ...(usage?.success ? { usage: usage.data } : {}),
          ...(value.usageFinalized === true
            ? { usageFinalized: true as const }
            : {}),
        }
      : null;
  } catch {
    return null;
  }
}

export function persistEndedRoomTombstoneAndClearRuntime(
  storage: DurableObjectStorage,
  tombstone: EndedRoomTombstone,
): void {
  storage.transactionSync(() => {
    writeMeta(storage, ROOM_ENDED_META_KEY, tombstone, tombstone.endedAt);
    storage.sql.exec("DELETE FROM p2p_replay_meta");
    storage.sql.exec("DROP TABLE IF EXISTS p2p_replay");
    storage.sql.exec(
      "DELETE FROM room_meta WHERE key IN (?, ?, ?)",
      ROOM_STATE_META_KEY,
      NEXT_P2P_SERVER_SEQ_META_KEY,
      ROOM_METER_META_KEY,
    );
  });
}

export async function readStoredRoomLifecycle(
  storage: DurableObjectStorage,
): Promise<RoomLifecycleState | null> {
  return parseRoomLifecycleState(
    await storage.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY),
  );
}

export async function activateStoredRoomLifecycle(
  storage: DurableObjectStorage,
  updatedAt: number,
): Promise<{ accepted: boolean; lifecycle: RoomLifecycleState | null }> {
  return storage.transaction(async (transaction) => {
    const raw = await transaction.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY);
    const current = parseStoredLifecycle(raw);
    if (current === "invalid") {
      return { accepted: false, lifecycle: null };
    }
    if (current?.status === "ending" || current?.status === "ended") {
      await reconcileStoredRoomAlarm(transaction);
      return { accepted: false, lifecycle: current };
    }

    const active = activeRoomLifecycle(updatedAt);
    await transaction.put(ROOM_LIFECYCLE_STORAGE_KEY, active);
    await reconcileStoredRoomAlarm(transaction);
    return { accepted: true, lifecycle: active };
  });
}

export async function markStoredRoomEmpty(
  storage: DurableObjectStorage,
  emptySince: number,
): Promise<RoomLifecycleState> {
  return storage.transaction(async (transaction) => {
    const raw = await transaction.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY);
    const current = parseStoredLifecycle(raw);
    if (current === "invalid") {
      throw new Error("Invalid persisted room lifecycle state");
    }
    if (current?.status === "ending" || current?.status === "ended") {
      await reconcileStoredRoomAlarm(transaction);
      return current;
    }
    if (current?.status === "empty") {
      await reconcileStoredRoomAlarm(transaction);
      return current;
    }

    const empty = emptyRoomLifecycle(emptySince);
    await transaction.put(ROOM_LIFECYCLE_STORAGE_KEY, empty);
    await reconcileStoredRoomAlarm(transaction);
    return empty;
  });
}

/**
 * Claims one due callback attempt. The ending outbox and its next retry alarm
 * are committed together before the caller performs external I/O.
 */
export async function claimStoredRoomEndAttempt(
  storage: DurableObjectStorage,
  roomId: string,
  now: number,
): Promise<EndingRoomLifecycle | null> {
  return storage.transaction(async (transaction) => {
    const rawPendingSource = await transaction.get<unknown>(ROOM_SOURCE_PENDING_STORAGE_KEY);
    const pendingSource = parsePendingRoomSourcePersistence(rawPendingSource);
    if (rawPendingSource !== undefined && !pendingSource) {
      await transaction.delete(ROOM_SOURCE_PENDING_STORAGE_KEY);
    }
    if (pendingSource) {
      // A due room end cannot make progress until the latest source is durable.
      // Schedule the source retry directly instead of repeatedly re-firing an
      // already-due lifecycle deadline.
      await transaction.setAlarm(pendingSource.nextAttemptAt);
      return null;
    }

    const raw = await transaction.get<unknown>(ROOM_LIFECYCLE_STORAGE_KEY);
    const current = parseStoredLifecycle(raw);
    if (current === "invalid") {
      await transaction.setAlarm(emptyRoomRetryAt(1, now));
      return null;
    }
    if (!current || current.status === "active" || current.status === "ended") {
      await reconcileStoredRoomAlarm(transaction);
      return null;
    }

    if (current.status === "empty") {
      if (now < current.alarmAt) {
        await reconcileStoredRoomAlarm(transaction);
        return null;
      }
      const attempts = 1;
      const ending: EndingRoomLifecycle = {
        schemaVersion: 1,
        status: "ending",
        emptySince: current.emptySince,
        endedAt: current.alarmAt,
        eventId: await createEmptyRoomEndEventId(roomId, current.emptySince),
        attempts,
        nextAttemptAt: emptyRoomRetryAt(attempts, now),
      };
      await transaction.put(ROOM_LIFECYCLE_STORAGE_KEY, ending);
      await reconcileStoredRoomAlarm(transaction);
      return ending;
    }

    if (now < current.nextAttemptAt) {
      await reconcileStoredRoomAlarm(transaction);
      return null;
    }
    const attempts = Math.min(Number.MAX_SAFE_INTEGER, current.attempts + 1);
    const ending: EndingRoomLifecycle = {
      ...current,
      attempts,
      nextAttemptAt: emptyRoomRetryAt(attempts, now),
    };
    await transaction.put(ROOM_LIFECYCLE_STORAGE_KEY, ending);
    await reconcileStoredRoomAlarm(transaction);
    return ending;
  });
}

export async function clearStoredRoomLifecycleAndAlarm(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.transaction(async (transaction) => {
    await transaction.delete(ROOM_LIFECYCLE_STORAGE_KEY);
    await reconcileStoredRoomAlarm(transaction);
  });
}

export function readStoredP2PReplayMetadata(
  storage: DurableObjectStorage,
  now = Date.now(),
): StoredP2PReplayMetadata[] {
  pruneStoredP2PReplayMetadata(storage, now);
  const rows = storage.sql
    .exec<P2PReplayMetadataRow>(
      `SELECT server_seq, dedupe_hash, room_generation, source_generation,
              server_received_at, signal_kind
       FROM p2p_replay_meta
       ORDER BY server_seq DESC
       LIMIT ?`,
      P2P_REPLAY_MAX_EVENTS,
    )
    .toArray()
    .sort((a, b) => a.server_seq - b.server_seq);

  const metadata: StoredP2PReplayMetadata[] = [];
  for (const row of rows) {
    const parsed = parseStoredP2PReplayMetadataRow(row);
    if (parsed) {
      metadata.push(parsed);
    } else {
      storage.sql.exec("DELETE FROM p2p_replay_meta WHERE server_seq = ?", row.server_seq);
    }
  }
  return metadata;
}

export function createStoredP2PReplayMetadata(
  event: BufferedP2PSignalEvent,
  dedupeHash: string,
): StoredP2PReplayMetadata {
  return {
    dedupeHash,
    roomGeneration: event.roomGeneration,
    serverReceivedAt: event.serverReceivedAt,
    serverSeq: event.serverSeq,
    signalKind: event.signal.kind,
    sourceGeneration: event.sourceGeneration,
  };
}

export function writeStoredP2PReplayMetadata(
  storage: DurableObjectStorage,
  metadata: StoredP2PReplayMetadata,
  now = Date.now(),
): void {
  storage.sql.exec(
    `INSERT OR IGNORE INTO p2p_replay_meta (
      server_seq,
      dedupe_hash,
      room_generation,
      source_generation,
      server_received_at,
      signal_kind
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    metadata.serverSeq,
    metadata.dedupeHash,
    metadata.roomGeneration,
    metadata.sourceGeneration,
    metadata.serverReceivedAt,
    metadata.signalKind,
  );
  pruneStoredP2PReplayMetadata(storage, now);
}

export function pruneStoredP2PReplayMetadata(
  storage: DurableObjectStorage,
  now = Date.now(),
): void {
  storage.sql.exec(
    "DELETE FROM p2p_replay_meta WHERE server_received_at < ?",
    now - P2P_REPLAY_TTL_MS,
  );
  storage.sql.exec(
    `DELETE FROM p2p_replay_meta
     WHERE server_seq NOT IN (
       SELECT server_seq
       FROM p2p_replay_meta
       ORDER BY server_seq DESC
       LIMIT ?
     )`,
    P2P_REPLAY_MAX_EVENTS,
  );
}

function parseStoredP2PReplayMetadataRow(
  row: P2PReplayMetadataRow,
): StoredP2PReplayMetadata | null {
  if (
    !isNonNegativeInteger(row.server_seq) ||
    !isNonNegativeInteger(row.room_generation) ||
    !isNonNegativeInteger(row.source_generation) ||
    !isNonNegativeInteger(row.server_received_at) ||
    typeof row.dedupe_hash !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.dedupe_hash) ||
    !isP2PSignalKind(row.signal_kind)
  ) {
    return null;
  }

  return {
    dedupeHash: row.dedupe_hash,
    roomGeneration: row.room_generation,
    serverReceivedAt: row.server_received_at,
    serverSeq: row.server_seq,
    signalKind: row.signal_kind,
    sourceGeneration: row.source_generation,
  };
}

function isP2PSignalKind(value: unknown): value is BufferedP2PSignalEvent["signal"]["kind"] {
  return (
    value === "offer" ||
    value === "answer" ||
    value === "ice" ||
    value === "voice-start" ||
    value === "voice-stop" ||
    value === "renegotiate" ||
    value === "restart-ice" ||
    value === "bye"
  );
}

function writeMeta(storage: DurableObjectStorage, key: string, value: unknown, updatedAt: number): void {
  storage.sql.exec(
    `INSERT INTO room_meta (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    updatedAt,
  );
}

function parseStoredLifecycle(
  raw: unknown,
): RoomLifecycleState | null | "invalid" {
  if (raw === undefined) return null;
  return parseRoomLifecycleState(raw) ?? "invalid";
}

export function parseRoomStateSnapshot(value: unknown): RoomStateSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.schemaVersion !== 1) {
    return null;
  }
  if (!isNonNegativeInteger(value.updatedAt)) {
    return null;
  }
  if (value.hostId !== null && typeof value.hostId !== "string") {
    return null;
  }
  if (
    !isNonNegativeInteger(value.roomGeneration) ||
    !isNonNegativeInteger(value.serverSeq) ||
    !isNonNegativeInteger(value.sourceGeneration)
  ) {
    return null;
  }

  const capabilities = RoomCapabilitiesSchema.safeParse(value.capabilities);
  if (!capabilities.success) {
    return null;
  }
  if (!Array.isArray(value.participants)) {
    return null;
  }
  const parsedParticipants: { hadMediaSeat: boolean; participant: Participant }[] = [];
  for (const participantValue of value.participants) {
    if (!isRecord(participantValue)) {
      return null;
    }
    const hadMediaSeat = "mediaSeat" in participantValue;
    const participant = ParticipantSchema.safeParse(participantValue);
    if (!participant.success) {
      return null;
    }
    parsedParticipants.push({ hadMediaSeat, participant: participant.data });
  }

  let occupiedMediaSeats = parsedParticipants.filter(
    ({ hadMediaSeat, participant }) => hadMediaSeat && participant.mediaSeat === "joined",
  ).length;
  const participants = parsedParticipants.map(({ hadMediaSeat, participant }) => {
    if (hadMediaSeat) {
      return participant;
    }

    const canMigrateToJoined =
      capabilities.data.maxMediaSeats > 0 &&
      occupiedMediaSeats < capabilities.data.maxMediaSeats &&
      (parsedParticipants.length <= capabilities.data.maxMediaSeats ||
        participant.cameraEnabled);
    if (canMigrateToJoined) {
      occupiedMediaSeats += 1;
      return {
        ...participant,
        mediaSeat: "joined" as const,
        mediaSeatSource: "auto" as const,
      };
    }

    return {
      ...participant,
      cameraEnabled: false,
      mediaSeat: "none" as const,
      mediaSeatSource: undefined,
    };
  });

  if (
    value.hostId !== null &&
    !participants.some((participant) => participant.id === value.hostId)
  ) {
    return null;
  }

  const snapshot: RoomStateSnapshot = {
    schemaVersion: 1,
    capabilities: capabilities.data,
    hostId: value.hostId,
    participants,
    roomGeneration: value.roomGeneration,
    serverSeq: value.serverSeq,
    sourceGeneration: value.sourceGeneration,
    updatedAt: value.updatedAt,
  };

  if (value.hostState !== undefined) {
    const hostState = PlaybackStateSchema.safeParse(value.hostState);
    if (!hostState.success) {
      return null;
    }
    snapshot.hostState = hostState.data;
  }

  if (value.source !== undefined) {
    const source = WatchSourceDescriptorSchema.safeParse(value.source);
    if (!source.success) {
      return null;
    }
    snapshot.source = source.data;
  }

  return snapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
