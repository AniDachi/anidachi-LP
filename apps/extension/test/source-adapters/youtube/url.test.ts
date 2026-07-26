import { describe, expect, it } from "vitest";
import { parseYouTubeVideoId } from "../../../src/source-adapters/youtube/url";

describe("parseYouTubeVideoId", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("extracts a video id from %s", (value) => {
    expect(parseYouTubeVideoId(new URL(value))).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=not%20an%20id",
    "https://www.youtube.com/shorts/invalid!id",
    "https://example.com/watch?v=dQw4w9WgXcQ",
  ])("returns null for an invalid YouTube URL: %s", (value) => {
    expect(parseYouTubeVideoId(new URL(value))).toBeNull();
  });
});
