"use client";

import * as amplitude from "@amplitude/unified";

import type { UnifiedOptions } from "@amplitude/unified";

/** Matches Amplitude Unified setup: analytics autocapture + full Session Replay sampling. */
const UNIFIED_OPTIONS = {
  analytics: { autocapture: true },
  sessionReplay: { sampleRate: 1 },
} as const satisfies UnifiedOptions;

let initPromise: Promise<void> | null = null;

function startInit(): void {
  if (typeof window === "undefined") return;
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;
  if (initPromise === null) {
    initPromise = amplitude.initAll(apiKey, UNIFIED_OPTIONS);
  }
}

/**
 * Initialize Amplitude Unified once (analytics + session replay). Safe to call multiple times.
 * Only runs in the browser when `NEXT_PUBLIC_AMPLITUDE_API_KEY` is set.
 */
export function initAmplitudeClient(): void {
  startInit();
}

async function ensureReady(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return false;
  startInit();
  if (!initPromise) return false;
  await initPromise;
  return true;
}

export async function trackAmplitudeEvent(
  eventName: string,
  eventProperties?: Record<string, unknown>
): Promise<void> {
  if (!(await ensureReady())) return;
  amplitude.track(eventName, eventProperties as Record<string, unknown>);
}
