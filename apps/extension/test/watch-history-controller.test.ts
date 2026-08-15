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

  it("creates a unique logical playback session while keeping one key stable within that session", async () => {
    const first = createFixture({ sessionKeys: ["11111111-1111-4111-8111-111111111111"] });
    await first.controller.start();
    first.setTime(11);
    await first.controller.observe("heartbeat");
    await first.controller.observe("pause");
    const second = createFixture({ sessionKeys: ["22222222-2222-4222-8222-222222222222"] });
    await second.controller.start();
    second.setTime(11);
    await second.controller.observe("heartbeat");

    expect(first.enqueued.map((event) => event.clientSessionKey)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(second.enqueued[0]?.clientSessionKey).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("publishes the retained meaningful source before rotating session identity and requiring a new gate", async () => {
    const fixture = createFixture({
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setSource({ titleKey: "crunchyroll-series:other", episodeKey: "episode-2", sourceUrl: "https://www.crunchyroll.com/watch/episode-2" });
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [event.kind, event.titleKey, event.clientSessionKey])).toEqual([
      ["heartbeat", "crunchyroll-series:show", "11111111-1111-4111-8111-111111111111"],
      ["source_change", "crunchyroll-series:show", "11111111-1111-4111-8111-111111111111"],
    ]);
    expect(fixture.local.at(-1)).toMatchObject({
      titleKey: "crunchyroll-series:other",
      clientSessionKey: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("does not publish a source change before that source becomes meaningful", async () => {
    const fixture = createFixture({
      sessionKeys: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    });
    await fixture.controller.start();
    fixture.setSource({ titleKey: "crunchyroll-series:other", episodeKey: "episode-2", sourceUrl: "https://www.crunchyroll.com/watch/episode-2" });
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued).toEqual([]);
  });

  it("invalidates delayed preference loading and queued work after disposal", async () => {
    let resolvePreferences: ((value: { accountGeneration: number; preferences: { youtubeHistoryEnabled: boolean } }) => void) | null = null;
    const fixture = createFixture({
      loadPreferences: () => new Promise((resolve) => { resolvePreferences = resolve; }),
    });
    const starting = fixture.controller.start();
    const disposing = fixture.controller.dispose();
    (resolvePreferences as unknown as (value: {
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void)({ accountGeneration: 1, preferences: { youtubeHistoryEnabled: false } });
    await Promise.all([starting, disposing]);

    expect(fixture.local).toEqual([]);
    expect(fixture.enqueued).toEqual([]);
    expect(fixture.current).toEqual([]);
  });

  it("does not let a disposed controller overwrite Current Resource with a later route", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    await fixture.controller.dispose();
    fixture.setSource({ titleKey: "crunchyroll-series:other", episodeKey: "episode-2", sourceUrl: "https://www.crunchyroll.com/watch/episode-2" });
    await fixture.controller.observe("heartbeat");

    expect(fixture.current).toHaveLength(1);
    expect(fixture.current[0]).toMatchObject({ titleKey: "crunchyroll-series:show" });
  });

  it("serializes concurrent forced events and keeps the retained source through cleanup", async () => {
    const fixture = createFixture({ sessionKeys: ["11111111-1111-4111-8111-111111111111"] });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setSource({ titleKey: "crunchyroll-series:other", episodeKey: "episode-2", sourceUrl: "https://www.crunchyroll.com/watch/episode-2" });
    await Promise.all([fixture.controller.observe("pause"), fixture.controller.dispose()]);

    expect(fixture.maxEnqueueConcurrency).toBe(1);
    expect(fixture.enqueued.at(-1)).toMatchObject({
      kind: "source_change",
      titleKey: "crunchyroll-series:show",
    });
  });

  it("observes but never publishes shared playback, then requires a fresh solo gate after leave", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(true);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(false);
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => event.currentTime)).toEqual([11, 14]);
    expect(fixture.local.some((event) => event.currentTime === 12)).toBe(true);
  });

  it("suppresses solo publication when room-entry persistence fails and requires a fresh session gate after leave", async () => {
    const fixture = createFixture({
      sessionKeys: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
      rejectLocalKinds: new Set(["source_change"]),
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(true);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.observe("pause");
    await fixture.controller.setRoomActive(false);
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [event.currentTime, event.clientSessionKey])).toEqual([
      [11, "11111111-1111-4111-8111-111111111111"],
      [14, "33333333-3333-4333-8333-333333333333"],
    ]);
    expect(fixture.localFailures).toBe(1);
  });

  it("does not start a second forced enqueue until the first deferred enqueue resolves", async () => {
    const fixture = createFixture({ holdEnqueueAt: 2 });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    const first = fixture.controller.observe("pause");
    await fixture.waitForEnqueues(2);
    const second = fixture.controller.observe("pagehide");
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.enqueued.map((event) => event.kind)).toEqual(["heartbeat", "pause"]);
    expect(fixture.maxEnqueueConcurrency).toBe(1);
    fixture.releaseHeldEnqueue();
    await Promise.all([first, second]);
    expect(fixture.enqueued.map((event) => event.kind)).toEqual(["heartbeat", "pause", "pagehide"]);
    expect(fixture.maxEnqueueConcurrency).toBe(1);
  });
});

function createFixture(options: {
  roomActive?: boolean;
  sessionKeys?: string[];
  loadPreferences?: WatchHistoryControllerDependencies["loadPreferences"];
  rejectLocalKinds?: Set<WatchProgressEvent["kind"]>;
  holdEnqueueAt?: number;
} = {}) {
  let now = 1_700_000_000_000;
  let time = 10;
  let roomActive = options.roomActive ?? false;
  let source = {
    titleKey: "crunchyroll-series:show",
    episodeKey: "episode-1",
    sourceUrl: "https://www.crunchyroll.com/watch/episode-1",
  };
  const sessionKeys = [...(options.sessionKeys ?? ["11111111-1111-4111-8111-111111111111"])];
  const local: WatchProgressEvent[] = [];
  const enqueued: WatchProgressEvent[] = [];
  const current: Array<HistoryObservation | null> = [];
  let enqueueConcurrency = 0;
  let maxEnqueueConcurrency = 0;
  let enqueueCount = 0;
  let localFailures = 0;
  let releaseHeldEnqueue: (() => void) | null = null;
  const observation = (): HistoryObservation => ({
    provider: "crunchyroll",
    providerLabel: "Crunchyroll",
    titleKey: source.titleKey,
    itemKind: "series",
    title: "Show",
    artworkUrl: null,
    episodeKey: source.episodeKey,
    episodeTitle: "Episode 1",
    seasonKey: null,
    seasonTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    sourceUrl: source.sourceUrl,
    currentTime: time,
    duration: 20,
    progress: time / 20,
  });
  const dependencies: WatchHistoryControllerDependencies = {
    getObservation: observation,
    getRoomActive: () => roomActive,
    loadPreferences: options.loadPreferences ?? (async () => ({ accountGeneration: 1, preferences: { youtubeHistoryEnabled: false } })),
    observeLocally: async (entry) => {
      if (options.rejectLocalKinds?.has(entry.kind)) {
        localFailures += 1;
        throw new Error("storage-full");
      }
      local.push(entry);
    },
    enqueue: async (event) => {
      enqueueCount += 1;
      enqueueConcurrency += 1;
      maxEnqueueConcurrency = Math.max(maxEnqueueConcurrency, enqueueConcurrency);
      enqueued.push(event);
      if (enqueueCount === options.holdEnqueueAt) {
        await new Promise<void>((resolve) => { releaseHeldEnqueue = resolve; });
      } else {
        await Promise.resolve();
      }
      enqueueConcurrency -= 1;
    },
    onObservation: (entry) => { current.push(entry); },
    now: () => now,
    createEventId: () => "11111111-1111-4111-8111-111111111111",
    createSessionKey: () => sessionKeys.shift() ?? "33333333-3333-4333-8333-333333333333",
    isPlaying: () => true,
    isSeeking: () => false,
  };
  return {
    controller: createWatchHistoryController(dependencies),
    local,
    enqueued,
    current,
    get maxEnqueueConcurrency() { return maxEnqueueConcurrency; },
    get localFailures() { return localFailures; },
    setTime(value: number) { time = value; },
    setSource(next: Partial<typeof source>) { source = { ...source, ...next }; },
    setRoomActive(value: boolean) { roomActive = value; },
    advance(value: number) { now += value; },
    releaseHeldEnqueue() { releaseHeldEnqueue?.(); },
    async waitForEnqueues(count: number) {
      for (let attempt = 0; attempt < 20 && enqueued.length < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(enqueued).toHaveLength(count);
    },
  };
}
