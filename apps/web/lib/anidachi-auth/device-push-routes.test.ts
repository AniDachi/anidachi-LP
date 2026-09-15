import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { POST } from "../../app/api/devices/push-subscription/route";
import { DELETE } from "../../app/api/devices/[deviceId]/push-subscription/route";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { signAccessToken } from "./jwt";
import { signExtensionAccessToken } from "./extension-session";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DEVICE = "33333333-3333-4333-8333-333333333333";
const subscription = {
  installationId: "44444444-4444-4444-8444-444444444444",
  endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
  expirationTime: null,
  keys: { p256dh: "BEl62iUYgUivxIkv69yViEuiBIa40HIhZbGzOCh6vTZMeYKv4A6eQHHuQNaO8h-SS5kxtR7U7I3F4R5y6T7u8V9", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
};
const profile = (sub: string) => ({ sub, email: "viewer@example.test", plan: "plus" as const });

// Exercise the real route, cookies and JWT verification; only database HTTP is local.
async function withAuthority(run: (writes: Array<{ owner: string | null; enabled: boolean }>) => Promise<void>) {
  const env = {
    ANIDACHI_JWT_SECRET: "push-auth-isolation-local-test-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "local-test-service-role",
  };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  const previousFetch = globalThis.fetch;
  const writes: Array<{ owner: string | null; enabled: boolean }> = [];
  Object.assign(process.env, env);
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, "https://supabase.example.test");
    assert.equal(url.pathname, "/rest/v1/devices");
    if (request.method === "GET") {
      return Response.json([{ id: DEVICE, user_id: OWNER, notifications_enabled: true }]);
    }
    assert.equal(request.method, "PATCH");
    const body = await request.json();
    if (body.notifications_enabled) {
      writes.push({ owner: body.user_id, enabled: true });
      return Response.json({ id: DEVICE, push_subscription_updated_at: body.push_subscription_updated_at });
    }
    const owner = url.searchParams.get("user_id")?.replace(/^eq\./, "") ?? null;
    if (owner !== OWNER) return Response.json([]);
    writes.push({ owner, enabled: false });
    return Response.json([{ id: DEVICE }]);
  };
  try {
    await run(writes);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function invoke(method: "POST" | "DELETE", bearer: string | null, cookie: string, body: unknown = subscription) {
  const path = method === "POST" ? "/api/devices/push-subscription" : `/api/devices/${DEVICE}/push-subscription`;
  const request = new NextRequest(`https://www.anidachi.app${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: `${ACCESS_TOKEN_COOKIE}=${cookie}`,
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  const store = createRequestStoreForAPI(request, request.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined);
  const work = createWorkStore({
    page: path, buildId: "test", previouslyRevalidatedTags: [],
    renderOpts: {
      supportsDynamicResponse: true,
      waitUntil: undefined,
      onClose: () => undefined,
      onAfterTaskError: undefined,
      experimental: { isRoutePPREnabled: false, cacheComponents: false, authInterrupts: false },
    },
  });
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store, () => method === "POST"
    ? POST(request)
    : DELETE(request, { params: Promise.resolve({ deviceId: DEVICE }) })));
}

for (const cookieOwner of [OWNER, OTHER]) {
  test(`push registration belongs to the extension despite a ${cookieOwner === OWNER ? "matching" : "different"} website session`, async () => {
    await withAuthority(async (writes) => {
      const cookie = await signAccessToken(profile(cookieOwner));
      const bearer = await signExtensionAccessToken(profile(OWNER));
      const response = await invoke("POST", bearer, cookie);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).deviceId, DEVICE);
      assert.deepEqual(writes, [{ owner: OWNER, enabled: true }]);
    });
  });
}

test("push revocation uses the extension owner despite another website session", async () => {
  await withAuthority(async (writes) => {
    const response = await invoke("DELETE", await signExtensionAccessToken(profile(OWNER)), await signAccessToken(profile(OTHER)));
    assert.equal(response.status, 200);
    assert.deepEqual(writes, [{ owner: OWNER, enabled: false }]);
  });
});

test("the website owner cannot authorize revoking another extension account's device", async () => {
  await withAuthority(async (writes) => {
    const response = await invoke("DELETE", await signExtensionAccessToken(profile(OTHER)), await signAccessToken(profile(OWNER)));
    assert.equal(response.status, 404);
    assert.deepEqual(writes, []);
  });
});

for (const method of ["POST", "DELETE"] as const) {
  test(`${method} requires an extension token even with a valid website cookie`, async () => {
    await withAuthority(async (writes) => {
      const cookie = await signAccessToken(profile(OWNER));
      for (const bearer of [null, "invalid-token", cookie]) {
        const response = await invoke(method, bearer, cookie);
        assert.equal(response.status, 401);
      }
      assert.deepEqual(writes, []);
    });
  });
}

test("valid extension authentication still validates the push payload before writing", async () => {
  await withAuthority(async (writes) => {
    const response = await invoke("POST", await signExtensionAccessToken(profile(OWNER)), await signAccessToken(profile(OTHER)), {});
    assert.equal(response.status, 400);
    assert.deepEqual(writes, []);
  });
});
