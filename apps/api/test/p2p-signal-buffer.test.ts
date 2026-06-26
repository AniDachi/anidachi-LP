import { describe, expect, it } from "vitest";
import {
  getP2PSignalDedupeKey,
  type BufferedP2PSignalEvent,
  RecentP2PSignalBuffer,
} from "../src/p2p-signal-buffer";

function p2pEvent(overrides: Partial<BufferedP2PSignalEvent> = {}): BufferedP2PSignalEvent {
  return {
    type: "P2P_SIGNAL",
    clientSignalId: "signal-1",
    fromUserId: "host",
    roomId: "room-1",
    roomGeneration: 1,
    senderConnectionId: "connection-1",
    serverReceivedAt: 1_000,
    serverSeq: 1,
    signal: { kind: "renegotiate" },
    sourceGeneration: 1,
    toUserId: "viewer",
    ...overrides,
  };
}

describe("RecentP2PSignalBuffer", () => {
  it("dedupes repeated sender signal ids without replacing the original event", () => {
    const buffer = new RecentP2PSignalBuffer();
    const first = p2pEvent({ serverSeq: 1 });
    const second = p2pEvent({ serverSeq: 2 });

    expect(buffer.add(first, 1_000)).toEqual({ duplicate: false, event: first });
    expect(buffer.add(second, 1_001)).toEqual({ duplicate: true, event: first });
    expect(buffer.replayFor("viewer", 0, 1_001)).toEqual([first]);
  });

  it("replays only targeted events newer than the last seen server sequence", () => {
    const buffer = new RecentP2PSignalBuffer();
    const oldTargeted = p2pEvent({ clientSignalId: "old", serverSeq: 1 });
    const newTargeted = p2pEvent({ clientSignalId: "new", serverSeq: 2 });
    const otherTarget = p2pEvent({
      clientSignalId: "other",
      serverSeq: 3,
      toUserId: "other-viewer",
    });

    buffer.add(oldTargeted, 1_000);
    buffer.add(newTargeted, 1_001);
    buffer.add(otherTarget, 1_002);

    expect(buffer.replayFor("viewer", 1, 1_002)).toEqual([newTargeted]);
  });

  it("prunes old events by ttl and max size", () => {
    const buffer = new RecentP2PSignalBuffer(2, 100);
    const first = p2pEvent({ clientSignalId: "first", serverReceivedAt: 1_000, serverSeq: 1 });
    const second = p2pEvent({ clientSignalId: "second", serverReceivedAt: 1_050, serverSeq: 2 });
    const third = p2pEvent({ clientSignalId: "third", serverReceivedAt: 1_080, serverSeq: 3 });

    buffer.add(first, 1_000);
    buffer.add(second, 1_050);
    buffer.add(third, 1_080);

    expect(buffer.replayFor("viewer", 0, 1_080)).toEqual([second, third]);

    buffer.prune(1_181);
    expect(buffer.replayFor("viewer", 0, 1_181)).toEqual([]);
  });

  it("does not replay signals from stale room or source generations", () => {
    const buffer = new RecentP2PSignalBuffer();
    const active = p2pEvent({
      clientSignalId: "active",
      roomGeneration: 2,
      serverSeq: 1,
      sourceGeneration: 5,
    });
    const staleRoom = p2pEvent({
      clientSignalId: "stale-room",
      roomGeneration: 1,
      serverSeq: 2,
      sourceGeneration: 5,
    });
    const staleSource = p2pEvent({
      clientSignalId: "stale-source",
      roomGeneration: 2,
      serverSeq: 3,
      sourceGeneration: 4,
    });

    buffer.add(active, 1_000);
    buffer.add(staleRoom, 1_001);
    buffer.add(staleSource, 1_002);

    expect(
      buffer.replayFor("viewer", 0, 1_002, {
        roomGeneration: 2,
        sourceGeneration: 5,
      }),
    ).toEqual([active]);
  });

  it("hydrates a persisted replay buffer and rebuilds dedupe state", () => {
    const buffer = new RecentP2PSignalBuffer();
    const first = p2pEvent({ clientSignalId: "first", serverSeq: 1 });
    const second = p2pEvent({ clientSignalId: "second", serverSeq: 2 });

    buffer.hydrate([second, first], 1_002);

    expect(buffer.replayFor("viewer", 0, 1_002)).toEqual([first, second]);
    expect(buffer.hasSeen(first)).toBe(true);
    expect(buffer.add({ ...first, serverSeq: 9 }, 1_003)).toEqual({
      duplicate: true,
      event: first,
    });
    expect(getP2PSignalDedupeKey(first)).toBe("room-1:host:viewer:first");
  });
});
