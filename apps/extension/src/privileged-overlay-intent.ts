import { getCurrentExtensionSession, signOutWithWebsite } from "./auth-client";
import { getStoredAuthTokens } from "./auth-tokens";
import { endWebsiteRoomFromApi } from "./room-client";

export const PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE = "ANIDACHI_PRIVILEGED_OVERLAY_INTENT";

export type PrivilegedOverlayAction = "sign-out" | "end-room" | "quota-end-room";
export type PrivilegedOverlayRole = "host" | "guest" | null;

export interface PrivilegedOverlayContext {
  accountUserId: string | null;
  roomId: string | null;
  role: PrivilegedOverlayRole;
  roomGeneration: number | null;
}

export type PrivilegedOverlayIntentMessage =
  | {
      type: typeof PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE;
      command: "set-context";
      context: PrivilegedOverlayContext;
    }
  | {
      type: typeof PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE;
      command: "invoke";
      action: PrivilegedOverlayAction;
      context: PrivilegedOverlayContext;
    };

export type PrivilegedOverlayIntentResponse =
  | { ok: true; endedAt?: string | null }
  | { ok: false; error: string };

type RuntimeMessageSender = (
  message: PrivilegedOverlayIntentMessage,
) => Promise<PrivilegedOverlayIntentResponse | null | undefined | unknown>;

export interface PrivilegedOverlayIntentDependencies {
  contexts?: Map<number, PrivilegedOverlayContext>;
  getStoredSession?: typeof getStoredAuthTokens;
  getCurrentSession?: typeof getCurrentExtensionSession;
  signOut?: typeof signOutWithWebsite;
  endRoom?: typeof endWebsiteRoomFromApi;
}

const contextsByTab = new Map<number, PrivilegedOverlayContext>();

export function isTrustedOverlayActionEvent(event: {
  nativeEvent?: { isTrusted?: unknown };
}): boolean {
  return event.nativeEvent?.isTrusted === true;
}

export function isPrivilegedOverlayIntentMessage(
  value: unknown,
): value is PrivilegedOverlayIntentMessage {
  if (!isRecord(value) || value.type !== PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE) return false;
  if (!isPrivilegedOverlayContext(value.context) || "accessToken" in value) return false;
  if (value.command === "set-context") return true;
  return (
    value.command === "invoke" &&
    (value.action === "sign-out" || value.action === "end-room" || value.action === "quota-end-room")
  );
}

export async function syncPrivilegedOverlayContext(
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender = (message) => chrome.runtime.sendMessage(message),
): Promise<void> {
  const response = await sendMessage({
    type: PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE,
    command: "set-context",
    context,
  });
  assertIntentResponse(response);
}

export async function requestPrivilegedOverlayAction(
  event: { nativeEvent?: { isTrusted?: unknown } },
  action: Exclude<PrivilegedOverlayAction, "quota-end-room">,
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender = (message) => chrome.runtime.sendMessage(message),
): Promise<PrivilegedOverlayIntentResponse> {
  if (!isTrustedOverlayActionEvent(event)) {
    return { ok: false, error: "Privileged action requires a trusted user gesture" };
  }
  return sendPrivilegedOverlayAction(action, context, sendMessage);
}

export async function requestQuotaRoomEnd(
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender = (message) => chrome.runtime.sendMessage(message),
): Promise<PrivilegedOverlayIntentResponse> {
  return sendPrivilegedOverlayAction("quota-end-room", context, sendMessage);
}

export async function handlePrivilegedOverlayIntentMessage(
  message: PrivilegedOverlayIntentMessage,
  sender: { tab?: { id?: number } },
  dependencies: PrivilegedOverlayIntentDependencies = {},
): Promise<PrivilegedOverlayIntentResponse> {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId) || (tabId ?? -1) < 0) {
    return { ok: false, error: "Privileged overlay intent is missing a sender tab" };
  }

  const contexts = dependencies.contexts ?? contextsByTab;
  const getCurrentSession = dependencies.getCurrentSession ?? getCurrentExtensionSession;
  const resolvedTabId = tabId as number;

  if (message.command === "set-context") {
    const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
    const storedSession = await getStoredSession();
    if (!isContextOwnedByCurrentSession(message.context, storedSession?.user.id ?? null)) {
      contexts.delete(resolvedTabId);
      return { ok: false, error: "Privileged overlay context does not match the current account" };
    }
    contexts.set(resolvedTabId, message.context);
    return { ok: true };
  }

  const currentContext = contexts.get(resolvedTabId);
  if (!currentContext || !samePrivilegedOverlayContext(currentContext, message.context)) {
    return { ok: false, error: "Privileged overlay context is stale" };
  }
  const currentSession = await getCurrentSession();
  if (!isContextOwnedByCurrentSession(currentContext, currentSession?.user.id ?? null)) {
    contexts.delete(resolvedTabId);
    return { ok: false, error: "Privileged overlay account changed" };
  }

  if (message.action === "sign-out") {
    const signOut = dependencies.signOut ?? signOutWithWebsite;
    await signOut();
    contexts.delete(resolvedTabId);
    return { ok: true };
  }

  if (
    currentContext.role !== "host" ||
    !currentContext.roomId ||
    !Number.isSafeInteger(currentContext.roomGeneration) ||
    (currentContext.roomGeneration ?? 0) <= 0 ||
    !currentSession
  ) {
    return { ok: false, error: "Privileged room action is not authorized for the current room" };
  }

  const endRoom = dependencies.endRoom ?? endWebsiteRoomFromApi;
  const ended = await endRoom(currentContext.roomId, currentSession.accessToken);
  return { ok: true, endedAt: ended.endedAt };
}

export function clearPrivilegedOverlayContextForTab(tabId: number): void {
  contextsByTab.delete(tabId);
}

function isPrivilegedOverlayContext(value: unknown): value is PrivilegedOverlayContext {
  if (!isRecord(value)) return false;
  const accountUserId = value.accountUserId;
  const roomId = value.roomId;
  const role = value.role;
  const roomGeneration = value.roomGeneration;
  if (!isNullableString(accountUserId) || !isNullableString(roomId)) return false;
  if (role !== "host" && role !== "guest" && role !== null) return false;
  if (
    roomGeneration !== null &&
    (typeof roomGeneration !== "number" ||
      !Number.isSafeInteger(roomGeneration) ||
      roomGeneration <= 0)
  ) {
    return false;
  }
  if (accountUserId === null) return roomId === null && role === null && roomGeneration === null;
  if (roomId === null) return role === null && roomGeneration === null;
  return role !== null && roomGeneration !== null;
}

function isContextOwnedByCurrentSession(
  context: PrivilegedOverlayContext,
  currentAccountUserId: string | null,
): boolean {
  return context.accountUserId === currentAccountUserId;
}

function samePrivilegedOverlayContext(
  left: PrivilegedOverlayContext,
  right: PrivilegedOverlayContext,
): boolean {
  return (
    left.accountUserId === right.accountUserId &&
    left.roomId === right.roomId &&
    left.role === right.role &&
    left.roomGeneration === right.roomGeneration
  );
}

async function sendPrivilegedOverlayAction(
  action: PrivilegedOverlayAction,
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender,
): Promise<PrivilegedOverlayIntentResponse> {
  const response = assertIntentResponse(
    await sendMessage({
      type: PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE,
      command: "invoke",
      action,
      context,
    }),
  );
  return response;
}

function assertIntentResponse(
  value: unknown,
): PrivilegedOverlayIntentResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new Error("Privileged overlay intent did not return a response");
  }
  if (!value.ok) {
    throw new Error(typeof value.error === "string" ? value.error : "Privileged overlay intent failed");
  }
  return value as PrivilegedOverlayIntentResponse;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
