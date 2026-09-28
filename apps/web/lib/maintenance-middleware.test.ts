import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, middleware } from "../middleware";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./anidachi-auth/cookies";

const originalEnv = process.env;
afterEach(() => { process.env = originalEnv; mock.restoreAll(); });

const admissions = [
  ["GET", "/api/auth/callback/google"], ["GET", "/api/auth/refresh"],
  ["GET", "/extension/connect"], ["GET", "/extension/logout"],
  ["GET", "/api/rooms/room-1/connect"], ["POST", "/api/rooms"],
  ["POST", "/api/rooms/room-1/join"], ["POST", "/api/internal/rooms/room-1/ended"],
  ["POST", "/api/internal/notifications/drain"], ["POST", "/api/stripe/webhook"],
  ["POST", "/api/create-checkout-session"], ["POST", "/api/watch-progress/reconcile"],
  ["POST", "/api/watch-history/v2/progress"], ["POST", "/api/watch-history/v3/progress"],
  ["POST", "/api/watch-history/v3/editor"], ["POST", "/api/watch-history/v3/delete"],
  ["PATCH", "/api/watch-history/v3/preferences"], ["POST", "/api/account/inbox/seen"],
  ["POST", "/api/friends/requests"], ["POST", "/account"],
  ["POST", "/__anidachi/staging-access"], ["GET", "/"],
] as const;

for (const mode of ["closed", "invalid", "OPEN"]) {
  test(`actual middleware denies ${mode} before staging config, JWT, cookies and HTTP`, async () => {
    const reads: string[] = [];
    process.env = new Proxy<NodeJS.ProcessEnv>({ NODE_ENV: "test", ANIDACHI_MAINTENANCE_MODE: mode }, {
      get(target, key) {
        // Node and Next internals may inspect these; application config must not run.
        if (String(key).startsWith("ANIDACHI_") || String(key).includes("SUPABASE") || key === "VERCEL_ENV") {
          reads.push(String(key));
          assert.equal(key, "ANIDACHI_MAINTENANCE_MODE");
        }
        return Reflect.get(target, key);
      },
    });
    const http = mock.method(globalThis, "fetch", async () => { throw new Error("No HTTP allowed"); });
    for (const [method, path] of admissions) {
      assert.equal(unstable_doesMiddlewareMatch({ config, url: path }), true, path);
      const request = new NextRequest(`https://spoofed.example${path}?maintenance=open`, {
        method,
        headers: {
          accept: "text/html", authorization: "Bearer internal-secret",
          cookie: `${ACCESS_TOKEN_COOKIE}=existing-access; ${REFRESH_TOKEN_COOKIE}=existing-refresh; anidachi_staging_access=existing-staging`,
          "X-Anidachi-Maintenance": "open", "Next-Action": "action-id",
        },
      });
      const cookieReads = mock.method(request.cookies, "get", () => { throw new Error("No auth cookies may be read"); });
      const response = await middleware(request);
      assert.equal(response.status, 503, path);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(response.headers.get("Retry-After"), "60");
      assert.equal(response.headers.get("X-Anidachi-Maintenance"), "closed");
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
      assert.equal(response.headers.has("Set-Cookie"), false);
      assert.equal(response.headers.has("Location"), false);
      assert.deepEqual(await response.json(), { error: "MAINTENANCE", message: "AniDachi is temporarily unavailable. Please try again shortly." });
      assert.equal(cookieReads.mock.callCount(), 0);
    }
    assert.ok(reads.length > 0);
    assert.equal(http.mock.callCount(), 0);
  });
}

test("documents get a self-contained noindex 503; RSC and POST remain retryable JSON", async () => {
  process.env = { NODE_ENV: "test", ANIDACHI_MAINTENANCE_MODE: "closed" };
  const doc = await middleware(new NextRequest("https://www.anidachi.app/extension/connect?next=reflected-secret", { headers: { accept: "text/html", "sec-fetch-dest": "document" } }));
  assert.equal(doc.status, 503);
  assert.match(doc.headers.get("Content-Type")!, /text\/html/);
  assert.equal(doc.headers.get("X-Robots-Tag"), "noindex, nofollow");
  const html = await doc.text();
  assert.match(html, /<main/); assert.match(html, /<h1/); assert.match(html, /lang="en"/);
  assert.doesNotMatch(html, /reflected-secret|<script|<form|<img|<link/);
  const nonDocuments: { method?: string; headers: Record<string, string> }[] = [{ method: "POST", headers: { accept: "text/html" } }, { headers: { accept: "text/html", RSC: "1" } }, { headers: { accept: "application/json" } }];
  for (const options of nonDocuments) {
    const response = await middleware(new NextRequest("https://www.anidachi.app/account", options));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "MAINTENANCE");
  }
});

test("open modes preserve marketing, session refresh and staging gate behavior", async () => {
  for (const mode of [undefined, "", "open"]) {
    process.env = { NODE_ENV: "test", ...(mode === undefined ? {} : { ANIDACHI_MAINTENANCE_MODE: mode }) };
    const marketing = await middleware(new NextRequest("https://www.anidachi.app/"));
    assert.equal(marketing.headers.get("x-middleware-next"), "1");
    const refresh = await middleware(new NextRequest("https://www.anidachi.app/account", { headers: { cookie: `${REFRESH_TOKEN_COOKIE}=existing-refresh` } }));
    assert.equal(refresh.status, 307);
    assert.match(refresh.headers.get("location")!, /\/api\/auth\/refresh\?next=/);
    process.env.ANIDACHI_STAGING_GATE_ENABLED = "true";
    process.env.ANIDACHI_STAGING_GATE_PASSWORD = "test-password";
    const staged = await middleware(new NextRequest("https://staging.anidachi.app/api/me"));
    assert.equal(staged.status, 401);
    assert.equal(staged.headers.get("X-Robots-Tag"), "noindex, nofollow");
  }
});
