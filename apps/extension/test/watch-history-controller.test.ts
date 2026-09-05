import { describe, expect, it, vi } from "vitest";
import {
  createWatchHistoryController,
  type WatchHistoryController,
  type WatchHistoryControllerDependencies,
} from "../src/watch-history-controller";
import type { WatchProgressEvent } from "@anidachi/protocol";
import type { HistoryObservation } from "../src/source-adapters/core/history-policy";
import type { WatchHistoryCaptureResult } from "../src/watch-history-client";

describe("watch history meaningful-progress controller", () => {
  it("signals discovery after durable capture without awaiting metadata and coalesces a playback interaction", async () => {
    const discovered: Array<{ refreshCatalog: boolean }> = [];
    const fixture = createFixture({ onPersisted: (_event, _owner, options) => { discovered.push(options); return new Promise<void>(() => undefined); } });
    await fixture.controller.start();
    await fixture.controller.notePlaybackInteraction();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    expect(discovered.map((entry) => entry.refreshCatalog)).toEqual([true, false]);
    await fixture.controller.dispose();
  });
  it("starts local capture from confirmed cache without waiting for canonical refresh", async () => {
    let resolveCanonical!: (
      value: Awaited<ReturnType<WatchHistoryControllerDependencies["loadPreferences"]>>,
    ) => void;
    const fixture = createFixture({
      loadCachedPreferences: async () => ({
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
      }),
      loadPreferences: () => new Promise((resolve) => { resolveCanonical = resolve; }),
    });
    let started = false;
    const start = fixture.controller.start().then(() => { started = true; });

    await start;
    expect(started).toBe(true);
    expect(fixture.localDisplayModes).toEqual(["mine"]);

    fixture.setTime(11);
    const observing = fixture.controller.observe("heartbeat");
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.localDisplayModes).toEqual(["mine", "mine"]);

    resolveCanonical({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    });
    await observing;
  });

  it("keeps YouTube disabled during cached startup authority", async () => {
    let resolveCanonical!: (
      value: Awaited<ReturnType<WatchHistoryControllerDependencies["loadPreferences"]>>,
    ) => void;
    const observedPreferences: Array<boolean | undefined> = [];
    const fixture = createFixture({
      loadCachedPreferences: async () => ({
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
      }),
      loadPreferences: () => new Promise((resolve) => { resolveCanonical = resolve; }),
      getObservation: (preferences, observation) => {
        observedPreferences.push(preferences?.youtubeHistoryEnabled);
        return observation;
      },
    });

    await fixture.controller.start();

    expect(observedPreferences).toEqual([false]);
    resolveCanonical({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });
  });

  it("publishes active local presentation immediately and clears it on page exit", async () => {
    const solo = createFixture();
    await solo.controller.start();
    await solo.controller.observe("pagehide");
    expect(solo.localDisplayModes).toEqual(["mine", null]);

    const together = createFixture({ roomActive: true });
    await together.controller.start();
    expect(together.localDisplayModes).toEqual(["together"]);
  });

  it("clears active local presentation when the supported source disappears", async () => {
    let sourceAvailable = true;
    const fixture = createFixture({
      getObservation: (_preferences, observation) => sourceAvailable ? observation : null,
    });
    await fixture.controller.start();
    sourceAvailable = false;
    await fixture.controller.observe("heartbeat");

    expect(fixture.local.map((event) => event.kind)).toEqual(["heartbeat", "source_change"]);
    expect(fixture.localDisplayModes).toEqual(["mine", null]);
  });

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

  it("keeps meaningful solo progress fresh locally without increasing transport cadence", async () => {
    const fixture = createFixture();
    await fixture.controller.start();

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.advance(5_000);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    expect(fixture.localMeaningfulSolo).toEqual([false, true, true]);
    expect(fixture.enqueued.map((event) => [event.kind, event.currentTime])).toEqual([
      ["heartbeat", 11],
    ]);
  });

  it("durably coalesces every meaningful local sample but requests transport only on cadence and boundaries", async () => {
    const fixture = createFixture();
    await fixture.controller.start();

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.advance(5_000);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.observe("pause");

    expect(fixture.localSyncDecisions).toEqual([
      [false, false],
      [true, true],
      [true, false],
      [true, true],
    ]);
  });

  it("never marks active-room observations as meaningful solo progress", async () => {
    const fixture = createFixture({ roomActive: true });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.observe("ended");

    expect(fixture.localMeaningfulSolo).toEqual([false, false, false]);
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

  it("publishes meaningful shared progress only after exact room authority arrives", async () => {
    const fixture = createFixture({
      roomActive: true,
      sessionKeys: ["11111111-1111-4111-8111-111111111111"],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued).toEqual([]);

    await fixture.controller.setRoomHistoryAuthority(roomAuthority());
    expect(fixture.roomAuthorityStates).toEqual(["ready"]);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued).toEqual([
      expect.objectContaining({
        currentTime: 13,
        clientSessionKey: "11111111-1111-4111-8111-111111111111",
        sharedRoom: roomAuthority(),
      }),
    ]);
  });

  it("keeps a new generation recoverably waiting until the adapter observes the new source", async () => {
    const fixture = createFixture({
      roomActive: true,
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();
    await fixture.controller.setRoomHistoryAuthority(roomAuthority());
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    await fixture.controller.setRoomHistoryAuthority(null);
    await fixture.controller.setRoomHistoryAuthority(roomAuthority(2));
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    fixture.setSource({
      titleKey: "crunchyroll-series:other",
      episodeKey: "episode-2",
      sourceUrl: "https://www.crunchyroll.com/watch/episode-2",
    });
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(15);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [
      event.kind,
      event.currentTime,
      event.titleKey,
      event.sharedRoom?.sourceGeneration,
    ])).toEqual([
      ["heartbeat", 12, "crunchyroll-series:show", 1],
      ["source_change", 12, "crunchyroll-series:show", 1],
      ["heartbeat", 15, "crunchyroll-series:other", 2],
    ]);
    expect(fixture.roomAuthorityStates).toContain("waiting");
    expect(fixture.roomAuthorityStates.at(-1)).toBe("ready");
  });

  it("finalizes the prior shared source with its old authority before activating a new generation", async () => {
    const fixture = createFixture({
      roomActive: true,
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();
    await fixture.controller.setRoomHistoryAuthority(roomAuthority());
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    await fixture.controller.setRoomHistoryAuthority(null);
    fixture.setSource({
      titleKey: "crunchyroll-series:other",
      episodeKey: "episode-2",
      sourceUrl: "https://www.crunchyroll.com/watch/episode-2",
    });
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomHistoryAuthority(roomAuthority(2));
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(15);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [
      event.kind,
      event.currentTime,
      event.clientSessionKey,
      event.sharedRoom?.sourceGeneration,
    ])).toEqual([
      ["heartbeat", 12, "11111111-1111-4111-8111-111111111111", 1],
      ["source_change", 12, "11111111-1111-4111-8111-111111111111", 1],
      ["heartbeat", 15, "22222222-2222-4222-8222-222222222222", 2],
    ]);
  });

  it("reuses the shared session for a replacement proof with the same tuple", async () => {
    const fixture = createFixture({ roomActive: true });
    await fixture.controller.start();
    await fixture.controller.setRoomHistoryAuthority(roomAuthority());
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomHistoryAuthority(roomAuthority(1, "replacement-proof"));
    fixture.setTime(13);
    await fixture.controller.observe("pause");

    expect(fixture.enqueued.map((event) => [
      event.kind,
      event.clientSessionKey,
      event.sharedRoom?.attestation,
    ])).toEqual([
      ["heartbeat", "11111111-1111-4111-8111-111111111111", "proof-1"],
      ["pause", "11111111-1111-4111-8111-111111111111", "replacement-proof"],
    ]);
  });

  it("publishes room leave with the retained authority then requires a fresh solo gate", async () => {
    const fixture = createFixture({
      roomActive: true,
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();
    await fixture.controller.setRoomHistoryAuthority(roomAuthority());
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    fixture.setRoomActive(false);
    await fixture.controller.setRoomActive(false);
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [
      event.kind,
      event.currentTime,
      event.clientSessionKey,
      event.sharedRoom?.sourceGeneration ?? null,
    ])).toEqual([
      ["heartbeat", 12, "11111111-1111-4111-8111-111111111111", 1],
      ["room_leave", 12, "11111111-1111-4111-8111-111111111111", 1],
      ["heartbeat", 14, "22222222-2222-4222-8222-222222222222", null],
    ]);
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
    let resolvePreferences: ((value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void) | null = null;
    const fixture = createFixture({
      loadPreferences: () => new Promise((resolve) => { resolvePreferences = resolve; }),
    });
    const starting = fixture.controller.start();
    const disposing = fixture.controller.dispose();
    (resolvePreferences as unknown as (value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void)({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    });
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

  it("makes stale owner cleanup harmless after another account becomes current", async () => {
    const ownerA = "00000000-0000-4000-8000-000000000001";
    const ownerB = "00000000-0000-4000-8000-000000000002";
    let currentOwner = ownerA;
    let time = 10;
    const local: WatchProgressEvent[] = [];
    const enqueued: WatchProgressEvent[] = [];
    const capture = async (
      event: WatchProgressEvent,
      expectedOwnerUserId?: string,
      _meaningfulSolo?: boolean,
      _displayMode?: "mine" | "together" | null,
      _queueForSync?: boolean,
      flushNow?: boolean,
    ): Promise<WatchHistoryCaptureResult> => {
      if (expectedOwnerUserId !== undefined && expectedOwnerUserId !== currentOwner) {
        return { ok: false, status: "rejected" };
      }
      local.push(event);
      if (flushNow) enqueued.push(event);
      return { ok: true };
    };
    const controller = createWatchHistoryController({
      getObservation: () => ({
        provider: "crunchyroll",
        providerLabel: "Crunchyroll",
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
      }),
      getRoomActive: () => false,
      loadPreferences: async () => ({
        ownerUserId: ownerA,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
      }),
      observeLocally: capture,
      isPlaying: () => true,
      isSeeking: () => false,
      now: () => 1_700_000_000_000,
      createEventId: () => "11111111-1111-4111-8111-111111111111",
      createSessionKey: () => "22222222-2222-4222-8222-222222222222",
    });

    await controller.start();
    time = 11;
    await controller.observe("heartbeat");
    const localBeforeSwitch = local.length;
    const enqueuedBeforeSwitch = enqueued.length;
    currentOwner = ownerB;
    await controller.dispose();

    expect(local).toHaveLength(localBeforeSwitch);
    expect(enqueued).toHaveLength(enqueuedBeforeSwitch);
  });

  it("refreshes unchanged authority in place without rotating the logical session or gate", async () => {
    const fixture = createFixture({
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    const refreshAuthority = (fixture.controller as WatchHistoryController & {
      refreshAuthority?: () => Promise<void>;
    }).refreshAuthority;
    expect(refreshAuthority).toBeTypeOf("function");
    if (!refreshAuthority) return;

    await refreshAuthority.call(fixture.controller);
    fixture.setTime(12);
    await fixture.controller.observe("pause");

    expect(fixture.enqueued.map((event) => [event.kind, event.clientSessionKey])).toEqual([
      ["heartbeat", "11111111-1111-4111-8111-111111111111"],
      ["pause", "11111111-1111-4111-8111-111111111111"],
    ]);
    expect(fixture.enqueued.some((event) => event.kind === "source_change")).toBe(false);
  });

  it("fails closed during an external YouTube opt-out refresh without a stale upload", async () => {
    let loadCount = 0;
    let resolveRefresh: ((value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void) | null = null;
    const fixture = createFixture({
      loadPreferences: async () => {
        loadCount += 1;
        if (loadCount === 1) {
          return {
            ownerUserId: "00000000-0000-4000-8000-000000000001",
            accountGeneration: 1,
            preferences: { youtubeHistoryEnabled: true },
          };
        }
        return new Promise((resolve) => { resolveRefresh = resolve; });
      },
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          episodeKey: "youtube:abcdefghijk",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    const refreshAuthority = (fixture.controller as WatchHistoryController & {
      refreshAuthority?: () => Promise<void>;
    }).refreshAuthority;
    expect(refreshAuthority).toBeTypeOf("function");
    if (!refreshAuthority) return;

    const refreshing = refreshAuthority.call(fixture.controller);
    await Promise.resolve();
    fixture.setTime(12);
    const observing = fixture.controller.observe("heartbeat");
    await Promise.resolve();
    expect(fixture.local).toHaveLength(2);
    expect(fixture.enqueued).toHaveLength(1);

    (resolveRefresh as unknown as (value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void)({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    });
    await Promise.all([refreshing, observing]);

    expect(fixture.local).toHaveLength(2);
    expect(fixture.enqueued.map((event) => event.kind)).toEqual(["heartbeat"]);
    expect(fixture.current.at(-1)).toBeNull();
  });

  it("applies a local YouTube opt-in directly and starts capture without a server refresh", async () => {
    const fixture = createFixture({
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    await fixture.controller.start();
    expect(fixture.local).toHaveLength(0);

    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });

    expect(fixture.local).toHaveLength(1);
    expect(fixture.local[0]).toMatchObject({
      kind: "heartbeat",
      provider: "youtube",
      currentTime: 10,
    });
    expect(fixture.enqueued).toHaveLength(0);

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued).toHaveLength(1);
    expect(fixture.enqueued[0]).toMatchObject({ provider: "youtube", currentTime: 11 });
  });

  it("does not let an in-flight authority refresh delay or overwrite a local YouTube choice", async () => {
    let loadCount = 0;
    let resolveRefresh!: (value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void;
    const fixture = createFixture({
      loadPreferences: async () => {
        loadCount += 1;
        if (loadCount === 1) {
          return {
            ownerUserId: "00000000-0000-4000-8000-000000000001",
            accountGeneration: 1,
            preferences: { youtubeHistoryEnabled: true },
          };
        }
        return new Promise((resolve) => { resolveRefresh = resolve; });
      },
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    await fixture.controller.start();
    const refreshing = fixture.controller.refreshAuthority();
    await Promise.resolve();

    let localChoiceApplied = false;
    const applying = fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    }).then(() => { localChoiceApplied = true; });
    await vi.waitFor(() => expect(localChoiceApplied).toBe(true));
    resolveRefresh({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    });
    await Promise.all([refreshing, applying]);

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.at(-1)).toMatchObject({ provider: "youtube", currentTime: 11 });
  });

  it("uses a complete local authority when the initial preference load is still pending", async () => {
    let resolveInitial!: (value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
    }) => void;
    const fixture = createFixture({
      loadPreferences: () => new Promise((resolve) => { resolveInitial = resolve; }),
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    const starting = fixture.controller.start();
    await Promise.resolve();

    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });
    expect(fixture.local).toHaveLength(1);

    resolveInitial({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    });
    await starting;
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.at(-1)).toMatchObject({ provider: "youtube", currentTime: 11 });
  });

  it("does not let a stale cached startup overwrite a local YouTube choice", async () => {
    let resolveCached!: (value: {
      ownerUserId: string;
      accountGeneration: number;
      preferences: { youtubeHistoryEnabled: boolean };
      capturePaused: boolean;
    }) => void;
    const fixture = createFixture({
      loadCachedPreferences: () => new Promise((resolve) => { resolveCached = resolve; }),
      loadPreferences: async () => {
        throw new Error("stale cached startup must not continue to canonical loading");
      },
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    const starting = fixture.controller.start();
    await Promise.resolve();

    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });
    expect(fixture.local).toHaveLength(1);

    resolveCached({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: false,
    });
    await starting;
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.at(-1)).toMatchObject({ provider: "youtube", currentTime: 11 });
  });

  it("ignores a stale rejected capture when local YouTube authority changes", async () => {
    let rejectHeldCapture = false;
    const fixture = createFixture({
      holdLocalAt: 2,
      loadPreferences: async () => ({
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
      }),
      observeResult: () => rejectHeldCapture
        ? { ok: false, status: "rejected" }
        : { ok: true },
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    await fixture.controller.start();
    fixture.setTime(11);
    const observing = fixture.controller.observe("heartbeat");
    await fixture.waitForLocalAttempts(2);
    rejectHeldCapture = true;
    const disabling = fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: false,
    });
    fixture.releaseHeldLocal();
    await Promise.all([observing, disabling]);
    expect(fixture.current.at(-1)).toBeNull();

    rejectHeldCapture = false;
    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.at(-1)).toMatchObject({ provider: "youtube", currentTime: 12 });
  });

  it("stops active YouTube observation without capturing after the local choice is turned off", async () => {
    const fixture = createFixture({
      loadPreferences: async () => ({
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
      }),
      getObservation: (preferences, observation) => preferences?.youtubeHistoryEnabled
        ? {
          ...observation,
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        }
        : null,
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");

    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
      capturePaused: false,
    });

    expect(fixture.local.map((event) => event.kind)).toEqual(["heartbeat", "heartbeat"]);
    expect(fixture.current.at(-1)).toBeNull();
  });

  it("does not reset an active Crunchyroll session when the YouTube choice changes", async () => {
    const fixture = createFixture({
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();

    await fixture.controller.applyLocalPreferences({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: true },
      capturePaused: false,
    });
    expect(fixture.local).toHaveLength(1);

    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued).toHaveLength(1);
    expect(fixture.enqueued[0]).toMatchObject({
      provider: "crunchyroll",
      clientSessionKey: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("keeps confirmed Crunchyroll capture active when a focus refresh is temporarily unavailable", async () => {
    let loadCount = 0;
    const fixture = createFixture({
      loadPreferences: async () => {
        loadCount += 1;
        return loadCount === 1
          ? {
            ownerUserId: "00000000-0000-4000-8000-000000000001",
            accountGeneration: 1,
            preferences: { youtubeHistoryEnabled: false },
          }
          : null;
      },
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    const refreshAuthority = (fixture.controller as WatchHistoryController & {
      refreshAuthority?: () => Promise<void>;
    }).refreshAuthority;
    expect(refreshAuthority).toBeTypeOf("function");
    if (!refreshAuthority) return;

    await refreshAuthority.call(fixture.controller);
    fixture.setTime(12);
    await fixture.controller.observe("pause");

    expect(fixture.local.map((event) => event.kind)).toEqual([
      "heartbeat",
      "heartbeat",
      "pause",
    ]);
    expect(fixture.enqueued.map((event) => event.kind)).toEqual(["heartbeat", "pause"]);
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

  it("samples the actual player position again before source cleanup", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(15);

    await fixture.controller.dispose();

    expect(fixture.enqueued.at(-1)).toMatchObject({
      kind: "source_change",
      currentTime: 15,
    });
  });

  it("observes but never publishes shared playback, then requires a fresh solo gate after leave", async () => {
    const fixture = createFixture({
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    fixture.advance(1_000);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(true);
    await fixture.controller.setRoomActive(true);
    fixture.setTime(13);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(false);
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(15);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [event.kind, event.currentTime, event.clientSessionKey])).toEqual([
      ["heartbeat", 11, "11111111-1111-4111-8111-111111111111"],
      ["source_change", 12, "11111111-1111-4111-8111-111111111111"],
      ["heartbeat", 15, "33333333-3333-4333-8333-333333333333"],
    ]);
    expect(fixture.local.some((event) => event.currentTime === 13)).toBe(true);
  });

  it("publishes nothing on room entry before meaningful playback", async () => {
    const fixture = createFixture();
    await fixture.controller.start();
    await fixture.controller.setRoomActive(true);
    await fixture.controller.setRoomActive(true);

    expect(fixture.enqueued).toEqual([]);
  });

  it("retains a storage-full pause until event-driven recovery and does not repeat capture writes", async () => {
    let paused = true;
    const fixture = createFixture({
      loadPreferences: async () => ({
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
        capturePaused: true,
      }),
      observeResult: () => paused
        ? { ok: false as const, status: "storage-full" as const }
        : { ok: true as const },
      recoverCapture: async () => {
        paused = false;
        return {
          ownerUserId: "00000000-0000-4000-8000-000000000001",
          accountGeneration: 1,
          preferences: { youtubeHistoryEnabled: false },
          capturePaused: false,
        };
      },
    });
    await fixture.controller.start();
    await fixture.controller.observe("heartbeat");
    expect(fixture.localAttempts).toBe(0);

    await fixture.controller.recover();
    await fixture.controller.observe("heartbeat");
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");

    expect(fixture.localAttempts).toBe(2);
    expect(fixture.enqueued).toHaveLength(1);
  });

  it("suppresses solo publication when the final room-entry enqueue fails and requires a fresh session gate after leave", async () => {
    const fixture = createFixture({
      sessionKeys: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
      rejectEnqueueKinds: new Set(["source_change"]),
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
      [11, "11111111-1111-4111-8111-111111111111"],
      [14, "33333333-3333-4333-8333-333333333333"],
    ]);
    expect(fixture.enqueueFailures).toBe(1);
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

  it("serializes room exit behind an in-flight shared ended observation before opening a fresh solo gate", async () => {
    const fixture = createFixture({
      holdLocalAt: 5,
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(true);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    fixture.setTime(13);
    const sharedEnded = fixture.controller.observe("ended");
    await fixture.waitForLocalAttempts(5);
    const leaving = fixture.controller.setRoomActive(false);
    let leaveResolved = false;
    void leaving.then(() => { leaveResolved = true; });
    fixture.setTime(14);
    const firstSolo = fixture.controller.observe("heartbeat");
    await Promise.resolve();
    expect(leaveResolved).toBe(false);

    fixture.releaseHeldLocal();
    await Promise.all([sharedEnded, leaving, firstSolo]);
    expect(leaveResolved).toBe(true);
    fixture.setTime(15);
    await fixture.controller.observe("heartbeat");

    expect(fixture.enqueued.map((event) => [event.kind, event.currentTime])).toEqual([
      ["heartbeat", 11],
      ["source_change", 11],
      ["heartbeat", 15],
    ]);
  });

  it("keeps rapid room re-entry active while a queued exit waits for shared persistence", async () => {
    const fixture = createFixture({
      holdLocalAt: 5,
      sessionKeys: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });
    await fixture.controller.start();
    fixture.setTime(11);
    await fixture.controller.observe("heartbeat");
    await fixture.controller.setRoomActive(true);
    fixture.setTime(12);
    await fixture.controller.observe("heartbeat");

    fixture.setTime(13);
    const sharedEnded = fixture.controller.observe("ended");
    await fixture.waitForLocalAttempts(5);
    const leaving = fixture.controller.setRoomActive(false);
    const reentering = fixture.controller.setRoomActive(true);

    fixture.releaseHeldLocal();
    await Promise.all([sharedEnded, leaving, reentering]);
    fixture.setTime(14);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(15);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.map((event) => [event.kind, event.currentTime])).toEqual([
      ["heartbeat", 11],
      ["source_change", 11],
    ]);

    await fixture.controller.setRoomActive(false);
    expect(fixture.local.filter((event) => event.kind === "room_leave")).toEqual([
      expect.objectContaining({
        currentTime: 15,
        clientSessionKey: "22222222-2222-4222-8222-222222222222",
      }),
    ]);
    fixture.setTime(16);
    await fixture.controller.observe("heartbeat");
    fixture.setTime(17);
    await fixture.controller.observe("heartbeat");
    expect(fixture.enqueued.map((event) => [event.kind, event.currentTime, event.clientSessionKey])).toEqual([
      ["heartbeat", 11, "11111111-1111-4111-8111-111111111111"],
      ["source_change", 11, "11111111-1111-4111-8111-111111111111"],
      ["heartbeat", 17, "33333333-3333-4333-8333-333333333333"],
    ]);
  });
});

function roomAuthority(sourceGeneration = 1, attestation = `proof-${sourceGeneration}`) {
  return {
    roomId: "room-1",
    participantSessionId: "participant-session-1",
    roomGeneration: 1,
    sourceGeneration,
    attestation,
  };
}

function createFixture(options: {
  onPersisted?: WatchHistoryControllerDependencies["onPersisted"];
  roomActive?: boolean;
  sessionKeys?: string[];
  loadCachedPreferences?: WatchHistoryControllerDependencies["loadCachedPreferences"];
  loadPreferences?: WatchHistoryControllerDependencies["loadPreferences"];
  recoverCapture?: WatchHistoryControllerDependencies["recoverCapture"];
  observeResult?: () => WatchHistoryCaptureResult;
  rejectLocalKinds?: Set<WatchProgressEvent["kind"]>;
  rejectEnqueueKinds?: Set<WatchProgressEvent["kind"]>;
  holdEnqueueAt?: number;
  holdLocalAt?: number;
  getObservation?: (
    preferences: Parameters<WatchHistoryControllerDependencies["getObservation"]>[0],
    observation: HistoryObservation,
  ) => HistoryObservation | null;
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
  const localMeaningfulSolo: boolean[] = [];
  const localDisplayModes: Array<"mine" | "together" | null> = [];
  const localSyncDecisions: Array<[queueForSync: boolean, flushNow: boolean]> = [];
  const enqueued: WatchProgressEvent[] = [];
  const current: Array<HistoryObservation | null> = [];
  const roomAuthorityStates: Array<"solo" | "waiting" | "ready"> = [];
  let enqueueConcurrency = 0;
  let maxEnqueueConcurrency = 0;
  let enqueueCount = 0;
  let localFailures = 0;
  let enqueueFailures = 0;
  let localAttempts = 0;
  let releaseHeldEnqueue: (() => void) | null = null;
  let releaseHeldLocal: (() => void) | null = null;
  const publish = async (event: WatchProgressEvent) => {
    enqueueCount += 1;
    enqueueConcurrency += 1;
    maxEnqueueConcurrency = Math.max(maxEnqueueConcurrency, enqueueConcurrency);
    enqueued.push(event);
    if (options.rejectEnqueueKinds?.has(event.kind)) {
      enqueueFailures += 1;
      enqueueConcurrency -= 1;
      throw new Error("offline");
    }
    if (enqueueCount === options.holdEnqueueAt) {
      await new Promise<void>((resolve) => { releaseHeldEnqueue = resolve; });
    } else {
      await Promise.resolve();
    }
    enqueueConcurrency -= 1;
  };
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
    onPersisted: options.onPersisted,
    getObservation: options.getObservation
      ? (preferences) => options.getObservation?.(preferences, observation()) ?? null
      : observation,
    getRoomActive: () => roomActive,
    loadCachedPreferences: options.loadCachedPreferences,
    loadPreferences: options.loadPreferences ?? (async () => ({
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      accountGeneration: 1,
      preferences: { youtubeHistoryEnabled: false },
    })),
    recoverCapture: options.recoverCapture,
    observeLocally: async (
      entry,
      _expectedOwnerUserId,
      meaningfulSolo,
      displayMode,
      queueForSync = false,
      flushNow = false,
    ) => {
      localAttempts += 1;
      if (options.rejectLocalKinds?.has(entry.kind)) {
        localFailures += 1;
        throw new Error("storage-full");
      }
      local.push(entry);
      localMeaningfulSolo.push(meaningfulSolo);
      localDisplayModes.push(displayMode);
      localSyncDecisions.push([queueForSync, flushNow]);
      if (localAttempts === options.holdLocalAt) {
        await new Promise<void>((resolve) => { releaseHeldLocal = resolve; });
      }
      const result = options.observeResult?.() ?? { ok: true as const };
      if (!result.ok) return result;
      if (flushNow) await publish(entry);
      return result;
    },
    onObservation: (entry) => { current.push(entry); },
    onRoomHistoryAuthorityState: (state) => { roomAuthorityStates.push(state); },
    now: () => now,
    createEventId: () => "11111111-1111-4111-8111-111111111111",
    createSessionKey: () => sessionKeys.shift() ?? "33333333-3333-4333-8333-333333333333",
    isPlaying: () => true,
    isSeeking: () => false,
  };
  return {
    controller: createWatchHistoryController(dependencies),
    local,
    localMeaningfulSolo,
    localDisplayModes,
    localSyncDecisions,
    enqueued,
    current,
    roomAuthorityStates,
    get maxEnqueueConcurrency() { return maxEnqueueConcurrency; },
    get localFailures() { return localFailures; },
    get enqueueFailures() { return enqueueFailures; },
    get localAttempts() { return localAttempts; },
    setTime(value: number) { time = value; },
    setSource(next: Partial<typeof source>) { source = { ...source, ...next }; },
    setRoomActive(value: boolean) { roomActive = value; },
    advance(value: number) { now += value; },
    releaseHeldEnqueue() { releaseHeldEnqueue?.(); },
    releaseHeldLocal() { releaseHeldLocal?.(); },
    async waitForEnqueues(count: number) {
      for (let attempt = 0; attempt < 20 && enqueued.length < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(enqueued).toHaveLength(count);
    },
    async waitForLocalAttempts(count: number) {
      for (let attempt = 0; attempt < 20 && localAttempts < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(localAttempts).toBe(count);
    },
  };
}
