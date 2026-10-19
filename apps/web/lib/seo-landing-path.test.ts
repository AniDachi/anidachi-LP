import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNonMarketingPath, redactAttributionPath } from "./seo-landing-path";

describe("seo landing path", () => {
  it("never records invite or room pages as a first landing", () => {
    assert.equal(isNonMarketingPath("/friend/invite/0IfBUcVRrHa3gIZroEyX1z4BKoWZ6YsUP26xum6qHu4"), true);
    assert.equal(isNonMarketingPath("/room/abc123"), true);
    assert.equal(isNonMarketingPath("/watch-crunchyroll-together"), false);
    assert.equal(isNonMarketingPath("/"), false);
  });

  it("drops invite tokens and room ids from fallback paths", () => {
    assert.equal(redactAttributionPath("/friend/invite/secret-token"), "/friend/invite");
    assert.equal(redactAttributionPath("/room/room-id"), "/room");
    assert.equal(redactAttributionPath("/guides/how-to-watch-crunchyroll-with-friends"), "/guides/how-to-watch-crunchyroll-with-friends");
  });
});
