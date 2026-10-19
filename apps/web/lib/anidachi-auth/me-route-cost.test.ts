import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/me/route";
import { signExtensionAccessToken } from "./extension-session";
import { ensureProfileForUser } from "./social";

const user = {
  id: "11111111-1111-4111-8111-111111111111", email: "test@example.test",
  display_name: "Alex", avatar_url: "https://example.test/avatar.png", plan: "plus" as const,
  discord_id: null, google_id: null, created_at: "2026-10-14T00:00:00.000Z",
};
const profile = {
  user_id: user.id, display_name: "Custom name", avatar_url: user.avatar_url,
  handle: "alex", created_at: user.created_at, updated_at: user.created_at,
};

type Call = { table: string; method: string; body: Record<string, unknown> | null };
async function database<T>(run: (calls: Call[]) => Promise<T>, options: {
  missingUser?: boolean; missingProfile?: boolean; missingAvatar?: boolean; insertRace?: boolean;
} = {}) {
  const prior = { url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.ANIDACHI_JWT_SECRET, fetch: globalThis.fetch };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
  process.env.ANIDACHI_JWT_SECRET = "local-test-jwt-secret";
  const calls: Call[] = [];
  let profileReads = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const table = url.pathname.split("/").at(-1)!;
    const body = request.method === "GET" ? null : await request.json();
    calls.push({ table, method: request.method, body });
    if (table === "users" && request.method === "GET") {
      assert.equal(url.searchParams.get("id"), `eq.${user.id}`);
      return Response.json(options.missingUser ? null : user);
    }
    if (table === "profiles" && request.method === "GET") {
      assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`);
      profileReads += 1;
      return Response.json(options.missingProfile && (!options.insertRace || profileReads === 1)
        ? null : { ...profile, avatar_url: options.missingAvatar ? null : profile.avatar_url });
    }
    if (table === "profiles" && request.method === "POST") {
      if (options.insertRace) return Response.json({ code: "23505", message: "duplicate" }, { status: 409 });
      return Response.json({ ...profile, ...body });
    }
    if (table === "profiles" && request.method === "PATCH") return Response.json({ ...profile, ...body });
    throw new Error(`Unexpected database request ${request.method} ${url.pathname}`);
  };
  try { return await run(calls); } finally {
    globalThis.fetch = prior.fetch;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: prior.url,
      SUPABASE_SERVICE_ROLE_KEY: prior.key, ANIDACHI_JWT_SECRET: prior.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
async function account() {
  const token = await signExtensionAccessToken({ sub: user.id, email: user.email, plan: user.plan });
  return GET(new NextRequest("https://staging.anidachi.app/api/me", {
    headers: { authorization: `Bearer ${token}` },
  }));
}

test("account response uses one user read and preserves custom public profile", async () => {
  await database(async (calls) => {
    const response = await account();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: { id: user.id, email: user.email, displayName: "Alex", avatarUrl: user.avatar_url, plan: "plus" },
      profile: { userId: user.id, displayName: "Custom name", avatarUrl: user.avatar_url, handle: "alex" },
    });
    assert.equal(calls.filter(call => call.table === "users").length, 1);
    assert.equal(calls.length, 2);
  });
});

test("missing authenticated user does not create a profile", async () => {
  await database(async (calls) => {
    const response = await account();
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "User not found" });
    assert.equal(calls.length, 1);
  }, { missingUser: true });
});

for (const scenario of ["missingProfile", "missingAvatar", "insertRace"] as const) {
  test(`account keeps ${scenario} repair without rereading its user`, async () => {
    await database(async (calls) => {
      const response = await account();
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.profile.userId, user.id);
      assert.equal(payload.profile.avatarUrl, user.avatar_url);
      assert.equal(calls.filter(call => call.table === "users").length, 1);
      const write = calls.find(call => call.method !== "GET");
      assert.ok(write);
      if (scenario === "missingAvatar") assert.equal(write.body?.avatar_url, user.avatar_url);
      else assert.equal(write.body?.user_id, user.id);
    }, scenario === "insertRace" ? { missingProfile: true, insertRace: true } : { [scenario]: true });
  });
}

test("profile ensure still verifies a user when no loaded snapshot is supplied", async () => {
  await database(async (calls) => {
    assert.deepEqual(await ensureProfileForUser(user.id), profile);
    assert.equal(calls.filter(call => call.table === "users").length, 1);
  });
});

test("profile ensure rejects a loaded snapshot belonging to another user", async () => {
  await database(async (calls) => {
    await assert.rejects(ensureProfileForUser(user.id, { ...user, id: "other-user" }), /user.*mismatch/i);
    assert.equal(calls.length, 0);
  });
});
