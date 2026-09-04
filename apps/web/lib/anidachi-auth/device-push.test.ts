import assert from "node:assert/strict";
import test from "node:test";
import { createECDH, randomBytes } from "node:crypto";
import webPush from "web-push";
import type { ExtensionPushSubscriptionRequest } from "@anidachi/protocol";
import {
  deferInboxChangedPushToUsers,
  deliverInboxChangedPush,
  deliverAccountInboxChanged,
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

test("deferred inbox invalidation sends once to unique recipients", async () => {
  const jobs: Array<() => Promise<void>> = [];
  const deliveries: string[][] = [];

  const scheduled = deferInboxChangedPushToUsers([USER_ID, USER_ID], (job) => jobs.push(job), {
    deliver: async (recipientUserIds) => {
      deliveries.push([...recipientUserIds]);
      return { attempted: 1, delivered: 1, pruned: 0, failed: 0 };
    },
  });

  assert.equal(scheduled, true);
  assert.equal(jobs.length, 1);
  assert.deepEqual(deliveries, []);

  await jobs[0]?.();
  assert.deepEqual(deliveries, [[USER_ID]]);
});

test("deferred inbox invalidation contains delivery failures after the durable write", async () => {
  const jobs: Array<() => Promise<void>> = [];
  const errors: string[] = [];

  deferInboxChangedPushToUsers([USER_ID], (job) => jobs.push(job), {
    deliver: async () => {
      throw new Error("provider returned private details");
    },
    reportError: (message) => errors.push(message),
  });

  await assert.doesNotReject(jobs[0]?.());
  assert.deepEqual(errors, ["Failed to deliver inbox invalidation"]);
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

test("outbox delivery distinguishes provider acceptance, retry, gone and permanent failures", async () => {
  const repo = fakeRepository();
  repo.listEnabledForUsers = async () => [
    pushDevice("ok", "https://fcm.googleapis.com/ok"),
    pushDevice("gone", "https://fcm.googleapis.com/gone"),
    pushDevice("rate", "https://fcm.googleapis.com/rate"),
    pushDevice("forbidden", "https://fcm.googleapis.com/forbidden"),
  ];
  const result = await deliverAccountInboxChanged(USER_ID, {
    repository: repo,
    environment: vapidEnvironment(),
    now: () => NOW.getTime(),
    send: async (device, payload, options) => {
      assert.equal(payload, '{"type":"inbox_changed"}');
      assert.equal(options.timeout, 10000);
      if (device.endpoint.endsWith("gone")) throw { statusCode: 410 };
      if (device.endpoint.endsWith("rate"))
        throw { statusCode: 429, headers: { "retry-after": "120" } };
      if (device.endpoint.endsWith("forbidden")) throw { statusCode: 403 };
    },
  });
  assert.equal(result.providerAccepted, 1);
  assert.equal(result.pruned, 1);
  assert.equal(result.failed, 2);
  assert.equal(result.outcome, "retry");
  assert.equal(result.retryAfterSeconds, 120);
  assert.equal("delivered" in result, false);
});

test("missing or incomplete VAPID is observable unavailable work, never a no-device success", async () => {
  for (const environment of [{}, { ANIDACHI_VAPID_PUBLIC_KEY: "incomplete" }]) {
    const repository = fakeRepository();
    repository.listEnabledForUsers = async () => [
      pushDevice(DEVICE_ID, "https://fcm.googleapis.com/live"),
    ];
    const result = await deliverAccountInboxChanged(USER_ID, {
      repository,
      environment,
    });
    assert.equal(result.outcome, "retry");
    assert.equal(result.errorCode, "configuration_unavailable");
    assert.equal(result.noDevices, false);
  }
});

test("confirmed no-device accounts complete independently of VAPID availability", async () => {
  const result = await deliverAccountInboxChanged(USER_ID, {
    repository: fakeRepository(),
    environment: {},
  });
  assert.equal(result.noDevices, true);
  assert.equal(result.outcome, "complete");
});

test("late delivery bookkeeping is fenced to the originally sent account and endpoint", async () => {
  const repo = fakeRepository();
  const original = pushDevice(DEVICE_ID, "https://fcm.googleapis.com/old");
  const current = { ...original };
  repo.listEnabledForUsers = async () => [{ ...original }];
  repo.markPermanentFailure = async (id, _code, _time, expected) => {
    if (
      id === current.deviceId &&
      expected.userId === current.userId &&
      expected.endpoint === current.endpoint
    ) {
      current.endpoint = "";
    }
  };
  await deliverAccountInboxChanged(USER_ID, {
    repository: repo,
    environment: vapidEnvironment(),
    send: async () => {
      current.userId = "44444444-4444-4444-8444-444444444444";
      current.endpoint = "https://fcm.googleapis.com/rotated";
      throw { statusCode: 410 };
    },
  });
  assert.equal(current.endpoint, "https://fcm.googleapis.com/rotated");
});

test("Retry-After HTTP dates and long cooldowns never become an early retry", async () => {
  for (const [header, want] of [
    ["Mon, 10 Aug 2026 08:05:00 GMT", 300],
    ["999999999", 86400],
  ] as const) {
    const repo = fakeRepository();
    repo.listEnabledForUsers = async () => [
      pushDevice(DEVICE_ID, "https://fcm.googleapis.com/rate"),
    ];
    const result = await deliverAccountInboxChanged(USER_ID, {
      repository: repo,
      environment: vapidEnvironment(),
      now: () => NOW.getTime(),
      send: async () => {
        throw { statusCode: 429, headers: { "retry-after": header } };
      },
    });
    assert.equal(result.retryAfterSeconds, want);
    assert.equal(result.outcome, "retry");
  }
});

function vapidEnvironment() {
  return {
    ANIDACHI_VAPID_SUBJECT: "mailto:test@example.test",
    ANIDACHI_VAPID_PUBLIC_KEY: "public",
    ANIDACHI_VAPID_PRIVATE_KEY: "private",
  };
}

test("production bookkeeping queries cannot prune or update a rotated subscription", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://outbox-db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  for (const providerStatus of [201, 410, 403]) {
    const state = {
      userId: USER_ID,
      endpoint: "https://fcm.googleapis.com/original",
      error: "new-device-state",
    };
    t.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "outbox-db.example.test");
        if (init?.method === "GET")
          return Response.json([
            {
              id: DEVICE_ID,
              user_id: state.userId,
              push_endpoint: state.endpoint,
              push_p256dh: "key",
              push_auth: "auth",
            },
          ]);
        assert.equal(init?.method, "PATCH");
        if (
          url.searchParams.get("id") === `eq.${DEVICE_ID}` &&
          (!url.searchParams.has("user_id") ||
            url.searchParams.get("user_id") === `eq.${state.userId}`) &&
          (!url.searchParams.has("push_endpoint") ||
            url.searchParams.get("push_endpoint") === `eq.${state.endpoint}`)
        ) {
          state.error = "clobbered";
        }
        return new Response(null, { status: 204 });
      },
    );
    await deliverAccountInboxChanged(USER_ID, {
      environment: vapidEnvironment(),
      send: async () => {
        state.userId = "44444444-4444-4444-8444-444444444444";
        state.endpoint = "https://fcm.googleapis.com/rotated";
        if (providerStatus !== 201) throw { statusCode: providerStatus };
      },
    });
    assert.equal(state.error, "new-device-state");
    t.mock.restoreAll();
  }
});

test("permanent provider rejection is terminal without pruning a live endpoint", async () => {
  const repository = fakeRepository();
  repository.listEnabledForUsers = async () => [
    pushDevice(DEVICE_ID, "https://fcm.googleapis.com/live"),
  ];
  let pruned = false;
  repository.markPermanentFailure = async () => {
    pruned = true;
  };
  const result = await deliverAccountInboxChanged(USER_ID, {
    repository,
    environment: vapidEnvironment(),
    send: async () => {
      throw { statusCode: 401 };
    },
  });
  assert.equal(result.outcome, "permanent");
  assert.equal(result.providerAccepted, 0);
  assert.equal(result.errorCode, "http_401");
  assert.equal(pruned, false);
});

test("a provider that never settles becomes retryable within the ten-second timeout", async () => {
  const repository = fakeRepository();
  repository.listEnabledForUsers = async () => [
    pushDevice(DEVICE_ID, "https://fcm.googleapis.com/hanging"),
  ];
  const started = Date.now();
  const result = await deliverAccountInboxChanged(USER_ID, {
    repository,
    environment: vapidEnvironment(),
    send: () => new Promise(() => undefined),
  });
  assert.equal(result.outcome, "retry");
  assert.equal(result.providerAccepted, 0);
  assert.ok(Date.now() - started < 12000);
});

function encryptedDeliveryFixture() {
  const vapid = webPush.generateVAPIDKeys();
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const repository = fakeRepository();
  repository.listEnabledForUsers = async () => [
    {
      ...pushDevice(DEVICE_ID, "https://fcm.googleapis.com/transport-test"),
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  ];
  return {
    repository,
    environment: {
      ANIDACHI_VAPID_SUBJECT: "mailto:test@example.test",
      ANIDACHI_VAPID_PUBLIC_KEY: vapid.publicKey,
      ANIDACHI_VAPID_PRIVATE_KEY: vapid.privateKey,
    },
  };
}

test("actual encrypted transport uses abortable fetch, disallows redirects, and honors provider status", async (t) => {
  const fixture = encryptedDeliveryFixture();
  t.mock.method(webPush, "sendNotification", async () => {
    throw new Error("legacy transport used");
  });
  let requests = 0;
  const signals: AbortSignal[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, options?: RequestInit) => {
      requests++;
      assert.equal(String(input), "https://fcm.googleapis.com/transport-test");
      assert.equal(options?.method, "POST");
      assert.equal(options?.redirect, "error");
      assert.ok(options?.signal);
      signals.push(options.signal);
      assert.equal(new Headers(options.headers).get("content-encoding"), "aes128gcm");
      assert.notEqual(
        Buffer.from(options.body as Uint8Array).toString(),
        '{"type":"inbox_changed"}',
      );
      return new Response("private provider body", {
        status: requests === 1 ? 201 : 429,
        headers: { "Retry-After": "180" },
      });
    },
  );
  const accepted = await deliverAccountInboxChanged(USER_ID, fixture);
  const throttled = await deliverAccountInboxChanged(USER_ID, fixture);
  assert.equal(requests, 2);
  assert.equal(accepted.providerAccepted, 1);
  assert.equal(throttled.outcome, "retry");
  assert.equal(throttled.retryAfterSeconds, 180);
  assert.ok(
    signals.every((signal) => signal.aborted),
    "transport resources released before returning",
  );
});

test("actual transport aborts both a hanging fetch and a hanging body cleanup", async (t) => {
  const fixture = encryptedDeliveryFixture();
  t.mock.method(webPush, "sendNotification", async () => {
    throw new Error("legacy transport used");
  });
  const signals: AbortSignal[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, options?: RequestInit) => {
    const signal = options?.signal;
    assert.ok(signal);
    signals.push(signal);
    if (signals.length === 1)
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    return new Response(new ReadableStream({ cancel: () => new Promise(() => undefined) }), {
      status: 201,
    });
  });
  const results = await Promise.all([
    deliverAccountInboxChanged(USER_ID, fixture),
    deliverAccountInboxChanged(USER_ID, fixture),
  ]);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal.aborted));
  assert.ok(results.every((result) => result.outcome === "retry" && result.providerAccepted === 0));
});
