import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPublicMarketingPath,
  needsSessionMiddleware,
} from "./middleware-routes";

describe("middleware-routes", () => {
  it("treats SEO and marketing paths as public", () => {
    assert.equal(isPublicMarketingPath("/"), true);
    assert.equal(isPublicMarketingPath("/guides/best-anime-to-watch-with-friends"), true);
    assert.equal(isPublicMarketingPath("/watch/demon-slayer-with-friends"), true);
    assert.equal(isPublicMarketingPath("/compare/anidachi-vs-teleparty"), true);
    assert.equal(isPublicMarketingPath("/glossary/shonen-anime"), true);
    assert.equal(isPublicMarketingPath("/watch-anime-together"), true);
    assert.equal(isPublicMarketingPath("/privacy"), true);
    assert.equal(isPublicMarketingPath("/terms"), true);
  });

  it("requires session middleware for auth and product routes", () => {
    assert.equal(needsSessionMiddleware("/api/me"), true);
    assert.equal(needsSessionMiddleware("/account"), true);
    assert.equal(needsSessionMiddleware("/room/abc123"), true);
    assert.equal(needsSessionMiddleware("/login"), true);
    assert.equal(needsSessionMiddleware("/friends"), true);
    assert.equal(needsSessionMiddleware("/friend/invite/token"), true);
    assert.equal(needsSessionMiddleware("/extension/connect"), true);
    assert.equal(needsSessionMiddleware("/success"), true);
    assert.equal(needsSessionMiddleware("/blou/login"), true);
    assert.equal(needsSessionMiddleware("/kreatli-email-crm"), true);
    assert.equal(needsSessionMiddleware("/__anidachi/staging-access"), true);
  });
});
