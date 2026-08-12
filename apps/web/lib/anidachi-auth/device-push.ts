import type {
  DevicePushSubscriptionResponse,
  ExtensionPushSubscriptionRequest,
  InboxChangedPushPayload,
} from "@anidachi/protocol";
import type { PushSubscription, RequestOptions } from "web-push";
import webPush from "web-push";
import { NextResponse } from "next/server";
import { db } from "./db";

const INBOX_PUSH_TTL_SECONDS = 24 * 60 * 60;
const INBOX_PUSH_TOPIC = "inbox-sync";
const PUSH_REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONCURRENT_PUSH_REQUESTS = 8;
const MAX_ACTIVE_PUSH_DEVICES_PER_USER = 5;

export type VapidConfiguration = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export type EnabledDevicePushSubscription = {
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type DevicePushRegistration = {
  deviceId: string;
  updatedAt: string;
};

export interface DevicePushRepository {
  register(input: {
    ownerUserId: string;
    subscription: ExtensionPushSubscriptionRequest;
    nowIso: string;
  }): Promise<DevicePushRegistration>;
  revoke(input: { ownerUserId: string; deviceId: string; nowIso: string }): Promise<boolean>;
  listEnabledForUsers(userIds: readonly string[]): Promise<EnabledDevicePushSubscription[]>;
  markDelivered(deviceId: string): Promise<void>;
  markPermanentFailure(deviceId: string, error: string, nowIso: string): Promise<void>;
  markTransientFailure(deviceId: string, error: string): Promise<void>;
}

export class DevicePushApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DevicePushApiError";
  }
}

export function devicePushErrorResponse(error: unknown): NextResponse {
  if (error instanceof DevicePushApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[anidachi/device-push] Unexpected API error");
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function readVapidConfiguration(
  environment: Record<string, string | undefined> = process.env,
): VapidConfiguration | null {
  const subject = environment.ANIDACHI_VAPID_SUBJECT?.trim();
  const publicKey = environment.ANIDACHI_VAPID_PUBLIC_KEY?.trim();
  const privateKey = environment.ANIDACHI_VAPID_PRIVATE_KEY?.trim();
  if (!subject && !publicKey && !privateKey) return null;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("Web Push VAPID configuration is incomplete");
  }
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    throw new Error("Web Push VAPID subject must be a mailto or HTTPS URL");
  }
  return { subject, publicKey, privateKey };
}

export async function registerDevicePushSubscription(
  params: {
    ownerUserId: string;
    subscription: ExtensionPushSubscriptionRequest;
    now?: Date;
  },
  repository: DevicePushRepository = defaultDevicePushRepository,
): Promise<DevicePushSubscriptionResponse> {
  if (!isAllowedChromePushEndpoint(params.subscription.endpoint)) {
    throw new DevicePushApiError(400, "Unsupported push subscription endpoint");
  }
  const registration = await repository.register({
    ownerUserId: params.ownerUserId,
    subscription: params.subscription,
    nowIso: (params.now ?? new Date()).toISOString(),
  });
  return {
    deviceId: registration.deviceId,
    notificationsEnabled: true,
    updatedAt: registration.updatedAt,
  };
}

export function isAllowedChromePushEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === "https:" &&
      endpoint.hostname === "fcm.googleapis.com" &&
      endpoint.port === "" &&
      endpoint.username === "" &&
      endpoint.password === ""
    );
  } catch {
    return false;
  }
}

export async function revokeDevicePushSubscription(
  params: { ownerUserId: string; deviceId: string; now?: Date },
  repository: DevicePushRepository = defaultDevicePushRepository,
): Promise<void> {
  const revoked = await repository.revoke({
    ownerUserId: params.ownerUserId,
    deviceId: params.deviceId,
    nowIso: (params.now ?? new Date()).toISOString(),
  });
  if (!revoked) throw new DevicePushApiError(404, "Push subscription not found");
}

type PushSend = (
  subscription: PushSubscription,
  payload: string,
  options: RequestOptions,
) => Promise<unknown>;

export type InboxPushDeliverySummary = {
  attempted: number;
  delivered: number;
  pruned: number;
  failed: number;
};

export async function deliverInboxChangedPush(params: {
  subscriptions: readonly EnabledDevicePushSubscription[];
  vapid: VapidConfiguration;
  send: PushSend;
  markDelivered: (deviceId: string) => Promise<void>;
  markPermanentFailure: (deviceId: string, error: string) => Promise<void>;
  markTransientFailure: (deviceId: string, error: string) => Promise<void>;
}): Promise<InboxPushDeliverySummary> {
  const subscriptions = limitActiveSubscriptionsPerUser(params.subscriptions);
  const payload: InboxChangedPushPayload = { type: "inbox_changed" };
  const summary: InboxPushDeliverySummary = {
    attempted: subscriptions.length,
    delivered: 0,
    pruned: 0,
    failed: 0,
  };

  await mapWithConcurrency(
    subscriptions,
    MAX_CONCURRENT_PUSH_REQUESTS,
    async (device) => {
      if (!isAllowedChromePushEndpoint(device.endpoint)) {
        summary.pruned += 1;
        await params
          .markPermanentFailure(device.deviceId, "invalid_endpoint")
          .catch(() => undefined);
        return;
      }
      try {
        await params.send(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          JSON.stringify(payload),
          {
            TTL: INBOX_PUSH_TTL_SECONDS,
            urgency: "normal",
            topic: INBOX_PUSH_TOPIC,
            contentEncoding: "aes128gcm",
            timeout: PUSH_REQUEST_TIMEOUT_MS,
            vapidDetails: params.vapid,
          },
        );
        summary.delivered += 1;
        await params.markDelivered(device.deviceId).catch(() => undefined);
      } catch (error) {
        const status = pushErrorStatus(error);
        if (status === 404 || status === 410) {
          summary.pruned += 1;
          await params
            .markPermanentFailure(device.deviceId, `http_${status}`)
            .catch(() => undefined);
          return;
        }

        summary.failed += 1;
        await params
          .markTransientFailure(
            device.deviceId,
            status ? `http_${status}` : "network_error",
          )
          .catch(() => undefined);
      }
    },
  );

  return summary;
}

function limitActiveSubscriptionsPerUser(
  subscriptions: readonly EnabledDevicePushSubscription[],
): EnabledDevicePushSubscription[] {
  const countByUser = new Map<string, number>();
  return subscriptions.filter((subscription) => {
    const count = countByUser.get(subscription.userId) ?? 0;
    if (count >= MAX_ACTIVE_PUSH_DEVICES_PER_USER) return false;
    countByUser.set(subscription.userId, count + 1);
    return true;
  });
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  visit: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        if (item !== undefined) await visit(item);
      }
    },
  );
  await Promise.all(workers);
}

export async function sendInboxChangedPushToUsers(
  recipientUserIds: readonly string[],
  options: {
    environment?: Record<string, string | undefined>;
    repository?: DevicePushRepository;
    send?: PushSend;
    now?: Date;
  } = {},
): Promise<InboxPushDeliverySummary> {
  const vapid = readVapidConfiguration(options.environment);
  if (!vapid) return { attempted: 0, delivered: 0, pruned: 0, failed: 0 };

  const repository = options.repository ?? defaultDevicePushRepository;
  const userIds = [...new Set(recipientUserIds)];
  if (userIds.length === 0) {
    return { attempted: 0, delivered: 0, pruned: 0, failed: 0 };
  }
  const subscriptions = await repository.listEnabledForUsers(userIds);
  const nowIso = (options.now ?? new Date()).toISOString();
  return deliverInboxChangedPush({
    subscriptions,
    vapid,
    send: options.send ?? ((...args) => webPush.sendNotification(...args)),
    markDelivered: (deviceId) => repository.markDelivered(deviceId),
    markPermanentFailure: (deviceId, error) =>
      repository.markPermanentFailure(deviceId, error, nowIso),
    markTransientFailure: (deviceId, error) =>
      repository.markTransientFailure(deviceId, error),
  });
}

function pushErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  return typeof error.statusCode === "number" ? error.statusCode : null;
}

type DevicePushRow = {
  id: string;
  push_subscription_updated_at: string;
};

type DevicePushIdentityRow = {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
};

type EnabledDevicePushRow = {
  id: string;
  user_id: string;
  push_endpoint: string | null;
  push_p256dh: string | null;
  push_auth: string | null;
};

const defaultDevicePushRepository: DevicePushRepository = {
  async register({ ownerUserId, subscription, nowIso }) {
    const client = db();
    const existingByInstallation = await client
      .from("devices")
      .select("id,user_id,notifications_enabled")
      .eq("extension_installation_id", subscription.installationId)
      .maybeSingle();
    if (existingByInstallation.error) {
      throw new Error(
        `Failed to load extension device: ${existingByInstallation.error.message}`,
      );
    }
    const existingByEndpoint = existingByInstallation.data
      ? null
      : await client
          .from("devices")
          .select("id,user_id,notifications_enabled")
          .eq("push_endpoint", subscription.endpoint)
          .maybeSingle();
    if (existingByEndpoint?.error) {
      throw new Error(`Failed to load push device: ${existingByEndpoint.error.message}`);
    }
    const existing = (existingByInstallation.data ??
      existingByEndpoint?.data ??
      null) as DevicePushIdentityRow | null;

    const needsActiveDeviceSlot =
      !existing || existing.user_id !== ownerUserId || !existing.notifications_enabled;
    if (needsActiveDeviceSlot) {
      const activeDevices = await client
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerUserId)
        .eq("notifications_enabled", true)
        .is("revoked_at", null);
      if (activeDevices.error) {
        throw new Error(`Failed to count push devices: ${activeDevices.error.message}`);
      }
      if ((activeDevices.count ?? 0) >= MAX_ACTIVE_PUSH_DEVICES_PER_USER) {
        throw new DevicePushApiError(429, "Too many active notification devices");
      }
    }

    const values = {
      user_id: ownerUserId,
      extension_installation_id: subscription.installationId,
      push_endpoint: subscription.endpoint,
      push_p256dh: subscription.keys.p256dh,
      push_auth: subscription.keys.auth,
      push_expiration_at:
        subscription.expirationTime === null
          ? null
          : new Date(subscription.expirationTime).toISOString(),
      push_subscription_updated_at: nowIso,
      notifications_enabled: true,
      revoked_at: null,
      last_delivery_error: null,
      last_seen_at: nowIso,
    };
    let result = existing
      ? await client
          .from("devices")
          .update(values)
          .eq("id", existing.id)
          .select("id,push_subscription_updated_at")
          .single()
      : await client
          .from("devices")
          .insert(values)
          .select("id,push_subscription_updated_at")
          .single();
    if (!existing && result.error?.code === "23505") {
      const raced = await client
        .from("devices")
        .select("id,user_id,notifications_enabled")
        .eq("extension_installation_id", subscription.installationId)
        .maybeSingle();
      if (raced.error) {
        throw new Error(`Failed to resolve concurrent device registration`);
      }
      const racedByEndpoint = raced.data
        ? null
        : await client
            .from("devices")
            .select("id,user_id,notifications_enabled")
            .eq("push_endpoint", subscription.endpoint)
            .maybeSingle();
      const racedDevice = raced.data ?? racedByEndpoint?.data ?? null;
      if (racedByEndpoint?.error || !racedDevice) {
        throw new Error(`Failed to resolve concurrent device registration`);
      }
      result = await client
        .from("devices")
        .update(values)
        .eq("id", (racedDevice as DevicePushIdentityRow).id)
        .select("id,push_subscription_updated_at")
        .single();
    }
    if (result.error) {
      throw new Error(`Failed to register push subscription: ${result.error.message}`);
    }
    const row = result.data as DevicePushRow;
    return { deviceId: row.id, updatedAt: row.push_subscription_updated_at };
  },

  async revoke({ ownerUserId, deviceId, nowIso }) {
    const { data, error } = await db()
      .from("devices")
      .update({
        push_endpoint: null,
        push_p256dh: null,
        push_auth: null,
        push_expiration_at: null,
        push_subscription_updated_at: nowIso,
        notifications_enabled: false,
        revoked_at: nowIso,
        last_delivery_error: null,
        last_seen_at: nowIso,
      })
      .eq("id", deviceId)
      .eq("user_id", ownerUserId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`Failed to revoke push subscription: ${error.message}`);
    return Boolean(data);
  },

  async listEnabledForUsers(userIds) {
    if (userIds.length === 0) return [];
    const { data, error } = await db()
      .from("devices")
      .select("id,user_id,push_endpoint,push_p256dh,push_auth")
      .in("user_id", [...userIds])
      .eq("notifications_enabled", true)
      .is("revoked_at", null)
      .not("push_endpoint", "is", null)
      .not("push_p256dh", "is", null)
      .not("push_auth", "is", null);
    if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`);

    return ((data as EnabledDevicePushRow[] | null) ?? []).flatMap((row) =>
      row.push_endpoint && row.push_p256dh && row.push_auth
        ? [
            {
              userId: row.user_id,
              deviceId: row.id,
              endpoint: row.push_endpoint,
              p256dh: row.push_p256dh,
              auth: row.push_auth,
            },
          ]
        : [],
    );
  },

  async markDelivered(deviceId) {
    const { error } = await db()
      .from("devices")
      .update({ last_delivery_error: null })
      .eq("id", deviceId);
    if (error) throw new Error(`Failed to clear push delivery error: ${error.message}`);
  },

  async markPermanentFailure(deviceId, errorCode, nowIso) {
    const { error } = await db()
      .from("devices")
      .update({
        push_endpoint: null,
        push_p256dh: null,
        push_auth: null,
        push_expiration_at: null,
        notifications_enabled: false,
        revoked_at: nowIso,
        last_delivery_error: errorCode,
      })
      .eq("id", deviceId);
    if (error) throw new Error(`Failed to prune push subscription: ${error.message}`);
  },

  async markTransientFailure(deviceId, errorCode) {
    const { error } = await db()
      .from("devices")
      .update({ last_delivery_error: errorCode })
      .eq("id", deviceId);
    if (error) throw new Error(`Failed to record push delivery error: ${error.message}`);
  },
};
