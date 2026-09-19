"use client";

import { useEffect, useState } from "react";

export type AsyncDemoPhase = "watching" | "compose" | "writing" | "emoji" | "send" | "saved" | "later" | "catching" | "approaching" | "unlocked";

const NEXT: Record<AsyncDemoPhase, AsyncDemoPhase> = {
  watching: "compose", compose: "writing", writing: "emoji", emoji: "send", send: "saved", saved: "later", later: "catching",
  catching: "approaching", approaching: "unlocked", unlocked: "watching",
};
// Leave time to read each outcome before moving to the next action.
// The scene uses the same timings for its playback and time-jump animations.
export const ASYNC_DEMO_TIMINGS: Record<AsyncDemoPhase, number> = {
  watching: 2800, compose: 800, writing: 1500, emoji: 1200, send: 1100,
  saved: 2000, later: 1600, catching: 1400, approaching: 1000, unlocked: 4200,
};

export function getAsyncDemoScene(phase: AsyncDemoPhase): 1 | 2 | 3 | 4 {
  if (phase === "watching") return 1;
  if (["compose", "writing", "emoji", "send", "saved"].includes(phase)) return 2;
  if (phase === "unlocked") return 4;
  return 3;
}

export const ASYNC_DEMO_MESSAGE = "That little cat!";

/** Uses the same visible typing pattern as Live, without a real message client. */
export function useAsyncDemoTyping(phase: AsyncDemoPhase, playing: boolean) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    if (phase !== "writing") { setLength(0); return; }
    if (!playing) return;
    const timer = setInterval(() => setLength(value => Math.min(value + 1, ASYNC_DEMO_MESSAGE.length)), 65);
    return () => clearInterval(timer);
  }, [phase, playing]);
  if (phase === "send") return `${ASYNC_DEMO_MESSAGE} 🥹`;
  if (phase === "emoji") return ASYNC_DEMO_MESSAGE;
  return phase === "writing" ? ASYNC_DEMO_MESSAGE.slice(0, length) : "";
}

/** A preview of a planned feature. It never saves or replays real reactions. */
export function useAsyncDemo(visible: boolean, reducedMotion: boolean | null) {
  const [phase, setPhase] = useState<AsyncDemoPhase>("watching");
  useEffect(() => {
    if (!visible || reducedMotion !== false) return;
    const timer = setTimeout(() => setPhase(NEXT[phase]), ASYNC_DEMO_TIMINGS[phase]);
    return () => clearTimeout(timer);
  }, [phase, visible, reducedMotion]);
  return reducedMotion ? "unlocked" : phase;
}
