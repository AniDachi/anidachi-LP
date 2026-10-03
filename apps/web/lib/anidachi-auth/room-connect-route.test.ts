import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { POST } from "../../app/api/rooms/[roomId]/connect/route";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { signAccessToken } from "./jwt";

const owner = "11111111-1111-4111-8111-111111111111";
const path = "/api/rooms/room-one/connect";

async function connect() {
  const cookie = await signAccessToken({ sub: owner, email: "viewer@example.test", plan: "free" });
  const request = new NextRequest(`https://web.example.test${path}`, {
    method: "POST", headers: { "content-type": "application/json", cookie: `${ACCESS_TOKEN_COOKIE}=${cookie}` },
    body: JSON.stringify({ participantSessionId: "session-one" }),
  });
  const store = createRequestStoreForAPI(request, request.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined);
  const work = createWorkStore({
    page: path, buildId: "test", previouslyRevalidatedTags: [],
    renderOpts: { supportsDynamicResponse: true, waitUntil: undefined,
      onClose: () => undefined, onAfterTaskError: undefined,
      experimental: { isRoutePPREnabled: false, cacheComponents: false, authInterrupts: false } },
  });
  return workAsyncStorage.run(work, () => workUnitAsyncStorage.run(store,
    () => POST(request, { params: Promise.resolve({ roomId: "room-one" }) })));
}

async function fixture(options: { closeAfterClaim?: boolean; active?: boolean; authorityDown?: boolean; upgraded?: boolean },
  run: (state: { status: string; quotaReads: number; claims: number; host_connected_at: string | null }) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const env = { ANIDACHI_JWT_SECRET: "room-connect-regression-local-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.test", SUPABASE_SERVICE_ROLE_KEY: "local-test-role" };
  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const state = { status: "lobby", quotaReads: 0, claims: 0, host_connected_at: null as string | null };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, "https://database.example.test");
    const now = new Date();
    const until = new Date(now.getTime() + 60_000).toISOString();
    const row = { room_id: "room-one", host_user_id: owner, host_plan_code: "free",
      max_participants: 4, max_media_seats: 2, can_name_room: false, can_send_push_invites: false,
      media_lease: null, status: state.status, host_connected_at: state.host_connected_at };
    if (url.pathname === "/rest/v1/rooms" && request.method === "GET") return Response.json(row);
    if (url.pathname === "/rest/v1/users") return Response.json({ id: owner, display_name: "Viewer", avatar_url: null });
    if (url.pathname.endsWith("/resolve_watch_history_access_v1")) {
      if (options.authorityDown) return Response.json({ message: "offline" }, { status: 503 });
      return Response.json({ planCode: options.upgraded ? "plus" : "free", paidUntil: options.upgraded ? until : null,
        selectedPlanExpiresAt: options.upgraded ? until : null,
        history: { accessVersion: 1, ownerUserId: owner, accountGeneration: 1, accessEpoch: 1,
          youtubeConsentEpoch: 1, state: options.upgraded ? "allowed" : "plan_required", serverTime: now.toISOString(),
          captureNotBefore: "2026-09-01T00:00:00Z", validUntil: until, youtubeHistoryEnabled: true },
        hosting: { hostingPolicyVersion: 1, hostingActivationAt: options.active ? "2026-09-01T00:00:00Z" : null,
          canHost: !!options.upgraded || !options.active, trialEligibility: "unavailable", trialEndsAt: null } });
    }
    if (url.pathname === "/rest/v1/usage_daily") {
      state.quotaReads++;
      return Response.json({ host_seconds: options.active ? 1800 : 0 });
    }
    if (url.pathname.endsWith("/claim_active_room_session_v3")) {
      state.claims++;
      // The real admission transaction finishes; closure wins before the delayed PATCH.
      if (options.closeAfterClaim) state.status = "ended";
      return Response.json([{ outcome: "claimed", active_room: null }]);
    }
    if (url.pathname === "/rest/v1/rooms" && request.method === "PATCH") {
      const matches = !(url.searchParams.get("status") === "neq.ended" && state.status === "ended");
      if (matches) Object.assign(state, await request.json());
      return Response.json(matches ? [{ room_id: "room-one" }] : []);
    }
    throw new Error(`Unexpected database request: ${request.method} ${url.pathname}`);
  };
  try { await run(state); } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("delayed host connect cannot reopen a room finalized after admission", async () => {
  await fixture({ closeAfterClaim: true }, async state => {
    const response = await connect();
    assert.equal(state.status, "ended");
    assert.equal(state.host_connected_at, null);
    assert.equal(response.status, 404);
    assert.equal("roomToken" in await response.json(), false);
  });
});
test("ordinary pre-cutover lobby connect still activates the room and issues a token", async () => {
  await fixture({}, async state => {
    const response = await connect();
    assert.equal(response.status, 200);
    assert.equal(state.status, "live");
    assert.equal(typeof (await response.json()).roomToken, "string");
  });
});
for (const upgraded of [false, true]) {
  test(`post-cutover frozen Free room rejects before retired quota, upgraded=${upgraded}`, async () => {
    await fixture({ active: true, upgraded }, async state => {
      const response = await connect();
      assert.equal(response.status, 403);
      const body = await response.json();
      assert.equal(body.code, "HOST_SUBSCRIPTION_REQUIRED");
      assert.equal("resetAt" in body, false);
      assert.equal(state.quotaReads, 0);
      assert.equal(state.claims, 0);
    });
  });
}
test("unavailable room authority cannot turn into a quota or subscription denial", async () => {
  await fixture({ active: true, authorityDown: true }, async state => {
    const response = await connect();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: "ROOM_AUTHORITY_UNAVAILABLE" });
    assert.equal(state.quotaReads, 0);
    assert.equal(state.claims, 0);
  });
});
