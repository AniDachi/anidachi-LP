import { describe, expect, it } from "vitest";
import { MAX_URL_CHARS } from "@anidachi/protocol";
import {
  canonicalWatchSourceUrl,
  normalizeVideoFingerprint,
  sourceProviderFromUrl,
} from "../../../src/source-adapters/core/source-url";

describe("canonicalWatchSourceUrl", () => {
  it("removes the Anidachi room hash while preserving other hash parameters", () => {
    expect(
      canonicalWatchSourceUrl(
        "https://example.com/watch/episode-1#anidachiRoom=room-123&chapter=2",
      ),
    ).toBe("https://example.com/watch/episode-1#chapter=2");
  });

  it("rejects URL values that exceed the protocol limit", () => {
    const prefix = "https://example.com/";
    const atLimit = `${prefix}${"a".repeat(MAX_URL_CHARS - prefix.length)}`;
    const overLimit = `${atLimit}a`;

    expect(canonicalWatchSourceUrl(atLimit)).toBe(atLimit);
    expect(canonicalWatchSourceUrl(overLimit)).toBeNull();
  });
});

describe("sourceProviderFromUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=video", "youtube"],
    ["https://youtu.be/video", "youtube"],
    ["https://www.youtube-nocookie.com/embed/video", "youtube"],
    ["https://www.crunchyroll.com/watch/episode", "crunchyroll"],
    ["https://example.com/watch/video", "generic"],
  ] as const)("classifies %s as %s", (url, provider) => {
    expect(sourceProviderFromUrl(url)).toBe(provider);
  });

  it("rejects malformed URLs without throwing", () => {
    expect(sourceProviderFromUrl("http://[")).toBeNull();
  });
});

describe("normalizeVideoFingerprint", () => {
  it("keeps a normal fingerprint unchanged", () => {
    expect(normalizeVideoFingerprint("html5|/watch|/demo.mp4")).toBe(
      "html5|/watch|/demo.mp4",
    );
  });
});
