import {
  AMPLITUDE_DEVICE_COOKIE,
  isAmplitudeInsertId,
} from "@/lib/amplitude-ids";

const AMPLITUDE_HTTP_API = "https://api2.amplitude.com/2/httpapi";

export type AmplitudeServerEvent = {
  eventType: string;
  insertId?: string | null;
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  properties?: Record<string, unknown>;
};

function amplitudeApiKey(): string | null {
  const key =
    process.env.AMPLITUDE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY?.trim() ||
    "";
  return key || null;
}

export function amplitudeDeviceIdFromCookieHeader(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${AMPLITUDE_DEVICE_COOKIE}=`)) continue;
    const value = decodeURIComponent(
      trimmed.slice(AMPLITUDE_DEVICE_COOKIE.length + 1).trim(),
    );
    return value || null;
  }
  return null;
}

export function clientIpFromRequest(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}

/**
 * Fire-and-forget Amplitude HTTP API. Never throws. Does not log the API key.
 */
export async function trackAmplitudeServerEvent(
  event: AmplitudeServerEvent,
): Promise<void> {
  const apiKey = amplitudeApiKey();
  if (!apiKey) {
    console.info("[amplitude] skip server event; no API key", {
      eventType: event.eventType,
    });
    return;
  }

  const insertId = isAmplitudeInsertId(event.insertId)
    ? event.insertId
    : crypto.randomUUID();
  const deviceId =
    event.deviceId?.trim() ||
    `anon-${insertId}`;

  const payload = {
    api_key: apiKey,
    events: [
      {
        event_type: event.eventType,
        device_id: deviceId,
        insert_id: insertId,
        time: Date.now(),
        platform: "Web",
        ip: event.ip || undefined,
        event_properties: {
          ...(event.properties ?? {}),
          ...(event.userAgent
            ? { user_agent: event.userAgent.slice(0, 180) }
            : {}),
        },
      },
    ],
  };

  try {
    const response = await fetch(AMPLITUDE_HTTP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[amplitude] HTTP track failed", {
        eventType: event.eventType,
        status: response.status,
        body: text.slice(0, 180),
      });
      return;
    }
    console.info("[amplitude] server event ok", {
      eventType: event.eventType,
      insertId,
    });
  } catch (error) {
    console.warn("[amplitude] HTTP track error", {
      eventType: event.eventType,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
