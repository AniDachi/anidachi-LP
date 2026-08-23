import { RoomDepartureAcknowledgementSchema } from "@anidachi/protocol";
import { refreshExtensionSession } from "./auth-client";
import { getStoredAuthTokens, type ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import {
  clearRoomSessionForClosedTab,
  loadRoomSessionForTab,
  type RoomSessionRecord,
} from "./room-session-storage";

export const ROOM_TAB_DEPARTURE_TIMEOUT_MS = 4_000;

export type RoomDepartureRequestResult =
  | { kind: "ack"; outcome: "departed" | "room_ended" | "stale" }
  | { kind: "unauthorized" }
  | { kind: "failed" };

export type RoomTabDepartureOutcome =
  | "departed"
  | "room_ended"
  | "stale"
  | "no-session"
  | "no-auth"
  | "account-changed"
  | "failed"
  | "timed-out";

export interface RoomTabDepartureDependencies {
  loadRoomSession?: (tabId: number) => Promise<RoomSessionRecord | null>;
  clearRoomSession?: (
    tabId: number,
    expected: RoomSessionRecord | null,
  ) => Promise<boolean>;
  getStoredSession?: () => Promise<ExtensionAuthTokens | null>;
  refreshSession?: () => Promise<ExtensionAuthTokens | null>;
  requestDeparture?: (
    record: RoomSessionRecord,
    accessToken: string,
    signal: AbortSignal,
  ) => Promise<RoomDepartureRequestResult>;
  timeoutMs?: number;
}

/**
 * Best-effort close accelerator. Durable Worker disconnect handling remains the
 * fallback if MV3 is suspended, auth is unavailable, or the network is down.
 */
export async function handleRoomTabDeparture(
  tabId: number,
  dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomTabDepartureOutcome> {
  const loadRoomSession = dependencies.loadRoomSession ?? loadRoomSessionForTab;
  const clearRoomSession = dependencies.clearRoomSession ?? clearRoomSessionForClosedTab;
  let record: RoomSessionRecord | null = null;

  try {
    record = await loadRoomSession(tabId);
  } catch {
    await clearRoomSession(tabId, null).catch(() => false);
    return "failed";
  }

  if (!record) {
    await clearRoomSession(tabId, null).catch(() => false);
    return "no-session";
  }

  const abortController = new AbortController();
  const timeoutMs = normalizeTimeout(dependencies.timeoutMs);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<"timed-out">((resolve) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      resolve("timed-out");
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      notifyExactDeparture(record, abortController.signal, dependencies),
      timedOut,
    ]);
  } catch {
    return abortController.signal.aborted ? "timed-out" : "failed";
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    await clearRoomSession(tabId, record).catch(() => false);
  }
}

async function notifyExactDeparture(
  record: RoomSessionRecord,
  signal: AbortSignal,
  dependencies: RoomTabDepartureDependencies,
): Promise<RoomTabDepartureOutcome> {
  const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
  const requestDeparture = dependencies.requestDeparture ?? departWebsiteRoomFromApi;
  const refreshSession = dependencies.refreshSession ?? refreshExtensionSession;
  const stored = await getStoredSession();
  if (!stored) return "no-auth";
  if (stored.user.id !== record.ownerUserId) return "account-changed";

  const first = await requestDeparture(record, stored.accessToken, signal);
  if (first.kind === "ack") return first.outcome;
  if (first.kind !== "unauthorized" || signal.aborted) return "failed";

  const refreshed = await refreshSession();
  if (!refreshed) return "no-auth";
  if (refreshed.user.id !== record.ownerUserId) return "account-changed";
  if (signal.aborted) return "timed-out";

  const retry = await requestDeparture(record, refreshed.accessToken, signal);
  return retry.kind === "ack" ? retry.outcome : "failed";
}

export async function departWebsiteRoomFromApi(
  record: RoomSessionRecord,
  accessToken: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RoomDepartureRequestResult> {
  const response = await fetcher(
    new URL(`/api/rooms/${encodeURIComponent(record.roomId)}/depart`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ participantSessionId: record.participantSessionId }),
      signal,
    },
  );
  if (response.status === 401) return { kind: "unauthorized" };
  if (!response.ok) return { kind: "failed" };

  const acknowledgement = RoomDepartureAcknowledgementSchema.safeParse(
    await response.json().catch(() => null),
  );
  return acknowledgement.success
    ? { kind: "ack", outcome: acknowledgement.data.outcome }
    : { kind: "failed" };
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0
    ? Math.floor(timeoutMs as number)
    : ROOM_TAB_DEPARTURE_TIMEOUT_MS;
}
