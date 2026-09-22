"use client";

import { createInstance, Identify } from "@amplitude/unified";
import { AMPLITUDE_DEVICE_COOKIE } from "@/lib/amplitude-ids";

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
      .initAll(apiKey, {
        analytics: ANALYTICS_OPTIONS,
        sessionReplay: { sampleRate: 1 },
      })
      .then(() => {
        persistDeviceId();
      });
  }
}

/**
 * Initialize Amplitude analytics plus Session Replay.
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

export type AmplitudeUserProfile = {
  userId: string;
  email?: string;
  displayName?: string;
  plan?: string;
};

let identifiedUserId: string | null = null;

/**
 * Attach the signed-in AniDachi account to Amplitude so User Look-Up and
 * Session Replay show a real profile instead of an anonymous device.
 */
export async function identifyAmplitudeUser(
  profile: AmplitudeUserProfile,
  stillCurrent: () => boolean = () => true,
): Promise<void> {
  const userId = profile.userId.trim();
  if (!userId) return;
  if (!(await ensureReady())) return;
  // Ready is async. A newer navigation may already own the session.
  if (!stillCurrent()) return;
  amplitude.setUserId(userId);
  const identifyEvent = new Identify();
  if (profile.plan) identifyEvent.set("plan", profile.plan);
  if (profile.displayName) identifyEvent.set("display_name", profile.displayName);
  if (profile.email) identifyEvent.set("email", profile.email);
  amplitude.identify(identifyEvent);
  identifiedUserId = userId;
  persistDeviceId();
}

export async function resetAmplitudeUser(
  stillCurrent: () => boolean = () => true,
): Promise<void> {
  if (!identifiedUserId) return;
  if (!(await ensureReady())) return;
  if (!stillCurrent()) return;
  amplitude.reset();
  identifiedUserId = null;
  persistDeviceId();
}
