"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// Only transient view controls live here. History, profiles and notifications
// continue to come from their authenticated APIs, never browser storage.
const AccountViewContext = createContext<Map<string, unknown> | null>(null);

export function AccountWorkspaceProvider({ children }: { children?: ReactNode }) {
  const views = useRef(new Map<string, unknown>());
  return <AccountViewContext.Provider value={views.current}>{children}</AccountViewContext.Provider>;
}

export function useAccountViewState<T>(key: string, initial: T) {
  const views = useContext(AccountViewContext);
  const [value, setValue] = useState<T>(() => views?.has(key) ? views.get(key) as T : initial);
  useEffect(() => { views?.set(key, value); }, [views, key, value]);
  return [value, setValue] as const;
}

export function useAccountScrollRestoration(key: string) {
  const views = useContext(AccountViewContext);
  useEffect(() => {
    if (!views) return;
    const position = views.get(key);
    const frame = window.requestAnimationFrame(() => {
      if (typeof position === "number") window.scrollTo({ top: position, behavior: "instant" });
    });
    const remember = () => views.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", remember); };
  }, [views, key]);
}

export function requestAccountNavigation(action: () => Promise<void>) {
  const intent = new CustomEvent("anidachi:before-account-navigation", {
    cancelable: true, detail: action,
  });
  if (window.dispatchEvent(intent)) void action();
}
