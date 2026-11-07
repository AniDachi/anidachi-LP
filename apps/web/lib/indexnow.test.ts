import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_MAX_URLS,
  buildIndexNowPayloads,
  normalizeIndexNowUrls,
} from "./indexnow";

describe("IndexNow", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses a key the protocol accepts", () => {
    assert.match(INDEXNOW_KEY, /^[a-zA-Z0-9-]{8,128}$/);
    assert.equal(INDEXNOW_KEY_LOCATION, `https://www.anidachi.app/${INDEXNOW_KEY}.txt`);
  });

  it("serves the key file from a route folder named after the key", () => {
    const route = path.join(process.cwd(), "app", `${INDEXNOW_KEY}.txt`, "route.ts");
    assert.ok(fs.existsSync(route), `missing ${route}`);
  });

  it("returns the key on production and 404 on noindex deployments", async () => {
    const { GET } = await import(`../app/${INDEXNOW_KEY}.txt/route`);

    process.env.VERCEL_ENV = "production";
    delete process.env.NEXT_PUBLIC_ROBOTS_NOINDEX;
    const live = GET();
    assert.equal(live.status, 200);
    assert.equal(await live.text(), INDEXNOW_KEY);

    process.env.VERCEL_ENV = "preview";
    assert.equal(GET().status, 404);
  });

  it("keeps only www.anidachi.app URLs and moves apex to www", () => {
    const { urls, rejected } = normalizeIndexNowUrls([
      "/netflix-watch-party",
      "https://anidachi.app/watch",
      "https://www.anidachi.app/discord-watch-party#faq",
      "/netflix-watch-party",
      "# comment",
      "",
      "https://staging.anidachi.app/virtual-movie-night",
      "http://www.anidachi.app/insecure",
      "not a url",
    ]);
    assert.deepEqual(urls, [
      "https://www.anidachi.app/netflix-watch-party",
      "https://www.anidachi.app/watch",
      "https://www.anidachi.app/discord-watch-party",
    ]);
    assert.deepEqual(rejected, [
      "https://staging.anidachi.app/virtual-movie-night",
      "http://www.anidachi.app/insecure",
      "not a url",
    ]);
  });

  it("splits large batches at the protocol limit", () => {
    const urls = Array.from({ length: INDEXNOW_MAX_URLS + 1 }, (_, i) => `https://www.anidachi.app/p${i}`);
    const payloads = buildIndexNowPayloads(urls);
    assert.equal(payloads.length, 2);
    assert.equal(payloads[0].urlList.length, INDEXNOW_MAX_URLS);
    assert.equal(payloads[1].urlList.length, 1);
    assert.equal(payloads[0].host, "www.anidachi.app");
    assert.equal(payloads[0].keyLocation, INDEXNOW_KEY_LOCATION);
  });
});
