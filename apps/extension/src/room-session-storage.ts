import {
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_ID_CHARS,
  MAX_SESSION_ID_CHARS,
} from "@anidachi/protocol";
import type { VoiceMode } from "./media-types";
import {
  loadCameraEnabledPreference,
  loadRoomJoinDefaults,
  persistCameraEnabledPreference,
  resolveRoomMediaDefaults,
} from "./room-media-defaults";
import {
  loadVoiceModePreference,
  persistVoiceModePreference,
} from "./voice-mode-preference";

export const ROOM_SESSION_INSTALL_ID_STORAGE_KEY = "anidachi:extension-install-id:v1";
export const ROOM_SESSION_STORAGE_MESSAGE_TYPE = "ANIDACHI_ROOM_SESSION_STORAGE";

const ROOM_SESSION_RECORD_VERSION = 1 as const;
const ROOM_SESSION_RECORD_KEY_PREFIX = "anidachi:room-session:v1:tab:";
const PREPARED_ROOM_SESSION_RECORD_KEY_PREFIX =
  "anidachi:prepared-room-session:v1:tab:";
const LEGACY_ROOM_SESSION_STORAGE_KEY = "anidachi:room-id";
const LEGACY_ROOM_SESSION_OWNER_STORAGE_KEY = "anidachi:room-owner-id";
const LEGACY_PARTICIPANT_SESSION_STORAGE_KEY = "anidachi:participant-session-id";

export interface RoomSessionRecord {
  version: typeof ROOM_SESSION_RECORD_VERSION;
  revision: number;
  roomId: string;
  ownerUserId: string;
  participantSessionId: string;
  cameraEnabled: boolean;
  voiceMode: VoiceMode;
}

export interface PreparedRoomSession {
  version: typeof ROOM_SESSION_RECORD_VERSION;
  preparationId: string;
  roomId: string | null;
  ownerUserId: string;
  participantSessionId: string;
}

export interface PrepareRoomSessionInput {
  ownerUserId: string;
  roomId: string | null;
  forceNew?: boolean;
}

export function isPreparedRoomSession(value: unknown): value is PreparedRoomSession {
  return parsePreparedRoomSession(value) !== null;
}

interface LegacyRoomSessionRecord {
  roomId: string | null;
  ownerUserId: string | null;
  participantSessionId: string | null;
}

export type RoomSessionStorageMessage =
  | { type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE; command: "legacy-prefix" }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "load";
      currentUserId: string | null;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "persist";
      roomId: string | null;
      ownerUserId: string | null;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "prepare";
      ownerUserId: string;
      roomId: string | null;
      forceNew?: boolean;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "discard-prepared";
      prepared: PreparedRoomSession;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "migrate";
      currentUserId: string | null;
      legacyRecord: LegacyRoomSessionRecord | null;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "clear-if-match";
      record: RoomSessionRecord;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "set-voice-mode";
      mode: VoiceMode;
      record: RoomSessionRecord;
      rememberPreference?: boolean;
    }
  | {
      type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE;
      command: "set-camera-enabled";
      enabled: boolean;
      record: RoomSessionRecord;
      rememberPreference?: boolean;
    }
  | { type: typeof ROOM_SESSION_STORAGE_MESSAGE_TYPE; command: "clear" };

export type RoomSessionStorageResponse =
  | {
      ok: true;
      record: RoomSessionRecord | null;
      prepared?: PreparedRoomSession | null;
      legacyPrefix?: string | null;
    }
  | { ok: false; error: string };

interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

type PageSessionStorageLike = Pick<Storage, "getItem" | "removeItem">;
type RuntimeMessageSender = (
  message: RoomSessionStorageMessage,
) => Promise<RoomSessionStorageResponse | null | undefined | unknown>;

const roomSessionOperationsByTab = new Map<number, Promise<unknown>>();

export interface RoomSessionBackgroundDependencies {
  sessionStorage?: StorageAreaLike;
  localStorage?: StorageAreaLike;
  runtimeId?: string;
  randomUUID?: () => string;
}

export interface RoomSessionClientDependencies {
  pageSessionStorage?: PageSessionStorageLike;
  sendMessage?: RuntimeMessageSender;
}

export function isRoomSessionStorageMessage(value: unknown): value is RoomSessionStorageMessage {
  if (!isObject(value) || value.type !== ROOM_SESSION_STORAGE_MESSAGE_TYPE) {
    return false;
  }

  switch (value.command) {
    case "legacy-prefix":
    case "clear":
      return true;
    case "load":
      return isNullableString(value.currentUserId);
    case "persist":
      return isNullableString(value.roomId) && isNullableString(value.ownerUserId);
    case "prepare":
      return isBoundedString(value.ownerUserId, MAX_PARTICIPANT_ID_CHARS) &&
        isNullableBoundedString(value.roomId, MAX_ROOM_ID_CHARS) &&
        (value.forceNew === undefined || typeof value.forceNew === "boolean");
    case "discard-prepared":
      return isPreparedRoomSession(value.prepared);
    case "migrate":
      return (
        isNullableString(value.currentUserId) &&
        (value.legacyRecord === null || isLegacyRoomSessionRecord(value.legacyRecord))
      );
    case "clear-if-match":
      return parseRoomSessionRecord(value.record) !== null;
    case "set-voice-mode":
      return isVoiceMode(value.mode) &&
        parseRoomSessionRecord(value.record) !== null &&
        (value.rememberPreference === undefined ||
          typeof value.rememberPreference === "boolean");
    case "set-camera-enabled":
      return typeof value.enabled === "boolean" &&
        parseRoomSessionRecord(value.record) !== null &&
        (value.rememberPreference === undefined ||
          typeof value.rememberPreference === "boolean");
    default:
      return false;
  }
}

export function handleRoomSessionStorageRuntimeMessage(
  value: unknown,
  sender: { tab?: { id?: number } },
  sendResponse: (response: RoomSessionStorageResponse) => void,
  dependencies: RoomSessionBackgroundDependencies = {},
): boolean {
  if (!isRoomSessionStorageMessage(value)) {
    return false;
  }

  void handleRoomSessionStorageMessage(value, sender, dependencies).then(
    sendResponse,
    (error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Room session storage failed",
      });
    },
  );
  return true;
}

export async function handleRoomSessionStorageMessage(
  message: RoomSessionStorageMessage,
  sender: { tab?: { id?: number } },
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<RoomSessionStorageResponse> {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || (tabId ?? -1) < 0) {
    return { ok: false, error: "Room session message is missing a sender tab" };
  }

  const resolvedTabId = tabId as number;
  return enqueueRoomSessionOperation(resolvedTabId, async () => {
    const sessionStorage =
      dependencies.sessionStorage ?? (chrome.storage.session as StorageAreaLike);
    const localStorage = dependencies.localStorage ?? (chrome.storage.local as StorageAreaLike);
    const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());

    try {
      switch (message.command) {
        case "legacy-prefix": {
          const stored = await localStorage.get(ROOM_SESSION_INSTALL_ID_STORAGE_KEY);
          const installId = stored[ROOM_SESSION_INSTALL_ID_STORAGE_KEY];
          const runtimeId = dependencies.runtimeId ?? chrome.runtime.id;
          return {
            ok: true,
            record: null,
            legacyPrefix:
              isNonEmptyString(installId) && isNonEmptyString(runtimeId)
                ? `anidachi:${runtimeId}:${installId}:room-session`
                : null,
          };
        }
        case "load":
          return {
            ok: true,
            record: await loadRecordForUser(sessionStorage, resolvedTabId, message.currentUserId),
          };
        case "persist":
          return {
            ok: true,
            record: await persistRecord(
              sessionStorage,
              localStorage,
              resolvedTabId,
              message.roomId,
              message.ownerUserId,
              randomUUID,
            ),
          };
        case "prepare":
          return {
            ok: true,
            record: null,
            prepared: await prepareRoomSessionForTabNow(
              sessionStorage,
              resolvedTabId,
              message,
              randomUUID,
            ),
          };
        case "discard-prepared":
          await discardPreparedRoomSessionIfMatchNow(
            sessionStorage,
            resolvedTabId,
            message.prepared,
          );
          return { ok: true, record: null, prepared: null };
        case "migrate":
          return {
            ok: true,
            record: await migrateRecord(
              sessionStorage,
              resolvedTabId,
              message.currentUserId,
              message.legacyRecord,
              randomUUID,
            ),
          };
        case "clear-if-match":
          return {
            ok: true,
            record: await clearRoomSessionIfMatchForTab(
              sessionStorage,
              resolvedTabId,
              message.record,
            ),
          };
        case "set-voice-mode": {
          const record = await setRoomSessionVoiceModeForTab(
            sessionStorage,
            resolvedTabId,
            message.record,
            message.mode,
          );
          if (
            message.rememberPreference === true &&
            record &&
            roomSessionIdentityMatches(record, message.record) &&
            record.voiceMode === message.mode
          ) {
            await persistVoiceModePreference(
              localStorage,
              record.ownerUserId,
              message.mode,
            ).catch(() => undefined);
          }
          return {
            ok: true,
            record,
          };
        }
        case "set-camera-enabled": {
          const record = await setRoomSessionCameraEnabledForTab(
            sessionStorage,
            resolvedTabId,
            message.record,
            message.enabled,
          );
          if (
            message.rememberPreference === true &&
            record &&
            roomSessionIdentityMatches(record, message.record) &&
            record.cameraEnabled === message.enabled
          ) {
            await persistCameraEnabledPreference(
              localStorage,
              record.ownerUserId,
              message.enabled,
            ).catch(() => undefined);
          }
          return {
            ok: true,
            record,
          };
        }
        case "clear":
          await removeRoomSessionForTabNow(resolvedTabId, sessionStorage);
          return { ok: true, record: null };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Room session storage failed",
      };
    }
  });
}

export async function removeRoomSessionForTab(
  tabId: number,
  storage: StorageAreaLike = chrome.storage.session as StorageAreaLike,
): Promise<void> {
  await enqueueRoomSessionOperation(tabId, () => removeRoomSessionForTabNow(tabId, storage));
}

/** Reads the background-owned confirmed session without trusting page identity. */
export async function loadRoomSessionForTab(
  tabId: number,
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<RoomSessionRecord | null> {
  assertTabId(tabId);
  return enqueueRoomSessionOperation(tabId, async () => {
    const storage = dependencies.sessionStorage ??
      (chrome.storage.session as StorageAreaLike);
    const key = roomSessionStorageKey(tabId);
    const stored = await storage.get(key);
    const record = parseRoomSessionRecord(stored[key]);
    if (!record && stored[key] !== undefined) {
      await storage.remove(key);
    }
    return record;
  });
}

/**
 * Cleans a closed tab only if its confirmed session is still the snapshot that
 * initiated departure. A recycled tab id or newer exact session wins.
 */
export async function clearRoomSessionForClosedTab(
  tabId: number,
  expected: RoomSessionRecord | null,
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<boolean> {
  assertTabId(tabId);
  return enqueueRoomSessionOperation(tabId, async () => {
    const storage = dependencies.sessionStorage ??
      (chrome.storage.session as StorageAreaLike);
    if (!expected) {
      await removeRoomSessionForTabNow(tabId, storage);
      return true;
    }

    const key = roomSessionStorageKey(tabId);
    const stored = await storage.get(key);
    const current = parseRoomSessionRecord(stored[key]);
    if (!current || !roomSessionIdentityMatches(current, expected)) {
      return false;
    }
    await removeRoomSessionForTabNow(tabId, storage);
    return true;
  });
}

async function removeRoomSessionForTabNow(tabId: number, storage: StorageAreaLike): Promise<void> {
  await Promise.all([
    storage.remove(roomSessionStorageKey(tabId)),
    storage.remove(preparedRoomSessionStorageKey(tabId)),
  ]);
}

export async function prepareRoomSessionForTab(
  tabId: number,
  input: PrepareRoomSessionInput,
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<PreparedRoomSession> {
  assertTabId(tabId);
  return enqueueRoomSessionOperation(tabId, async () => {
    const storage = dependencies.sessionStorage ??
      (chrome.storage.session as StorageAreaLike);
    const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
    return prepareRoomSessionForTabNow(storage, tabId, input, randomUUID);
  });
}

export async function confirmRoomSessionForTab(
  tabId: number,
  prepared: PreparedRoomSession,
  roomId: string,
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<RoomSessionRecord | null> {
  assertTabId(tabId);
  return enqueueRoomSessionOperation(tabId, async () => {
    const sessionStorage = dependencies.sessionStorage ??
      (chrome.storage.session as StorageAreaLike);
    const localStorage = dependencies.localStorage ??
      (chrome.storage.local as StorageAreaLike);
    return confirmRoomSessionForTabNow(
      sessionStorage,
      localStorage,
      tabId,
      prepared,
      roomId,
    );
  });
}

export async function discardPreparedRoomSessionIfMatch(
  tabId: number,
  prepared: PreparedRoomSession,
  dependencies: RoomSessionBackgroundDependencies = {},
): Promise<boolean> {
  assertTabId(tabId);
  return enqueueRoomSessionOperation(tabId, async () => {
    const storage = dependencies.sessionStorage ??
      (chrome.storage.session as StorageAreaLike);
    return discardPreparedRoomSessionIfMatchNow(storage, tabId, prepared);
  });
}

async function discardPreparedRoomSessionIfMatchNow(
  storage: StorageAreaLike,
  tabId: number,
  prepared: PreparedRoomSession,
): Promise<boolean> {
  const parsed = parsePreparedRoomSession(prepared);
  if (!parsed) {
    throw new Error("Invalid prepared room session");
  }
  const key = preparedRoomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const current = parsePreparedRoomSession(stored[key]);
  if (!current || !preparedRoomSessionsMatch(current, parsed)) {
    return false;
  }
  await storage.remove(key);
  return true;
}

function enqueueRoomSessionOperation<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  const previous = roomSessionOperationsByTab.get(tabId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const queued = current.finally(() => {
    if (roomSessionOperationsByTab.get(tabId) === queued) {
      roomSessionOperationsByTab.delete(tabId);
    }
  });
  roomSessionOperationsByTab.set(tabId, queued);
  return queued;
}

export async function loadRoomSession(
  currentUserId: string | null,
  dependencies: RoomSessionClientDependencies = {},
): Promise<RoomSessionRecord | null> {
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "load",
      currentUserId,
    },
    dependencies.sendMessage,
  );
  return response.record;
}

export async function persistRoomSession(
  roomId: string,
  ownerUserId: string,
  dependencies: RoomSessionClientDependencies = {},
): Promise<RoomSessionRecord> {
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "persist",
      roomId,
      ownerUserId,
    },
    dependencies.sendMessage,
  );
  if (!response.record) {
    throw new Error("Room session storage rejected the current account");
  }
  return response.record;
}

export async function prepareRoomSession(
  ownerUserId: string,
  roomId: string | null,
  options: {
    forceNew?: boolean;
    dependencies?: RoomSessionClientDependencies;
  } = {},
): Promise<PreparedRoomSession> {
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "prepare",
      ownerUserId,
      roomId,
      ...(options.forceNew === undefined ? {} : { forceNew: options.forceNew }),
    },
    options.dependencies?.sendMessage,
  );
  if (!response.prepared) {
    throw new Error("Room session storage did not prepare a candidate");
  }
  return response.prepared;
}

export async function discardPreparedRoomSession(
  prepared: PreparedRoomSession,
  dependencies: RoomSessionClientDependencies = {},
): Promise<void> {
  await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "discard-prepared",
      prepared,
    },
    dependencies.sendMessage,
  );
}

export async function clearRoomSession(
  dependencies: RoomSessionClientDependencies = {},
): Promise<void> {
  await sendRoomSessionMessage(
    { type: ROOM_SESSION_STORAGE_MESSAGE_TYPE, command: "clear" },
    dependencies.sendMessage,
  );
}

export async function clearRoomSessionIfMatch(
  record: RoomSessionRecord,
  dependencies: RoomSessionClientDependencies = {},
): Promise<void> {
  await sendRoomSessionMessage(
    { type: ROOM_SESSION_STORAGE_MESSAGE_TYPE, command: "clear-if-match", record },
    dependencies.sendMessage,
  );
}

export async function updateRoomSessionVoiceMode(
  record: RoomSessionRecord,
  mode: VoiceMode,
  options: RoomSessionClientDependencies & {
    rememberPreference?: boolean;
  } = {},
): Promise<RoomSessionRecord | null> {
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "set-voice-mode",
      mode,
      record,
      ...(options.rememberPreference === true
        ? { rememberPreference: true }
        : {}),
    },
    options.sendMessage,
  );
  return response.record;
}

export async function updateRoomSessionCameraEnabled(
  record: RoomSessionRecord,
  enabled: boolean,
  options: RoomSessionClientDependencies & {
    rememberPreference?: boolean;
  } = {},
): Promise<RoomSessionRecord | null> {
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "set-camera-enabled",
      enabled,
      record,
      ...(options.rememberPreference === true
        ? { rememberPreference: true }
        : {}),
    },
    options.sendMessage,
  );
  return response.record;
}

export async function migrateLegacyRoomSession(
  currentUserId: string | null,
  dependencies: RoomSessionClientDependencies = {},
): Promise<RoomSessionRecord | null> {
  const pageStorage = dependencies.pageSessionStorage ?? sessionStorage;
  const prefixResponse = await sendRoomSessionMessage(
    { type: ROOM_SESSION_STORAGE_MESSAGE_TYPE, command: "legacy-prefix" },
    dependencies.sendMessage,
  );
  const legacyGroups = legacyStorageGroups(prefixResponse.legacyPrefix ?? null);
  const values = legacyGroups.map((group) => readLegacyGroup(pageStorage, group));
  const selected =
    values.find((value) => isCompleteLegacyRecordForUser(value.record, currentUserId)) ??
    values.find((value) => value.hasAnyValue);
  const response = await sendRoomSessionMessage(
    {
      type: ROOM_SESSION_STORAGE_MESSAGE_TYPE,
      command: "migrate",
      currentUserId,
      legacyRecord: selected?.record ?? null,
    },
    dependencies.sendMessage,
  );

  for (const group of legacyGroups) {
    removePageStorageKey(pageStorage, group.roomId);
    removePageStorageKey(pageStorage, group.ownerUserId);
    removePageStorageKey(pageStorage, group.participantSessionId);
  }

  return response.record;
}

async function loadRecordForUser(
  storage: StorageAreaLike,
  tabId: number,
  currentUserId: string | null,
): Promise<RoomSessionRecord | null> {
  const key = roomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const rawRecord = stored[key];
  if (rawRecord === undefined) {
    return null;
  }

  const record = parseRoomSessionRecord(rawRecord);
  if (!record || !isNonEmptyString(currentUserId) || record.ownerUserId !== currentUserId) {
    await storage.remove(key);
    return null;
  }

  return record;
}

async function persistRecord(
  sessionStorage: StorageAreaLike,
  localStorage: StorageAreaLike,
  tabId: number,
  roomId: string | null,
  ownerUserId: string | null,
  randomUUID: () => string,
): Promise<RoomSessionRecord | null> {
  const key = roomSessionStorageKey(tabId);
  if (!isNonEmptyString(roomId) || !isNonEmptyString(ownerUserId)) {
    await sessionStorage.remove(key);
    return null;
  }

  const stored = await sessionStorage.get(key);
  const existing = parseRoomSessionRecord(stored[key]);
  const sameRoom =
    existing?.roomId === roomId && existing.ownerUserId === ownerUserId;
  const preferredMedia = sameRoom
    ? { cameraEnabled: existing.cameraEnabled, voiceMode: existing.voiceMode }
    : await loadRoomMediaDefaults(localStorage, ownerUserId);
  const record: RoomSessionRecord = {
    version: ROOM_SESSION_RECORD_VERSION,
    revision: nextRoomSessionRevision(existing),
    roomId,
    ownerUserId,
    participantSessionId:
      sameRoom
        ? existing.participantSessionId
        : createParticipantSessionId(randomUUID),
    cameraEnabled: preferredMedia.cameraEnabled,
    voiceMode: preferredMedia.voiceMode,
  };
  await sessionStorage.set({ [key]: record });
  return record;
}

async function prepareRoomSessionForTabNow(
  storage: StorageAreaLike,
  tabId: number,
  input: PrepareRoomSessionInput,
  randomUUID: () => string,
): Promise<PreparedRoomSession> {
  if (
    !isBoundedString(input.ownerUserId, MAX_PARTICIPANT_ID_CHARS) ||
    (input.roomId !== null && !isBoundedString(input.roomId, MAX_ROOM_ID_CHARS)) ||
    (input.forceNew !== undefined && typeof input.forceNew !== "boolean")
  ) {
    throw new Error("Invalid room session preparation");
  }

  const confirmedKey = roomSessionStorageKey(tabId);
  const preparedKey = preparedRoomSessionStorageKey(tabId);
  const [storedConfirmed, storedPrepared] = await Promise.all([
    storage.get(confirmedKey),
    storage.get(preparedKey),
  ]);
  const confirmed = parseRoomSessionRecord(storedConfirmed[confirmedKey]);
  const currentPrepared = parsePreparedRoomSession(storedPrepared[preparedKey]);

  if (storedConfirmed[confirmedKey] !== undefined && !confirmed) {
    await storage.remove(confirmedKey);
  }
  if (storedPrepared[preparedKey] !== undefined && !currentPrepared) {
    await storage.remove(preparedKey);
  }
  if (confirmed && confirmed.ownerUserId !== input.ownerUserId) {
    await removeRoomSessionForTabNow(tabId, storage);
    throw new Error("Room session belongs to another account");
  }
  const reuseParticipantSessionId =
    input.forceNew !== true && confirmed?.roomId === input.roomId
      ? confirmed.participantSessionId
      : input.forceNew !== true &&
          currentPrepared?.ownerUserId === input.ownerUserId &&
          currentPrepared.roomId === input.roomId
        ? currentPrepared.participantSessionId
        : null;
  const prepared: PreparedRoomSession = {
    version: ROOM_SESSION_RECORD_VERSION,
    preparationId: createBoundedSessionValue("preparation", randomUUID),
    roomId: input.roomId,
    ownerUserId: input.ownerUserId,
    participantSessionId:
      reuseParticipantSessionId ?? createParticipantSessionId(randomUUID),
  };
  await storage.set({ [preparedKey]: prepared });
  return prepared;
}

async function confirmRoomSessionForTabNow(
  sessionStorage: StorageAreaLike,
  localStorage: StorageAreaLike,
  tabId: number,
  prepared: PreparedRoomSession,
  roomId: string,
): Promise<RoomSessionRecord | null> {
  const parsedPrepared = parsePreparedRoomSession(prepared);
  if (
    !parsedPrepared ||
    !isBoundedString(roomId, MAX_ROOM_ID_CHARS) ||
    (parsedPrepared.roomId !== null && parsedPrepared.roomId !== roomId)
  ) {
    throw new Error("Invalid room session confirmation");
  }

  const confirmedKey = roomSessionStorageKey(tabId);
  const preparedKey = preparedRoomSessionStorageKey(tabId);
  const [storedConfirmed, storedPrepared] = await Promise.all([
    sessionStorage.get(confirmedKey),
    sessionStorage.get(preparedKey),
  ]);
  const confirmed = parseRoomSessionRecord(storedConfirmed[confirmedKey]);
  const currentPrepared = parsePreparedRoomSession(storedPrepared[preparedKey]);
  if (
    !currentPrepared ||
    !preparedRoomSessionsMatch(currentPrepared, parsedPrepared)
  ) {
    return confirmed &&
        confirmed.roomId === roomId &&
        confirmed.ownerUserId === parsedPrepared.ownerUserId &&
        confirmed.participantSessionId === parsedPrepared.participantSessionId
      ? confirmed
      : null;
  }
  const sameRoom =
    confirmed?.ownerUserId === parsedPrepared.ownerUserId &&
    confirmed.roomId === roomId;
  const preferredMedia = sameRoom
    ? { cameraEnabled: confirmed.cameraEnabled, voiceMode: confirmed.voiceMode }
    : await loadRoomMediaDefaults(localStorage, parsedPrepared.ownerUserId);
  const record: RoomSessionRecord = {
    version: ROOM_SESSION_RECORD_VERSION,
    revision: nextRoomSessionRevision(confirmed),
    roomId,
    ownerUserId: parsedPrepared.ownerUserId,
    participantSessionId: parsedPrepared.participantSessionId,
    cameraEnabled: preferredMedia.cameraEnabled,
    voiceMode: preferredMedia.voiceMode,
  };
  await sessionStorage.set({ [confirmedKey]: record });
  await sessionStorage.remove(preparedKey);
  return record;
}

async function migrateRecord(
  storage: StorageAreaLike,
  tabId: number,
  currentUserId: string | null,
  legacyRecord: LegacyRoomSessionRecord | null,
  randomUUID: () => string,
): Promise<RoomSessionRecord | null> {
  if (legacyRecord === null) {
    return loadRecordForUser(storage, tabId, currentUserId);
  }

  const key = roomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const existing = parseRoomSessionRecord(stored[key]);
  if (existing?.ownerUserId === currentUserId) {
    return existing;
  }
  if (
    !isBoundedString(currentUserId, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedString(legacyRecord.roomId, MAX_ROOM_ID_CHARS) ||
    !isBoundedString(legacyRecord.ownerUserId, MAX_PARTICIPANT_ID_CHARS) ||
    legacyRecord.ownerUserId !== currentUserId
  ) {
    await storage.remove(key);
    return null;
  }

  const record: RoomSessionRecord = {
    version: ROOM_SESSION_RECORD_VERSION,
    revision: nextRoomSessionRevision(existing),
    roomId: legacyRecord.roomId,
    ownerUserId: legacyRecord.ownerUserId,
    // Page sessionStorage can be cloned when a tab is duplicated. Preserve
    // legacy room/account context, but mint identity in trusted tab-scoped
    // background storage so two tabs never inherit one exact session.
    participantSessionId: createParticipantSessionId(randomUUID),
    cameraEnabled:
      existing?.roomId === legacyRecord.roomId &&
      existing.ownerUserId === legacyRecord.ownerUserId
        ? existing.cameraEnabled
        : false,
    voiceMode:
      existing?.roomId === legacyRecord.roomId &&
      existing.ownerUserId === legacyRecord.ownerUserId
        ? existing.voiceMode
        : "push-to-talk",
  };
  await storage.set({ [key]: record });
  return record;
}

async function sendRoomSessionMessage(
  message: RoomSessionStorageMessage,
  sendMessage: RuntimeMessageSender = (value) => chrome.runtime.sendMessage(value),
): Promise<Extract<RoomSessionStorageResponse, { ok: true }>> {
  const response = await sendMessage(message);
  if (!isObject(response) || typeof response.ok !== "boolean") {
    throw new Error("Room session storage did not return a response");
  }
  if (!response.ok) {
    throw new Error(
      typeof response.error === "string" ? response.error : "Room session storage failed",
    );
  }
  return response as Extract<RoomSessionStorageResponse, { ok: true }>;
}

async function clearRoomSessionIfMatchForTab(
  storage: StorageAreaLike,
  tabId: number,
  expected: RoomSessionRecord,
): Promise<RoomSessionRecord | null> {
  const key = roomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const current = parseRoomSessionRecord(stored[key]);
  if (!current) {
    if (stored[key] !== undefined) {
      await storage.remove(key);
    }
    return null;
  }

  if (!roomSessionRecordsMatch(current, expected)) {
    return current;
  }

  await storage.remove(key);
  return null;
}

async function setRoomSessionVoiceModeForTab(
  storage: StorageAreaLike,
  tabId: number,
  expected: RoomSessionRecord,
  mode: VoiceMode,
): Promise<RoomSessionRecord | null> {
  const key = roomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const current = parseRoomSessionRecord(stored[key]);
  if (!current) {
    if (stored[key] !== undefined) {
      await storage.remove(key);
    }
    return null;
  }
  if (!roomSessionRecordsMatch(current, expected)) {
    return current;
  }
  if (current.voiceMode === mode) {
    return current;
  }

  const next: RoomSessionRecord = {
    ...current,
    revision: nextRoomSessionRevision(current),
    voiceMode: mode,
  };
  await storage.set({ [key]: next });
  return next;
}

async function setRoomSessionCameraEnabledForTab(
  storage: StorageAreaLike,
  tabId: number,
  expected: RoomSessionRecord,
  enabled: boolean,
): Promise<RoomSessionRecord | null> {
  const key = roomSessionStorageKey(tabId);
  const stored = await storage.get(key);
  const current = parseRoomSessionRecord(stored[key]);
  if (!current) {
    if (stored[key] !== undefined) {
      await storage.remove(key);
    }
    return null;
  }
  if (!roomSessionRecordsMatch(current, expected)) {
    return current;
  }
  if (current.cameraEnabled === enabled) {
    return current;
  }

  const next: RoomSessionRecord = {
    ...current,
    revision: nextRoomSessionRevision(current),
    cameraEnabled: enabled,
  };
  await storage.set({ [key]: next });
  return next;
}

function parseRoomSessionRecord(value: unknown): RoomSessionRecord | null {
  const revision =
    isObject(value) && value.revision === undefined
      ? 0
      : isObject(value) &&
          typeof value.revision === "number" &&
          Number.isSafeInteger(value.revision) &&
          value.revision >= 0
        ? value.revision
        : null;
  if (
    !isObject(value) ||
    revision === null ||
    value.version !== ROOM_SESSION_RECORD_VERSION ||
    !isBoundedString(value.roomId, MAX_ROOM_ID_CHARS) ||
    !isBoundedString(value.ownerUserId, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedString(value.participantSessionId, MAX_SESSION_ID_CHARS)
  ) {
    return null;
  }

  return {
    version: ROOM_SESSION_RECORD_VERSION,
    revision,
    roomId: value.roomId,
    ownerUserId: value.ownerUserId,
    participantSessionId: value.participantSessionId,
    cameraEnabled: value.cameraEnabled === true,
    voiceMode: isVoiceMode(value.voiceMode) ? value.voiceMode : "push-to-talk",
  };
}

function parsePreparedRoomSession(value: unknown): PreparedRoomSession | null {
  if (
    !isObject(value) ||
    value.version !== ROOM_SESSION_RECORD_VERSION ||
    !isBoundedString(value.preparationId, MAX_SESSION_ID_CHARS) ||
    !isNullableBoundedString(value.roomId, MAX_ROOM_ID_CHARS) ||
    !isBoundedString(value.ownerUserId, MAX_PARTICIPANT_ID_CHARS) ||
    !isBoundedString(value.participantSessionId, MAX_SESSION_ID_CHARS)
  ) {
    return null;
  }
  return {
    version: ROOM_SESSION_RECORD_VERSION,
    preparationId: value.preparationId,
    roomId: value.roomId,
    ownerUserId: value.ownerUserId,
    participantSessionId: value.participantSessionId,
  };
}

function nextRoomSessionRevision(existing: RoomSessionRecord | null): number {
  const revision = existing?.revision ?? 0;
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Room session revision is exhausted");
  }
  return revision + 1;
}

function roomSessionRecordsMatch(
  current: RoomSessionRecord,
  expected: RoomSessionRecord,
): boolean {
  return (
    current.version === expected.version &&
    current.revision === expected.revision &&
    current.roomId === expected.roomId &&
    current.ownerUserId === expected.ownerUserId &&
    current.participantSessionId === expected.participantSessionId &&
    current.cameraEnabled === expected.cameraEnabled &&
    current.voiceMode === expected.voiceMode
  );
}

function roomSessionIdentityMatches(
  current: RoomSessionRecord,
  expected: RoomSessionRecord,
): boolean {
  return current.version === expected.version &&
    current.roomId === expected.roomId &&
    current.ownerUserId === expected.ownerUserId &&
    current.participantSessionId === expected.participantSessionId;
}

function isVoiceMode(value: unknown): value is VoiceMode {
  return value === "push-to-talk" || value === "open-mic";
}

async function loadRoomMediaDefaults(
  localStorage: StorageAreaLike,
  ownerUserId: string,
): Promise<{ cameraEnabled: boolean; voiceMode: VoiceMode }> {
  const [preferences, lastVoiceMode, lastCameraEnabled] = await Promise.all([
    loadRoomJoinDefaults(localStorage, ownerUserId),
    loadVoiceModePreference(localStorage, ownerUserId),
    loadCameraEnabledPreference(localStorage, ownerUserId),
  ]);
  return resolveRoomMediaDefaults({
    lastCameraEnabled,
    lastVoiceMode,
    preferences,
  });
}

function legacyStorageGroups(prefix: string | null): Array<{
  roomId: string;
  ownerUserId: string;
  participantSessionId: string;
}> {
  const groups = [];
  if (isNonEmptyString(prefix)) {
    groups.push({
      roomId: `${prefix}:room-id`,
      ownerUserId: `${prefix}:room-owner-id`,
      participantSessionId: `${prefix}:participant-session-id`,
    });
  }
  groups.push({
    roomId: LEGACY_ROOM_SESSION_STORAGE_KEY,
    ownerUserId: LEGACY_ROOM_SESSION_OWNER_STORAGE_KEY,
    participantSessionId: LEGACY_PARTICIPANT_SESSION_STORAGE_KEY,
  });
  return groups;
}

function readLegacyGroup(
  storage: PageSessionStorageLike,
  keys: { roomId: string; ownerUserId: string; participantSessionId: string },
): { hasAnyValue: boolean; record: LegacyRoomSessionRecord } {
  const record = {
    roomId: readPageStorageKey(storage, keys.roomId),
    ownerUserId: readPageStorageKey(storage, keys.ownerUserId),
    participantSessionId: readPageStorageKey(storage, keys.participantSessionId),
  };
  return {
    hasAnyValue: Object.values(record).some((value) => value !== null),
    record,
  };
}

function readPageStorageKey(storage: PageSessionStorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function removePageStorageKey(storage: PageSessionStorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // A page may block sessionStorage; the background ACK remains authoritative.
  }
}

function roomSessionStorageKey(tabId: number): string {
  return `${ROOM_SESSION_RECORD_KEY_PREFIX}${tabId}`;
}

function preparedRoomSessionStorageKey(tabId: number): string {
  return `${PREPARED_ROOM_SESSION_RECORD_KEY_PREFIX}${tabId}`;
}

function createParticipantSessionId(randomUUID: () => string): string {
  return createBoundedSessionValue("session", randomUUID);
}

function createBoundedSessionValue(prefix: string, randomUUID: () => string): string {
  const value = `${prefix}-${randomUUID()}`;
  if (!isBoundedString(value, MAX_SESSION_ID_CHARS)) {
    throw new Error("Generated room session identifier is invalid");
  }
  return value;
}

function preparedRoomSessionsMatch(
  current: PreparedRoomSession,
  expected: PreparedRoomSession,
): boolean {
  return current.version === expected.version &&
    current.preparationId === expected.preparationId &&
    current.roomId === expected.roomId &&
    current.ownerUserId === expected.ownerUserId &&
    current.participantSessionId === expected.participantSessionId;
}

function assertTabId(tabId: number): void {
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new Error("Invalid room session tab");
  }
}

function isLegacyRoomSessionRecord(value: unknown): value is LegacyRoomSessionRecord {
  return (
    isObject(value) &&
    isNullableString(value.roomId) &&
    isNullableString(value.ownerUserId) &&
    isNullableString(value.participantSessionId)
  );
}

function isCompleteLegacyRecordForUser(
  record: LegacyRoomSessionRecord,
  currentUserId: string | null,
): boolean {
  return (
    isNonEmptyString(currentUserId) &&
    isNonEmptyString(record.roomId) &&
    record.ownerUserId === currentUserId
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoundedString(value: unknown, maxChars: number): value is string {
  return isNonEmptyString(value) && value.length <= maxChars;
}

function isNullableBoundedString(value: unknown, maxChars: number): value is string | null {
  return value === null || isBoundedString(value, maxChars);
}
