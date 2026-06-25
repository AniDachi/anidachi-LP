import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStagingAccessCookieValue,
  canBypassStagingGate,
  getStagingAccessConfig,
  isValidStagingAccessCookie,
  passwordMatchesStagingGate,
  sanitizeStagingAccessNextPath,
  sha256Hex,
} from "./staging-access";

test("staging gate is disabled unless explicitly enabled", async () => {
  assert.deepEqual(await getStagingAccessConfig({ VERCEL_ENV: "preview" }), {
    enabled: false,
  });
});

test("staging gate is disabled on production even when env is configured", async () => {
  const passwordHash = await sha256Hex("secret");
  assert.deepEqual(
    await getStagingAccessConfig({
      ANIDACHI_STAGING_GATE_ENABLED: "true",
      ANIDACHI_STAGING_GATE_PASSWORD_SHA256: passwordHash,
      VERCEL_ENV: "production",
    }),
    { enabled: false },
  );
});

test("staging gate accepts hashed password config and remembers with signed cookie", async () => {
  const passwordHash = await sha256Hex("stage-password");
  const config = await getStagingAccessConfig({
    ANIDACHI_STAGING_GATE_ENABLED: "true",
    ANIDACHI_STAGING_GATE_PASSWORD_SHA256: passwordHash,
    ANIDACHI_STAGING_GATE_COOKIE_SECRET: "cookie-secret",
    VERCEL_ENV: "preview",
  });

  assert.equal(config.enabled, true);
  if (!config.enabled) throw new Error("expected enabled config");

  assert.equal(await passwordMatchesStagingGate("stage-password", config), true);
  assert.equal(await passwordMatchesStagingGate("wrong", config), false);

  const cookie = await buildStagingAccessCookieValue(config);
  assert.equal(await isValidStagingAccessCookie(cookie, config), true);
  assert.equal(await isValidStagingAccessCookie("v1.invalid", config), false);
});

test("staging gate bypasses extension token endpoints and allowed bearer API calls", () => {
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/extension/auth/exchange",
      method: "POST",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/stripe/webhook",
      method: "POST",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/stripe/webhook",
      method: "GET",
    }),
    false,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/auth/refresh",
      method: "GET",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/auth/refresh",
      method: "POST",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/me",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/me/profile",
      method: "PATCH",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/friends",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/friends/requests",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/friends/requests/request_1/accept",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/friends/request_1",
      method: "DELETE",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/users/user_1/block",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/recent-people",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/recent-people/user_1/hide",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/groups",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/groups",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/groups/group_1",
      method: "PATCH",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/groups/group_1/members",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/groups/group_1/members/user_1",
      method: "DELETE",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/invites",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/invites",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/invites/invite_1/accept",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/invites/invite_1/decline",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/watch-library",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/watch-library",
      method: "DELETE",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/watch-library/rooms",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms/room_123",
      method: "GET",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms/room_123/connect",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms/room_123/end",
      method: "POST",
      authorization: "Bearer token",
    }),
    true,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms/room_123/end",
      method: "POST",
    }),
    false,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/rooms",
      method: "POST",
    }),
    false,
  );
  assert.equal(
    canBypassStagingGate({
      pathname: "/api/openclaw/health",
      method: "GET",
      authorization: "Bearer token",
    }),
    false,
  );
});

test("staging gate keeps extension auth return targets inside the app", () => {
  assert.equal(
    sanitizeStagingAccessNextPath(
      "/extension/connect?redirect_uri=https%3A%2F%2Fabc.chromiumapp.org%2Fauth&state=s1",
    ),
    "/extension/connect?redirect_uri=https%3A%2F%2Fabc.chromiumapp.org%2Fauth&state=s1",
  );
  assert.equal(sanitizeStagingAccessNextPath("/room/abc"), "/room/abc");
  assert.equal(sanitizeStagingAccessNextPath("https://evil.example"), "/");
  assert.equal(sanitizeStagingAccessNextPath("//evil.example"), "/");
  assert.equal(sanitizeStagingAccessNextPath("/__anidachi/staging-access"), "/");
});
