import assert from "node:assert/strict";
import { test } from "node:test";
import { createUninstallFeedbackGet } from "./uninstall-feedback-route";
import { feedbackPage, parseFeedbackCursor } from "./uninstall-feedback-page";

const stamp = "2026-11-05T13:00:00.123456+00:00";
const rows = Array.from({ length: 51 }, (_, n) => ({
  submission_id: `11111111-1111-4111-8111-${String(51 - n).padStart(12, "0")}`,
  reason: "other", note: "A comment", created_at: stamp,
  actor_hash: "private", user_id: "private",
}));

test("private feedback rejects unauthenticated requests before any read or cursor parsing", async () => {
  let reads = 0;
  const get = createUninstallFeedbackGet({ authorized: async () => false, read: async () => { reads++; return feedbackPage(rows); } });
  const response = await get(new Request("https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback?cursor=bad"));
  assert.equal(response.status, 401);
  assert.equal(reads, 0);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.doesNotMatch(await response.text(), /private|A comment/);
});

test("feedback pages are bounded and preserve timestamp precision for tied rows", async () => {
  const page = feedbackPage(rows);
  assert.equal(page.items.length, 50);
  assert.deepEqual(parseFeedbackCursor(page.nextCursor), { createdAt: stamp, id: rows[49].submission_id });
  assert.doesNotMatch(JSON.stringify(page), /private|actor_hash|user_id/);
  assert.equal(feedbackPage(rows.slice(50)).nextCursor, null);
  assert.deepEqual(feedbackPage([]), { items: [], nextCursor: null });
  assert.throws(() => feedbackPage([{ ...rows[0], reason: "unknown" }]));
});

test("authorized reads validate cursors and return uncached projected data", async () => {
  const page = feedbackPage(rows);
  let received: unknown;
  const get = createUninstallFeedbackGet({ authorized: async () => true, read: async (cursor) => { received = cursor; return feedbackPage(rows.slice(50)); } });
  const response = await get(new Request(`https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback?cursor=${page.nextCursor}`));
  assert.equal(response.status, 200);
  assert.deepEqual(received, parseFeedbackCursor(page.nextCursor));
  assert.equal((await response.json()).items.length, 1);
  assert.match(response.headers.get("x-robots-tag")!, /noindex/);
  for (const cursor of ["bad", "x".repeat(513), Buffer.from(JSON.stringify({ id: rows[0].submission_id, createdAt: "infinity" })).toString("base64url")]) {
    received = undefined;
    const invalid = await get(new Request(`https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback?cursor=${cursor}`));
    assert.equal(invalid.status, 400);
    assert.equal(received, undefined);
  }
});

test("storage failure is retryable, never a false empty inbox or raw provider error", async () => {
  const get = createUninstallFeedbackGet({ authorized: async () => true, read: async () => { throw new Error("private database details"); } });
  const response = await get(new Request("https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private|items/);
});
