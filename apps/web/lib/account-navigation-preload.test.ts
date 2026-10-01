import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { preloadAccountNavigation, takeAccountPreload, clearAccountPreloads } from "./account-navigation-preload";
const originalFetch = globalThis.fetch;
afterEach(() => { clearAccountPreloads(); globalThis.fetch = originalFetch; });

test("explicit navigation starts friends and groups before mounting and each result is consumed once", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => { paths.push(String(input)); assert.equal(new Headers(init?.headers).get("x-anidachi-social-owner"), "owner"); return Response.json({ ok: true }); };
  preloadAccountNavigation("owner", "/account/friends");
  assert.deepEqual(paths, ["/api/friends", "/api/groups"]);
  const friends = takeAccountPreload("owner", "/api/friends");
  assert.ok(friends);
  assert.deepEqual(await friends.response, { ok: true });
  assert.equal(takeAccountPreload("owner", "/api/friends"), null);
  assert.equal(paths.length, 2);
});
test("another owner cannot reuse a pending request; navigation away aborts unused work", async () => {
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (_input, init) => { signal = init?.signal ?? undefined; return new Promise(() => {}); };
  preloadAccountNavigation("owner", "/account/billing");
  assert.equal(takeAccountPreload("other", "/api/billing/subscription"), null);
  preloadAccountNavigation("owner", "/account/help");
  assert.equal(signal?.aborted, true);
  assert.equal(takeAccountPreload("owner", "/api/billing/subscription"), null);
});
test("unconsumed navigation requests expire rather than becoming a persistent account cache", () => {
  globalThis.fetch = async () => Response.json({ ok: true });
  preloadAccountNavigation("owner", "/account/billing");
  assert.equal(takeAccountPreload("owner", "/api/billing/subscription", Date.now() + 16_000), null);
});
