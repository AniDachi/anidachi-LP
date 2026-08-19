import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as websiteLogout } from "../../app/api/auth/logout/route";
import { POST as websiteRefresh } from "../../app/api/auth/refresh/route";
import { POST as extensionLogout } from "../../app/api/extension/auth/logout/route";
import { POST as extensionRefresh } from "../../app/api/extension/auth/refresh/route";

type RpcCall = {
  name: string;
  body: Record<string, unknown>;
};

async function withMockedRefreshAuthority<T>(
  run: (calls: RpcCall[]) => Promise<T>,
): Promise<T> {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousSecret = process.env.ANIDACHI_JWT_SECRET;
  const previousFetch = globalThis.fetch;
  const calls: RpcCall[] = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-service-role";
  process.env.ANIDACHI_JWT_SECRET = "test-secret-for-anidachi-jwt-bridge";
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const name = url.pathname.split("/").at(-1) ?? "";
    const body = (await request.json()) as Record<string, unknown>;
    calls.push({ name, body });

    if (name === "rotate_refresh_token_family_v1") {
      return Response.json([
        { rotation_outcome: "invalid", user_id: null, family_id: null },
      ]);
    }
    if (name === "revoke_refresh_token_family_v1") {
      return Response.json(true);
    }
    throw new Error(`Unexpected Supabase request: ${request.method} ${url.pathname}`);
  };

  try {
    return await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.ANIDACHI_JWT_SECRET;
    else process.env.ANIDACHI_JWT_SECRET = previousSecret;
  }
}

test("website and extension refresh routes send tokens to only their own channel", async () => {
  await withMockedRefreshAuthority(async (calls) => {
    const websiteResponse = await websiteRefresh(
      new NextRequest("http://localhost/api/auth/refresh", {
        method: "POST",
        headers: { cookie: "anidachi_refresh_token=extension-family-token" },
      }),
    );
    const extensionResponse = await extensionRefresh(
      new NextRequest("http://localhost/api/extension/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "website-family-token" }),
      }),
    );

    assert.equal(websiteResponse.status, 401);
    assert.equal(extensionResponse.status, 401);
    assert.deepEqual(
      calls.map(({ name, body }) => ({ name, channel: body.p_channel })),
      [
        { name: "rotate_refresh_token_family_v1", channel: "website" },
        { name: "rotate_refresh_token_family_v1", channel: "extension" },
      ],
    );
  });
});

test("website and extension logout routes revoke only their own channel", async () => {
  await withMockedRefreshAuthority(async (calls) => {
    const websiteResponse = await websiteLogout(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: "anidachi_refresh_token=website-family-token" },
      }),
    );
    const extensionResponse = await extensionLogout(
      new NextRequest("http://localhost/api/extension/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: "extension-family-token" }),
      }),
    );

    assert.equal(websiteResponse.status, 200);
    assert.equal(extensionResponse.status, 200);
    assert.deepEqual(
      calls.map(({ name, body }) => ({ name, channel: body.p_channel })),
      [
        { name: "revoke_refresh_token_family_v1", channel: "website" },
        { name: "revoke_refresh_token_family_v1", channel: "extension" },
      ],
    );
  });
});
