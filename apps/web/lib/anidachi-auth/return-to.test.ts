import assert from "node:assert/strict";
import test from "node:test";
import { isSafeAuthReturnTo, sanitizeAuthReturnTo } from "./return-to";

test("auth return targets allow internal app pages", () => {
  assert.equal(isSafeAuthReturnTo("/"), true);
  assert.equal(isSafeAuthReturnTo("/account"), true);
  assert.equal(isSafeAuthReturnTo("/account/watch-library?tab=recent"), true);
  assert.equal(isSafeAuthReturnTo("/room/room_123"), true);
  assert.equal(
    isSafeAuthReturnTo(
      "/extension/connect?redirect_uri=https%3A%2F%2Fabc.chromiumapp.org%2Fauth&state=s1",
    ),
    true,
  );
  assert.equal(isSafeAuthReturnTo("/friend/invite/token_123"), true);
});

test("auth return targets reject external and internal service paths", () => {
  assert.equal(isSafeAuthReturnTo("https://evil.example"), false);
  assert.equal(isSafeAuthReturnTo("//evil.example"), false);
  assert.equal(isSafeAuthReturnTo("/api/auth/refresh?next=/account"), false);
  assert.equal(isSafeAuthReturnTo("/_next/static/chunk.js"), false);
  assert.equal(isSafeAuthReturnTo("/__anidachi/staging-access"), false);

  assert.equal(sanitizeAuthReturnTo("https://evil.example"), "");
  assert.equal(sanitizeAuthReturnTo("/api/auth/refresh?next=/account"), "");
  assert.equal(sanitizeAuthReturnTo("/account/friends"), "/account/friends");
});
