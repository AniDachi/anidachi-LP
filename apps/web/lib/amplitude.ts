"use client";

import { createInstance } from "@amplitude/unified";
import { AMPLITUDE_DEVICE_COOKIE } from "@/lib/amplitude-ids";

// Initialize analytics only. initAll also installs Session Replay, which must
// never record the account/history interface or authentication screens.
const amplitude = createInstance();
const ANALYTICS_OPTIONS = {
  fetchRemoteConfig: false,
  autocapture: false,
} as const;

let initPromise: Promise<void> | null = null;

function persistDeviceId(): void {
  try {
    const deviceId = amplitude.getDeviceId?.();
    if (!deviceId) return;
    document.cookie = `${AMPLITUDE_DEVICE_COOKIE}=${encodeURIComponent(
      deviceId,
    )}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie failures (ITP / disabled cookies).
  }
}

function startInit(): void {
  if (typeof window === "undefined") return;
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;
  if (initPromise === null) {
    initPromise = amplitude
      .init(apiKey, ANALYTICS_OPTIONS)
      .promise.then(() => {
        persistDeviceId();
      });
  }
}

/**
 * Initialize explicit Amplitude analytics events once, without Session Replay.
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
  eventProperties?: Record<string, unknown>,
): Promise<void> {
  if (!(await ensureReady())) return;
  const properties = { ...(eventProperties ?? {}) };
  const insertId =
    typeof properties.insert_id === "string" ? properties.insert_id : undefined;
  if (insertId) delete properties.insert_id;
  if (insertId) {
    amplitude.track({
      event_type: eventName,
      insert_id: insertId,
      event_properties: properties,
    });
  } else {
    amplitude.track(eventName, properties);
  }
  persistDeviceId();
}

export async function flushAmplitude(): Promise<void> {
  if (!(await ensureReady())) return;
  const result = amplitude.flush();
  await (result && "promise" in result ? result.promise : result);
}
