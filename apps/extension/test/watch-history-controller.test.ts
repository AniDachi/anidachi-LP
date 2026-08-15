import { describe, expect, it } from "vitest";
import {
  createWatchHistoryController,
  type WatchHistoryControllerDependencies,
} from "../src/watch-history-controller";
import type { WatchProgressEvent } from "@anidachi/protocol";
import type { HistoryObservation } from "../src/source-adapters/core/history-policy";

describe("watch history meaningful-progress controller", () => {
  it("publishes only after a non-seeking playing observation advances", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued).toHaveLength(0);
    expect(fixture.local).toHaveLength(2);

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued).toHaveLength(1);
    expect(fixture.enqueued[0]).toMatchObject({ kind: "heartbeat", currentTime: 11 });
  });

  it("uses 60 seconds only as transport cadence after the meaningful gate and forces terminal state", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.advance(59_999);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    fixture.advance(1);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.observe("pause");

    expect(fixture.enqueued.map((event) => event.kind)).toEqual(["heartbeat", "heartbeat", "pause"]);
    expect(fixture.local).toHaveLength(5);
  });

  it("does not publish pause, seek, pagehide, source change, room leave, or heartbeat before the gate", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    for (const kind of ["pause", "seek", "pagehide", "source_change", "room_leave", "heartbeat"] as const) {
      await fixture.controller.observe(kind);
    }

    expect(fixture.enqueued).toEqual([]);
    expect(fixture.local).toHaveLength(7);
  });

  it("does not treat a seek completion as playing advancement", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    fixture.controller.noteSeeking();
    fixture.setTime(19);
    await fixture.controller.observe("seek");

    expect(fixture.enqueued).toEqual([]);
  });

  it("allows ended without prior advancement but suppresses every publication while a room is active", async () => {
    const fixture = createFixture({ roomActive: true });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.observe("ended");

    expect(fixture.enqueued).toEqual([]);
    expect(fixture.local).toHaveLength(3);
  });
});

function createFixture(options: { roomActive?: boolean } = {}) {
  let now = 1_700_000_000_000;
  let time = 10;
  const local: WatchProgressEvent[] = [];
  const enqueued: WatchProgressEvent[] = [];
  const observation = (): HistoryObservation => ({
    provider: "crunchyroll",
    titleKey: "crunchyroll-series:show",
    itemKind: "series",
    title: "Show",
    artworkUrl: null,
    episodeKey: "episode-1",
    episodeTitle: "Episode 1",
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl: "https://www.crunchyroll.com/watch/episode-1",
    currentTime: time,
    duration: 20,
    progress: time / 20,
  });
  const dependencies: WatchHistoryControllerDependencies = {
    getObservation: observation,
    getRoomActive: () => options.roomActive ?? false,
    loadPreferences: async () => ({ accountGeneration: 1, preferences: { youtubeHistoryEnabled: false } }),
    observeLocally: async (entry) => { local.push(entry); },
    enqueue: async (event) => { enqueued.push(event); },
    now: () => now,
    createEventId: () => "11111111-1111-4111-8111-111111111111",
    createSessionKey: () => "solo:episode-1",
    isPlaying: () => true,
    isSeeking: () => false,
  };
  return {
    controller: createWatchHistoryController(dependencies),
    local,
    enqueued,
    setTime(value: number) { time = value; },
    advance(value: number) { now += value; },
  };
}
