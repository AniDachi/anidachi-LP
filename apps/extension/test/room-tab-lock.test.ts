import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireRoomTabLock,
  isRoomTabLockSupported,
  releaseRoomTabLock,
} from "../src/room-tab-lock";

afterEach(() => {
  releaseRoomTabLock();
  vi.unstubAllGlobals();
});

describe("room tab lock", () => {
  it("degrades to allowing when Web Locks are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    expect(isRoomTabLockSupported()).toBe(false);
    expect(await acquireRoomTabLock()).toBe(true);
  });

  it("grants the lock to the first tab and holds it", async () => {
    let held = false;
    vi.stubGlobal("navigator", {
      locks: {
        request: (_name: string, _opts: unknown, cb: (lock: unknown) => Promise<void> | void) => {
          // Available the first time, then busy while held.
          const lock = held ? null : {};
          if (!held && lock) held = true;
          return Promise.resolve(cb(lock));
        },
      },
    });

    expect(isRoomTabLockSupported()).toBe(true);
    expect(await acquireRoomTabLock()).toBe(true);
    // Same tab re-acquiring (e.g. reconnect) is allowed without re-locking.
    expect(await acquireRoomTabLock()).toBe(true);
  });

  it("rejects a second tab while the lock is held elsewhere", async () => {
    vi.stubGlobal("navigator", {
      locks: {
        request: (_name: string, _opts: unknown, cb: (lock: unknown) => Promise<void> | void) => {
          // Simulate another tab already holding it: ifAvailable yields null.
          return Promise.resolve(cb(null));
        },
      },
    });

    expect(await acquireRoomTabLock()).toBe(false);
  });

  it("allows the connection if the lock manager throws", async () => {
    vi.stubGlobal("navigator", {
      locks: {
        request: () => Promise.reject(new Error("locks unavailable")),
      },
    });

    expect(await acquireRoomTabLock()).toBe(true);
  });
});
