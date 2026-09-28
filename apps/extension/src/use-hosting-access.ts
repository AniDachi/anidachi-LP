import { useCallback, useEffect, useRef, useState } from "react";
import { requestHostingAccess, type HostingAccountAccess } from "./hosting-access-client";

export type HostingPolicyMode = "unknown" | "legacy" | "paid-hosting";
export type HostingDisplayState = {
  mode: HostingPolicyMode;
  access?: HostingAccountAccess;
  error: boolean;
  busy: boolean;
};
const UNKNOWN: HostingDisplayState = { mode: "unknown", error: false, busy: false };

/** One display read for quota and the offer. Never grants room creation. */
export function useHostingAccess({ ownerUserId, sessionKey, enabled, request = requestHostingAccess }: {
  ownerUserId: string | null;
  sessionKey: string | null;
  enabled: boolean;
  request?: typeof requestHostingAccess;
}) {
  const [result, setResult] = useState<{ ownerUserId: string; sessionKey: string; state: HostingDisplayState } | null>(null);
  const refreshRef = useRef<(supersede: boolean) => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(false), []);
  const invalidate = useCallback(() => refreshRef.current(true), []);
  useEffect(() => {
    if (!enabled || !ownerUserId || !sessionKey) return;
    let alive = true;
    let pending = false;
    let generation = 0;
    const show = (state: HostingDisplayState) => setResult({ ownerUserId, sessionKey, state });
    async function load(supersede = false) {
      if (!alive || (pending && !supersede)) return;
      const ownGeneration = ++generation;
      pending = true;
      show({ ...UNKNOWN, busy: true });
      try {
        const access = await request(ownerUserId!);
        if (!alive || ownGeneration !== generation) return;
        if (access.ownerUserId !== ownerUserId) throw new Error("Hosting access owner changed");
        const hosting = access.hosting;
        const mode: HostingPolicyMode = !hosting ? "unknown" :
          hosting.hostingActivationAt !== null && Date.parse(hosting.hostingActivationAt) <= Date.parse(access.serverTime) ? "paid-hosting" : "legacy";
        show({ mode, access, error: false, busy: false });
      } catch {
        if (alive && ownGeneration === generation) show({ ...UNKNOWN, error: true });
      } finally {
        if (ownGeneration === generation) pending = false;
      }
    }
    refreshRef.current = supersede => { void load(supersede); };
    const resume = () => { if (document.visibilityState !== "hidden") void load(); };
    void load();
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false;
      setResult(null);
      refreshRef.current = () => {};
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [ownerUserId, sessionKey, enabled, request]);
  const state = enabled && result?.ownerUserId === ownerUserId && result?.sessionKey === sessionKey ? result.state : UNKNOWN;
  return { state, refresh, invalidate };
}
