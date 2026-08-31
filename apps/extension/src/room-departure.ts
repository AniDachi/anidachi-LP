import {
	ActiveRoomRecoveryRequestSchema,
	MAX_PARTICIPANT_ID_CHARS,
	MAX_SESSION_ID_CHARS,
	type RoomDepartureAcknowledgement,
	RoomDepartureAcknowledgementSchema,
	RoomDepartureErrorResponseSchema,
} from "@anidachi/protocol";
import { refreshExtensionSession } from "./auth-client";
import { getStoredAuthTokens, type ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE } from "./constants";
import {
  clearRoomSessionForClosedTab,
  loadRoomSessionForExactDeparture,
  loadRoomSessionForTab,
  roomSessionIdentityMatches,
  type RoomSessionBackgroundDependencies,
  type RoomSessionRecord,
} from "./room-session-storage";

export const ROOM_TAB_DEPARTURE_TIMEOUT_MS = 4_000;
export const ROOM_DEPARTURE_MESSAGE_TYPE = "ANIDACHI_ROOM_DEPARTURE";

export type RoomDepartureRuntimeMessage =
	| {
			type: typeof ROOM_DEPARTURE_MESSAGE_TYPE;
			command: "depart";
			roomId: string;
			expectedUserId: string;
			participantSessionId: string;
	  }
	| {
			type: typeof ROOM_DEPARTURE_MESSAGE_TYPE;
			command: "recover-active";
			roomId: string;
			expectedUserId: string;
	  };

export type RoomDepartureRuntimeResponse =
	| { ok: true; outcome: RoomDepartureAcknowledgement["outcome"] }
  | { ok: false; error: string };

export type RoomDepartureRequestResult =
	| { kind: "ack"; outcome: RoomDepartureAcknowledgement["outcome"] }
	| { kind: "unauthorized" }
	| { kind: "active-room-changed"; message: string }
	| {
			kind: "retryable";
			code: "ROOM_DEPARTURE_UNAVAILABLE";
			message: string;
	  }
	| { kind: "failed" };

export type RoomTabDepartureOutcome =
  | "departed"
  | "room_ended"
	| "already_departed"
  | "stale"
  | "no-session"
  | "no-auth"
  | "account-changed"
	| "active-room-changed"
	| "retryable"
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
	roomSessionDependencies?: RoomSessionBackgroundDependencies;
	recoverActiveDeparture?: (
		roomId: string,
		accessToken: string,
		signal: AbortSignal,
	) => Promise<RoomDepartureRequestResult>;
  timeoutMs?: number;
}

export interface RoomDepartureClientDependencies {
  sendMessage?: (message: RoomDepartureRuntimeMessage) => Promise<unknown>;
}

type ConfirmedRoomDepartureOutcome =
	RoomDepartureAcknowledgement["outcome"];

export interface ConfirmExplicitRoomDepartureDependencies {
	roomSession: RoomSessionRecord;
	cancelPendingJoin(): void;
	requestDeparture(): Promise<ConfirmedRoomDepartureOutcome>;
	getCurrentRoomSession(): RoomSessionRecord | null;
	onConfirmed(
		roomSession: RoomSessionRecord,
		outcome: ConfirmedRoomDepartureOutcome,
	): void;
}

export function isRoomDepartureRuntimeMessage(
  value: unknown,
): value is RoomDepartureRuntimeMessage {
	if (
		!isObject(value) ||
    value.type !== ROOM_DEPARTURE_MESSAGE_TYPE ||
		(value.command !== "depart" && value.command !== "recover-active") ||
		!ActiveRoomRecoveryRequestSchema.safeParse({ roomId: value.roomId })
			.success ||
		typeof value.expectedUserId !== "string" ||
		value.expectedUserId.length < 1 ||
		value.expectedUserId.length > MAX_PARTICIPANT_ID_CHARS
	) {
		return false;
	}

	if (value.command === "recover-active") {
		return Object.keys(value).length === 4;
	}

	return (
		typeof value.participantSessionId === "string" &&
		value.participantSessionId.length >= 1 &&
		value.participantSessionId.length <= MAX_SESSION_ID_CHARS &&
		Object.keys(value).length === 5
	);
}

export async function handleRoomDepartureRuntimeMessage(
  _message: RoomDepartureRuntimeMessage,
  sender: { tab?: { id?: number } },
  dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomDepartureRuntimeResponse> {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || (tabId ?? -1) < 0) {
    return { ok: false, error: "Room departure is missing a sender tab" };
  }

	const outcome =
		_message.command === "recover-active"
			? await handleActiveRoomRecovery(
					_message.roomId,
					_message.expectedUserId,
					dependencies,
				)
			: await handleExplicitRoomDeparture(
					tabId as number,
					_message.roomId,
					_message.expectedUserId,
					_message.participantSessionId,
					dependencies,
				);
	if (isConfirmedRoomDepartureOutcome(outcome)) {
    return { ok: true, outcome };
  }
  return { ok: false, error: explicitDepartureError(outcome) };
}

export async function requestCurrentRoomDeparture(
	roomSession: RoomSessionRecord,
  dependencies: RoomDepartureClientDependencies = {},
): Promise<ConfirmedRoomDepartureOutcome> {
	const sendMessage =
		dependencies.sendMessage ??
		((message: RoomDepartureRuntimeMessage) =>
			chrome.runtime.sendMessage(message));
  const response = await sendMessage({
    type: ROOM_DEPARTURE_MESSAGE_TYPE,
    command: "depart",
		roomId: roomSession.roomId,
		expectedUserId: roomSession.ownerUserId,
		participantSessionId: roomSession.participantSessionId,
	});
	return confirmedRuntimeDeparture(response);
}

export async function requestActiveRoomRecovery(
	roomId: string,
	expectedUserId: string,
	dependencies: RoomDepartureClientDependencies = {},
): Promise<ConfirmedRoomDepartureOutcome> {
	const sendMessage =
		dependencies.sendMessage ??
		((message: RoomDepartureRuntimeMessage) =>
			chrome.runtime.sendMessage(message));
	const response = await sendMessage({
		type: ROOM_DEPARTURE_MESSAGE_TYPE,
		command: "recover-active",
		roomId,
		expectedUserId,
  });
	return confirmedRuntimeDeparture(response);
}

function confirmedRuntimeDeparture(
	response: unknown,
): ConfirmedRoomDepartureOutcome {
  if (!isObject(response) || typeof response.ok !== "boolean") {
    throw new Error("Room departure did not return a response");
  }
  if (!response.ok) {
    throw new Error(
      typeof response.error === "string"
        ? response.error
        : "Could not leave the room. Please try again.",
    );
  }
	const acknowledgement = RoomDepartureAcknowledgementSchema.safeParse(response);
	if (!acknowledgement.success) {
    throw new Error("Room departure returned an invalid response");
  }
	return acknowledgement.data.outcome;
}

export async function confirmExplicitRoomDeparture(
  dependencies: ConfirmExplicitRoomDepartureDependencies,
): Promise<ConfirmedRoomDepartureOutcome> {
	dependencies.cancelPendingJoin();
	const outcome = await dependencies.requestDeparture();
	const currentRoomSession = dependencies.getCurrentRoomSession();
	if (
		currentRoomSession &&
		roomSessionIdentityMatches(currentRoomSession, dependencies.roomSession)
	) {
		dependencies.onConfirmed(dependencies.roomSession, outcome);
	}
  return outcome;
}

/**
 * Explicit leave keeps the confirmed record until the overlay receives the
 * server acknowledgement and performs its normal local teardown.
 */
export async function handleExplicitRoomDeparture(
  tabId: number,
	requestedRoomId: string,
	expectedUserId: string,
	expectedParticipantSessionId: string,
  dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomTabDepartureOutcome> {
  const loadRoomSession = dependencies.loadRoomSession ??
		((resolvedTabId: number) =>
			loadRoomSessionForExactDeparture(
				resolvedTabId,
				{
					roomId: requestedRoomId,
					ownerUserId: expectedUserId,
					participantSessionId: expectedParticipantSessionId,
				},
				dependencies.roomSessionDependencies,
			));
  let record: RoomSessionRecord | null;
	try {
		record = await loadRoomSession(tabId);
	} catch {
		return "failed";
	}
	if (!record) return "no-session";
	if (record.ownerUserId !== expectedUserId) return "account-changed";
	if (record.roomId !== requestedRoomId) return "failed";
	if (record.participantSessionId !== expectedParticipantSessionId) {
		return "active-room-changed";
	}
	return notifyBoundedDeparture(record, dependencies);
}

export async function departExactRoomSession(
	record: RoomSessionRecord,
	dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomTabDepartureOutcome> {
	return notifyBoundedDeparture(record, dependencies);
}

export async function handleExactRoomSessionDepartureRuntime(
	record: RoomSessionRecord,
	dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomDepartureRuntimeResponse> {
	const outcome = await departExactRoomSession(record, dependencies);
	return roomDepartureRuntimeResponse(outcome);
}

export function roomDepartureRuntimeResponse(
	outcome: RoomTabDepartureOutcome,
): RoomDepartureRuntimeResponse {
	if (isConfirmedRoomDepartureOutcome(outcome)) {
		return { ok: true, outcome };
	}
	return { ok: false, error: explicitDepartureError(outcome) };
}

export async function handleActiveRoomRecovery(
	roomId: string,
	expectedUserId: string,
	dependencies: RoomTabDepartureDependencies = {},
): Promise<RoomTabDepartureOutcome> {
	return notifyBoundedActiveDeparture(roomId, expectedUserId, dependencies);
}

/**
 * Passive close clears only extension-local bookkeeping. The closing content
 * script socket is the remote signal; the Worker owns its reconnect grace and
 * eventual signed durable departure callback.
 */
export async function handleRoomTabDeparture(
  tabId: number,
  dependencies: RoomTabDepartureDependencies = {},
): Promise<"closed" | "no-session" | "failed"> {
  const loadRoomSession = dependencies.loadRoomSession ??
		((resolvedTabId: number) =>
			loadRoomSessionForTab(resolvedTabId, dependencies.roomSessionDependencies));
  const clearRoomSession = dependencies.clearRoomSession ??
		((resolvedTabId: number, expected: RoomSessionRecord | null) =>
			clearRoomSessionForClosedTab(
				resolvedTabId,
				expected,
				dependencies.roomSessionDependencies,
			));
  let record: RoomSessionRecord | null;

  try {
    record = await loadRoomSession(tabId);
  } catch {
    return "failed";
  }

	if (!record) return "no-session";
	await clearRoomSession(tabId, record).catch(() => false);
	return "closed";
}

async function notifyBoundedDeparture(
  record: RoomSessionRecord,
  dependencies: RoomTabDepartureDependencies,
): Promise<RoomTabDepartureOutcome> {
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
		if (timeoutId !== null) clearTimeout(timeoutId);
	}
}

async function notifyBoundedActiveDeparture(
	roomId: string,
	expectedUserId: string,
	dependencies: RoomTabDepartureDependencies,
): Promise<RoomTabDepartureOutcome> {
	const parsed = ActiveRoomRecoveryRequestSchema.safeParse({ roomId });
	if (!parsed.success) return "failed";
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
			notifyActiveDeparture(
				parsed.data.roomId,
				expectedUserId,
				abortController.signal,
				dependencies,
			),
      timedOut,
    ]);
  } catch {
    return abortController.signal.aborted ? "timed-out" : "failed";
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
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
	const firstOutcome = requestResultOutcome(first);
	if (firstOutcome !== "no-auth") return firstOutcome;
	if (signal.aborted) return "timed-out";

  const refreshed = await refreshSession();
  if (!refreshed) return "no-auth";
  if (refreshed.user.id !== record.ownerUserId) return "account-changed";
  if (signal.aborted) return "timed-out";

	const retry = await requestDeparture(record, refreshed.accessToken, signal);
	return requestResultOutcome(retry);
}

async function notifyActiveDeparture(
	roomId: string,
	expectedUserId: string,
	signal: AbortSignal,
	dependencies: RoomTabDepartureDependencies,
): Promise<RoomTabDepartureOutcome> {
	const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
	const refreshSession = dependencies.refreshSession ?? refreshExtensionSession;
	const stored = await getStoredSession();
	if (!stored) return "no-auth";
	if (stored.user.id !== expectedUserId) return "account-changed";

	const first = await requestActiveDeparture(
		roomId,
		stored.accessToken,
		signal,
		dependencies,
	);
	if (first !== "no-auth") return first;
	if (signal.aborted) return "timed-out";

	const refreshed = await refreshSession();
	if (!refreshed) return "no-auth";
	if (refreshed.user.id !== expectedUserId) return "account-changed";
	if (signal.aborted) return "timed-out";
	return requestActiveDeparture(
		roomId,
		refreshed.accessToken,
		signal,
		dependencies,
	);
}

async function requestActiveDeparture(
	roomId: string,
	accessToken: string,
	signal: AbortSignal,
	dependencies: RoomTabDepartureDependencies,
): Promise<RoomTabDepartureOutcome> {
	const recover =
		dependencies.recoverActiveDeparture ?? departActiveWebsiteRoomFromApi;
	const result = await recover(roomId, accessToken, signal);
	return requestResultOutcome(result);
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
	return parseDepartureResponse(response);
}

export async function departActiveWebsiteRoomFromApi(
	roomId: string,
	accessToken: string,
	signal: AbortSignal,
	fetcher: typeof fetch = fetch,
): Promise<RoomDepartureRequestResult> {
	const request = ActiveRoomRecoveryRequestSchema.parse({ roomId });
	const response = await fetcher(
		new URL("/api/rooms/active-session/depart", WEB_HTTP_BASE),
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
			signal,
		},
	);
	return parseDepartureResponse(response);
}

async function parseDepartureResponse(
	response: Response,
): Promise<RoomDepartureRequestResult> {
	const body = await response.json().catch(() => null);
	if (response.ok) {
		const acknowledgement = RoomDepartureAcknowledgementSchema.safeParse(body);
		return acknowledgement.success
			? { kind: "ack", outcome: acknowledgement.data.outcome }
			: { kind: "failed" };
	}

	const error = RoomDepartureErrorResponseSchema.safeParse(body);
	if (
		response.status === 401 &&
		error.success &&
		error.data.code === "AUTH_REQUIRED"
	) {
		return { kind: "unauthorized" };
	}
	if (
		response.status === 409 &&
		error.success &&
		error.data.code === "ACTIVE_ROOM_CHANGED"
	) {
		return { kind: "active-room-changed", message: error.data.message };
	}
	if (
		response.status === 503 &&
		error.success &&
		error.data.code === "ROOM_DEPARTURE_UNAVAILABLE"
	) {
		return {
			kind: "retryable",
			code: error.data.code,
			message: error.data.message,
		};
	}
	return { kind: "failed" };
}

function requestResultOutcome(
	result: RoomDepartureRequestResult,
): RoomTabDepartureOutcome {
	switch (result.kind) {
		case "ack":
			return result.outcome;
		case "unauthorized":
			return "no-auth";
		case "active-room-changed":
			return "active-room-changed";
		case "retryable":
			return "retryable";
		case "failed":
			return "failed";
	}
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  return Number.isFinite(timeoutMs) && (timeoutMs ?? 0) > 0
    ? Math.floor(timeoutMs as number)
    : ROOM_TAB_DEPARTURE_TIMEOUT_MS;
}

function explicitDepartureError(outcome: RoomTabDepartureOutcome): string {
  switch (outcome) {
    case "no-session":
      return "The active room session is no longer available.";
    case "no-auth":
    case "account-changed":
      return "Sign in again before leaving the room.";
    case "timed-out":
      return "Leaving the room timed out. Please try again.";
		case "active-room-changed":
			return "Your active room changed. Nothing was removed.";
		case "retryable":
			return "Could not leave right now. Please try again.";
    case "failed":
      return "Could not leave the room. Please try again.";
    default:
      return "Could not leave the room. Please try again.";
  }
}

function isConfirmedRoomDepartureOutcome(
	value: RoomTabDepartureOutcome,
): value is ConfirmedRoomDepartureOutcome {
	return RoomDepartureAcknowledgementSchema.safeParse({
		ok: true,
		outcome: value,
	}).success;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
