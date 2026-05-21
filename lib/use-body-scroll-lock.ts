import { useEffect } from "react";

const SCROLLABLE_SELECTOR = "[data-scroll-lock-scrollable]";

function isInsideScrollableOverlay(target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  return Boolean(
    (target instanceof Element ? target : target.parentElement)?.closest(
      SCROLLABLE_SELECTOR,
    ),
  );
}

const BLOCKED_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/**
 * Locks background scroll without overflow:hidden (which breaks position:sticky on the nav).
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    const scrollY = window.scrollY;

    const preventWheel = (e: WheelEvent) => {
      if (isInsideScrollableOverlay(e.target)) return;
      e.preventDefault();
    };

    const preventTouch = (e: TouchEvent) => {
      if (isInsideScrollableOverlay(e.target)) return;
      e.preventDefault();
    };

    const preventKeys = (e: KeyboardEvent) => {
      if (!BLOCKED_KEYS.has(e.key)) return;
      if (isInsideScrollableOverlay(document.activeElement)) return;
      e.preventDefault();
    };

    document.addEventListener("wheel", preventWheel, { passive: false });
    document.addEventListener("touchmove", preventTouch, { passive: false });
    document.addEventListener("keydown", preventKeys);

    return () => {
      document.removeEventListener("wheel", preventWheel);
      document.removeEventListener("touchmove", preventTouch);
      document.removeEventListener("keydown", preventKeys);
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [locked]);
}
