import { createHash } from "node:crypto";
import { after } from "next/server";
import {
  amplitudeDeviceIdFromCookieHeader,
  clientIpFromRequest,
  trackAmplitudeServerEvent,
} from "@/lib/amplitude-server";

/**
 * Fire-and-forget product events sent to Amplitude from the server.
 * Production only (never preview/staging/local), best effort, no durable queue.
 */
export const FIRST_TOUCH_COOKIE = "anidachi_first_touch";
export const SIGNUP_FLAG_COOKIE = "anidachi_signup";

export function serverAnalyticsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === "production" && env.VERCEL_GIT_COMMIT_REF === "main";
}

/** Same seed always gives the same UUID, so retries and repeats dedupe in Amplitude. */
export function deterministicInsertId(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  const variant = "89ab"[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export type FirstTouch = {
  first_landing_path?: string;
  first_referrer_host?: string;
  first_utm?: string;
};

/** Reads the first-touch cookie written by the browser (see seo-landing-path.ts). */
export function readFirstTouch(cookieHeader: string | null | undefined): FirstTouch {
  if (!cookieHeader) return {};
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${FIRST_TOUCH_COOKIE}=`)) continue;
    try {
      const raw = JSON.parse(
        decodeURIComponent(trimmed.slice(FIRST_TOUCH_COOKIE.length + 1)),
      ) as { p?: unknown; r?: unknown; u?: unknown };
      const out: FirstTouch = {};
      if (typeof raw.p === "string" && raw.p.startsWith("/"))
        out.first_landing_path = raw.p.slice(0, 200);
      if (typeof raw.r === "string") out.first_referrer_host = raw.r.slice(0, 100);
      if (typeof raw.u === "string") out.first_utm = raw.u.slice(0, 300);
      return out;
    } catch {
      return {};
    }
  }
  return {};
}

export type ServerEventInput = {
  eventType: string;
  userId?: string | null;
  /** Browser request: adds the Amplitude device cookie, IP and user agent. */
  request?: { headers: Headers } | null;
  /** Dedup key. Omit for events that may legitimately repeat. */
  insertSeed?: string;
  occurredAt?: number;
  properties?: Record<string, unknown>;
};

export function emitServerEvent(input: ServerEventInput): void {
  if (!serverAnalyticsEnabled()) return;
  try {
    const headers = input.request?.headers;
    const task = () =>
      trackAmplitudeServerEvent({
        eventType: input.eventType,
        userId: input.userId ?? null,
        deviceId: headers
          ? amplitudeDeviceIdFromCookieHeader(headers.get("cookie"))
          : null,
        insertId: input.insertSeed ? deterministicInsertId(input.insertSeed) : null,
        occurredAt: input.occurredAt,
        ip: headers ? clientIpFromRequest(headers) : null,
        userAgent: headers?.get("user-agent") ?? null,
        properties: { source: "server", ...(input.properties ?? {}) },
      }).catch(() => undefined);
    try {
      after(task);
    } catch {
      void task();
    }
  } catch {
    // Analytics must never break a request.
  }
}
