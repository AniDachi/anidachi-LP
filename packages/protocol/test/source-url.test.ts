import { describe, expect, it } from "vitest";
import {
  canonicalizeRoomSourceUrl,
  RoomSourceDescriptorSchema,
} from "../src/source-url";

describe("canonical room source URLs", () => {
  // Break caught: a room source that retains a mobile/bare host or tracking query
  // would create different durable identities for the same YouTube video.
  it.each([
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://m.youtube.com/watch/?utm_source=chat&v=dQw4w9WgXcQ#anidachiRoom=room-1",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://youtu.be/dQw4w9WgXcQ?si=share#chapter=1",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
  ])("canonicalizes the accepted YouTube watch destination %s", (input, canonicalUrl) => {
    expect(canonicalizeRoomSourceUrl(input)).toEqual({
      ok: true,
      source: {
        provider: "youtube",
        sourceUrl: canonicalUrl,
        canonicalUrl,
        videoFingerprint: "youtube|dQw4w9WgXcQ",
      },
    });
  });

  // Break caught: preserving query or fragment data on an episode URL would make
  // the same Crunchyroll episode persist as multiple room sources.
  it.each([
    [
      "https://www.crunchyroll.com/watch/GOLD22222/episode-two?ref=share#anidachiRoom=room-1",
      "https://www.crunchyroll.com/watch/GOLD22222/episode-two",
    ],
    [
      "https://crunchyroll.com/watch/GOLD22222/episode-two/",
      "https://www.crunchyroll.com/watch/GOLD22222/episode-two",
    ],
    [
      "https://www.crunchyroll.com/watch/GOLD22222",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
  ])("canonicalizes the accepted Crunchyroll watch destination %s", (input, canonicalUrl) => {
    expect(canonicalizeRoomSourceUrl(input)).toEqual({
      ok: true,
      source: {
        provider: "crunchyroll",
        sourceUrl: canonicalUrl,
        canonicalUrl,
        videoFingerprint: "crunchyroll|watch/GOLD22222",
      },
    });
  });

  // Break caught: permissive provider detection would allow a player, embed,
  // redirect, or deceptive domain to become an automatic room destination.
  it.each([
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "UNSUPPORTED_ROUTE"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "UNSUPPORTED_ROUTE"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "UNSUPPORTED_PROVIDER"],
    ["https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "UNSUPPORTED_PROVIDER"],
    ["https://evil.youtube.com/watch?v=dQw4w9WgXcQ", "UNSUPPORTED_PROVIDER"],
    ["https://evil.crunchyroll.com/watch/GOLD22222/episode-two", "UNSUPPORTED_PROVIDER"],
    ["https://www.crunchyroll.com.evil.test/watch/GOLD22222/episode-two", "UNSUPPORTED_PROVIDER"],
    ["https://www.crunchyroll.com/browse/GOLD22222", "UNSUPPORTED_ROUTE"],
    ["https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ", "CREDENTIALS_FORBIDDEN"],
    ["http://www.crunchyroll.com/watch/GOLD22222/episode-two", "INSECURE_URL"],
    [" https://www.youtube.com/watch?v=dQw4w9WgXcQ ", "INVALID_URL"],
  ])("rejects unsafe or unsupported source %s", (input, code) => {
    expect(canonicalizeRoomSourceUrl(input)).toEqual({ ok: false, code });
  });

  // Break caught: accepting a different provider after the first room source
  // would violate the room's provider pin.
  it("rejects a cross-provider source change against the pinned provider", () => {
    expect(canonicalizeRoomSourceUrl(
      "https://www.crunchyroll.com/watch/GOLD22222/episode-two",
      "youtube",
    )).toEqual({ ok: false, code: "PROVIDER_MISMATCH" });
  });

  // Break caught: parser work on unbounded input would retain an unbounded URL
  // attack surface before room persistence or navigation.
  it("rejects input above the shared URL bound before parsing", () => {
    expect(canonicalizeRoomSourceUrl(
      `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${"a".repeat(2_048)}`,
    )).toEqual({ ok: false, code: "URL_TOO_LONG" });
  });

  // Break caught: accepting an uncanonical descriptor lets callers bypass the
  // canonicalizer and persist a fragment, tracking query, or wrong identity.
  it("accepts only an exact canonical room source descriptor", () => {
    const canonical = {
      provider: "youtube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoFingerprint: "youtube|dQw4w9WgXcQ",
    } as const;

    expect(RoomSourceDescriptorSchema.parse(canonical)).toEqual(canonical);
    expect(() => RoomSourceDescriptorSchema.parse({
      ...canonical,
      sourceUrl: "https://m.youtube.com/watch?v=dQw4w9WgXcQ#room=1",
    })).toThrow();
    expect(() => RoomSourceDescriptorSchema.parse({
      ...canonical,
      videoFingerprint: "youtube|another-video",
    })).toThrow();
    expect(() => RoomSourceDescriptorSchema.parse({ ...canonical, extra: true })).toThrow();
  });
});
