import { getCurrentExtensionSession, signOutWithWebsite } from "./auth-client";
import { getStoredAuthTokens } from "./auth-tokens";

export const PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE = "ANIDACHI_PRIVILEGED_OVERLAY_INTENT";

const PRIVILEGED_ROOM_AUTHORITY_STORAGE_KEY_PREFIX = "anidachi:privileged-room-authority:v1:tab:";

export type PrivilegedOverlayAction = "sign-out" | "end-room" | "quota-end-room";
export type PrivilegedOverlayRole = "host" | "member" | null;

/**
 * `authorityGeneration` is issued by the extension background after a trusted
 * create/connect response. It is deliberately not the Worker's playback
 * `roomGeneration`, which has no independently verifiable background source.
 */
export interface PrivilegedOverlayContext {
  accountUserId: string;
  roomId: string | null;
  role: PrivilegedOverlayRole;
  authorityGeneration: number | null;
}

export type PrivilegedOverlayIntentMessage = {
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

interface SessionStorageLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PrivilegedOverlayIntentDependencies {
  sessionStorage?: SessionStorageLike;
  getStoredSession?: typeof getStoredAuthTokens;
  getCurrentSession?: typeof getCurrentExtensionSession;
  signOut?: typeof signOutWithWebsite;
  endRoom?: (roomId: string, accessToken: string) => Promise<{ endedAt: string | null }>;
  isAuthorityRequestCurrent?: () => boolean;
}

export interface IssuedRoomAuthorityInput {
  roomId: string;
  roomToken: string;
}

export function isTrustedOverlayActionEvent(event: {
  nativeEvent?: { isTrusted?: unknown };
}): boolean {
  return event.nativeEvent?.isTrusted === true;
}

export function isPrivilegedOverlayIntentMessage(
  value: unknown,
): value is PrivilegedOverlayIntentMessage {
  if (!isRecord(value) || value.type !== PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE) return false;
  if (value.command !== "invoke" || "accessToken" in value) return false;
  if (!isPrivilegedOverlayContext(value.context)) return false;
  return value.action === "sign-out" || value.action === "end-room" || value.action === "quota-end-room";
}

export async function requestPrivilegedOverlayAction(
  event: { nativeEvent?: { isTrusted?: unknown } },
  action: Exclude<PrivilegedOverlayAction, "quota-end-room">,
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender = (message) => chrome.runtime.sendMessage(message),
): Promise<PrivilegedOverlayIntentResponse> {
  if (!isTrustedOverlayActionEvent(event)) {
    throw new Error("Privileged action requires a trusted user gesture");
  }
  return sendPrivilegedOverlayAction(action, context, sendMessage);
}

export async function requestQuotaRoomEnd(
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender = (message) => chrome.runtime.sendMessage(message),
): Promise<PrivilegedOverlayIntentResponse> {
  return sendPrivilegedOverlayAction("quota-end-room", context, sendMessage);
}

/**
 * Establishes per-tab room authority from the room token delivered by the
 * background's own authenticated HTTPS request. It never accepts a token sent
 * later by content as proof of authority.
 */
export async function issuePrivilegedRoomAuthority(
  input: IssuedRoomAuthorityInput,
  sender: { tab?: { id?: number } },
  dependencies: PrivilegedOverlayIntentDependencies = {},
): Promise<PrivilegedOverlayContext | null> {
  const tabId = getSenderTabId(sender);
  if (tabId === null) return null;
  if (dependencies.isAuthorityRequestCurrent?.() === false) return null;

  const claims = parseTrustedRoomToken(input.roomToken);
  if (!claims || claims.roomId !== input.roomId) return null;

  const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
  const currentSession = await getStoredSession();
  if (currentSession?.user.id !== claims.sub) return null;
  if (dependencies.isAuthorityRequestCurrent?.() === false) return null;

  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  const existing = parsePrivilegedOverlayContext((await storage.get(key))[key]);
  if (dependencies.isAuthorityRequestCurrent?.() === false) return null;
  const authorityGeneration = (existing?.authorityGeneration ?? 0) + 1;
  const authority: PrivilegedOverlayContext = {
    accountUserId: claims.sub,
    roomId: claims.roomId,
    role: claims.role,
    authorityGeneration,
  };
  await storage.set({ [key]: authority });
  return authority;
}

export async function handlePrivilegedOverlayIntentMessage(
  message: PrivilegedOverlayIntentMessage,
  sender: { tab?: { id?: number } },
  dependencies: PrivilegedOverlayIntentDependencies = {},
): Promise<PrivilegedOverlayIntentResponse> {
  const tabId = getSenderTabId(sender);
  if (tabId === null) {
    return { ok: false, error: "Privileged overlay intent is missing a sender tab" };
  }

  const getCurrentSession = dependencies.getCurrentSession ?? getCurrentExtensionSession;
  const currentSession = await getCurrentSession();
  if (currentSession?.user.id !== message.context.accountUserId) {
    return { ok: false, error: "Privileged overlay account changed" };
  }

  if (message.action === "sign-out") {
    if (!isSignOutContext(message.context)) {
      return { ok: false, error: "Privileged sign-out context is invalid" };
    }
    const signOut = dependencies.signOut ?? signOutWithWebsite;
    await signOut();
    await clearPrivilegedOverlayContextForTab(tabId, dependencies);
    return { ok: true };
  }

  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  const storedAuthority = parsePrivilegedOverlayContext((await storage.get(key))[key]);
  if (!storedAuthority || !samePrivilegedOverlayContext(storedAuthority, message.context)) {
    return { ok: false, error: "Privileged overlay room authority is stale" };
  }
  if (storedAuthority.role !== "host" || !storedAuthority.roomId || !currentSession) {
    return { ok: false, error: "Privileged room action is not authorized for the current room" };
  }

  const endRoom = dependencies.endRoom;
  if (!endRoom) {
    return { ok: false, error: "Privileged room action is unavailable" };
  }
  const ended = await endRoom(storedAuthority.roomId, currentSession.accessToken);
  await clearPrivilegedOverlayContextForTab(tabId, dependencies);
  return { ok: true, endedAt: ended.endedAt };
}

export async function clearPrivilegedOverlayContextForTab(
  tabId: number,
  dependencies: Pick<PrivilegedOverlayIntentDependencies, "sessionStorage"> = {},
): Promise<void> {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const storage = dependencies.sessionStorage ?? getSessionStorage();
  await storage.remove(authorityStorageKey(tabId));
}

function isPrivilegedOverlayContext(value: unknown): value is PrivilegedOverlayContext {
  return parsePrivilegedOverlayContext(value) !== null;
}

function parsePrivilegedOverlayContext(value: unknown): PrivilegedOverlayContext | null {
  if (!isRecord(value)) return null;
  const accountUserId = value.accountUserId;
  const roomId = value.roomId;
  const role = value.role;
  const authorityGeneration = value.authorityGeneration;
  if (typeof accountUserId !== "string" || !accountUserId) return null;
  if (roomId === null) {
    return role === null && authorityGeneration === null
      ? { accountUserId, roomId, role, authorityGeneration }
      : null;
  }
  if (
    typeof roomId !== "string" ||
    !roomId ||
    (role !== "host" && role !== "member") ||
    typeof authorityGeneration !== "number" ||
    !Number.isSafeInteger(authorityGeneration) ||
    authorityGeneration <= 0
  ) {
    return null;
  }
  return { accountUserId, roomId, role, authorityGeneration };
}

function isSignOutContext(context: PrivilegedOverlayContext): boolean {
  return context.roomId === null && context.role === null && context.authorityGeneration === null;
}

function samePrivilegedOverlayContext(
  left: PrivilegedOverlayContext,
  right: PrivilegedOverlayContext,
): boolean {
  return (
    left.accountUserId === right.accountUserId &&
    left.roomId === right.roomId &&
    left.role === right.role &&
    left.authorityGeneration === right.authorityGeneration
  );
}

async function sendPrivilegedOverlayAction(
  action: PrivilegedOverlayAction,
  context: PrivilegedOverlayContext,
  sendMessage: RuntimeMessageSender,
): Promise<PrivilegedOverlayIntentResponse> {
  return assertIntentResponse(
    await sendMessage({
      type: PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE,
      command: "invoke",
      action,
      context,
    }),
  );
}

function assertIntentResponse(value: unknown): PrivilegedOverlayIntentResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    throw new Error("Privileged overlay intent did not return a response");
  }
  if (!value.ok) {
    throw new Error(typeof value.error === "string" ? value.error : "Privileged overlay intent failed");
  }
  return value as PrivilegedOverlayIntentResponse;
}

function parseTrustedRoomToken(token: string): {
  sub: string;
  roomId: string;
  role: "host" | "member";
} | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] ?? "")) as unknown;
    if (!isRecord(payload) || payload.typ !== "room") return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.roomId !== "string" || !payload.roomId) return null;
    if (payload.role !== "host" && payload.role !== "member") return null;
    return { sub: payload.sub, roomId: payload.roomId, role: payload.role };
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function getSenderTabId(sender: { tab?: { id?: number } }): number | null {
  const tabId = sender.tab?.id;
  return Number.isInteger(tabId) && (tabId ?? -1) >= 0 ? (tabId as number) : null;
}

function authorityStorageKey(tabId: number): string {
  return `${PRIVILEGED_ROOM_AUTHORITY_STORAGE_KEY_PREFIX}${tabId}`;
}

function getSessionStorage(): SessionStorageLike {
  if (!chrome.storage?.session) {
    throw new Error("Privileged room authority session storage is unavailable");
  }
  return chrome.storage.session;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
