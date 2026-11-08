import assert from "node:assert/strict";
import { test } from "node:test";
import { createUninstallFeedbackGet } from "./uninstall-feedback-route";
import { feedbackPage, parseFeedbackCursor } from "./uninstall-feedback-page";

const stamp = "2026-11-05T13:00:00.123456+00:00";
const rows = Array.from({ length: 51 }, (_, n) => ({
  submission_id: `11111111-1111-4111-8111-${String(51 - n).padStart(12, "0")}`,
  reason: "other", note: "A comment", created_at: stamp, email: n % 2 ? null : "feedback@example.com",
  actor_hash: "private", user_id: "private", discord_id: n % 2 ? null : "123456789012345678",
  display_name: n % 2 ? null : "Alex Johnson",
}));

test("private feedback rejects unauthenticated requests before any read or cursor parsing", async () => {
  let reads = 0;
  const get = createUninstallFeedbackGet({ authorized: async () => false, read: async () => { reads++; return feedbackPage(rows); } });
  const response = await get(new Request("https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback?cursor=bad"));
  assert.equal(response.status, 401);
  assert.equal(reads, 0);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.doesNotMatch(await response.text(), /private|A comment|feedback@example.com/);
});

test("feedback pages are bounded and preserve timestamp precision for tied rows", async () => {
  const page = feedbackPage(rows);
  assert.equal(page.items.length, 50);
  assert.deepEqual(parseFeedbackCursor(page.nextCursor), { createdAt: stamp, id: rows[49].submission_id });
  assert.doesNotMatch(JSON.stringify(page), /private|actor_hash|user_id/);
  assert.equal(page.items[0].email, "feedback@example.com");
  assert.equal(page.items[1].email, null);
  assert.equal(page.items[0].discordId, "123456789012345678");
  assert.equal(page.items[1].discordId, null);
  assert.equal(page.items[0].displayName, "Alex Johnson");
  assert.equal(page.items[1].displayName, null);
  assert.equal(feedbackPage([{ ...rows[0], display_name: undefined }]).items[0].displayName, null);
  assert.equal(feedbackPage([{ ...rows[0], display_name: "名".repeat(200) }]).items[0].displayName, "名".repeat(200));
  for (const display_name of [42, {}, "", " ", "a".repeat(201)]) {
    assert.throws(() => feedbackPage([{ ...rows[0], display_name }]));
  }
  assert.equal(feedbackPage(rows.slice(50)).nextCursor, null);
  assert.deepEqual(feedbackPage([]), { items: [], nextCursor: null });
  assert.throws(() => feedbackPage([{ ...rows[0], reason: "unknown" }]));
  for (const discord_id of [undefined, 123, "abc", "", "1".repeat(21)]) {
    assert.throws(() => feedbackPage([{ ...rows[0], discord_id }]));
  }
  for (const email of [undefined, 42, {}, "", " ", "a".repeat(321)]) {
    assert.throws(() => feedbackPage([{ ...rows[0], email }]));
  }
});

test("authorized reads validate cursors and return uncached projected data", async () => {
  const page = feedbackPage(rows);
  let received: unknown;
  const get = createUninstallFeedbackGet({ authorized: async () => true, read: async (cursor) => { received = cursor; return feedbackPage(rows.slice(50)); } });
  const response = await get(new Request(`https://staging.anidachi.app/api/kreatli-crm/uninstall-feedback?cursor=${page.nextCursor}`));
  assert.equal(response.status, 200);
  assert.deepEqual(received, parseFeedbackCursor(page.nextCursor));
  const body = await response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].email, "feedback@example.com");
  assert.equal(body.items[0].discordId, "123456789012345678");
  assert.equal(body.items[0].displayName, "Alex Johnson");
  assert.doesNotMatch(JSON.stringify(body), /actor_hash|user_id/);
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
