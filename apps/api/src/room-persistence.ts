import {
  ParticipantSchema,
  PlaybackStateSchema,
  RoomCapabilitiesSchema,
  ServerEventSchema,
  WatchSourceDescriptorSchema,
  type Participant,
} from "@anidachi/protocol";
import type { BufferedP2PSignalEvent } from "./p2p-signal-buffer";
import type { RoomStateSnapshot } from "./room-state";

export const ROOM_STATE_META_KEY = "room_state";
export const NEXT_P2P_SERVER_SEQ_META_KEY = "next_p2p_server_seq";
export const P2P_REPLAY_TTL_MS = 45_000;
export const P2P_REPLAY_MAX_EVENTS = 80;

interface RoomMetaRow {
  [key: string]: ArrayBuffer | number | string | null;
  key: string;
  updated_at: number;
  value_json: string;
}

interface P2PReplayRow {
  [key: string]: ArrayBuffer | number | string | null;
  event_json: string;
  server_seq: number;
}

export function initializeRoomStorage(storage: DurableObjectStorage): void {
  storage.sql.exec(
    `CREATE TABLE IF NOT EXISTS room_meta (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  );
  storage.sql.exec(
    `CREATE TABLE IF NOT EXISTS p2p_replay (
      server_seq INTEGER PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      to_user_id TEXT NOT NULL,
      room_generation INTEGER NOT NULL,
      source_generation INTEGER NOT NULL,
      server_received_at INTEGER NOT NULL,
      event_json TEXT NOT NULL
    )`,
  );
  storage.sql.exec(
    "CREATE INDEX IF NOT EXISTS idx_p2p_replay_target_seq ON p2p_replay (to_user_id, server_seq)",
  );
  storage.sql.exec(
    "CREATE INDEX IF NOT EXISTS idx_p2p_replay_received_at ON p2p_replay (server_received_at)",
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

export function readStoredP2PReplay(
  storage: DurableObjectStorage,
  now = Date.now(),
): BufferedP2PSignalEvent[] {
  pruneStoredP2PReplay(storage, now);
  const rows = storage.sql
    .exec<P2PReplayRow>(
      `SELECT server_seq, event_json
       FROM p2p_replay
       ORDER BY server_seq DESC
       LIMIT ?`,
      P2P_REPLAY_MAX_EVENTS,
    )
    .toArray()
    .sort((a, b) => a.server_seq - b.server_seq);

  const events: BufferedP2PSignalEvent[] = [];
  for (const row of rows) {
    try {
      const event = ServerEventSchema.parse(JSON.parse(row.event_json));
      if (event.type === "P2P_SIGNAL") {
        events.push(event);
      }
    } catch {
      storage.sql.exec("DELETE FROM p2p_replay WHERE server_seq = ?", row.server_seq);
    }
  }
  return events;
}

export function writeStoredP2PReplayEvent(
  storage: DurableObjectStorage,
  event: BufferedP2PSignalEvent,
  dedupeKey: string,
  now = Date.now(),
): void {
  storage.sql.exec(
    `INSERT OR IGNORE INTO p2p_replay (
      server_seq,
      dedupe_key,
      to_user_id,
      room_generation,
      source_generation,
      server_received_at,
      event_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    event.serverSeq,
    dedupeKey,
    event.toUserId,
    event.roomGeneration,
    event.sourceGeneration,
    event.serverReceivedAt,
    JSON.stringify(event),
  );
  pruneStoredP2PReplay(storage, now);
}

export function pruneStoredP2PReplay(storage: DurableObjectStorage, now = Date.now()): void {
  storage.sql.exec("DELETE FROM p2p_replay WHERE server_received_at < ?", now - P2P_REPLAY_TTL_MS);
  storage.sql.exec(
    `DELETE FROM p2p_replay
     WHERE server_seq NOT IN (
       SELECT server_seq
       FROM p2p_replay
       ORDER BY server_seq DESC
       LIMIT ?
     )`,
    P2P_REPLAY_MAX_EVENTS,
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

function parseRoomStateSnapshot(value: unknown): RoomStateSnapshot | null {
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
  const participants: Participant[] = [];
  for (const participantValue of value.participants) {
    const participant = ParticipantSchema.safeParse(participantValue);
    if (!participant.success) {
      return null;
    }
    participants.push(participant.data);
  }
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
