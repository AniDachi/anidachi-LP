import { useCallback, useLayoutEffect, useRef, useState } from "react";

type Presentation = { key: string; phase: "entering" | "open" | "closing"; revealCapsule?: boolean } | null;

/** Motion only: eligibility and the countdown belong to the caller. Invalid
 * authority disappears immediately; only an explicit dismissal animates out. */
export function useCapsuleNoticePresentation(options: { noticeKey: string | null; bubbleVisible: boolean; onDismiss(): void }) {
  const { noticeKey } = options;
  const latest = useRef(options); latest.current = options;
  const current = useRef<Presentation>(null);
  const [state, setState] = useState<Presentation>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; }, []);
  const show = useCallback((next: Presentation) => { current.current = next; setState(next); }, []);

  useLayoutEffect(() => {
    clear();
    const previous = current.current;
    if (!noticeKey) { show(null); return; }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Terminal copy replaces a visible warning in the same strip.
    if (reduced || (previous && previous.phase !== "entering")) {
      show({ key: noticeKey, phase: "open" });
    } else {
      show({ key: noticeKey, phase: "entering", revealCapsule: !latest.current.bubbleVisible });
      // Leave a painted closed frame even for an already-visible capsule.
      timer.current = setTimeout(() => {
        timer.current = null;
        if (latest.current.noticeKey === noticeKey) show({ key: noticeKey, phase: "open" });
      }, latest.current.bubbleVisible ? 32 : 360);
    }
    return clear;
  }, [noticeKey, clear, show]);

  const dismiss = useCallback(() => {
    const { noticeKey: key, onDismiss } = latest.current;
    if (!key || current.current?.phase === "closing") return;
    clear(); show({ key, phase: "closing" });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onDismiss(); return; }
    timer.current = setTimeout(() => {
      timer.current = null;
      if (latest.current.noticeKey === key) onDismiss();
    }, 330);
  }, [clear, show]);

  return { present: noticeKey !== null, open: state?.key === noticeKey && state?.phase === "open",
    revealCapsule: state?.key === noticeKey && state?.phase === "entering" && state.revealCapsule, dismiss };
}
