import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { YOUTUBE_SHORTS_PRIVACY, youtubeUploadStepLabel } from "./privacy";

describe("YouTube Shorts privacy", () => {
  it("is always private", () => {
    assert.equal(YOUTUBE_SHORTS_PRIVACY, "private");
  });

  it("labels private uploads", () => {
    assert.match(youtubeUploadStepLabel(), /private/i);
  });
});
