import { describe, expect, it, vi } from "vitest";
import { createWatchHistoryClient } from "../src/watch-history-client";
import { createWatchHistoryController } from "../src/watch-history-controller";
import { bindWatchHistoryPreferenceListener } from "../src/watch-history-preference-listener";
import {
  WATCH_HISTORY_STORAGE_KEY,
  createWatchHistoryStorage,
  type WatchHistoryStorageRoot,
  watchHistoryPartitionKey,
} from "../src/watch-history-storage";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_OWNER_ID = "00000000-0000-4000-8000-000000000002";

describe("watch history preference listener", () => {
  it("refreshes and observes immediately only when the current owner's explicit choice changes", async () => {
    type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
    let listener: Listener = () => undefined;
    let removed = false;
    const onChanged = {
      addListener: vi.fn((next: Listener) => { listener = next; }),
      removeListener: vi.fn((next: Listener) => {
        if (listener === next) removed = true;
      }),
    };
    const controller = {
      applyLocalPreferences: vi.fn(async () => undefined),
    };
    const dispose = bindWatchHistoryPreferenceListener({
      ownerUserId: OWNER_ID,
      controller,
      onChanged,
    });

    listener({
      [WATCH_HISTORY_STORAGE_KEY]: {
        oldValue: preferenceRoot(OWNER_ID, false, 0),
        newValue: preferenceRoot(OWNER_ID, true, 1),
      },
    }, "local");

    await vi.waitFor(() => {
      expect(controller.applyLocalPreferences).toHaveBeenCalledWith({
        ownerUserId: OWNER_ID,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: true },
        capturePaused: false,
      });
    });

    listener({
      [WATCH_HISTORY_STORAGE_KEY]: {
        oldValue: preferenceRoot(OWNER_ID, true, 1),
        newValue: preferenceRoot(OWNER_ID, true, 1, "new observation"),
      },
    }, "local");
    listener({
      [WATCH_HISTORY_STORAGE_KEY]: {
        oldValue: preferenceRoot(OTHER_OWNER_ID, false, 0),
        newValue: preferenceRoot(OTHER_OWNER_ID, true, 1),
      },
    }, "local");
    listener({
      [WATCH_HISTORY_STORAGE_KEY]: {
        oldValue: preferenceRoot(OWNER_ID, true, 1),
        newValue: preferenceRoot(OWNER_ID, false, 2),
      },
    }, "sync");
    await Promise.resolve();
    expect(controller.applyLocalPreferences).toHaveBeenCalledTimes(1);

    dispose();
    expect(onChanged.removeListener).toHaveBeenCalledTimes(1);
    expect(removed).toBe(true);
  });

  it("contains detached controller failures", async () => {
    type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
    let listener: Listener = () => undefined;
    const controller = {
      applyLocalPreferences: vi.fn(async () => { throw new Error("apply failed"); }),
    };
    bindWatchHistoryPreferenceListener({
      ownerUserId: OWNER_ID,
      controller,
      onChanged: {
        addListener: (next) => { listener = next; },
        removeListener: () => undefined,
      },
    });

    expect(() => listener({
      [WATCH_HISTORY_STORAGE_KEY]: {
        oldValue: preferenceRoot(OWNER_ID, false, 0),
        newValue: preferenceRoot(OWNER_ID, true, 1),
      },
    }, "local")).not.toThrow();
    await vi.waitFor(() => expect(controller.applyLocalPreferences).toHaveBeenCalledTimes(1));
  });

  it("carries a Popup preference write through storage into active YouTube capture", async () => {
    type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
    let listener: Listener = () => undefined;
    let stored = preferenceRoot(OWNER_ID, false, 0);
    const storage = createWatchHistoryStorage({
      item: {
        getValue: async () => stored,
        setValue: async (value) => {
          const previous = stored;
          stored = value;
          listener({ [WATCH_HISTORY_STORAGE_KEY]: { oldValue: previous, newValue: value } }, "local");
        },
      },
      getBytesInUse: async () => 0,
      quotaBytes: 1_000_000,
    });
    let currentTime = 10;
    const localWrites: Array<{ currentTime: number; queueForSync: boolean }> = [];
    const controller = createWatchHistoryController({
      getObservation: (preferences) => preferences?.youtubeHistoryEnabled
        ? {
          provider: "youtube",
          providerLabel: "YouTube",
          titleKey: "youtube:abcdefghijk",
          itemKind: "movie",
          title: "YouTube video",
          artworkUrl: null,
          episodeKey: "youtube:abcdefghijk",
          episodeTitle: "YouTube video",
          seasonKey: null,
          seasonTitle: null,
          seasonNumber: null,
          episodeNumber: null,
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
          currentTime,
          duration: 120,
          progress: currentTime / 120,
        }
        : null,
      getRoomActive: () => false,
      loadPreferences: async () => ({
        ownerUserId: OWNER_ID,
        accountGeneration: 1,
        preferences: { youtubeHistoryEnabled: false },
      }),
      observeLocally: async (event, _owner, _meaningful, _mode, queueForSync) => {
        localWrites.push({ currentTime: event.currentTime, queueForSync });
        return { ok: true };
      },
      isPlaying: () => true,
      isSeeking: () => false,
      createEventId: () => crypto.randomUUID(),
      createSessionKey: () => crypto.randomUUID(),
    });
    await controller.start();
    expect(localWrites).toHaveLength(0);
    bindWatchHistoryPreferenceListener({
      ownerUserId: OWNER_ID,
      controller,
      onChanged: {
        addListener: (next) => { listener = next; },
        removeListener: () => undefined,
      },
    });
    const session = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: OWNER_ID,
        email: "owner@example.com",
        displayName: "Owner",
        avatarUrl: null,
        plan: "plus" as const,
      },
    };
    const client = createWatchHistoryClient({
      getCurrentSession: async () => session,
      getRequestSession: async () => session,
      storage,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        meta: {
          serverTime: "2026-08-17T09:00:00.000Z",
          schemaVersion: 2,
          ownerUserId: OWNER_ID,
          accountGeneration: 1,
        },
        preferences: { youtubeHistoryEnabled: true },
      }))) as typeof fetch,
    });

    await expect(client.handle({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: true },
    })).resolves.toEqual({ ok: true });
    await vi.waitFor(() => expect(localWrites).toEqual([
      { currentTime: 10, queueForSync: false },
    ]));

    currentTime = 11;
    await controller.observe("heartbeat");
    expect(localWrites.at(-1)).toEqual({ currentTime: 11, queueForSync: true });
  });
});

function preferenceRoot(
  ownerUserId: string,
  enabled: boolean,
  localRevision: number,
  observationMarker: string | null = null,
): WatchHistoryStorageRoot {
  const key = watchHistoryPartitionKey(ownerUserId, 1);
  return {
    schemaVersion: 2,
    activeGenerations: { [ownerUserId]: 1 },
    partitions: {
      [key]: {
        ownerUserId,
        accountGeneration: 1,
        cache: null,
        preferences: { youtubeHistoryEnabled: enabled },
        preferencesConfirmed: true,
        preferencesSyncPending: false,
        preferencesLocalRevision: localRevision,
        currentObservation: observationMarker ? ({ marker: observationMarker } as never) : null,
        currentObservationMeaningfulSolo: false,
        currentObservationDisplayMode: null,
        capturePaused: false,
        captureMarkersReady: true,
        outbox: { ownerUserId, accountGeneration: 1, entries: [] },
      },
    },
  };
}
