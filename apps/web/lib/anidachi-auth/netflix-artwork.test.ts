import assert from "node:assert/strict";
import test from "node:test";
import { isNetflixArtworkUrl } from "./netflix-artwork";
test("Netflix artwork accepts observed CDN subdomains and rejects untrusted hosts", () => {
  assert.equal(isNetflixArtworkUrl(null), true);
  assert.equal(isNetflixArtworkUrl("https://occ-0-123.nflxso.net/image.jpg?x=1"), true);
  for (const url of ["https://nflxso.net.evil.test/a", "https://evilnflxso.net/a", "https://127.0.0.1/a", "http://occ-0.nflxso.net/a", "https://user@occ-0.nflxso.net/a", "https://occ-0.nflxso.net:444/a", "https://nflxso.net/a", "https://occ-0.nflxso.net./a"]) {
    assert.equal(isNetflixArtworkUrl(url), false, url);
  }
});
