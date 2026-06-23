import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_REFRESH_PATH,
  shouldAutoRefreshWebsiteSession,
} from "./session-refresh";

test("website session auto refresh targets only page navigation with a refresh cookie", () => {
  assert.equal(
    shouldAutoRefreshWebsiteSession({
      method: "GET",
      pathname: "/account/watch-library",
      hasValidAccessToken: false,
      hasRefreshToken: true,
    }),
    true,
  );

  assert.equal(
    shouldAutoRefreshWebsiteSession({
      method: "GET",
      pathname: "/account/watch-library",
      hasValidAccessToken: true,
      hasRefreshToken: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoRefreshWebsiteSession({
      method: "GET",
      pathname: "/account/watch-library",
      hasValidAccessToken: false,
      hasRefreshToken: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoRefreshWebsiteSession({
      method: "POST",
      pathname: "/account/watch-library",
      hasValidAccessToken: false,
      hasRefreshToken: true,
    }),
    false,
  );
});

test("website session auto refresh treats an expired access token as refreshable", () => {
  assert.equal(
    shouldAutoRefreshWebsiteSession({
      method: "GET",
      pathname: "/account",
      hasValidAccessToken: false,
      hasRefreshToken: true,
    }),
    true,
  );
});

test("website session auto refresh skips API, refresh, staging, and static paths", () => {
  for (const pathname of [
    AUTH_REFRESH_PATH,
    "/api/me",
    "/__anidachi/staging-access",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/image.png",
  ]) {
    assert.equal(
      shouldAutoRefreshWebsiteSession({
        method: "GET",
        pathname,
        hasValidAccessToken: false,
        hasRefreshToken: true,
      }),
      false,
      pathname,
    );
  }
});
