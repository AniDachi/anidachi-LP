import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/internal/notifications/drain/route";
import { POST as endRoom } from "../app/api/internal/rooms/[roomId]/ended/route";
import { POST as departRoom } from "../app/api/internal/rooms/[roomId]/participants/[userId]/departed/route";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let calls: string[];
let claimCount: number;
let fail: "claim" | "finish" | null;
let withDevice: boolean;
let diagnostics: unknown[][];

beforeEach(() => {
  diagnostics = [];
  mock.method(console, "info", (...args: unknown[]) => diagnostics.push(args));
  mock.method(console, "error", (...args: unknown[]) => diagnostics.push(args));
  process.env.ANIDACHI_INTERNAL_API_SECRET = "internal-test-secret";
  delete process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  delete process.env.ANIDACHI_VAPID_PUBLIC_KEY;
  delete process.env.ANIDACHI_VAPID_PRIVATE_KEY;
  delete process.env.ANIDACHI_VAPID_SUBJECT;
  calls = []; claimCount = 0; fail = null; withDevice = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.pathname);
    if (url.pathname.endsWith("claim_account_inbox_push_outbox")) {
      assert.equal(JSON.parse(String(init?.body)).p_recipient_user_ids, null);
      if (fail === "claim") return Response.json({ message: "private database failure" }, { status: 500 });
      return Response.json(claimCount++ === 0 ? [{ user_id: "account-a", revision: 1, lease_token: "lease-a" }] : []);
    }
    if (url.pathname === "/rest/v1/devices") {
      return Response.json(withDevice ? [{ id: "device-a", user_id: "account-a", push_endpoint: "https://fcm.googleapis.com/fcm/send/test", push_p256dh: "test", push_auth: "test" }] : []);
    }
    if (url.pathname.endsWith("finish_account_inbox_push_outbox")) {
      if (fail === "finish") return Response.json({ message: "private database failure" }, { status: 500 });
      return Response.json(withDevice ? "retry" : "completed");
    }
    throw new Error(`Unexpected test HTTP ${url.pathname}`);
  };
});
afterEach(() => { mock.restoreAll(); globalThis.fetch = originalFetch; process.env = { ...originalEnv }; });

function request(authorization?: string, method = "POST") {
  return new NextRequest("https://staging.anidachi.app/api/internal/notifications/drain", {
    method, headers: authorization ? { authorization } : {},
  });
}

test("drain requires the existing internal bearer before database access", async () => {
  for (const auth of [undefined, "Bearer wrong", "Basic internal-test-secret"]) {
    const response = await POST(request(auth));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
  delete process.env.ANIDACHI_INTERNAL_API_SECRET;
  assert.equal((await POST(request("Bearer internal-test-secret"))).status, 401);
  assert.deepEqual(calls, []);
});

test("GET never drains even with internal authorization", async () => {
  assert.equal((await GET()).status, 405);
  assert.deepEqual(calls, []);
});

test("dedicated drain bearer works with and without the legacy secret", async () => {
  process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET = "dedicated-drain-test";
  for (const legacy of ["internal-test-secret", undefined]) {
    if (legacy) process.env.ANIDACHI_INTERNAL_API_SECRET = legacy;
    else delete process.env.ANIDACHI_INTERNAL_API_SECRET;
    const response = await POST(request("Bearer dedicated-drain-test"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  }
});

test("missing or empty drain credentials fail closed", async () => {
  delete process.env.ANIDACHI_INTERNAL_API_SECRET;
  for (const dedicated of [undefined, ""]) {
    if (dedicated === undefined) delete process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET;
    else process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET = dedicated;
    for (const auth of ["Bearer dedicated-drain-test", "Bearer internal-test-secret", "Bearer undefined", "Bearer "]) {
      assert.equal((await POST(request(auth))).status, 401);
    }
  }
  assert.deepEqual(calls, []);
});

test("dedicated drain bearer never authorizes either room callback", async () => {
  process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET = "dedicated-drain-test";
  const context = { params: Promise.resolve({ roomId: "room-test", userId: "user-test" }) };
  assert.equal((await endRoom(request("Bearer dedicated-drain-test"), context)).status, 401);
  assert.equal((await departRoom(request("Bearer dedicated-drain-test"), context)).status, 401);
  assert.deepEqual(calls, []);
});

test("authorized POST drains globally and returns only the literal health acknowledgement", async () => {
  const response = await POST(request("Bearer internal-test-secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(calls, ["/rest/v1/rpc/claim_account_inbox_push_outbox", "/rest/v1/devices", "/rest/v1/rpc/finish_account_inbox_push_outbox", "/rest/v1/rpc/claim_account_inbox_push_outbox"]);
  assert.ok(JSON.stringify(diagnostics).includes('"pruneOperations":0'));
  assert.ok(!JSON.stringify(diagnostics).includes("account-a"));
});

test("a persisted recipient retry is a completed pass, not an infrastructure failure", async () => {
  withDevice = true;
  const response = await POST(request("Bearer internal-test-secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.ok(calls.includes("/rest/v1/rpc/finish_account_inbox_push_outbox"));
});

test("claim and finish infrastructure failures cannot produce a successful acknowledgement", async () => {
  for (const failure of ["claim", "finish"] as const) {
    fail = failure; claimCount = 0;
    const response = await POST(request("Bearer internal-test-secret"));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Notification drain unavailable" });
    assert.ok(!JSON.stringify(diagnostics).includes("private database failure"));
  }
});
