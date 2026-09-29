import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GET } from "../app/api/community-stats/route";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://community-count.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

test("counts only registrations after the fixed baseline and returns no account data", async () => {
  let count = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://community-count.invalid");
    assert.equal(url.pathname, "/rest/v1/users");
    assert.equal(init?.method, "HEAD");
    assert.equal(url.searchParams.get("select"), "id");
    assert.equal(
      url.searchParams.get("created_at"),
      "gt.2026-09-29T18:03:46.456294Z",
    );
    assert.match(new Headers(init?.headers).get("prefer") ?? "", /count=exact/);
    assert.ok(init?.signal);
    return new Response(null, {
      status: 200,
      headers: { "content-range": `*/${count}` },
    });
  };

  const baseline = await GET();
  assert.equal(baseline.status, 200);
  assert.deepEqual(await baseline.json(), { count: 1409 });
  assert.match(baseline.headers.get("cache-control") ?? "", /s-maxage=300/);

  count = 3;
  assert.deepEqual(await (await GET()).json(), { count: 1412 });
  // Refreshes and repeat visits never add to a persisted counter.
  assert.deepEqual(await (await GET()).json(), { count: 1412 });
});

test("database failures do not publish a misleading baseline or zero", async (t) => {
  t.mock.method(console, "error", () => {});
  globalThis.fetch = async () => new Response(null, { status: 403 });
  const response = await GET();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { count: null });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("a missing count is an error rather than a fresh 1409 result", async (t) => {
  t.mock.method(console, "error", () => {});
  globalThis.fetch = async () => new Response(null, { status: 200 });
  const response = await GET();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { count: null });
});
