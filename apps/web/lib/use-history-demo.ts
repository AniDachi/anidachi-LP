"use client";

import { useEffect, useState } from "react";

export type HistoryDemoPhase = "watching" | "saved" | "library" | "episodes" | "resume" | "playing";

const NEXT: Record<HistoryDemoPhase, HistoryDemoPhase> = {
  watching: "saved", saved: "library", library: "episodes",
  episodes: "resume", resume: "playing", playing: "watching",
};
const DELAY: Record<HistoryDemoPhase, number> = {
  watching: 1900, saved: 1300, library: 1700,
  episodes: 2700, resume: 800, playing: 2900,
};

export function getHistoryDemoScene(phase: HistoryDemoPhase): 1 | 2 | 3 {
  if (phase === "watching" || phase === "saved") return 1;
  if (phase === "library" || phase === "episodes") return 2;
  return 3;
}

/** Illustration only. No history clients, storage, or account mutations. */
export function useHistoryDemo(visible: boolean, reducedMotion: boolean | null) {
  const [phase, setPhase] = useState<HistoryDemoPhase>("watching");
  useEffect(() => {
    if (!visible || reducedMotion !== false) return;
    const timer = setTimeout(() => setPhase(NEXT[phase]), DELAY[phase]);
    return () => clearTimeout(timer);
  }, [phase, visible, reducedMotion]);
  return reducedMotion ? "episodes" : phase;
}
