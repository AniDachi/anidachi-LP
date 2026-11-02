import { useEffect, useState } from "react";
import type { ClientEvent } from "@anidachi/protocol";
import type { RoomHostingTime } from "./room-hosting-time";

/** Renders local ticks; only a lifecycle transition or one expiry recovery sends
 * a request. Unknown readings never fire an end-room/admission action. */
export function useRoomHostingTime(clock: RoomHostingTime, ready: boolean, send: (event: ClientEvent) => unknown) {
  const [, render] = useState(0);
  useEffect(() => {
    if (!ready) { clock.invalidate(); return; }
    let expiryRecheckUsed = false;
    let lastResume = Number.NEGATIVE_INFINITY;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    const recover = () => {
      if (document.visibilityState === "hidden" || recoveryTimer !== null) return;
      const command = clock.requestRecovery();
      if (command) send(command);
      else if (clock.observed) recoveryTimer = setTimeout(() => { recoveryTimer = null; recover(); }, 5_000);
    };
    const resume = () => {
      const now = performance.now();
      if (document.visibilityState !== "hidden" && now - lastResume < 1_000) return;
      clock.checkContinuity();
      clock.suspend({ preserveDisplay: true }); render(n => n + 1);
      if (document.visibilityState === "hidden") lastResume = Number.NEGATIVE_INFINITY;
      if (document.visibilityState !== "hidden") {
        lastResume = now;
        // This recovery also covers expiry of the retained display while its
        // reply is pending. Do not issue another request for that same gap.
        expiryRecheckUsed = clock.observed;
        recover();
      }
    };
    const interval = setInterval(() => {
      clock.checkContinuity();
      // A new continuity loss cancels the previous request and needs its own
      // recovery, even if that earlier request consumed the expiry budget.
      const needsRecovery = clock.recoveryNeeded || (!expiryRecheckUsed && clock.needsExpiryRecovery());
      if (document.visibilityState === "hidden") clock.suspend({ preserveDisplay: true });
      if (needsRecovery && document.visibilityState !== "hidden") { expiryRecheckUsed = true; recover(); }
      render(n => n + 1);
    }, 1_000);
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(interval); if (recoveryTimer !== null) clearTimeout(recoveryTimer);
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [clock, ready, send]);
  clock.checkContinuity();
  return ready ? clock.read() : null;
}
