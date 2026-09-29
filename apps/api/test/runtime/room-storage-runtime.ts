import { reset, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredRoomState, writeStoredRoomState } from "../../src/room-persistence";
import { RoomState } from "../../src/room-state";
import { observeRoomStorage } from "../helpers/room-storage-profile";

afterEach(async () => { vi.restoreAllMocks(); await reset(); });
function stub() {
  const rooms = (env as unknown as { ROOMS: DurableObjectNamespace }).ROOMS;
  return rooms.get(rooms.idFromName(`storage-${crypto.randomUUID()}`));
}
describe("real SQLite snapshot persistence", () => {
  it("skips timestamp-only snapshots and unchanged denial sets", async () => {
    await runInDurableObject(stub(), (_instance, state) => {
      const original = { ...new RoomState("room").toSnapshot(), mediaSeatDenials: ["a", "b"] };
      writeStoredRoomState(state.storage, original);
      const profile = observeRoomStorage(state.storage);
      try {
        writeStoredRoomState(state.storage, { ...original, updatedAt: original.updatedAt + 1000,
          mediaSeatDenials: ["b", "a"] });
        expect(profile.snapshot().sqlRowsWritten).toBe(0);
        expect(readStoredRoomState(state.storage)?.updatedAt).toBe(original.updatedAt);
        writeStoredRoomState(state.storage, { ...original, serverSeq: original.serverSeq + 1 });
        expect(profile.snapshot().sqlByKey.media_seat_denials).toBe(0);
        expect(readStoredRoomState(state.storage)?.serverSeq).toBe(original.serverSeq + 1);
      } finally { profile.restore(); }
    });
  });
  it("persists source, participant and capability changes even without a new sequence", async () => {
    await runInDurableObject(stub(), (_instance, state) => {
      const original = new RoomState("room").toSnapshot();
      writeStoredRoomState(state.storage, original);
      const changed = { ...original, sourceGeneration: 2,
        capabilities: { ...original.capabilities, hostPlanCode: "plus" as const,
          maxParticipants: 6 as const, canNameRoom: true, canSendPushInvites: true },
        participants: [{ id: "viewer", displayName: "Viewer", role: "viewer" as const,
          cameraEnabled: false, mediaSeat: "none" as const, syncStatus: "unknown" as const, lastSeenAt: 123 }],
        source: { provider: "youtube" as const, title: "Source", videoFingerprint: "youtube|dQw4w9WgXcQ",
          sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } };
      writeStoredRoomState(state.storage, changed);
      expect(readStoredRoomState(state.storage)).toMatchObject(changed);
    });
  });
  it("rolls back snapshot and denial diff together and permits an identical retry", async () => {
    await runInDurableObject(stub(), (_instance, state) => {
      const original = { ...new RoomState("room").toSnapshot(), mediaSeatDenials: ["old"] };
      writeStoredRoomState(state.storage, original);
      const changed = { ...original, serverSeq: original.serverSeq + 1, mediaSeatDenials: ["a", "b"] };
      const exec = state.storage.sql.exec.bind(state.storage.sql);
      const fail = vi.spyOn(state.storage.sql, "exec").mockImplementation((query, ...bindings) => {
        if (/INSERT INTO room_media_seat_denials/.test(query) && bindings[0] === "b")
          throw new Error("injected denial write failure");
        return exec(query, ...bindings);
      });
      expect(() => writeStoredRoomState(state.storage, changed)).toThrow("injected denial write failure");
      fail.mockRestore();
      expect(readStoredRoomState(state.storage)).toMatchObject(original);
      writeStoredRoomState(state.storage, changed);
      expect(readStoredRoomState(state.storage)).toMatchObject(changed);
      const profile = observeRoomStorage(state.storage);
      try {
        writeStoredRoomState(state.storage, changed);
        expect(profile.snapshot().sqlRowsWritten).toBe(0);
      } finally { profile.restore(); }
    });
  });
});
