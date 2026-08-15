import { describe, expect, it } from "vitest";
import {
  acknowledgeWatchHistoryEvent,
  enqueueWatchHistoryEvent,
  orderWatchHistoryOutbox,
  removeWatchHistoryEventsForDeletion,
  type WatchHistoryOutboxPartition,
} from "../src/watch-history-outbox";

const ownerUserId = "00000000-0000-4000-8000-000000000001";

function event(
  id: string,
  kind: "heartbeat" | "pause" | "seek" | "ended",
  observedAt: string,
  clientSessionKey = "session-a",
) {
  return {
    schemaVersion: 2 as const,
    clientEventId: id,
    clientSessionKey,
    accountGeneration: 1,
    provider: "youtube" as const,
    titleKey: "title-a",
    itemKind: "series" as const,
    title: "Title A",
    artworkUrl: null,
    episodeKey: "episode-a",
    episodeTitle: "Episode A",
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    currentTime: 12,
    duration: 120,
    progress: 0.1,
    observedAt,
    kind,
  };
}

describe("watch history outbox", () => {
  it("keeps one terminal and one latest slot per account generation key", () => {
    const empty: WatchHistoryOutboxPartition = {
      ownerUserId,
      accountGeneration: 1,
      entries: [],
    };
    const withLatest = enqueueWatchHistoryEvent(
      empty,
      event("00000000-0000-4000-4000-800000000001", "heartbeat", "2026-08-15T10:00:00.000Z"),
      10,
    );
    const replacedLatest = enqueueWatchHistoryEvent(
      withLatest,
      event("00000000-0000-4000-4000-800000000002", "heartbeat", "2026-08-15T10:01:00.000Z"),
      11,
    );
    const withTerminal = enqueueWatchHistoryEvent(
      replacedLatest,
      event("00000000-0000-4000-4000-800000000003", "ended", "2026-08-15T10:02:00.000Z"),
      12,
    );

    expect(orderWatchHistoryOutbox(withTerminal).map((entry) => entry.event.clientEventId)).toEqual([
      "00000000-0000-4000-4000-800000000003",
      "00000000-0000-4000-4000-800000000002",
    ]);
    expect(acknowledgeWatchHistoryEvent(withTerminal, "00000000-0000-4000-4000-800000000003").entries).toHaveLength(1);
    expect(acknowledgeWatchHistoryEvent(withTerminal, "00000000-0000-4000-4000-800000000099")).toEqual(withTerminal);
  });

  it("keeps retry IDs stable, orders deterministically, and removes only the deleted scope", () => {
    const empty: WatchHistoryOutboxPartition = {
      ownerUserId,
      accountGeneration: 1,
      entries: [],
    };
    const first = enqueueWatchHistoryEvent(
      empty,
      event("00000000-0000-4000-4000-800000000010", "heartbeat", "2026-08-15T10:00:00.000Z"),
      5,
    );
    const second = enqueueWatchHistoryEvent(
      first,
      {
        ...event("00000000-0000-4000-4000-800000000011", "heartbeat", "2026-08-15T09:00:00.000Z"),
        titleKey: "title-b",
        episodeKey: "episode-b",
      },
      4,
    );

    expect(orderWatchHistoryOutbox(second).map((entry) => entry.event.clientEventId)).toEqual([
      "00000000-0000-4000-4000-800000000011",
      "00000000-0000-4000-4000-800000000010",
    ]);
    expect(JSON.parse(JSON.stringify(second)).entries[0].event.clientEventId).toBe(
      "00000000-0000-4000-4000-800000000010",
    );
    expect(
      removeWatchHistoryEventsForDeletion(second, {
        scope: "episode",
        provider: "youtube",
        titleKey: "title-a",
        episodeKey: "episode-a",
      }).entries.map((entry) => entry.event.titleKey),
    ).toEqual(["title-b"]);
    expect(() =>
      enqueueWatchHistoryEvent(
        empty,
        { ...event("00000000-0000-4000-4000-800000000012", "heartbeat", "2026-08-15T10:00:00.000Z"), accountGeneration: 2 },
      ),
    ).toThrow("generation");
  });

  it("uses owner/generation/session in the coalescing key and preserves the first unacknowledged ended event", () => {
    const empty: WatchHistoryOutboxPartition = {
      ownerUserId,
      accountGeneration: 1,
      entries: [],
    };
    const firstEnded = enqueueWatchHistoryEvent(
      empty,
      event("00000000-0000-4000-4000-800000000020", "ended", "2026-08-15T10:00:00.000Z"),
      10,
    );
    const withSecondEnded = enqueueWatchHistoryEvent(
      firstEnded,
      event("00000000-0000-4000-4000-800000000021", "ended", "2026-08-15T10:01:00.000Z"),
      11,
    );
    const withSecondSession = enqueueWatchHistoryEvent(
      withSecondEnded,
      event("00000000-0000-4000-4000-800000000022", "heartbeat", "2026-08-15T10:01:00.000Z", "session-b"),
      12,
    );

    expect(withSecondSession.entries.map((entry) => entry.event.clientEventId)).toContain(
      "00000000-0000-4000-4000-800000000020",
    );
    expect(withSecondSession.entries.map((entry) => entry.event.clientEventId)).not.toContain(
      "00000000-0000-4000-4000-800000000021",
    );
    expect(withSecondSession.entries).toHaveLength(2);
    expect(withSecondSession.entries[0]?.key).toBe(
      "00000000-0000-4000-8000-000000000001:1:youtube:title-a:episode-a:session-a",
    );
  });

  it("orders equal-time entries by stable event ID without persisted-time precedence", () => {
    const empty: WatchHistoryOutboxPartition = {
      ownerUserId,
      accountGeneration: 1,
      entries: [],
    };
    const laterPersisted = enqueueWatchHistoryEvent(
      empty,
      event("00000000-0000-4000-4000-800000000099", "heartbeat", "2026-08-15T10:00:00.000Z", "session-a"),
      99,
    );
    const separateSession = enqueueWatchHistoryEvent(
      laterPersisted,
      event("00000000-0000-4000-4000-800000000001", "heartbeat", "2026-08-15T10:00:00.000Z", "session-b"),
      1,
    );
    expect(orderWatchHistoryOutbox(separateSession).map((entry) => entry.event.clientEventId)).toEqual([
      "00000000-0000-4000-4000-800000000001",
      "00000000-0000-4000-4000-800000000099",
    ]);
  });
});
