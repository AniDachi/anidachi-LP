import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createWatchHistoryEditorHandlers, type WatchHistoryEditorStore } from "./watch-history-editor";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
const owner = "11111111-1111-4111-8111-111111111111";
const mutation = "22222222-2222-4222-8222-222222222222";
const session = { userId: owner, email: "editor@example.test", plan: "plus" as const, source: "cookie" as const };
const meta = { schemaVersion: 3, ownerUserId: owner, accountGeneration: 1, serverTime: "2026-09-10T00:00:00Z" };
const input = { provider: "crunchyroll", titleKey: "crunchyroll:series:S", accountGeneration: 1, clientMutationId: mutation, revision: "a".repeat(32), changes: [{ episodeKey: "E1", watched: true }] };
const state = { meta, provider: "crunchyroll", titleKey: input.titleKey, revision: input.revision, catalogComplete: false,
  episodes: [{ episodeKey: "E1", episodeTitle: "Episode One", episodeNumber: 1, seasonKey: "S1", seasonTitle: "Season One", seasonNumber: 1,
    seasonOrder: 0, order: 0, sourceUrl: "https://www.crunchyroll.com/watch/E1", available: true, watched: false, currentTime: 20, duration: 100, progress: .2 }] };
const ack = { meta, clientMutationId: mutation, revision: "b".repeat(32) };
function request(body?: unknown, expectedOwner: string | null = owner, origin = "https://example.test") {
  const headers = new Headers({ origin }); if (expectedOwner) headers.set(WATCH_HISTORY_OWNER_HEADER, expectedOwner);
  const url = "https://example.test/api/watch-history/v3/editor" + (body ? "" : `?provider=crunchyroll&titleKey=${input.titleKey}&accountGeneration=1`);
  return new NextRequest(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
}
function handlers(store: Partial<WatchHistoryEditorStore> = {}) {
  return createWatchHistoryEditorHandlers({ getSession: async () => session, store: {
    read: async () => state, edit: async () => ack, ...store,
  } });
}
test("editor reads and atomic writes bind the mounted owner and generation", async () => {
  const api = handlers({ edit: async (user, body) => { assert.equal(user, owner); assert.deepEqual(body, input); return ack; } });
  const read = await api.GET(request()); assert.equal(read.status, 200); assert.deepEqual(await read.json(), state);
  const write = await api.POST(request(input)); assert.equal(write.status, 200); assert.deepEqual(await write.json(), ack);
  assert.equal(write.headers.get("Cache-Control"), "private, no-store");
  assert.equal(write.headers.get("Vary"), "Cookie, Authorization");
});
test("identity and cross-origin checks run before any store access", async () => {
  let calls = 0; const api = handlers({ edit: async () => { calls++; return ack; }, read: async () => { calls++; return state; } });
  for (const body of [undefined, input]) {
    const fn = body ? api.POST : api.GET;
    assert.equal((await fn(request(body, null))).status, 400);
    assert.equal((await fn(request(body, "33333333-3333-4333-8333-333333333333"))).status, 409);
  }
  assert.equal((await api.POST(request(input, owner, "https://foreign.test"))).status, 403);
  assert.equal(calls, 0);
});
test("missing authentication cannot read private progress", async () => {
  const api = createWatchHistoryEditorHandlers({ getSession: async () => null, store: { read: async () => { throw Error("must not read"); }, edit: async () => null } });
  assert.equal((await api.GET(request())).status, 401);
});
test("invalid bulk edits never reach storage", async () => {
  let calls = 0; const api = handlers({ edit: async () => { calls++; return ack; } });
  for (const bad of [
    { ...input, changes: [] }, { ...input, changes: [...input.changes, ...input.changes] },
    { ...input, changes: [{ episodeKey: "E1", watched: "true" }] },
    { ...input, changes: Array.from({ length: 2001 }, (_, i) => ({ episodeKey: `E${i}`, watched: true })) },
    { ...input, accountGeneration: 0 }, { ...input, userId: owner },
  ]) assert.equal((await api.POST(request(bad))).status, 400);
  assert.equal(calls, 0);
});
test("database enforces current plan even if the cookie still says Plus", async () => {
  const response = await handlers({ edit: async () => { throw Error("HISTORY_PLAN_REQUIRED"); } }).POST(request(input));
  assert.equal(response.status, 403); assert.equal((await response.json()).code, "HISTORY_PLAN_REQUIRED");
});
test("cross-owner, cross-generation and cross-mutation responses fail closed", async () => {
  for (const bad of [{ ...ack, meta: { ...meta, accountGeneration: 2 } }, { ...ack, clientMutationId: owner }, { ...ack, meta: { ...meta, ownerUserId: mutation } }])
    assert.equal((await handlers({ edit: async () => bad }).POST(request(input))).status, 502);
  assert.equal((await handlers({ read: async () => ({ ...state, titleKey: "different" }) }).GET(request())).status, 502);
});
test("optimistic conflicts are actionable and storage details remain private", async () => {
  for (const [code, status] of [["HISTORY_EDIT_CONFLICT",409], ["HISTORY_EPISODE_UNAVAILABLE",409], ["HISTORY_TITLE_NOT_FOUND",404], ["password=do-not-expose",503]] as const) {
    const response = await handlers({ edit: async () => { throw Error(code); } }).POST(request(input));
    assert.equal(response.status, status); assert.equal((await response.text()).includes("do-not-expose"), false);
  }
});
