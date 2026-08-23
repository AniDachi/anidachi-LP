import { describe, expect, it } from "vitest";
import {
  clearRoomSessionForClosedTab,
  confirmRoomSessionForTab,
  discardPreparedRoomSessionIfMatch,
  handleRoomSessionStorageRuntimeMessage,
  handleRoomSessionStorageMessage,
  loadRoomSessionForTab,
  prepareRoomSessionForTab,
  ROOM_SESSION_INSTALL_ID_STORAGE_KEY as INSTALL_ID_STORAGE_KEY,
  migrateLegacyRoomSession,
  ROOM_SESSION_STORAGE_MESSAGE_TYPE as ROOM_SESSION_MESSAGE_TYPE,
  type RoomSessionStorageMessage as RoomSessionMessage,
  type RoomSessionRecord,
  type RoomSessionStorageResponse as RoomSessionResponse,
  removeRoomSessionForTab,
  updateRoomSessionVoiceMode,
} from "../src/room-session-storage";

interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

interface BackgroundDependencies {
  sessionStorage: MemoryStorageArea;
  localStorage: MemoryStorageArea;
  runtimeId: string;
  randomUUID: () => string;
}

class MemoryStorageArea implements StorageAreaLike {
  readonly values = new Map<string, unknown>();
  readonly setCalls: Record<string, unknown>[] = [];

  async get(key: string): Promise<Record<string, unknown>> {
    return this.values.has(key) ? { [key]: this.values.get(key) } : {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.setCalls.push(items);
    for (const [key, value] of Object.entries(items)) {
      this.values.set(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class DelayedRemoveStorageArea extends MemoryStorageArea {
  private releaseRemove!: () => void;
  private signalRemoveStarted!: () => void;
  readonly removeStarted = new Promise<void>((resolve) => {
    this.signalRemoveStarted = resolve;
  });
  private readonly removeGate = new Promise<void>((resolve) => {
    this.releaseRemove = resolve;
  });

  override async remove(key: string): Promise<void> {
    this.signalRemoveStarted();
    await this.removeGate;
    await super.remove(key);
  }

  continueRemove(): void {
    this.releaseRemove();
  }
}

class PageSessionStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
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

function backgroundDependencies(): BackgroundDependencies {
  let nextId = 0;
  return {
    sessionStorage: new MemoryStorageArea(),
    localStorage: new MemoryStorageArea(),
    runtimeId: "runtime-id",
    randomUUID: () => `uuid-${++nextId}`,
  };
}

function sender(tabId: number): { tab: { id: number } } {
  return { tab: { id: tabId } };
}

type MessageWithoutType<T> = T extends unknown ? Omit<T, "type"> : never;

function message(value: MessageWithoutType<RoomSessionMessage>): RoomSessionMessage {
  return { type: ROOM_SESSION_MESSAGE_TYPE, ...value } as RoomSessionMessage;
}

function expectRecord(response: RoomSessionResponse): RoomSessionRecord {
  expect(response.ok).toBe(true);
  if (!response.ok || !response.record) {
    throw new Error("Expected a room session record");
  }
  return response.record;
}

describe("background-owned room session storage", () => {
  it("loads the trusted confirmed record before closed-tab cleanup", async () => {
    const dependencies = backgroundDependencies();
    const record = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-close", ownerUserId: "user-a" }),
        sender(2),
        dependencies,
      ),
    );

    await expect(loadRoomSessionForTab(2, dependencies)).resolves.toEqual(record);
    await expect(clearRoomSessionForClosedTab(2, record, dependencies)).resolves.toBe(true);
    await expect(loadRoomSessionForTab(2, dependencies)).resolves.toBeNull();
  });

  it("drops an oversized confirmed record instead of restoring corrupt authority", async () => {
    const dependencies = backgroundDependencies();
    await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
      sender(1),
      dependencies,
    );
    const [key] = dependencies.sessionStorage.values.keys();
    const record = dependencies.sessionStorage.values.get(key ?? "") as RoomSessionRecord;
    dependencies.sessionStorage.values.set(key ?? "", {
      ...record,
      participantSessionId: "x".repeat(129),
    });

    await expect(loadRoomSessionForTab(1, dependencies)).resolves.toBeNull();
    expect(dependencies.sessionStorage.values.size).toBe(0);
  });

  it("does not let an old tab-close cleanup erase a same-room takeover session", async () => {
    const dependencies = backgroundDependencies();
    const oldRecord = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-old", ownerUserId: "user-a" }),
        sender(7),
        dependencies,
      ),
    );
    const takeover = await prepareRoomSessionForTab(
      7,
      { ownerUserId: "user-a", roomId: "room-old", forceNew: true },
      dependencies,
    );
    const replacement = await confirmRoomSessionForTab(7, takeover, "room-old", dependencies);

    await expect(clearRoomSessionForClosedTab(7, oldRecord, dependencies)).resolves.toBe(false);
    await expect(loadRoomSessionForTab(7, dependencies)).resolves.toEqual(replacement);
  });

  it("clears the same exact session after a mutable local update", async () => {
    const dependencies = backgroundDependencies();
    const snapshot = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-same", ownerUserId: "user-a" }),
        sender(10),
        dependencies,
      ),
    );
    const updated = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-same", ownerUserId: "user-a" }),
        sender(10),
        dependencies,
      ),
    );
    expect(updated.revision).toBeGreaterThan(snapshot.revision);
    expect(updated.participantSessionId).toBe(snapshot.participantSessionId);

    await expect(clearRoomSessionForClosedTab(10, snapshot, dependencies)).resolves.toBe(true);
    await expect(loadRoomSessionForTab(10, dependencies)).resolves.toBeNull();
  });

  it("prepares a bounded candidate before admission and confirms that exact candidate", async () => {
    const dependencies = backgroundDependencies();
    const prepared = await prepareRoomSessionForTab(
      3,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );

    expect(prepared).toMatchObject({
      version: 1,
      ownerUserId: "user-a",
      roomId: "room-a",
    });
    expect(prepared.participantSessionId).toMatch(/^session-/);
    expect(prepared.participantSessionId.length).toBeLessThanOrEqual(128);

    await expect(
      confirmRoomSessionForTab(3, prepared, "room-a", dependencies),
    ).resolves.toMatchObject({
      roomId: "room-a",
      ownerUserId: "user-a",
      participantSessionId: prepared.participantSessionId,
    });
  });

  it("reuses the confirmed same-tab session and creates a new deliberate takeover candidate", async () => {
    const dependencies = backgroundDependencies();
    const first = await prepareRoomSessionForTab(
      4,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );
    const confirmed = await confirmRoomSessionForTab(4, first, "room-a", dependencies);
    const retry = await prepareRoomSessionForTab(
      4,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );
    const takeover = await prepareRoomSessionForTab(
      4,
      { ownerUserId: "user-a", roomId: "room-a", forceNew: true },
      dependencies,
    );

    expect(retry.participantSessionId).toBe(confirmed?.participantSessionId);
    expect(takeover.participantSessionId).not.toBe(confirmed?.participantSessionId);
  });

  it("keeps a confirmed room until exact admission confirms its replacement", async () => {
    const dependencies = backgroundDependencies();
    const prepared = await prepareRoomSessionForTab(
      6,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );
    const confirmed = await confirmRoomSessionForTab(6, prepared, "room-a", dependencies);

    const replacement = await prepareRoomSessionForTab(
      6,
      { ownerUserId: "user-a", roomId: "room-b" },
      dependencies,
    );
    const loaded = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "load", currentUserId: "user-a" }),
        sender(6),
        dependencies,
      ),
    );
    expect(loaded).toEqual(confirmed);

    await expect(
      confirmRoomSessionForTab(6, replacement, "room-b", dependencies),
    ).resolves.toMatchObject({
      roomId: "room-b",
      ownerUserId: "user-a",
      participantSessionId: replacement.participantSessionId,
      voiceMode: "push-to-talk",
    });
  });

  it("discards only the matching unconfirmed candidate and ignores stale confirmation", async () => {
    const dependencies = backgroundDependencies();
    const stale = await prepareRoomSessionForTab(
      8,
      { ownerUserId: "user-a", roomId: null },
      dependencies,
    );
    const winner = await prepareRoomSessionForTab(
      8,
      { ownerUserId: "user-a", roomId: null },
      dependencies,
    );

    expect(winner.participantSessionId).toBe(stale.participantSessionId);
    expect(winner.preparationId).not.toBe(stale.preparationId);
    await expect(
      discardPreparedRoomSessionIfMatch(8, stale, dependencies),
    ).resolves.toBe(false);
    await expect(
      confirmRoomSessionForTab(8, stale, "room-stale", dependencies),
    ).resolves.toBeNull();
    await expect(
      confirmRoomSessionForTab(8, winner, "room-winner", dependencies),
    ).resolves.toMatchObject({
      roomId: "room-winner",
      participantSessionId: winner.participantSessionId,
    });
  });

  it("failed admission removes its candidate without clearing the confirmed room", async () => {
    const dependencies = backgroundDependencies();
    const first = await prepareRoomSessionForTab(
      9,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );
    const confirmed = await confirmRoomSessionForTab(9, first, "room-a", dependencies);
    const retry = await prepareRoomSessionForTab(
      9,
      { ownerUserId: "user-a", roomId: "room-a" },
      dependencies,
    );

    await expect(
      discardPreparedRoomSessionIfMatch(9, retry, dependencies),
    ).resolves.toBe(true);
    const loaded = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "load", currentUserId: "user-a" }),
        sender(9),
        dependencies,
      ),
    );
    expect(loaded).toEqual(confirmed);
  });

  it("keeps the runtime message channel open until background persistence responds", async () => {
    const dependencies = backgroundDependencies();
    let resolveResponse: (response: RoomSessionResponse) => void = () => {};
    const response = new Promise<RoomSessionResponse>((resolve) => {
      resolveResponse = resolve;
    });

    expect(
      handleRoomSessionStorageRuntimeMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(5),
        resolveResponse,
        dependencies,
      ),
    ).toBe(true);
    expect(await response).toEqual({
      ok: true,
      record: expect.objectContaining({ roomId: "room-a", ownerUserId: "user-a" }),
    });
    expect(
      handleRoomSessionStorageRuntimeMessage(
        { type: "OTHER" },
        sender(5),
        resolveResponse,
        dependencies,
      ),
    ).toBe(false);
  });

  it("stores one atomic versioned record and preserves its participant session id", async () => {
    const dependencies = backgroundDependencies();
    const first = expectRecord(
      await handleRoomSessionStorageMessage(
        message({
          command: "persist",
          roomId: "room-a",
          ownerUserId: "user-a",
        }),
        sender(7),
        dependencies,
      ),
    );
    const second = expectRecord(
      await handleRoomSessionStorageMessage(
        message({
          command: "persist",
          roomId: "room-a",
          ownerUserId: "user-a",
        }),
        sender(7),
        dependencies,
      ),
    );

    expect(first).toEqual({
      version: 1,
      revision: 1,
      roomId: "room-a",
      ownerUserId: "user-a",
      participantSessionId: "session-uuid-1",
      voiceMode: "push-to-talk",
    });

    expect(second.participantSessionId).toBe(first.participantSessionId);
    expect(second.revision).toBe(2);
    expect(dependencies.sessionStorage.values.size).toBe(1);
    expect(Object.values(dependencies.sessionStorage.setCalls[0] ?? {})).toEqual([first]);
  });

  it("isolates records and participant session ids by sender tab", async () => {
    const dependencies = backgroundDependencies();

    const tabOne = expectRecord(
      await handleRoomSessionStorageMessage(
        message({
          command: "persist",
          roomId: "room-a",
          ownerUserId: "user-a",
        }),
        sender(11),
        dependencies,
      ),
    );
    const tabTwo = expectRecord(
      await handleRoomSessionStorageMessage(
        message({
          command: "persist",
          roomId: "room-b",
          ownerUserId: "user-a",
        }),
        sender(12),
        dependencies,
      ),
    );
    const loadedTabOne = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "load", currentUserId: "user-a" }),
        sender(11),
        dependencies,
      ),
    );

    expect(tabOne.roomId).toBe("room-a");
    expect(tabTwo.roomId).toBe("room-b");
    expect(tabOne.participantSessionId).not.toBe(tabTwo.participantSessionId);
    expect(loadedTabOne).toEqual(tabOne);
    expect(dependencies.sessionStorage.values.size).toBe(2);
  });

  it("restores the same tab session after background worker state is recreated", async () => {
    const firstWorker = backgroundDependencies();
    const persisted = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(17),
        firstWorker,
      ),
    );
    const restartedWorker = {
      ...backgroundDependencies(),
      sessionStorage: firstWorker.sessionStorage,
    };

    const restored = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "load", currentUserId: "user-a" }),
        sender(17),
        restartedWorker,
      ),
    );

    expect(restored).toEqual(persisted);
  });

  it("updates Voice mode only for the exact current room session revision", async () => {
    const dependencies = backgroundDependencies();
    const persisted = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(18),
        dependencies,
      ),
    );
    const updated = await updateRoomSessionVoiceMode(persisted, "open-mic", {
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(18), dependencies),
    });

    expect(updated).toEqual({
      ...persisted,
      revision: persisted.revision + 1,
      voiceMode: "open-mic",
    });

    const staleAttempt = await updateRoomSessionVoiceMode(persisted, "push-to-talk", {
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(18), dependencies),
    });
    expect(staleAttempt).toEqual(updated);
  });

  it("preserves Voice mode for the same room and resets it for a new room", async () => {
    const dependencies = backgroundDependencies();
    const first = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(20),
        dependencies,
      ),
    );
    const open = await updateRoomSessionVoiceMode(first, "open-mic", {
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(20), dependencies),
    });
    expect(open?.voiceMode).toBe("open-mic");

    const sameRoom = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(20),
        dependencies,
      ),
    );
    expect(sameRoom.voiceMode).toBe("open-mic");

    const newRoom = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-b", ownerUserId: "user-a" }),
        sender(20),
        dependencies,
      ),
    );
    expect(newRoom.voiceMode).toBe("push-to-talk");
  });

  it("fails closed and clears a record when the current user is missing", async () => {
    const dependencies = backgroundDependencies();

    await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
      sender(19),
      dependencies,
    );
    const response = await handleRoomSessionStorageMessage(
      message({ command: "load", currentUserId: null }),
      sender(19),
      dependencies,
    );

    expect(response).toEqual({ ok: true, record: null });
    expect(dependencies.sessionStorage.values.size).toBe(0);
  });

  it("fails closed and clears missing-owner or wrong-account state", async () => {
    const dependencies = backgroundDependencies();

    await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
      sender(23),
      dependencies,
    );
    const wrongAccount = await handleRoomSessionStorageMessage(
      message({ command: "load", currentUserId: "user-b" }),
      sender(23),
      dependencies,
    );

    expect(wrongAccount).toEqual({ ok: true, record: null });
    expect(dependencies.sessionStorage.values.size).toBe(0);

    const missingOwner = await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-b", ownerUserId: null }),
      sender(23),
      dependencies,
    );

    expect(missingOwner).toEqual({ ok: true, record: null });
    expect(dependencies.sessionStorage.values.size).toBe(0);
  });

  it("removes the tab record when the tab closes", async () => {
    const dependencies = backgroundDependencies();

    await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
      sender(31),
      dependencies,
    );
    await handleRoomSessionStorageMessage(
      message({ command: "persist", roomId: "room-b", ownerUserId: "user-a" }),
      sender(32),
      dependencies,
    );

    await removeRoomSessionForTab(31, dependencies.sessionStorage);

    expect(dependencies.sessionStorage.values.size).toBe(1);
    expect([...dependencies.sessionStorage.values.values()]).toEqual([
      expect.objectContaining({ roomId: "room-b" }),
    ]);
  });

  it("serializes clear and persist so an old clear cannot delete a new room", async () => {
    const dependencies = backgroundDependencies();
    const delayedStorage = new DelayedRemoveStorageArea();
    dependencies.sessionStorage = delayedStorage;
    await handleRoomSessionStorageMessage(
      message({
        command: "persist",
        roomId: "room-old",
        ownerUserId: "user-a",
      }),
      sender(37),
      dependencies,
    );

    const clearPromise = handleRoomSessionStorageMessage(
      message({ command: "clear" }),
      sender(37),
      dependencies,
    );
    await delayedStorage.removeStarted;
    const persistPromise = handleRoomSessionStorageMessage(
      message({
        command: "persist",
        roomId: "room-new",
        ownerUserId: "user-a",
      }),
      sender(37),
      dependencies,
    );
    delayedStorage.continueRemove();
    await Promise.all([clearPromise, persistPromise]);

    const loaded = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "load", currentUserId: "user-a" }),
        sender(37),
        dependencies,
      ),
    );
    expect(loaded.roomId).toBe("room-new");
  });

  it("clears only the exact canceled persistence revision", async () => {
    const dependencies = backgroundDependencies();
    const canceled = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(39),
        dependencies,
      ),
    );
    const replacement = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-a", ownerUserId: "user-a" }),
        sender(39),
        dependencies,
      ),
    );

    const staleCleanup = await handleRoomSessionStorageMessage(
      {
        type: ROOM_SESSION_MESSAGE_TYPE,
        command: "clear-if-match",
        record: canceled,
      } as unknown as RoomSessionMessage,
      sender(39),
      dependencies,
    );
    expect(staleCleanup).toEqual({ ok: true, record: replacement });

    const currentCleanup = await handleRoomSessionStorageMessage(
      {
        type: ROOM_SESSION_MESSAGE_TYPE,
        command: "clear-if-match",
        record: replacement,
      } as unknown as RoomSessionMessage,
      sender(39),
      dependencies,
    );
    expect(currentCleanup).toEqual({ ok: true, record: null });
    expect(dependencies.sessionStorage.values.size).toBe(0);
  });
});

describe("legacy page room session migration", () => {
  it("migrates namespaced keys through the background and deletes them after ACK", async () => {
    const dependencies = backgroundDependencies();
    const pageSessionStorage = new PageSessionStorage();
    const prefix = "anidachi:runtime-id:install-a:room-session";
    await dependencies.localStorage.set({
      [INSTALL_ID_STORAGE_KEY]: "install-a",
    });
    pageSessionStorage.setItem(`${prefix}:room-id`, "room-a");
    pageSessionStorage.setItem(`${prefix}:room-owner-id`, "user-a");
    pageSessionStorage.setItem(`${prefix}:participant-session-id`, "session-stable-a");

    const record = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(41), dependencies),
    });

    expect(record).toEqual({
      version: 1,
      revision: 1,
      roomId: "room-a",
      ownerUserId: "user-a",
      participantSessionId: "session-uuid-1",
      voiceMode: "push-to-talk",
    });
    expect(pageSessionStorage.values.size).toBe(0);
    expect(dependencies.sessionStorage.values.size).toBe(1);
  });

  it("migrates the old unnamespaced page keys", async () => {
    const dependencies = backgroundDependencies();
    const pageSessionStorage = new PageSessionStorage();
    pageSessionStorage.setItem("anidachi:room-id", "legacy-room");
    pageSessionStorage.setItem("anidachi:room-owner-id", "user-a");
    pageSessionStorage.setItem("anidachi:participant-session-id", "legacy-session");

    const record = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(43), dependencies),
    });

    expect(record).toEqual({
      version: 1,
      revision: 1,
      roomId: "legacy-room",
      ownerUserId: "user-a",
      participantSessionId: "session-uuid-1",
      voiceMode: "push-to-talk",
    });
    expect(pageSessionStorage.values.size).toBe(0);
  });

  it("prefers a complete legacy record over an earlier partial namespace", async () => {
    const dependencies = backgroundDependencies();
    const pageSessionStorage = new PageSessionStorage();
    const prefix = "anidachi:runtime-id:install-a:room-session";
    await dependencies.localStorage.set({
      [INSTALL_ID_STORAGE_KEY]: "install-a",
    });
    pageSessionStorage.setItem(`${prefix}:participant-session-id`, "partial-session");
    pageSessionStorage.setItem("anidachi:room-id", "legacy-room");
    pageSessionStorage.setItem("anidachi:room-owner-id", "user-a");
    pageSessionStorage.setItem("anidachi:participant-session-id", "complete-session");

    const record = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(47), dependencies),
    });

    expect(record).toMatchObject({
      roomId: "legacy-room",
      ownerUserId: "user-a",
      participantSessionId: "session-uuid-1",
    });
    expect(pageSessionStorage.values.size).toBe(0);
  });

  it("keeps page keys retryable when the background does not ACK migration", async () => {
    const pageSessionStorage = new PageSessionStorage();
    pageSessionStorage.setItem("anidachi:room-id", "legacy-room");
    pageSessionStorage.setItem("anidachi:room-owner-id", "user-a");
    pageSessionStorage.setItem("anidachi:participant-session-id", "legacy-session");

    await expect(
      migrateLegacyRoomSession("user-a", {
        pageSessionStorage,
        sendMessage: async (runtimeMessage) =>
          runtimeMessage.command === "legacy-prefix"
            ? { ok: true, record: null, legacyPrefix: null }
            : { ok: false, error: "session storage unavailable" },
      }),
    ).rejects.toThrow("session storage unavailable");

    expect(pageSessionStorage.values).toEqual(
      new Map([
        ["anidachi:room-id", "legacy-room"],
        ["anidachi:room-owner-id", "user-a"],
        ["anidachi:participant-session-id", "legacy-session"],
      ]),
    );
  });

  it("keeps a trusted current record instead of overwriting it from stale page state", async () => {
    const dependencies = backgroundDependencies();
    const existing = expectRecord(
      await handleRoomSessionStorageMessage(
        message({ command: "persist", roomId: "room-current", ownerUserId: "user-a" }),
        sender(48),
        dependencies,
      ),
    );
    const pageSessionStorage = new PageSessionStorage();
    pageSessionStorage.setItem("anidachi:room-id", "room-stale");
    pageSessionStorage.setItem("anidachi:room-owner-id", "user-a");
    pageSessionStorage.setItem("anidachi:participant-session-id", "stale-session");

    const migrated = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(48), dependencies),
    });

    expect(migrated).toEqual(existing);
    expect(pageSessionStorage.values.size).toBe(0);
  });

  it("does not trust one cloned legacy session id as two tab identities", async () => {
    const dependencies = backgroundDependencies();
    const firstPage = new PageSessionStorage();
    const duplicatedPage = new PageSessionStorage();
    for (const page of [firstPage, duplicatedPage]) {
      page.setItem("anidachi:room-id", "legacy-room");
      page.setItem("anidachi:room-owner-id", "user-a");
      page.setItem("anidachi:participant-session-id", "cloned-session");
    }

    const first = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage: firstPage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(49), dependencies),
    });
    const duplicate = await migrateLegacyRoomSession("user-a", {
      pageSessionStorage: duplicatedPage,
      sendMessage: (runtimeMessage) =>
        handleRoomSessionStorageMessage(runtimeMessage, sender(50), dependencies),
    });

    expect(first?.participantSessionId).toMatch(/^session-/);
    expect(duplicate?.participantSessionId).toMatch(/^session-/);
    expect(duplicate?.participantSessionId).not.toBe(first?.participantSessionId);
  });
});
