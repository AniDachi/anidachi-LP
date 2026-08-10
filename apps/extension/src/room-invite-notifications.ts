import {
  type AccountInboxResponse,
  DevicePushSubscriptionResponseSchema,
  type ExtensionPushSubscriptionRequest,
  InboxChangedPushPayloadSchema,
} from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import { listAccountInboxFromApi } from "./account-inbox-client";
import { setCachedAccountInboxForUser } from "./account-inbox-cache";
import { getCurrentExtensionSession } from "./auth-client";
import type { ExtensionAuthTokens } from "./auth-tokens";
import { WEB_HTTP_BASE, WXT_VAPID_PUBLIC_KEY } from "./constants";
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
let authSessionEpoch = 0;

type RememberedInvites = { userId: string; inviteIds: string[] };
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

export type RoomInviteNotificationPlan = {
  title: string;
  message: string;
  inviteIds: string[];
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

type ExtensionPushEvent = {
  data?: { text: () => string } | null;
};

export function buildRoomInviteNotificationPlan(
  inbox: AccountInboxResponse,
  rememberedInviteIds: readonly string[] = [],
): RoomInviteNotificationPlan | null {
  const remembered = new Set(rememberedInviteIds);
  const invitations = inbox.items.filter(
    (item): item is AccountInboxRoomInvite =>
      item.kind === "room-invite" && item.seenAt === null,
  );
  if (
    invitations.length === 0 ||
    !invitations.some((invitation) => !remembered.has(invitation.inviteId))
  ) {
    return null;
  }

  if (invitations.length > 1) {
    return {
      title: `${invitations.length} watch invitations`,
      message: "Open AniDachi to view them.",
      inviteIds: invitations.map((item) => item.inviteId),
    };
  }

  const invitation = invitations[0];
  if (!invitation) return null;
  if (invitation.state === "missed") {
    return {
      title: `You missed a watch invitation from ${invitation.sender.displayName}`,
      message: "Open AniDachi to view it.",
      inviteIds: [invitation.inviteId],
    };
  }
  return {
    title:
      invitation.targetKind === "group"
        ? `${invitation.sender.displayName} invited you to watch with a group`
        : `${invitation.sender.displayName} invited you to watch together`,
    message: "Open AniDachi to view the invitation.",
    inviteIds: [invitation.inviteId],
  };
}

export function pruneRememberedRoomInviteIds(
  inbox: AccountInboxResponse,
  rememberedInviteIds: readonly string[],
): string[] {
  const currentIds = new Set(
    inbox.items
      .filter(
        (item): item is AccountInboxRoomInvite =>
          item.kind === "room-invite" && item.seenAt === null,
      )
      .map((item) => item.inviteId),
  );
  return rememberedInviteIds.filter((inviteId) => currentIds.has(inviteId));
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
        await reconcileRoomInviteNotificationsNow({ notify: false }, expectedAuthSessionEpoch);
      });
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
  const expectedAuthSessionEpoch = authSessionEpoch;
  return enqueueNotificationWork(() =>
    reconcileRoomInviteNotificationsNow(options, expectedAuthSessionEpoch),
  );
}

async function reconcileRoomInviteNotificationsNow(
  options: { notify: boolean },
  expectedAuthSessionEpoch: number,
): Promise<void> {
  if (authSessionEpoch !== expectedAuthSessionEpoch) return;
  const tokens = await getCurrentExtensionSession().catch(() => null);
  if (!tokens) {
    await disableRoomInviteNotifications(null, { clearAccountState: true });
    return;
  }

  const preference = await notificationPreference();
  const permissionGranted = await containsNotificationsPermission();
  if (preference && permissionGranted && WXT_VAPID_PUBLIC_KEY) {
    await ensureRegisteredPushSubscription(tokens);
  } else {
    await disableRoomInviteNotifications(tokens);
  }
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;

  const inbox = await listAccountInboxFromApi(tokens.accessToken);
  if (inbox.meta.ownerUserId !== tokens.user.id) {
    throw new Error("Inbox response belongs to another account");
  }
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  if (!(await setCachedAccountInboxForUser(tokens.user.id, inbox))) return;
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  await setInboxBadge(inbox.counts.unseen);
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;

  const remembered = await getRememberedInvites(tokens.user.id);
  const pruned = pruneRememberedRoomInviteIds(inbox, remembered.inviteIds);
  const canDisplayNotification =
    options.notify &&
    preference &&
    permissionGranted &&
    Boolean(chrome.notifications);
  if (canDisplayNotification) {
    const plan = buildRoomInviteNotificationPlan(inbox, pruned);
    if (plan) {
      if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
      await chrome.notifications.create(NOTIFICATION_ID, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON),
        title: plan.title,
        message: plan.message,
        priority: 1,
      });
      pruned.push(...plan.inviteIds);
    }
  }
  if (!(await isCurrentReconciliation(tokens.user.id, expectedAuthSessionEpoch))) return;
  await setRememberedInvites(tokens.user.id, [...new Set(pruned)]);
}

export async function handleRoomInvitePush(event: ExtensionPushEvent): Promise<void> {
  if (!parseInboxChangedPushPayload(event.data?.text() ?? null)) return;
  await reconcileRoomInviteNotifications({ notify: true });
}

export async function disableRoomInviteNotifications(
  tokens?: ExtensionAuthTokens | null,
  options: { clearAccountState?: boolean } = {},
): Promise<void> {
  const session = tokens === undefined ? await getCurrentExtensionSession().catch(() => null) : tokens;
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
    if (accountId) await clearRememberedInvites(accountId);
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
    await reconcileRoomInviteNotificationsNow({ notify: false }, expectedAuthSessionEpoch);
  });
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
  authSessionEpoch += 1;
  const expectedAuthSessionEpoch = authSessionEpoch;
  await enqueueNotificationWork(async () => {
    if (previousTokens && previousTokens.user.id !== currentTokens?.user.id) {
      await disableRoomInviteNotifications(previousTokens, { clearAccountState: true });
    }
    if (currentTokens && previousTokens?.user.id !== currentTokens.user.id) {
      await reconcileRoomInviteNotificationsNow({ notify: true }, expectedAuthSessionEpoch).catch(
        () => undefined,
      );
    }
  });
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
  const current = await getCurrentExtensionSession().catch(() => null);
  return current?.user.id === userId && authSessionEpoch === expectedAuthSessionEpoch;
}

async function ensureRegisteredPushSubscription(tokens: ExtensionAuthTokens): Promise<void> {
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
  const response = await registerPushSubscriptionFromApi(tokens.accessToken, request);
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
  const response = await fetch(new URL("/api/devices/push-subscription", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await pushHttpError(response, "Failed to enable notifications");
  return DevicePushSubscriptionResponseSchema.parse(await response.json());
}

async function revokePushSubscriptionFromApi(accessToken: string, deviceId: string): Promise<void> {
  const response = await fetch(
    new URL(`/api/devices/${encodeURIComponent(deviceId)}/push-subscription`, WEB_HTTP_BASE),
    { method: "DELETE", headers: createWebsiteRoomHeaders(accessToken) },
  );
  if (!response.ok && response.status !== 404) {
    throw await pushHttpError(response, "Failed to disable notifications");
  }
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

function rememberedInvitesKey(userId: string): `local:${string}` {
  return `local:anidachi.roomInviteNotifications.notified.${encodeURIComponent(userId)}`;
}

async function getRememberedInvites(userId: string): Promise<RememberedInvites> {
  const value = await storage.getItem<unknown>(rememberedInvitesKey(userId));
  if (!value || typeof value !== "object") return { userId, inviteIds: [] };
  const stored = value as Partial<RememberedInvites>;
  if (stored.userId !== userId || !Array.isArray(stored.inviteIds)) {
    return { userId, inviteIds: [] };
  }
  return {
    userId,
    inviteIds: stored.inviteIds.filter((item): item is string => typeof item === "string"),
  };
}

async function setRememberedInvites(userId: string, inviteIds: string[]): Promise<void> {
  await storage.setItem(rememberedInvitesKey(userId), { userId, inviteIds });
}

async function clearRememberedInvites(userId: string): Promise<void> {
  await storage.removeItem(rememberedInvitesKey(userId));
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
