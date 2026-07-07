import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adaptCaptionForYouTube } from "./caption";

describe("adaptCaptionForYouTube", () => {
  it("splits first line into title and rest into description", () => {
    const result = adaptCaptionForYouTube("My title line\nBody text here");
    assert.equal(result.title, "My title line");
    assert.match(result.description, /Body text here/);
    assert.match(result.description, /#Shorts/i);
  });

  it("adds #Shorts when missing", () => {
    const result = adaptCaptionForYouTube("Only one line");
    assert.match(result.title + result.description, /#Shorts/i);
  });
});
