import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionPushSubscriptionRequest } from "@anidachi/protocol";
import {
  deliverInboxChangedPush,
  DevicePushApiError,
  readVapidConfiguration,
  registerDevicePushSubscription,
  revokeDevicePushSubscription,
  type DevicePushRepository,
} from "./device-push";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-08-10T08:00:00.000Z");

const subscription: ExtensionPushSubscriptionRequest = {
  installationId: INSTALLATION_ID,
  endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
  expirationTime: null,
  keys: {
    p256dh:
      "BEl62iUYgUivxIkv69yViEuiBIa40HIhZbGzOCh6vTZMeYKv4A6eQHHuQNaO8h-SS5kxtR7U7I3F4R5y6T7u8V9",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
  },
};

test("VAPID configuration is either complete or unavailable", () => {
  assert.equal(readVapidConfiguration({}), null);
  assert.deepEqual(
    readVapidConfiguration({
      ANIDACHI_VAPID_SUBJECT: "mailto:notifications@anidachi.app",
      ANIDACHI_VAPID_PUBLIC_KEY: "public-key",
      ANIDACHI_VAPID_PRIVATE_KEY: "private-key",
    }),
    {
      subject: "mailto:notifications@anidachi.app",
      publicKey: "public-key",
      privateKey: "private-key",
    },
  );
  assert.throws(
    () => readVapidConfiguration({ ANIDACHI_VAPID_PUBLIC_KEY: "public-key" }),
    /incomplete/i,
  );
});

test("registering a subscription returns the canonical device acknowledgement", async () => {
  const repository = fakeRepository();
  let registered: Parameters<DevicePushRepository["register"]>[0] | null = null;
  repository.register = async (value) => {
    registered = value;
    return { deviceId: DEVICE_ID, updatedAt: NOW.toISOString() };
  };

  const response = await registerDevicePushSubscription(
    { ownerUserId: USER_ID, subscription, now: NOW },
    repository,
  );

  assert.deepEqual(registered, {
    ownerUserId: USER_ID,
    subscription,
    nowIso: NOW.toISOString(),
  });
  assert.deepEqual(response, {
    deviceId: DEVICE_ID,
    notificationsEnabled: true,
    updatedAt: NOW.toISOString(),
  });
});

test("registration rejects endpoints outside Chrome's push service", async () => {
  await assert.rejects(
    registerDevicePushSubscription(
      {
        ownerUserId: USER_ID,
        subscription: { ...subscription, endpoint: "https://127.0.0.1/internal" },
        now: NOW,
      },
      fakeRepository(),
    ),
    (error) => error instanceof DevicePushApiError && error.status === 400,
  );
});

test("revoking a subscription is owner-bound and idempotent for a known device", async () => {
  const repository = fakeRepository();
  repository.revoke = async () => true;
  await assert.doesNotReject(
    revokeDevicePushSubscription(
      { ownerUserId: USER_ID, deviceId: DEVICE_ID, now: NOW },
      repository,
    ),
  );

  repository.revoke = async () => false;
  await assert.rejects(
    revokeDevicePushSubscription(
      { ownerUserId: USER_ID, deviceId: DEVICE_ID, now: NOW },
      repository,
    ),
    (error) => error instanceof DevicePushApiError && error.status === 404,
  );
});

test("inbox invalidation delivery handles every device without exposing invite data", async () => {
  const delivered: string[] = [];
  const pruned: string[] = [];
  const failed: Array<{ deviceId: string; error: string }> = [];
  const sends: Array<{ payload: string; options: Record<string, unknown> }> = [];
  const subscriptions = [
    pushDevice("device-ok", "https://fcm.googleapis.com/fcm/send/ok"),
    pushDevice("device-gone", "https://fcm.googleapis.com/fcm/send/gone"),
    pushDevice("device-retry", "https://fcm.googleapis.com/fcm/send/retry"),
  ];

  const summary = await deliverInboxChangedPush({
    subscriptions,
    vapid: {
      subject: "mailto:notifications@anidachi.app",
      publicKey: "public-key",
      privateKey: "private-key",
    },
    send: async (_subscription, payload, options) => {
      sends.push({ payload, options: options as Record<string, unknown> });
      const endpoint = _subscription.endpoint;
      if (endpoint.endsWith("/gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (endpoint.endsWith("/retry")) throw new Error("socket included sensitive details");
    },
    markDelivered: async (deviceId) => {
      delivered.push(deviceId);
    },
    markPermanentFailure: async (deviceId) => {
      pruned.push(deviceId);
    },
    markTransientFailure: async (deviceId, error) => {
      failed.push({ deviceId, error });
    },
  });

  assert.deepEqual(summary, { attempted: 3, delivered: 1, pruned: 1, failed: 1 });
  assert.deepEqual(delivered, ["device-ok"]);
  assert.deepEqual(pruned, ["device-gone"]);
  assert.deepEqual(failed, [{ deviceId: "device-retry", error: "network_error" }]);
  assert.equal(sends.length, 3);
  for (const send of sends) {
    assert.equal(send.payload, JSON.stringify({ type: "inbox_changed" }));
    assert.equal(send.options.TTL, 86_400);
    assert.equal(send.options.urgency, "normal");
    assert.equal(send.options.topic, "inbox-sync");
    assert.equal(send.options.timeout, 10_000);
    assert.deepEqual(send.options.vapidDetails, {
      subject: "mailto:notifications@anidachi.app",
      publicKey: "public-key",
      privateKey: "private-key",
    });
  }
});

test("delivery prunes an invalid stored endpoint without making a network request", async () => {
  let sends = 0;
  const pruned: Array<{ deviceId: string; error: string }> = [];
  const summary = await deliverInboxChangedPush({
    subscriptions: [pushDevice("device-invalid", "https://localhost/push")],
    vapid: {
      subject: "mailto:notifications@anidachi.app",
      publicKey: "public-key",
      privateKey: "private-key",
    },
    send: async () => {
      sends += 1;
    },
    markDelivered: async () => undefined,
    markPermanentFailure: async (deviceId, error) => {
      pruned.push({ deviceId, error });
    },
    markTransientFailure: async () => undefined,
  });

  assert.deepEqual(summary, { attempted: 1, delivered: 0, pruned: 1, failed: 0 });
  assert.equal(sends, 0);
  assert.deepEqual(pruned, [{ deviceId: "device-invalid", error: "invalid_endpoint" }]);
});

test("delivery caps active devices per account", async () => {
  let sends = 0;
  const summary = await deliverInboxChangedPush({
    subscriptions: Array.from({ length: 7 }, (_, index) =>
      pushDevice(`device-${index}`, `https://fcm.googleapis.com/fcm/send/${index}`),
    ),
    vapid: {
      subject: "mailto:notifications@anidachi.app",
      publicKey: "public-key",
      privateKey: "private-key",
    },
    send: async () => {
      sends += 1;
    },
    markDelivered: async () => undefined,
    markPermanentFailure: async () => undefined,
    markTransientFailure: async () => undefined,
  });

  assert.deepEqual(summary, { attempted: 5, delivered: 5, pruned: 0, failed: 0 });
  assert.equal(sends, 5);
});

function pushDevice(deviceId: string, endpoint: string) {
  return {
    userId: USER_ID,
    deviceId,
    endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  };
}

function fakeRepository(): DevicePushRepository {
  return {
    register: async () => ({ deviceId: DEVICE_ID, updatedAt: NOW.toISOString() }),
    revoke: async () => true,
    listEnabledForUsers: async () => [],
    markDelivered: async () => undefined,
    markPermanentFailure: async () => undefined,
    markTransientFailure: async () => undefined,
  };
}
