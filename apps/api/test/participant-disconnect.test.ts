import { ROOM_DISCONNECT_GRACE_MS } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
  acknowledgeParticipantDisconnect,
  acknowledgeStoredParticipantDisconnect,
  cancelParticipantDisconnectForJoin,
  cancelStoredParticipantDisconnectForJoin,
  claimDueParticipantDisconnects,
  claimDueStoredParticipantDisconnects,
  createParticipantDisconnect,
  expediteParticipantDisconnect,
  MAX_PERSISTED_PARTICIPANT_DISCONNECTS,
  nextParticipantDisconnectAlarmAt,
  parseParticipantDisconnectState,
  readStoredParticipantDisconnects,
  storeParticipantDisconnect,
  upsertParticipantDisconnect,
} from "../src/participant-disconnect";
import { reconcileStoredRoomAlarm } from "../src/room-source-persistence";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const GUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("participant disconnect state", () => {
  it("creates the canonical 60-second exact-session deadline", () => {
    expect(
      createParticipantDisconnect({
        userId: HOST_ID,
        role: "host",
        participantSessionId: "host-session",
        disconnectedAt: 1_000,
      }),
    ).toEqual({
      userId: HOST_ID,
      role: "host",
      participantSessionId: "host-session",
      disconnectedAt: 1_000,
      deadlineAt: 1_000 + ROOM_DISCONNECT_GRACE_MS,
      departureAt: 1_000 + ROOM_DISCONNECT_GRACE_MS,
      attempts: 0,
      nextAttemptAt: 1_000 + ROOM_DISCONNECT_GRACE_MS,
    });
  });

  it("cancels both a same-session reconnect and a deliberate newer-session takeover", () => {
    const state = upsertParticipantDisconnect(null, createParticipantDisconnect({
      userId: HOST_ID,
      role: "host",
      participantSessionId: "old-session",
      disconnectedAt: 1_000,
    }), 6);

    expect(
      cancelParticipantDisconnectForJoin(state, HOST_ID, "old-session"),
    ).toEqual({ outcome: "reconnected", state: null });
    expect(
      cancelParticipantDisconnectForJoin(state, HOST_ID, "new-session"),
    ).toEqual({ outcome: "taken_over", state: null });
  });

  it("keeps stale exact-session acknowledgement harmless", () => {
    const state = upsertParticipantDisconnect(null, createParticipantDisconnect({
      userId: GUEST_ID,
      role: "member",
      participantSessionId: "current-session",
      disconnectedAt: 1_000,
    }), 6);

    expect(
      acknowledgeParticipantDisconnect(state, GUEST_ID, "old-session"),
    ).toEqual({ outcome: "stale", state });
    expect(
      acknowledgeParticipantDisconnect(state, GUEST_ID, "current-session"),
    ).toEqual({ outcome: "acknowledged", state: null });
  });

  it("claims every bounded due record once and retains retry deadlines", () => {
    const host = createParticipantDisconnect({
      userId: HOST_ID,
      role: "host",
      participantSessionId: "host-session",
      disconnectedAt: 1_000,
    });
    const guest = createParticipantDisconnect({
      userId: GUEST_ID,
      role: "member",
      participantSessionId: "guest-session",
      disconnectedAt: 2_000,
    });
    const state = upsertParticipantDisconnect(
      upsertParticipantDisconnect(null, host, 6),
      guest,
      6,
    );
    const beforeDue = claimDueParticipantDisconnects(
      state,
      host.deadlineAt - 1,
    );
    expect(beforeDue.claimed).toEqual([]);
    expect(beforeDue.state).toEqual(state);

    const due = claimDueParticipantDisconnects(
      state,
      guest.deadlineAt,
    );
    expect(due.claimed.map((record) => record.userId)).toEqual([
      HOST_ID,
      GUEST_ID,
    ]);
    expect(due.claimed.every((record) => record.attempts === 1)).toBe(true);
    expect(
      due.claimed.every((record) => record.nextAttemptAt > guest.deadlineAt),
    ).toBe(true);
    expect(nextParticipantDisconnectAlarmAt(due.state)).toBe(
      due.claimed[0]?.nextAttemptAt,
    );
  });

  it("expedites only the exact active session", () => {
    const state = upsertParticipantDisconnect(null, createParticipantDisconnect({
      userId: GUEST_ID,
      role: "member",
      participantSessionId: "guest-session",
      disconnectedAt: 1_000,
    }), 6);

    expect(
      expediteParticipantDisconnect(state, GUEST_ID, "old-session", 2_000),
    ).toEqual({ outcome: "stale", state });
    const expedited = expediteParticipantDisconnect(
      state,
      GUEST_ID,
      "guest-session",
      2_000,
    );
    expect(expedited.outcome).toBe("expedited");
    expect(expedited.state?.records[0]?.nextAttemptAt).toBe(2_000);
    expect(expedited.state?.records[0]?.departureAt).toBe(2_000);
  });

  it("honors an explicit persisted-record bound", () => {
    const first = upsertParticipantDisconnect(null, createParticipantDisconnect({
      userId: HOST_ID,
      role: "host",
      participantSessionId: "host-session",
      disconnectedAt: 1_000,
    }), 1);

    expect(() => upsertParticipantDisconnect(
      first,
      createParticipantDisconnect({
        userId: GUEST_ID,
        role: "member",
        participantSessionId: "guest-session",
        disconnectedAt: 2_000,
      }),
      1,
    )).toThrow("Participant disconnect capacity exceeded");
  });

  it("rejects corrupt persisted records instead of losing a deadline", () => {
    expect(parseParticipantDisconnectState({
      schemaVersion: 1,
      records: [{
        userId: HOST_ID,
        role: "host",
        participantSessionId: "host-session",
        disconnectedAt: 1_000,
        deadlineAt: 1_001,
        departureAt: 1_001,
        attempts: 0,
        nextAttemptAt: 1_001,
      }],
    })).toBeNull();
  });

  it("persists, restores, claims, and acknowledges one hibernation-safe deadline", async () => {
    const storage = new MemoryStorage();
    const durable = storage.asDurableObjectStorage();
    const record = createParticipantDisconnect({
      userId: GUEST_ID,
      role: "member",
      participantSessionId: "guest-session",
      disconnectedAt: 1_000,
    });

    await storeParticipantDisconnect(
      durable,
      record,
      6,
      reconcileStoredRoomAlarm,
    );
    expect(storage.alarmAt).toBe(record.deadlineAt);
    await expect(readStoredParticipantDisconnects(durable)).resolves.toEqual({
      schemaVersion: 1,
      records: [record],
    });

    await expect(claimDueStoredParticipantDisconnects(
      durable,
      record.deadlineAt,
      reconcileStoredRoomAlarm,
    )).resolves.toMatchObject([{ userId: GUEST_ID, attempts: 1 }]);
    expect(storage.alarmAt).toBeGreaterThan(record.deadlineAt);

    await expect(acknowledgeStoredParticipantDisconnect(
      durable,
      GUEST_ID,
      "old-session",
      reconcileStoredRoomAlarm,
    )).resolves.toBe("stale");
    await expect(acknowledgeStoredParticipantDisconnect(
      durable,
      GUEST_ID,
      "guest-session",
      reconcileStoredRoomAlarm,
    )).resolves.toBe("acknowledged");
    expect(storage.alarmAt).toBeNull();
  });

  it("retains disconnect deadlines independently from the live room seat cap", async () => {
    const storage = new MemoryStorage();
    const durable = storage.asDurableObjectStorage();
    const host = createParticipantDisconnect({
      userId: HOST_ID,
      role: "host",
      participantSessionId: "host-session",
      disconnectedAt: 1_000,
    });
    const guest = createParticipantDisconnect({
      userId: GUEST_ID,
      role: "member",
      participantSessionId: "guest-session",
      disconnectedAt: 2_000,
    });

    await storeParticipantDisconnect(
      durable,
      host,
      MAX_PERSISTED_PARTICIPANT_DISCONNECTS,
      reconcileStoredRoomAlarm,
    );
    await storeParticipantDisconnect(
      durable,
      guest,
      MAX_PERSISTED_PARTICIPANT_DISCONNECTS,
      reconcileStoredRoomAlarm,
    );

    await expect(readStoredParticipantDisconnects(durable)).resolves.toMatchObject({
      records: [
        { userId: HOST_ID, participantSessionId: "host-session" },
        { userId: GUEST_ID, participantSessionId: "guest-session" },
      ],
    });
  });

  it("atomically cancels a stored old session when a newer same-room join wins", async () => {
    const storage = new MemoryStorage();
    const durable = storage.asDurableObjectStorage();
    await storeParticipantDisconnect(
      durable,
      createParticipantDisconnect({
        userId: HOST_ID,
        role: "host",
        participantSessionId: "old-session",
        disconnectedAt: 1_000,
      }),
      6,
      reconcileStoredRoomAlarm,
    );

    await expect(cancelStoredParticipantDisconnectForJoin(
      durable,
      HOST_ID,
      "new-session",
      reconcileStoredRoomAlarm,
    )).resolves.toBe("taken_over");
    await expect(readStoredParticipantDisconnects(durable)).resolves.toBeNull();
    expect(storage.alarmAt).toBeNull();
  });
});

class MemoryStorage {
  readonly values = new Map<string, unknown>();
  alarmAt: number | null = null;

  asDurableObjectStorage(): DurableObjectStorage {
    return this as unknown as DurableObjectStorage;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async setAlarm(scheduledTime: number): Promise<void> {
    this.alarmAt = scheduledTime;
  }

  async deleteAlarm(): Promise<void> {
    this.alarmAt = null;
  }

  async transaction<T>(
    closure: (transaction: DurableObjectTransaction) => Promise<T>,
  ): Promise<T> {
    return closure(this as unknown as DurableObjectTransaction);
  }
}
