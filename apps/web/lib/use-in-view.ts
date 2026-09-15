"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Tracks whether `ref` intersects the viewport. Used to pause decorative loops
 * when a showcase is scrolled off-screen.
 */
export function useInView<T extends Element = HTMLElement>(): [
  RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry?.isIntersecting ?? false);
      },
      {
        root: null,
        rootMargin: "48px 0px",
        threshold: 0.2,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
