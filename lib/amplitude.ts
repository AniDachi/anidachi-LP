import * as amplitude from "@amplitude/analytics-browser";

let initialized = false;

function ensureInit(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey || typeof window === "undefined") return false;
  if (!initialized) {
    initialized = true;
    amplitude.init(apiKey);
  }
  return true;
}

/** Start Amplitude on mount (e.g. from a client layout helper) so sessions begin early. */
export function initAmplitudeClient(): void {
  ensureInit();
}

export function trackAmplitudeEvent(
  eventName: string,
  eventProperties?: Record<string, unknown>
): void {
  if (!ensureInit()) return;
  amplitude.track(eventName, eventProperties);
}
