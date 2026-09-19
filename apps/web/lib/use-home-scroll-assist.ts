"use client";

import { useEffect, type RefObject } from "react";
import { getHomeScrollNudge } from "./home-scroll-assist";

const ASSIST_MEDIA = "(min-width: 640px) and (min-height: 600px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function useHomeScrollAssist(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = window.matchMedia(ASSIST_MEDIA);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let direction: 1 | -1 | 0 = 0;
    let previousY = window.scrollY;
    let inputAt = 0;

    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      frame = 0;
      direction = 0;
    };

    const assist = () => {
      const travel = direction;
      direction = 0;
      const page = document.documentElement;
      if (!travel || !media.matches || document.hidden ||
          getComputedStyle(page).overflowY === "hidden" ||
          getComputedStyle(document.body).overflowY === "hidden") return;
      const sections = Array.from(root.children)
        .filter(el => el.tagName === "SECTION" && el.getAttribute("aria-label") !== "Trust and credibility")
        .map(el => el.getBoundingClientRect());
      const delta = getHomeScrollNudge(sections, window.innerHeight,
        Number.parseFloat(getComputedStyle(page).scrollPaddingTop) || 0, travel);
      if (delta === null) return;
      const start = window.scrollY;
      const target = Math.max(0, Math.min(start + delta, page.scrollHeight - window.innerHeight));
      const started = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - started) / 320);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo({ top: start + (target - start) * eased, behavior: "instant" });
        if (progress < 1) frame = requestAnimationFrame(animate);
        else frame = 0;
      };
      frame = requestAnimationFrame(animate);
    };

    const onWheel = (event: WheelEvent) => {
      cancel();
      if (!media.matches || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      // Leave nested lists, text fields, and the demo's own scrollable panels alone.
      const nested = event.composedPath().some(node => {
        if (!(node instanceof HTMLElement) || node === document.body || node === document.documentElement) return false;
        if (node.matches("input, textarea, select, [contenteditable='true'], [role='dialog']")) return true;
        return /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1;
      });
      if (nested) return;
      direction = event.deltaY > 0 ? 1 : -1;
      inputAt = performance.now();
    };

    const onScroll = () => {
      const delta = window.scrollY - previousY;
      previousY = window.scrollY;
      if (!direction || !delta) return;
      if (Math.sign(delta) !== direction || performance.now() - inputAt > 1500) {
        cancel();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(assist, 180);
    };

    // Never consume wheel input. Only assist after the native scroll has settled.
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    const interruptions = ["pointerdown", "touchstart", "keydown", "resize", "hashchange", "blur"] as const;
    interruptions.forEach(name => window.addEventListener(name, cancel, { passive: true }));
    media.addEventListener("change", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      interruptions.forEach(name => window.removeEventListener(name, cancel));
      media.removeEventListener("change", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [ref]);
}
