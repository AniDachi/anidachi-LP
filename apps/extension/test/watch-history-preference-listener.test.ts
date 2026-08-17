import { describe, expect, it, vi } from "vitest";
import { bindWatchHistoryPreferenceListener } from "../src/watch-history-preference-listener";
import {
  WATCH_HISTORY_STORAGE_KEY,
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
      refreshAuthority: vi.fn(async () => undefined),
      observe: vi.fn(async () => undefined),
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
      expect(controller.refreshAuthority).toHaveBeenCalledTimes(1);
      expect(controller.observe).toHaveBeenCalledWith("heartbeat");
    });
    expect(controller.refreshAuthority.mock.invocationCallOrder[0])
      .toBeLessThan(controller.observe.mock.invocationCallOrder[0]);

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
    expect(controller.refreshAuthority).toHaveBeenCalledTimes(1);
    expect(controller.observe).toHaveBeenCalledTimes(1);

    dispose();
    expect(onChanged.removeListener).toHaveBeenCalledTimes(1);
    expect(removed).toBe(true);
  });

  it("contains detached controller failures", async () => {
    type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;
    let listener: Listener = () => undefined;
    const controller = {
      refreshAuthority: vi.fn(async () => { throw new Error("refresh failed"); }),
      observe: vi.fn(async () => undefined),
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
    await vi.waitFor(() => expect(controller.refreshAuthority).toHaveBeenCalledTimes(1));
    expect(controller.observe).not.toHaveBeenCalled();
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
        outbox: { ownerUserId, accountGeneration: 1, entries: [] },
      },
    },
  };
}
