import type { FocusEventHandler, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export const TOP_BUBBLE_REVEAL_DELAY_MS = 300;
export const TOP_BUBBLE_HIDE_DELAY_MS = 620;

const TOP_EDGE_PROXIMITY_WIDTH_PX = 180;
const TOP_EDGE_PROXIMITY_HEIGHT_PX = 72;
const TOP_EDGE_INTENT_WIDTH_PX = 96;
const TOP_EDGE_INTENT_HEIGHT_PX = 24;
const OVERLAY_RECT_MAX_AGE_MS = 250;

type RevealPhase = "hidden" | "glow" | "visible";

interface UseTopBubbleRevealOptions {
  bubbleRef: RefObject<HTMLButtonElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  panelOpen: boolean;
}

interface TopBubbleRevealState {
  bubbleVisible: boolean;
  edgeGlowVisible: boolean;
  handleBubbleBlur: FocusEventHandler<HTMLButtonElement>;
  handleBubbleFocus: FocusEventHandler<HTMLButtonElement>;
}

export function useTopBubbleReveal({
  bubbleRef,
  overlayRef,
  panelOpen,
}: UseTopBubbleRevealOptions): TopBubbleRevealState {
  const [phase, setPhaseState] = useState<RevealPhase>(panelOpen ? "visible" : "hidden");
  const phaseRef = useRef<RevealPhase>(panelOpen ? "visible" : "hidden");
  const panelOpenRef = useRef(panelOpen);
  const focusedRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRectRef = useRef<DOMRect | null>(null);
  const overlayRectMeasuredAtRef = useRef(0);
  const revealTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const setPhase = useCallback((nextPhase: RevealPhase) => {
    if (phaseRef.current === nextPhase) {
      return;
    }
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const clearRevealTimer = useCallback(() => {
    clearTimer(revealTimerRef);
  }, []);

  const clearHideTimer = useCallback(() => {
    clearTimer(hideTimerRef);
  }, []);

  const hide = useCallback(() => {
    if (panelOpenRef.current || focusedRef.current) {
      return;
    }
    clearRevealTimer();
    setPhase("hidden");
  }, [clearRevealTimer, setPhase]);

  const scheduleHide = useCallback(() => {
    if (panelOpenRef.current || focusedRef.current || hideTimerRef.current !== null) {
      return;
    }
    clearRevealTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, TOP_BUBBLE_HIDE_DELAY_MS);
  }, [clearRevealTimer, hide]);

  const revealImmediately = useCallback(() => {
    clearRevealTimer();
    clearHideTimer();
    setPhase("visible");
  }, [clearHideTimer, clearRevealTimer, setPhase]);

  const scheduleReveal = useCallback(() => {
    clearHideTimer();
    if (phaseRef.current === "visible") {
      return;
    }

    setPhase("glow");
    if (revealTimerRef.current !== null) {
      return;
    }

    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      revealImmediately();
    }, TOP_BUBBLE_REVEAL_DELAY_MS);
  }, [clearHideTimer, revealImmediately, setPhase]);

  const updateOverlayRect = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      overlayRectRef.current = null;
      return null;
    }

    const nextRect = overlay.getBoundingClientRect();
    overlayRectRef.current = nextRect;
    overlayRectMeasuredAtRef.current = Date.now();
    return nextRect;
  }, [overlayRef]);

  const invalidateOverlayRect = useCallback(() => {
    overlayRectRef.current = null;
    overlayRectMeasuredAtRef.current = 0;
  }, []);

  const evaluatePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (panelOpenRef.current || focusedRef.current) {
        return;
      }

      const overlayRectIsStale =
        overlayRectRef.current === null ||
        Date.now() - overlayRectMeasuredAtRef.current >= OVERLAY_RECT_MAX_AGE_MS;
      const overlayRect = overlayRectIsStale ? updateOverlayRect() : overlayRectRef.current;
      if (!overlayRect) {
        return;
      }

      const insideEdgeIntent =
        clientX >= overlayRect.right - TOP_EDGE_INTENT_WIDTH_PX &&
        clientX <= overlayRect.right &&
        clientY >= overlayRect.top &&
        clientY <= overlayRect.top + TOP_EDGE_INTENT_HEIGHT_PX;
      const insideEdgeProximity =
        clientX >= overlayRect.right - TOP_EDGE_PROXIMITY_WIDTH_PX &&
        clientX <= overlayRect.right &&
        clientY >= overlayRect.top &&
        clientY <= overlayRect.top + TOP_EDGE_PROXIMITY_HEIGHT_PX;
      const bubbleRect =
        phaseRef.current === "visible"
          ? bubbleRef.current?.getBoundingClientRect()
          : undefined;
      const insideBubble = bubbleRect ? pointInsideRect(clientX, clientY, bubbleRect) : false;

      if (phaseRef.current === "visible") {
        if (insideEdgeIntent || insideBubble) {
          clearHideTimer();
        } else {
          scheduleHide();
        }
        return;
      }

      if (insideEdgeIntent) {
        scheduleReveal();
      } else {
        clearRevealTimer();
        setPhase(insideEdgeProximity ? "glow" : "hidden");
      }
    },
    [
      bubbleRef,
      clearHideTimer,
      clearRevealTimer,
      scheduleHide,
      scheduleReveal,
      setPhase,
      updateOverlayRect,
    ],
  );

  const handlePointerExit = useCallback(() => {
    lastPointerRef.current = null;
    if (phaseRef.current === "visible") {
      scheduleHide();
      return;
    }
    clearRevealTimer();
    setPhase("hidden");
  }, [clearRevealTimer, scheduleHide, setPhase]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      evaluatePointer(event.clientX, event.clientY);
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        handlePointerExit();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    window.addEventListener("blur", handlePointerExit);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("blur", handlePointerExit);
    };
  }, [evaluatePointer, handlePointerExit]);

  useEffect(() => {
    updateOverlayRect();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidateOverlayRect);
    if (overlayRef.current) {
      resizeObserver?.observe(overlayRef.current);
    }

    window.addEventListener("resize", invalidateOverlayRect);
    window.addEventListener("scroll", invalidateOverlayRect, true);
    document.addEventListener("fullscreenchange", invalidateOverlayRect);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", invalidateOverlayRect);
      window.removeEventListener("scroll", invalidateOverlayRect, true);
      document.removeEventListener("fullscreenchange", invalidateOverlayRect);
    };
  }, [invalidateOverlayRect, overlayRef, updateOverlayRect]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
    if (panelOpen) {
      revealImmediately();
      return;
    }

    const pointer = lastPointerRef.current;
    if (pointer) {
      evaluatePointer(pointer.x, pointer.y);
    } else {
      scheduleHide();
    }
  }, [evaluatePointer, panelOpen, revealImmediately, scheduleHide]);

  useEffect(
    () => () => {
      clearRevealTimer();
      clearHideTimer();
    },
    [clearHideTimer, clearRevealTimer],
  );

  const handleBubbleFocus = useCallback<FocusEventHandler<HTMLButtonElement>>(() => {
    focusedRef.current = true;
    revealImmediately();
  }, [revealImmediately]);

  const handleBubbleBlur = useCallback<FocusEventHandler<HTMLButtonElement>>(() => {
    focusedRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  return {
    bubbleVisible: phase === "visible",
    edgeGlowVisible: phase === "glow",
    handleBubbleBlur,
    handleBubbleFocus,
  };
}

function clearTimer(timerRef: { current: number | null }): void {
  if (timerRef.current === null) {
    return;
  }
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function pointInsideRect(clientX: number, clientY: number, rect: DOMRect): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}
