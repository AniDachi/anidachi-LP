import {
  type AccountInboxResponse,
  DevicePushSubscriptionResponseSchema,
  type ExtensionPushSubscriptionRequest,
  InboxChangedPushPayloadSchema,
} from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import { AccountInboxUnauthorizedError, listAccountInboxFromApi } from "./account-inbox-client";
import { setCachedAccountInboxForUser } from "./account-inbox-cache";
import { getCurrentExtensionSession, refreshExtensionSession } from "./auth-client";
import { getStoredAuthTokens, type ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE, WXT_VAPID_PUBLIC_KEY } from "./constants";
import { logDebug } from "./debug-log";
import { withInvitationHttpDeadline } from "./invitation-http-deadline";
import { createWebsiteRoomHeaders, RoomApiError } from "./room-client";

const MESSAGE_TYPE = "ANIDACHI_ROOM_INVITE_NOTIFICATIONS";
const MAINTENANCE_ALARM = "anidachi-room-invite-notifications";
const NOTIFICATION_ID = "anidachi-room-invites";
const NOTIFICATION_ICON = "icons/icon-128.png";
const PREFERENCE_KEY = "local:anidachi.roomInviteNotifications.enabled" as const;
const INSTALLATION_ID_KEY = "local:anidachi.extensionInstallationId" as const;
const REGISTRATION_KEY = "local:anidachi.roomInviteNotifications.registration" as const;
const ROUTE_INTENT_KEY = "local:anidachi.popupRouteIntent" as const;

let reconciliationQueue: Promise<void> = Promise.resolve();
let subscriptionQueue: Promise<void> = Promise.resolve();
type ReconciliationBatch = {
  epoch: number;
  options: { notify: boolean };
  trailing: boolean;
  promise: Promise<void>;
};
let activeReconciliation: ReconciliationBatch | null = null;
let authSessionEpoch = 0;

type RememberedInboxItems = { userId: string; itemKeys: string[] };
type LegacyRememberedInvites = { userId: string; inviteIds: string[] };
type StoredRegistration = {
  userId: string;
  deviceId: string;
  endpoint: string;
};

export type PopupRouteIntent = {
  userId: string;
  tab: "inbox";
  createdAt: string;
};

export type InboxNotificationPlan = {
  title: string;
  message: string;
  itemKeys: string[];
};

export type RoomInviteNotificationStatus = {
  supported: boolean;
  configured: boolean;
  enabled: boolean;
  permissionGranted: boolean;
  subscribed: boolean;
};

type RoomInviteNotificationDestinationDependencies = {
  getLastFocusedWindow: () => Promise<{ id?: number }>;
  openPopup: (options: { windowId: number }) => Promise<void>;
  openWebInbox: () => Promise<void>;
};

export type RoomInviteNotificationMessage = {
  type: typeof MESSAGE_TYPE;
  command: "status" | "enable" | "disable" | "reconcile";
};

export type RoomInviteNotificationMessageResponse =
  | { ok: true; status: RoomInviteNotificationStatus }
  | { ok: false; error: string };

type AccountInboxRoomInvite = Extract<
  AccountInboxResponse["items"][number],
  { kind: "room-invite" }
>;
type AccountInboxFriendRequest = Extract<
  AccountInboxResponse["items"][number],
  { kind: "friend-request" }
>;
type AccountInboxNotificationItem =
  | AccountInboxRoomInvite
  | AccountInboxFriendRequest;

type ExtensionPushEvent = {
  data?: { text: () => string } | null;
};

export function buildInboxNotificationPlan(
  inbox: AccountInboxResponse,
  rememberedItemKeys: readonly string[] = [],
): InboxNotificationPlan | null {
  const remembered = new Set(rememberedItemKeys);
  const invitations = notificationItems(inbox);
  if (
    invitations.length === 0 ||
    !invitations.some((item) => !remembered.has(itemKey(item)))
  ) {
    return null;
  }

  if (invitations.length > 1) {
    const roomInvites = invitations.filter((item) => item.kind === "room-invite").length;
    const friendRequests = invitations.length - roomInvites;
    return {
      title:
        roomInvites === invitations.length
          ? `${invitations.length} watch invitations`
          : friendRequests === invitations.length
            ? `${invitations.length} friend requests`
            : `${invitations.length} new invitations`,
      message: "Open AniDachi to view them.",
      itemKeys: invitations.map(itemKey),
    };
  }

  const invitation = invitations[0];
  if (!invitation) return null;
  if (invitation.kind === "friend-request") {
    return {
      title: `${invitation.sender.displayName} sent you a friend request`,
      message: "Open AniDachi to respond.",
      itemKeys: [itemKey(invitation)],
    };
  }
  if (invitation.state === "missed") {
    return {
      title: `You missed a watch invitation from ${invitation.sender.displayName}`,
      message: "Open AniDachi to view it.",
      itemKeys: [itemKey(invitation)],
    };
  }
  return {
    title:
      invitation.targetKind === "group"
        ? `${invitation.sender.displayName} invited you to watch with a group`
        : `${invitation.sender.displayName} invited you to watch together`,
    message: "Open AniDachi to view the invitation.",
    itemKeys: [itemKey(invitation)],
  };
}

export function pruneRememberedInboxItemKeys(
  inbox: AccountInboxResponse,
  rememberedItemKeys: readonly string[],
): string[] {
  const currentKeys = new Set(notificationItems(inbox).map(itemKey));
  return rememberedItemKeys.filter((key) => currentKeys.has(key));
}

function notificationItems(inbox: AccountInboxResponse): AccountInboxNotificationItem[] {
  return inbox.items.filter(
    (item): item is AccountInboxNotificationItem =>
      (item.kind === "room-invite" || item.kind === "friend-request") &&
      item.seenAt === null,
  );
}

function itemKey(item: AccountInboxNotificationItem): string {
  return item.kind === "room-invite"
    ? `room-invite:${item.inviteId}`
    : `friend-request:${item.friendshipId}`;
}

export function parseInboxChangedPushPayload(value: string | null): { type: "inbox_changed" } | null {
  if (!value) return null;
  try {
    const parsed = InboxChangedPushPayloadSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isRoomInviteNotificationMessage(
  value: unknown,
): value is RoomInviteNotificationMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<RoomInviteNotificationMessage>;
  return (
    message.type === MESSAGE_TYPE &&
    (message.command === "status" ||
      message.command === "enable" ||
      message.command === "disable" ||
      message.command === "reconcile")
  );
}

export function roomInviteNotificationMessage(
  command: RoomInviteNotificationMessage["command"],
): RoomInviteNotificationMessage {
  return { type: MESSAGE_TYPE, command };
}

export async function requestRoomInviteNotificationPermission(): Promise<boolean> {
  return chrome.permissions.request({ permissions: ["notifications"] });
}

export async function requestRoomInviteNotificationStatus(): Promise<RoomInviteNotificationStatus> {
  const response = (await chrome.runtime.sendMessage(
    roomInviteNotificationMessage("status"),
  )) as RoomInviteNotificationMessageResponse;
  if (!response?.ok) {
    throw new Error(response?.error ?? "Could not read notification settings");
  }
  return response.status;
}

export async function setRoomInviteNotificationsEnabled(
  enabled: boolean,
): Promise<RoomInviteNotificationStatus> {
  const response = (await chrome.runtime.sendMessage(
    roomInviteNotificationMessage(enabled ? "enable" : "disable"),
  )) as RoomInviteNotificationMessageResponse;
  if (!response?.ok) {
    throw new Error(response?.error ?? "Could not update notification settings");
  }
  return response.status;
}

export async function handleRoomInviteNotificationMessage(
  message: RoomInviteNotificationMessage,
): Promise<RoomInviteNotificationMessageResponse> {
  try {
    if (message.command === "enable") {
      await storage.setItem(PREFERENCE_KEY, true);
      await reconcileRoomInviteNotifications({ notify: false });
    } else if (message.command === "disable") {
      await storage.setItem(PREFERENCE_KEY, false);
      authSessionEpoch += 1;
      const expectedAuthSessionEpoch = authSessionEpoch;
      await enqueueNotificationWork(async () => {
        await disableRoomInviteNotifications();
      });
      if (authSessionEpoch === expectedAuthSessionEpoch) {
        await reconcileRoomInviteNotifications({ notify: false });
      }
    } else if (message.command === "reconcile") {
      await reconcileRoomInviteNotifications({ notify: false });
    }
    return { ok: true, status: await getRoomInviteNotificationStatus() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Notification settings failed",
    };
  }
}

export async function getRoomInviteNotificationStatus(): Promise<RoomInviteNotificationStatus> {
  const serviceWorkerRegistration = globalThis.registration;
  const supported = Boolean(serviceWorkerRegistration?.pushManager && chrome.notifications);
  const permissionGranted = await containsNotificationsPermission();
  const preference = await notificationPreference();
  const subscription =
    supported && permissionGranted && serviceWorkerRegistration
      ? await serviceWorkerRegistration.pushManager.getSubscription().catch(() => null)
      : null;
  return {
    supported,
    configured: Boolean(WXT_VAPID_PUBLIC_KEY),
    enabled: preference && permissionGranted && Boolean(subscription),
    permissionGranted,
    subscribed: Boolean(subscription),
  };
}

export async function reconcileRoomInviteNotifications(options: {
  notify: boolean;
}): Promise<void> {
  if (activeReconciliation?.epoch === authSessionEpoch) {
    activeReconciliation.options.notify ||= options.notify;
    activeReconciliation.trailing = true;
    return activeReconciliation.promise;
  }
  const batch: ReconciliationBatch = {
    epoch: authSessionEpoch,
    options: { ...options },
    trailing: false,
    promise: Promise.resolve(),
  };
  activeReconciliation = batch;
  const subscriptions: Promise<void>[] = [];
  const delivery = enqueueNotificationWork(async () => {
    try {
      let failure: unknown;
      do {
        batch.trailing = false;
        try {
          await reconcileRoomInviteNotificationsNow(batch.options, batch.epoch, subscriptions);
          failure = undefined;
        } catch (error) {
          failure = error;
        }
      } while (batch.trailing && batch.epoch === authSessionEpoch);
      if (failure !== undefined) throw failure;
    } finally {
      if (activeReconciliation === batch) activeReconciliation = null;
    }
  });
  // Keep registration alive for the caller's event lifetime, but never hold the
  // delivery lane behind it. A later push can read/display inbox immediately.
  batch.promise = delivery.finally(async () => {
    await Promise.all(subscriptions);
  });
  return batch.promise;
}

async function reconcileRoomInviteNotificationsNow(
  options: { notify: boolean },
  expectedAuthSessionEpoch: number,
  subscriptions: Promise<void>[],
): Promise<void> {
  if (authSessionEpoch !== expectedAuthSessionEpoch) return;
  let tokens = await getStoredAuthTokens();
  if (!tokens) {
    await enqueueSubscriptionWork(async () => {
      if (authSessionEpoch !== expectedAuthSessionEpoch || (await getStoredAuthTokens())) return;
      await disableRoomInviteNotificationsNow(null, { clearAccountState: true });
    });
    return;
  }

  const preference = await notificationPreference();
  const permissionGranted = await containsNotificationsPermission();
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;

  let inbox: AccountInboxResponse;
  try {
    inbox = await listAccountInboxFromApi(tokens.accessToken);
  } catch (error) {
    if (!(error instanceof AccountInboxUnauthorizedError)) throw error;
    if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
    const refreshed = await withInvitationHttpDeadline(() => refreshExtensionSession());
    if (!refreshed || refreshed.user.id !== tokens.user.id) return;
    if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
    tokens = refreshed;
    inbox = await listAccountInboxFromApi(tokens.accessToken);
  }
  if (inbox.meta.ownerUserId !== tokens.user.id) {
    throw new Error("Inbox response belongs to another account");
  }
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  if (!(await setCachedAccountInboxForUser(tokens.user.id, inbox))) return;
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  await setInboxBadge(inbox.counts.unseen);
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;

  const remembered = await getRememberedInboxItems(tokens.user.id);
  const pruned = pruneRememberedInboxItemKeys(inbox, remembered.itemKeys);
  const canDisplayNotification =
    options.notify &&
    preference &&
    permissionGranted &&
    Boolean(chrome.notifications);
  if (canDisplayNotification) {
    const plan = buildInboxNotificationPlan(inbox, pruned);
    if (plan) {
      if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
      await chrome.notifications.create(NOTIFICATION_ID, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON),
        title: plan.title,
        message: plan.message,
        priority: 1,
      });
      pruned.push(...plan.itemKeys);
    }
  }
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  await setRememberedInboxItems(tokens.user.id, [...new Set(pruned)]);
  const session = tokens;
  subscriptions.push(enqueueSubscriptionWork(async () => {
    try {
      if (!(await isCurrentReconciliation(session.user.id, expectedAuthSessionEpoch))) return;
      if (preference && permissionGranted && WXT_VAPID_PUBLIC_KEY) {
        await ensureRegisteredPushSubscription(session, expectedAuthSessionEpoch);
      } else {
        await disableRoomInviteNotificationsNow(session);
      }
    } catch (error) {
      logDebug("account.inbox", "notification subscription maintenance failed", {
        code: (error instanceof RoomApiError && error.code) || "SUBSCRIPTION_UNAVAILABLE",
      });
    }
  }));
}

export async function handleRoomInvitePush(event: ExtensionPushEvent): Promise<void> {
  if (!parseInboxChangedPushPayload(event.data?.text() ?? null)) return;
  await reconcileRoomInviteNotifications({ notify: true });
}

export async function disableRoomInviteNotifications(
  tokens?: ExtensionAuthTokens | null,
  options: { clearAccountState?: boolean } = {},
): Promise<void> {
  return enqueueSubscriptionWork(() => disableRoomInviteNotificationsNow(tokens, options));
}

async function disableRoomInviteNotificationsNow(
  tokens: ExtensionAuthTokens | null | undefined,
  options: { clearAccountState?: boolean } = {},
): Promise<void> {
  const session = tokens === undefined ? await getStoredAuthTokens() : tokens;
  const registration = normalizeStoredRegistration(await storage.getItem(REGISTRATION_KEY));
  if (session && registration?.userId === session.user.id) {
    await revokePushSubscriptionFromApi(session.accessToken, registration.deviceId).catch(
      () => undefined,
    );
  }
  const subscription = await globalThis.registration?.pushManager
    ?.getSubscription()
    .catch(() => null);
  await subscription?.unsubscribe().catch(() => undefined);
  await storage.removeItem(REGISTRATION_KEY);
  await chrome.notifications?.clear?.(NOTIFICATION_ID).catch(() => undefined);
  if (options.clearAccountState) {
    const accountId = session?.user.id ?? registration?.userId;
    if (accountId) await clearRememberedInboxItems(accountId);
    await chrome.action.setBadgeText({ text: "" }).catch(() => undefined);
  }
}

export async function handleRoomInviteNotificationPermissionRemoved(
  permissions: chrome.permissions.Permissions,
): Promise<void> {
  if (!permissions.permissions?.includes("notifications")) return;
  authSessionEpoch += 1;
  const expectedAuthSessionEpoch = authSessionEpoch;
  await storage.setItem(PREFERENCE_KEY, false);
  await enqueueNotificationWork(async () => {
    await disableRoomInviteNotifications();
  });
  if (authSessionEpoch === expectedAuthSessionEpoch) {
    await reconcileRoomInviteNotifications({ notify: false });
  }
}

export async function handleRoomInviteNotificationClick(notificationId: string): Promise<void> {
  if (notificationId !== NOTIFICATION_ID) return;
  const tokens = await getCurrentExtensionSession().catch(() => null);
  if (tokens) {
    await storage.setItem(ROUTE_INTENT_KEY, {
      userId: tokens.user.id,
      tab: "inbox",
      createdAt: new Date().toISOString(),
    } satisfies PopupRouteIntent);
  }

  await openRoomInviteNotificationDestination({
    getLastFocusedWindow: () =>
      chrome.windows.getLastFocused({
        windowTypes: ["normal"],
      }),
    openPopup: (options) => chrome.action.openPopup(options),
    openWebInbox: async () => {
      await chrome.tabs.create({ url: new URL("/account/invites", WEB_HTTP_BASE).toString() });
    },
  });
}

export async function openRoomInviteNotificationDestination(
  dependencies: RoomInviteNotificationDestinationDependencies,
): Promise<"popup" | "web"> {
  try {
    const targetWindow = await dependencies.getLastFocusedWindow();
    const windowId = targetWindow.id;
    if (typeof windowId !== "number" || !Number.isInteger(windowId) || windowId < 0) {
      throw new Error("No normal Chrome window is available");
    }
    await dependencies.openPopup({ windowId });
    return "popup";
  } catch {
    await dependencies.openWebInbox();
    return "web";
  }
}

export async function consumePopupRouteIntent(userId: string): Promise<PopupRouteIntent | null> {
  const value = normalizePopupRouteIntent(await storage.getItem(ROUTE_INTENT_KEY));
  await storage.removeItem(ROUTE_INTENT_KEY);
  if (!value || value.userId !== userId) return null;
  if (Date.now() - Date.parse(value.createdAt) > 5 * 60 * 1000) return null;
  return value;
}

export async function createRoomInviteNotificationMaintenanceAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(MAINTENANCE_ALARM);
  if (!existing) {
    await chrome.alarms.create(MAINTENANCE_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 24 * 60,
    });
  }
}

export function isRoomInviteNotificationMaintenanceAlarm(name: string): boolean {
  return name === MAINTENANCE_ALARM;
}

export async function handleAuthSessionChanged(
  previousTokens: ExtensionAuthTokens | null,
  currentTokens: ExtensionAuthTokens | null,
): Promise<void> {
  if (previousTokens?.user.id === currentTokens?.user.id) return;
  authSessionEpoch += 1;
  const expectedAuthSessionEpoch = authSessionEpoch;
  await enqueueNotificationWork(async () => {
    if (previousTokens && previousTokens.user.id !== currentTokens?.user.id) {
      await disableRoomInviteNotifications(previousTokens, { clearAccountState: true });
    }
  });
  if (currentTokens && authSessionEpoch === expectedAuthSessionEpoch) {
    await reconcileRoomInviteNotifications({ notify: true }).catch(() => undefined);
  }
}

function enqueueNotificationWork(work: () => Promise<void>): Promise<void> {
  const run = reconciliationQueue.catch(() => undefined).then(work);
  reconciliationQueue = run;
  return run;
}

async function isCurrentReconciliation(
  userId: string,
  expectedAuthSessionEpoch: number,
): Promise<boolean> {
  if (authSessionEpoch !== expectedAuthSessionEpoch) return false;
  const current = await getStoredAuthTokens();
  return current?.user.id === userId && authSessionEpoch === expectedAuthSessionEpoch;
}

function enqueueSubscriptionWork(work: () => Promise<void>): Promise<void> {
  const run = subscriptionQueue.catch(() => undefined).then(work);
  subscriptionQueue = run;
  return run;
}

async function ensureRegisteredPushSubscription(
  tokens: ExtensionAuthTokens,
  expectedAuthSessionEpoch: number,
): Promise<void> {
  if (!globalThis.registration?.pushManager) return;
  const applicationServerKey = base64UrlToUint8Array(WXT_VAPID_PUBLIC_KEY);
  let subscription = await globalThis.registration.pushManager.getSubscription();
  if (
    subscription &&
    !applicationServerKeyMatches(
      subscription.options.applicationServerKey,
      applicationServerKey,
    )
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await globalThis.registration.pushManager.subscribe({
      userVisibleOnly: false,
      applicationServerKey,
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("Chrome returned an incomplete push subscription");
  }

  const stored = normalizeStoredRegistration(await storage.getItem(REGISTRATION_KEY));
  if (stored?.userId === tokens.user.id && stored.endpoint === json.endpoint) return;

  const request: ExtensionPushSubscriptionRequest = {
    installationId: await extensionInstallationId(),
    endpoint: json.endpoint,
    expirationTime: subscription.expirationTime,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  const response = await registerPushSubscriptionFromApi(tokens.accessToken, request);
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) {
    await revokePushSubscriptionFromApi(tokens.accessToken, response.deviceId).catch(() => undefined);
    return;
  }
  await storage.setItem(REGISTRATION_KEY, {
    userId: tokens.user.id,
    deviceId: response.deviceId,
    endpoint: request.endpoint,
  } satisfies StoredRegistration);
}

async function registerPushSubscriptionFromApi(
  accessToken: string,
  request: ExtensionPushSubscriptionRequest,
) {
  return withInvitationHttpDeadline(async (signal) => {
    const response = await fetch(new URL("/api/devices/push-subscription", WEB_HTTP_BASE), {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) throw await pushHttpError(response, "Failed to enable notifications");
    return DevicePushSubscriptionResponseSchema.parse(await response.json());
  }, "PUSH_SUBSCRIPTION_TIMEOUT");
}

async function revokePushSubscriptionFromApi(accessToken: string, deviceId: string): Promise<void> {
  await withInvitationHttpDeadline(async (signal) => {
    const response = await fetch(
      new URL(`/api/devices/${encodeURIComponent(deviceId)}/push-subscription`, WEB_HTTP_BASE),
      { method: "DELETE", headers: createWebsiteRoomHeaders(accessToken), signal },
    );
    if (!response.ok && response.status !== 404) {
      throw await pushHttpError(response, "Failed to disable notifications");
    }
  }, "PUSH_SUBSCRIPTION_TIMEOUT");
}

async function pushHttpError(response: Response, fallback: string): Promise<RoomApiError> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return new RoomApiError(
    `${typeof body?.error === "string" ? body.error : fallback} (${response.status})`,
  );
}

async function notificationPreference(): Promise<boolean> {
  return (await storage.getItem<boolean>(PREFERENCE_KEY)) !== false;
}

async function extensionInstallationId(): Promise<string> {
  const existing = await storage.getItem<unknown>(INSTALLATION_ID_KEY);
  if (typeof existing === "string" && existing.trim()) return existing;
  const created = crypto.randomUUID();
  await storage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

async function containsNotificationsPermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ["notifications"] });
}

async function setInboxBadge(unseenCount: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: "#ff7a1a" });
  await chrome.action.setBadgeText({ text: unseenCount > 0 ? String(Math.min(unseenCount, 99)) : "" });
}

export async function updateInboxBadge(unseenCount: number): Promise<void> {
  await setInboxBadge(unseenCount);
}

function rememberedInboxItemsKey(userId: string): `local:${string}` {
  return `local:anidachi.roomInviteNotifications.notified.${encodeURIComponent(userId)}`;
}

async function getRememberedInboxItems(userId: string): Promise<RememberedInboxItems> {
  const value = await storage.getItem<unknown>(rememberedInboxItemsKey(userId));
  return normalizeRememberedInboxItems(value, userId);
}

export function normalizeRememberedInboxItems(
  value: unknown,
  userId: string,
): RememberedInboxItems {
  if (!value || typeof value !== "object") return { userId, itemKeys: [] };
  const stored = value as Partial<RememberedInboxItems & LegacyRememberedInvites>;
  if (stored.userId !== userId) return { userId, itemKeys: [] };
  if (Array.isArray(stored.itemKeys)) {
    return {
      userId,
      itemKeys: stored.itemKeys.filter((item): item is string => typeof item === "string"),
    };
  }
  return {
    userId,
    itemKeys: Array.isArray(stored.inviteIds)
      ? stored.inviteIds
          .filter((item): item is string => typeof item === "string")
          .map((inviteId) => `room-invite:${inviteId}`)
      : [],
  };
}

async function setRememberedInboxItems(userId: string, itemKeys: string[]): Promise<void> {
  await storage.setItem(rememberedInboxItemsKey(userId), { userId, itemKeys });
}

async function clearRememberedInboxItems(userId: string): Promise<void> {
  await storage.removeItem(rememberedInboxItemsKey(userId));
}

function normalizeStoredRegistration(value: unknown): StoredRegistration | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Partial<StoredRegistration>;
  if (
    typeof stored.userId !== "string" ||
    typeof stored.deviceId !== "string" ||
    typeof stored.endpoint !== "string"
  ) {
    return null;
  }
  return { userId: stored.userId, deviceId: stored.deviceId, endpoint: stored.endpoint };
}

function normalizePopupRouteIntent(value: unknown): PopupRouteIntent | null {
  if (!value || typeof value !== "object") return null;
  const intent = value as Partial<PopupRouteIntent>;
  if (
    typeof intent.userId !== "string" ||
    intent.tab !== "inbox" ||
    typeof intent.createdAt !== "string" ||
    !Number.isFinite(Date.parse(intent.createdAt))
  ) {
    return null;
  }
  return { userId: intent.userId, tab: "inbox", createdAt: intent.createdAt };
}

function base64UrlToUint8Array(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

export function applicationServerKeyMatches(
  current: ArrayBuffer | null,
  expected: ArrayBuffer,
): boolean {
  if (!current) return false;
  const currentBytes = new Uint8Array(current);
  const expectedBytes = new Uint8Array(expected);
  if (currentBytes.length !== expectedBytes.length) return false;
  return currentBytes.every((byte, index) => byte === expectedBytes[index]);
}

declare global {
  var registration: ServiceWorkerRegistration | undefined;
}
