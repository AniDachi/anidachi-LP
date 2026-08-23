import {
  ExtensionAuthTemporarilyUnavailableError,
  getCurrentExtensionSession,
  signOutWithWebsite,
} from "./auth-client";
import { getStoredAuthTokens } from "./auth-tokens";

export const PRIVILEGED_OVERLAY_INTENT_MESSAGE_TYPE = "ANIDACHI_PRIVILEGED_OVERLAY_INTENT";

const PRIVILEGED_ROOM_AUTHORITY_STORAGE_KEY_PREFIX = "anidachi:privileged-room-authority:v1:tab:";
const LEGACY_PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION = 1;
const PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION = 2;
const WORKER_ROOM_AUTHORITY_CLAIM_OWNER_ID = createClaimOwnerId();
const authorityStorageMutationQueuesByTab = new Map<number, Promise<void>>();
const activeRoomAuthorityClaimExecutionsByTab = new Map<number, string>();

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

interface PrivilegedRoomAuthorityState {
  version: typeof PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION;
  lastAuthorityGeneration: number;
  currentAuthority: PrivilegedOverlayContext | null;
  inFlightClaim: PrivilegedRoomAuthorityClaim | null;
}

interface PrivilegedRoomAuthorityClaim {
  authority: PrivilegedOverlayContext;
  ownerId: string;
}

export interface PrivilegedOverlayIntentDependencies {
  sessionStorage?: SessionStorageLike;
  getStoredSession?: typeof getStoredAuthTokens;
  getCurrentSession?: typeof getCurrentExtensionSession;
  signOut?: typeof signOutWithWebsite;
  endRoom?: (roomId: string, accessToken: string) => Promise<{ endedAt: string | null }>;
  isAuthorityRequestCurrent?: () => boolean;
  claimOwnerId?: string;
}

export interface IssuedRoomAuthorityInput {
  roomId: string;
  roomToken: string;
  authorityGeneration: number;
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
  if (!isValidAuthorityGeneration(input.authorityGeneration)) return null;

  const claims = parseTrustedRoomToken(input.roomToken);
  if (!claims || claims.roomId !== input.roomId) return null;

  const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
  const currentSession = await getStoredSession();
  if (currentSession?.user.id !== claims.sub) return null;
  if (dependencies.isAuthorityRequestCurrent?.() === false) return null;

  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  return enqueueAuthorityStorageMutation(tabId, async () => {
    if (dependencies.isAuthorityRequestCurrent?.() === false) return null;
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    if (dependencies.isAuthorityRequestCurrent?.() === false) return null;
    if (
      state.lastAuthorityGeneration !== input.authorityGeneration ||
      state.currentAuthority !== null ||
      state.inFlightClaim !== null
    ) {
      return null;
    }
    const authority: PrivilegedOverlayContext = {
      accountUserId: claims.sub,
      roomId: claims.roomId,
      role: claims.role,
      authorityGeneration: input.authorityGeneration,
    };
    await writePrivilegedRoomAuthorityState(storage, key, {
      ...state,
      currentAuthority: authority,
    });
    return dependencies.isAuthorityRequestCurrent?.() === false ? null : authority;
  });
}

/**
 * Synchronously joins the per-tab mutation queue and persistently invalidates
 * the previous authority. Callers may start their room HTTP request without
 * awaiting the returned promise, but must await it before issuing or returning.
 */
export function reservePrivilegedRoomAuthorityForTab(
  tabId: number,
  dependencies: Pick<PrivilegedOverlayIntentDependencies, "sessionStorage"> = {},
): Promise<number> {
  if (!Number.isInteger(tabId) || tabId < 0) {
    return Promise.reject(new Error("Privileged room authority reservation is missing a tab"));
  }
  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  return enqueueAuthorityStorageMutation(tabId, async () => {
    activeRoomAuthorityClaimExecutionsByTab.delete(tabId);
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    const authorityGeneration = nextAuthorityGeneration(state.lastAuthorityGeneration);
    await writePrivilegedRoomAuthorityState(storage, key, {
      version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
      lastAuthorityGeneration: authorityGeneration,
      currentAuthority: null,
      inFlightClaim: null,
    });
    return authorityGeneration;
  });
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

  if (message.action === "sign-out") {
    if (!isSignOutContext(message.context)) {
      return { ok: false, error: "Privileged sign-out context is invalid" };
    }
    const getStoredSession = dependencies.getStoredSession ?? getStoredAuthTokens;
    const storedSession = await getStoredSession();
    if (storedSession?.user.id !== message.context.accountUserId) {
      return { ok: false, error: "Privileged overlay account changed" };
    }
    const signOut = dependencies.signOut ?? signOutWithWebsite;
    if (
      !(await signOut(storedSession, () =>
        clearPrivilegedOverlayContextForTab(tabId, dependencies),
      ))
    ) {
      return { ok: false, error: "Privileged overlay account changed" };
    }
    return { ok: true };
  }

  const endRoom = dependencies.endRoom;
  if (!endRoom) {
    return { ok: false, error: "Privileged room action is unavailable" };
  }

  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  const claimOwnerId = dependencies.claimOwnerId?.trim() || WORKER_ROOM_AUTHORITY_CLAIM_OWNER_ID;
  const claimExecutionId = createClaimOwnerId();
  const claimed = await enqueueAuthorityStorageMutation(tabId, async () => {
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    let authority: PrivilegedOverlayContext | null = null;
    if (
      state.currentAuthority &&
      samePrivilegedOverlayContext(state.currentAuthority, message.context)
    ) {
      authority = state.currentAuthority;
    } else if (
      state.inFlightClaim &&
      state.inFlightClaim.ownerId !== claimOwnerId &&
      samePrivilegedOverlayContext(state.inFlightClaim.authority, message.context)
    ) {
      authority = state.inFlightClaim.authority;
    }
    if (!authority) {
      return {
        claimed: false,
        error: "Privileged overlay room authority is stale",
      } as const;
    }
    if (authority.role !== "host" || !authority.roomId) {
      return {
        claimed: false,
        error: "Privileged room action is not authorized for the current room",
      } as const;
    }
    await writePrivilegedRoomAuthorityState(storage, key, {
      ...state,
      currentAuthority: null,
      inFlightClaim: { authority, ownerId: claimOwnerId },
    });
    activeRoomAuthorityClaimExecutionsByTab.set(tabId, claimExecutionId);
    return { claimed: true, authority, roomId: authority.roomId } as const;
  });
  if (!claimed.claimed) {
    return { ok: false, error: claimed.error };
  }

  const getCurrentSession = dependencies.getCurrentSession ?? getCurrentExtensionSession;
  let currentSession: Awaited<ReturnType<typeof getCurrentSession>>;
  try {
    currentSession = await getCurrentSession();
  } catch (error) {
    if (error instanceof ExtensionAuthTemporarilyUnavailableError) {
      await restoreRoomAuthorityClaimIfOwned(
        tabId,
        storage,
        key,
        claimed.authority,
        claimOwnerId,
        claimExecutionId,
      );
    } else {
      await clearRoomAuthorityClaimIfOwned(
        tabId,
        storage,
        key,
        claimed.authority,
        claimOwnerId,
        claimExecutionId,
      );
    }
    throw error;
  }
  if (currentSession?.user.id !== claimed.authority.accountUserId) {
    await clearRoomAuthorityClaimIfOwned(
      tabId,
      storage,
      key,
      claimed.authority,
      claimOwnerId,
      claimExecutionId,
    );
    return { ok: false, error: "Privileged overlay account changed" };
  }
  if (
    !(await isRoomAuthorityClaimOwned(
      tabId,
      storage,
      key,
      claimed.authority,
      claimOwnerId,
      claimExecutionId,
    ))
  ) {
    return { ok: false, error: "Privileged overlay room authority is stale" };
  }

  try {
    const ended = await endRoom(claimed.roomId, currentSession.accessToken);
    await clearRoomAuthorityClaimIfOwned(
      tabId,
      storage,
      key,
      claimed.authority,
      claimOwnerId,
      claimExecutionId,
    );
    return { ok: true, endedAt: ended.endedAt };
  } catch (error) {
    await restoreRoomAuthorityClaimIfOwned(
      tabId,
      storage,
      key,
      claimed.authority,
      claimOwnerId,
      claimExecutionId,
    );
    throw error;
  }
}

function isMatchingRoomAuthorityClaim(
  claim: PrivilegedRoomAuthorityClaim | null,
  authority: PrivilegedOverlayContext,
  ownerId: string,
): boolean {
  return Boolean(
    claim && claim.ownerId === ownerId && samePrivilegedOverlayContext(claim.authority, authority),
  );
}

function isRoomAuthorityClaimOwned(
  tabId: number,
  storage: SessionStorageLike,
  key: string,
  authority: PrivilegedOverlayContext,
  ownerId: string,
  executionId: string,
): Promise<boolean> {
  return enqueueAuthorityStorageMutation(tabId, async () => {
    if (activeRoomAuthorityClaimExecutionsByTab.get(tabId) !== executionId) return false;
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    return isMatchingRoomAuthorityClaim(state.inFlightClaim, authority, ownerId);
  });
}

function clearRoomAuthorityClaimIfOwned(
  tabId: number,
  storage: SessionStorageLike,
  key: string,
  authority: PrivilegedOverlayContext,
  ownerId: string,
  executionId: string,
): Promise<void> {
  return enqueueAuthorityStorageMutation(tabId, async () => {
    if (activeRoomAuthorityClaimExecutionsByTab.get(tabId) !== executionId) return;
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    if (!isMatchingRoomAuthorityClaim(state.inFlightClaim, authority, ownerId)) return;
    await writePrivilegedRoomAuthorityState(storage, key, {
      ...state,
      inFlightClaim: null,
    });
    if (activeRoomAuthorityClaimExecutionsByTab.get(tabId) === executionId) {
      activeRoomAuthorityClaimExecutionsByTab.delete(tabId);
    }
  });
}

function restoreRoomAuthorityClaimIfOwned(
  tabId: number,
  storage: SessionStorageLike,
  key: string,
  authority: PrivilegedOverlayContext,
  ownerId: string,
  executionId: string,
): Promise<void> {
  return enqueueAuthorityStorageMutation(tabId, async () => {
    if (activeRoomAuthorityClaimExecutionsByTab.get(tabId) !== executionId) return;
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    if (
      state.lastAuthorityGeneration !== authority.authorityGeneration ||
      state.currentAuthority !== null ||
      !isMatchingRoomAuthorityClaim(state.inFlightClaim, authority, ownerId)
    ) {
      return;
    }
    await writePrivilegedRoomAuthorityState(storage, key, {
      ...state,
      currentAuthority: authority,
      inFlightClaim: null,
    });
    if (activeRoomAuthorityClaimExecutionsByTab.get(tabId) === executionId) {
      activeRoomAuthorityClaimExecutionsByTab.delete(tabId);
    }
  });
}

export async function clearPrivilegedOverlayContextForTab(
  tabId: number,
  dependencies: Pick<PrivilegedOverlayIntentDependencies, "sessionStorage"> = {},
): Promise<void> {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const storage = dependencies.sessionStorage ?? getSessionStorage();
  const key = authorityStorageKey(tabId);
  await enqueueAuthorityStorageMutation(tabId, async () => {
    activeRoomAuthorityClaimExecutionsByTab.delete(tabId);
    const state = await readPrivilegedRoomAuthorityState(storage, key);
    const authorityGeneration = nextAuthorityGeneration(state.lastAuthorityGeneration);
    await writePrivilegedRoomAuthorityState(storage, key, {
      version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
      lastAuthorityGeneration: authorityGeneration,
      currentAuthority: null,
      inFlightClaim: null,
    });
  });
}

/** Tab removal ends the storage lifetime, so it may remove the counter too. */
export async function removePrivilegedRoomAuthorityStateForTab(
  tabId: number,
  dependencies: Pick<PrivilegedOverlayIntentDependencies, "sessionStorage"> = {},
): Promise<void> {
  if (!Number.isInteger(tabId) || tabId < 0) return;
  const storage = dependencies.sessionStorage ?? getSessionStorage();
  await enqueueAuthorityStorageMutation(tabId, async () => {
    activeRoomAuthorityClaimExecutionsByTab.delete(tabId);
    await storage.remove(authorityStorageKey(tabId));
  });
}

function enqueueAuthorityStorageMutation<T>(tabId: number, mutation: () => Promise<T>): Promise<T> {
  const previous = authorityStorageMutationQueuesByTab.get(tabId) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(mutation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  authorityStorageMutationQueuesByTab.set(tabId, tail);
  void tail.then(() => {
    if (authorityStorageMutationQueuesByTab.get(tabId) === tail) {
      authorityStorageMutationQueuesByTab.delete(tabId);
    }
  });
  return result;
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

function parsePrivilegedRoomAuthorityState(value: unknown): PrivilegedRoomAuthorityState | null {
  const legacyAuthority = parsePrivilegedOverlayContext(value);
  if (
    legacyAuthority &&
    legacyAuthority.roomId !== null &&
    legacyAuthority.authorityGeneration !== null
  ) {
    return {
      version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
      lastAuthorityGeneration: legacyAuthority.authorityGeneration,
      currentAuthority: legacyAuthority,
      inFlightClaim: null,
    };
  }
  if (!isRecord(value)) return null;
  if (!isValidAuthorityGeneration(value.lastAuthorityGeneration)) return null;
  const currentAuthority = parseStoredAuthorityForGeneration(
    value.currentAuthority,
    value.lastAuthorityGeneration,
  );
  if (value.currentAuthority !== null && !currentAuthority) return null;

  if (value.version === LEGACY_PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION) {
    return {
      version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
      lastAuthorityGeneration: value.lastAuthorityGeneration,
      currentAuthority,
      inFlightClaim: null,
    };
  }
  if (value.version !== PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION) return null;
  const inFlightClaim = parseStoredRoomAuthorityClaim(
    value.inFlightClaim,
    value.lastAuthorityGeneration,
  );
  if (value.inFlightClaim !== null && !inFlightClaim) return null;
  if (currentAuthority && inFlightClaim) return null;
  return {
    version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
    lastAuthorityGeneration: value.lastAuthorityGeneration,
    currentAuthority,
    inFlightClaim,
  };
}

function parseStoredAuthorityForGeneration(
  value: unknown,
  authorityGeneration: number,
): PrivilegedOverlayContext | null {
  if (value === null) return null;
  const authority = parsePrivilegedOverlayContext(value);
  if (
    !authority ||
    authority.roomId === null ||
    authority.authorityGeneration !== authorityGeneration
  ) {
    return null;
  }
  return authority;
}

function parseStoredRoomAuthorityClaim(
  value: unknown,
  authorityGeneration: number,
): PrivilegedRoomAuthorityClaim | null {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.ownerId !== "string" || !value.ownerId.trim()) return null;
  const authority = parseStoredAuthorityForGeneration(value.authority, authorityGeneration);
  return authority ? { authority, ownerId: value.ownerId } : null;
}

async function readPrivilegedRoomAuthorityState(
  storage: SessionStorageLike,
  key: string,
): Promise<PrivilegedRoomAuthorityState> {
  const value = (await storage.get(key))[key];
  if (value === undefined) {
    return {
      version: PRIVILEGED_ROOM_AUTHORITY_STATE_VERSION,
      lastAuthorityGeneration: 0,
      currentAuthority: null,
      inFlightClaim: null,
    };
  }
  const state = parsePrivilegedRoomAuthorityState(value);
  if (!state) throw new Error("Privileged room authority state is invalid");
  return state;
}

function writePrivilegedRoomAuthorityState(
  storage: SessionStorageLike,
  key: string,
  state: PrivilegedRoomAuthorityState,
): Promise<void> {
  return storage.set({ [key]: state });
}

function nextAuthorityGeneration(previous: number): number {
  if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Privileged room authority generation is exhausted");
  }
  return previous + 1;
}

function isValidAuthorityGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
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

function createClaimOwnerId(): string {
  return crypto.randomUUID();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
