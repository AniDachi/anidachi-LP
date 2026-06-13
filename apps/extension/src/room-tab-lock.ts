/**
 * Single-active-tab guard via the Web Locks API (Block 4.3).
 *
 * The first tab in a browser profile that enters a room acquires an exclusive
 * lock and holds it for the whole room session. A second tab cannot acquire it
 * and is told the room is open elsewhere instead of fighting over the socket
 * (owner decision 2026-06-13: one active tab). Cross-device takeover is handled
 * server-side via `participantSessionId` (Block 4.1); this only covers tabs in
 * the same browser, where Web Locks apply.
 *
 * Degrades gracefully: if Web Locks are unavailable or error, the guard allows
 * the connection rather than blocking the user.
 */

const ROOM_TAB_LOCK_NAME = "anidachi-room-session";

interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable?: boolean; mode?: "exclusive" | "shared" },
    callback: (lock: unknown) => Promise<void> | void,
  ): Promise<void>;
}

let releaseHeldLock: (() => void) | null = null;

function getLockManager(): LockManagerLike | null {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManagerLike }) : null;
  return nav?.locks && typeof nav.locks.request === "function" ? nav.locks : null;
}

export function isRoomTabLockSupported(): boolean {
  return getLockManager() !== null;
}

/**
 * Tries to become the active tab. Resolves true when this tab owns the room
 * lock (or when the guard cannot apply and we degrade to allowing), false when
 * another tab in this browser already owns it.
 */
export function acquireRoomTabLock(): Promise<boolean> {
  // Already held by this tab (e.g. a reconnect) — allow without re-locking.
  if (releaseHeldLock) return Promise.resolve(true);

  const locks = getLockManager();
  if (!locks) return Promise.resolve(true);

  return new Promise<boolean>((resolveAcquired) => {
    locks
      .request(ROOM_TAB_LOCK_NAME, { ifAvailable: true, mode: "exclusive" }, (lock) => {
        if (!lock) {
          // Another tab holds the lock.
          resolveAcquired(false);
          return;
        }

        // Granted: hold the lock until releaseRoomTabLock() is called.
        resolveAcquired(true);
        return new Promise<void>((resolveHeld) => {
          releaseHeldLock = () => {
            releaseHeldLock = null;
            resolveHeld();
          };
        });
      })
      .catch(() => {
        // Lock manager error — degrade to allowing the connection.
        resolveAcquired(true);
      });
  });
}

/** Releases the held room lock so another tab can take over. Safe to call twice. */
export function releaseRoomTabLock(): void {
  releaseHeldLock?.();
}
