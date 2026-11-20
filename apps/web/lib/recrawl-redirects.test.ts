import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../next.config";
import sitemap from "../app/sitemap";
import { RECRAWL_REDIRECT_PATHS } from "./recrawl-redirects";

describe("temporary recrawl sitemap (ANI-38)", () => {
  it("lists only URLs that permanently redirect", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    const permanent = new Set(redirects.filter((r) => r.permanent).map((r) => r.source));
    for (const path of RECRAWL_REDIRECT_PATHS) {
      assert.ok(permanent.has(path), `${path} has no permanent redirect`);
    }
  });

  it("keeps redirected URLs out of the main sitemap", () => {
    const main = new Set(sitemap().map((entry) => new URL(entry.url).pathname));
    for (const path of RECRAWL_REDIRECT_PATHS) {
      assert.ok(!main.has(path), `${path} is in sitemap.xml`);
    }
  });
});
