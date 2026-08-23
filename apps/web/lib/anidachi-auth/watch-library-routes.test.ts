import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  DELETE as disabledWatchLibraryDelete,
  GET as disabledWatchLibraryGet,
} from "../../app/api/watch-library/route";
import { POST as disabledWatchLibraryRoomPost } from "../../app/api/watch-library/rooms/route";
import { POST as disabledWatchProgressPost } from "../../app/api/watch-progress/reconcile/route";
import type { ApiSession } from "./api-session";
import {
  createDisabledWatchLibraryRoute,
  disabledWatchLibraryRoute,
} from "./watch-library-routes";

const session: ApiSession = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "viewer@example.test",
  plan: "free",
  source: "extension",
};

test("every public v1 Watch History method is wired to the disabled route", () => {
  assert.equal(disabledWatchLibraryGet, disabledWatchLibraryRoute);
  assert.equal(disabledWatchLibraryDelete, disabledWatchLibraryRoute);
  assert.equal(disabledWatchLibraryRoomPost, disabledWatchLibraryRoute);
  assert.equal(disabledWatchProgressPost, disabledWatchLibraryRoute);
});

test("disabled v1 watch-library routes preserve authentication", async () => {
  const route = createDisabledWatchLibraryRoute({
    getSession: async () => null,
  });

  const response = await route(new NextRequest("https://staging.anidachi.app/api/watch-library"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required",
    code: "UNAUTHORIZED",
  });
});

test("authenticated v1 watch-library routes require the v2 client without calling legacy work", async () => {
  let sessionReads = 0;
  const route = createDisabledWatchLibraryRoute({
    getSession: async () => {
      sessionReads += 1;
      return session;
    },
  });

  const response = await route(
    new NextRequest("https://staging.anidachi.app/api/watch-progress/reconcile", {
      method: "POST",
      body: JSON.stringify([{ legacy: true }]),
    }),
  );

  assert.equal(sessionReads, 1);
  assert.equal(response.status, 426);
  assert.deepEqual(await response.json(), {
    error: "Watch History v2 is required",
    code: "UPGRADE_REQUIRED",
  });
});
