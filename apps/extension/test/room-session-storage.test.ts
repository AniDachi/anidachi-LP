import { describe, expect, it } from "vitest";
import {
  clearLegacyRoomSessionStorage,
  getPersistedRoomId,
  getPersistedRoomIdForUser,
  persistRoomId,
  type RoomSessionNamespace,
} from "../src/room-session-storage";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function namespace(id: string): RoomSessionNamespace {
  return {
    installId: id,
    prefix: `anidachi:runtime:${id}:room-session`,
  };
}

describe("room session storage", () => {
  it("scopes persisted rooms by extension install namespace and account owner", () => {
    const storage = new MemoryStorage();
    const firstInstall = namespace("install-a");
    const secondInstall = namespace("install-b");

    persistRoomId(firstInstall, "room-a", "user-a", storage);

    expect(getPersistedRoomIdForUser(firstInstall, "user-a", storage)).toBe("room-a");
    expect(getPersistedRoomIdForUser(secondInstall, "user-a", storage)).toBeNull();
    expect(getPersistedRoomIdForUser(firstInstall, "user-b", storage)).toBeNull();
    expect(getPersistedRoomId(firstInstall, storage)).toBeNull();
  });

  it("clears legacy page session keys from earlier extension builds", () => {
    const storage = new MemoryStorage();
    storage.setItem("anidachi:room-id", "legacy-room");
    storage.setItem("anidachi:room-owner-id", "legacy-user");

    clearLegacyRoomSessionStorage(storage);

    expect(storage.getItem("anidachi:room-id")).toBeNull();
    expect(storage.getItem("anidachi:room-owner-id")).toBeNull();
  });
});
