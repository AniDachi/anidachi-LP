export const ROOM_SESSION_INSTALL_ID_STORAGE_KEY = "anidachi:extension-install-id:v1";

const LEGACY_ROOM_SESSION_STORAGE_KEY = "anidachi:room-id";
const LEGACY_ROOM_SESSION_OWNER_STORAGE_KEY = "anidachi:room-owner-id";

export interface RoomSessionNamespace {
  installId: string;
  prefix: string;
}

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function getRoomSessionNamespace(): Promise<RoomSessionNamespace> {
  const installId = await getOrCreateExtensionInstallId();
  const runtimeId = chrome.runtime?.id || "runtime";
  return {
    installId,
    prefix: `anidachi:${runtimeId}:${installId}:room-session`,
  };
}

export function getPersistedRoomId(
  namespace: RoomSessionNamespace,
  storage: SessionStorageLike = sessionStorage,
): string | null {
  try {
    return storage.getItem(roomIdKey(namespace));
  } catch {
    return null;
  }
}

export function getPersistedRoomOwnerId(
  namespace: RoomSessionNamespace,
  storage: SessionStorageLike = sessionStorage,
): string | null {
  try {
    return storage.getItem(roomOwnerKey(namespace));
  } catch {
    return null;
  }
}

export function getPersistedRoomIdForUser(
  namespace: RoomSessionNamespace,
  userId: string | null,
  storage: SessionStorageLike = sessionStorage,
): string | null {
  const roomId = getPersistedRoomId(namespace, storage);
  if (!roomId) {
    return null;
  }

  const ownerId = getPersistedRoomOwnerId(namespace, storage);
  if (!ownerId || userId === null) {
    return roomId;
  }

  if (ownerId === userId) {
    return roomId;
  }

  clearPersistedRoomId(namespace, storage);
  return null;
}

export function persistRoomId(
  namespace: RoomSessionNamespace,
  roomId: string,
  ownerUserId: string,
  storage: SessionStorageLike = sessionStorage,
): void {
  try {
    storage.setItem(roomIdKey(namespace), roomId);
    storage.setItem(roomOwnerKey(namespace), ownerUserId);
  } catch {
    // Session storage may be unavailable on some embedded pages.
  }
}

export function clearPersistedRoomId(
  namespace: RoomSessionNamespace,
  storage: SessionStorageLike = sessionStorage,
): void {
  try {
    storage.removeItem(roomIdKey(namespace));
    storage.removeItem(roomOwnerKey(namespace));
  } catch {
    // Session storage may be unavailable on some embedded pages.
  }
}

export function clearLegacyRoomSessionStorage(
  storage: SessionStorageLike = sessionStorage,
): void {
  try {
    storage.removeItem(LEGACY_ROOM_SESSION_STORAGE_KEY);
    storage.removeItem(LEGACY_ROOM_SESSION_OWNER_STORAGE_KEY);
  } catch {
    // Session storage may be unavailable on some embedded pages.
  }
}

async function getOrCreateExtensionInstallId(): Promise<string> {
  const stored = await chrome.storage.local.get(ROOM_SESSION_INSTALL_ID_STORAGE_KEY);
  const existing = stored[ROOM_SESSION_INSTALL_ID_STORAGE_KEY];
  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `install-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [ROOM_SESSION_INSTALL_ID_STORAGE_KEY]: generated });
  return generated;
}

function roomIdKey(namespace: RoomSessionNamespace): string {
  return `${namespace.prefix}:room-id`;
}

function roomOwnerKey(namespace: RoomSessionNamespace): string {
  return `${namespace.prefix}:room-owner-id`;
}
