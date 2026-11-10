import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildLlmsTxt } from "./llms-txt";
import { PLANNED_PLATFORMS, PRODUCT_FACTS, PRODUCT_FEATURE_LIST, SUPPORTED_PLATFORMS } from "./product-facts";

const ORIGIN = "https://www.anidachi.app";
const appDir = path.join(__dirname, "..", "app");
const routeExists = (urlPath: string) =>
  urlPath === "/" || fs.existsSync(path.join(appDir, ...urlPath.split("/").filter(Boolean), "page.tsx"));

describe("product facts and llms.txt", () => {
  it("names every supported platform in the facts and the feature list", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      assert.ok(PRODUCT_FACTS.includes(platform.name), `${platform.name} missing from facts`);
      assert.ok(PRODUCT_FEATURE_LIST.some((f) => f.includes(platform.name)), `${platform.name} missing from featureList`);
    }
  });

  it("never presents a planned platform as supported", () => {
    for (const planned of PLANNED_PLATFORMS) {
      assert.ok(!PRODUCT_FACTS.includes(planned), `${planned} must not appear in the facts`);
      assert.ok(!SUPPORTED_PLATFORMS.some((p) => p.name === planned));
    }
  });

  it("links only to routes that exist", () => {
    const body = buildLlmsTxt(ORIGIN);
    const links = [...body.matchAll(/\]\((https:\/\/www\.anidachi\.app[^)]*)\)/g)].map((m) => new URL(m[1]).pathname);
    assert.ok(links.length >= 10);
    for (const link of links) assert.ok(routeExists(link), `llms.txt links to a missing route: ${link}`);
    for (const platform of SUPPORTED_PLATFORMS) assert.ok(links.includes(platform.hubPath));
  });

  it("starts with the title and the facts summary", () => {
    const body = buildLlmsTxt(ORIGIN);
    assert.ok(body.startsWith("# AniDachi\n\n> "));
    assert.ok(body.includes(PRODUCT_FACTS));
  });
});
