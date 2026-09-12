import { type ReactNode, type RefObject, useCallback, useLayoutEffect, useState } from "react";
import type { PopupTab } from "./popup-app";
import { readPopupView, writePopupNavigation } from "./popup-view-state";

export function PopupRetainedPanel({ active, tab, children }: { active: boolean; tab: PopupTab; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <div data-popup-tab={tab} hidden={!active}>{active || visited ? children : null}</div>;
}

export function usePopupNavigation(owner: string | null, shell: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ owner: string | null; tab: PopupTab }>({ owner, tab: owner ? readPopupView(owner).tab : "resources" });
  const tab = state.owner === owner ? state.tab : owner ? readPopupView(owner).tab : "resources";
  if (state.owner !== owner) setState({ owner, tab });
  const select = useCallback((next: PopupTab) => {
    if (next === tab) return;
    if (owner) {
      writePopupNavigation(owner, tab, shell.current?.scrollTop ?? 0);
      writePopupNavigation(owner, next);
    }
    setState({ owner, tab: next });
  }, [owner, tab, shell]);
  useLayoutEffect(() => {
    const element = shell.current;
    if (!element || !owner) return;
    const target = readPopupView(owner).scroll[tab] ?? 0;
    let restoring = true;
    const pane = element.querySelector<HTMLElement>(`[data-popup-tab="${tab}"]`);
    const restore = () => {
      if (!restoring) return;
      element.scrollTop = target;
      if (Math.abs(element.scrollTop - target) < 1) restoring = false;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(restore);
    if (pane) observer?.observe(pane);
    const cancel = () => { restoring = false; };
    const scroll = () => {
      if (!restoring) writePopupNavigation(owner, tab, element.scrollTop);
    };
    restore();
    element.addEventListener("scroll", scroll);
    element.addEventListener("wheel", cancel, { passive: true });
    element.addEventListener("touchstart", cancel, { passive: true });
    element.addEventListener("keydown", cancel);
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", scroll);
      element.removeEventListener("wheel", cancel);
      element.removeEventListener("touchstart", cancel);
      element.removeEventListener("keydown", cancel);
    };
  }, [owner, tab, shell]);
  return [tab, select] as const;
}
