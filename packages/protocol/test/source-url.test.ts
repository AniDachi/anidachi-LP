import { describe, expect, it } from "vitest";
import {
  canonicalizeRoomSourceUrl,
  RoomSourceDescriptorSchema,
} from "../src/source-url";
import { MAX_URL_CHARS, MAX_VIDEO_FINGERPRINT_CHARS } from "../src/limits";

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
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://crunchyroll.com/watch/GOLD22222/episode-two/",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://www.crunchyroll.com/watch/GOLD22222",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://www.crunchyroll.com/ru/watch/GOLD22222/episode-two",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://www.crunchyroll.com/en-US/watch/GOLD22222/episode-two",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://www.crunchyroll.com/en-gb/watch/GOLD22222/episode-two",
      "https://www.crunchyroll.com/watch/GOLD22222",
    ],
    [
      "https://www.crunchyroll.com/EN-us/watch/GOLD22222/episode-two",
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

  // Break caught: retaining a mutable slug makes two URLs for the same episode
  // disagree at the durable source URL despite sharing a fingerprint.
  it("converges Crunchyroll slug aliases on the episode-only canonical path", () => {
    const aliases = [
      "https://www.crunchyroll.com/watch/GOLD22222/episode-two",
      "https://www.crunchyroll.com/watch/GOLD22222/renamed-episode",
      "https://crunchyroll.com/watch/GOLD22222",
    ];

    for (const alias of aliases) {
      expect(canonicalizeRoomSourceUrl(alias)).toEqual({
        ok: true,
        source: {
          provider: "crunchyroll",
          sourceUrl: "https://www.crunchyroll.com/watch/GOLD22222",
          canonicalUrl: "https://www.crunchyroll.com/watch/GOLD22222",
          videoFingerprint: "crunchyroll|watch/GOLD22222",
        },
      });
    }
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
    ["https://www.crunchyroll.com/rus/watch/GOLD22222", "UNSUPPORTED_ROUTE"],
    ["https://www.crunchyroll.com/en_US/watch/GOLD22222", "UNSUPPORTED_ROUTE"],
    ["https://www.crunchyroll.com/en-US.evil/watch/GOLD22222", "UNSUPPORTED_ROUTE"],
    ["https://www.crunchyroll.com/ru/watch/GOLD22222/episode/extra", "UNSUPPORTED_ROUTE"],
    ["https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ", "CREDENTIALS_FORBIDDEN"],
    ["http://www.crunchyroll.com/watch/GOLD22222/episode-two", "INSECURE_URL"],
    [" https://www.youtube.com/watch?v=dQw4w9WgXcQ ", "INVALID_URL"],
    ["https:youtube.com/watch?v=dQw4w9WgXcQ", "INVALID_URL"],
    ["https:\\\\www.youtube.com\\watch?v=dQw4w9WgXcQ", "INVALID_URL"],
    ["https:///www.youtube.com/watch?v=dQw4w9WgXcQ", "INVALID_URL"],
    ["https:////www.youtube.com/watch?v=dQw4w9WgXcQ", "INVALID_URL"],
    ["https://www.youtu\nbe.com/watch?v=dQw4w9WgXcQ", "INVALID_URL"],
    ["https://www.youtube.com:444/watch?v=dQw4w9WgXcQ", "INVALID_URL"],
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

  // Break caught: applying a provider pin to a matching source must not reject
  // an ordinary same-provider room update.
  it("accepts a source change for the pinned provider", () => {
    expect(canonicalizeRoomSourceUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtube",
    )).toMatchObject({ ok: true, source: { provider: "youtube" } });
  });

  // Break caught: picking an arbitrary duplicate query value would give one URL
  // more than one possible room identity.
  it("rejects duplicate YouTube video identifiers", () => {
    expect(canonicalizeRoomSourceUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aqz-KE-bpKQ",
    )).toEqual({ ok: false, code: "UNSUPPORTED_ROUTE" });
  });

  // Break caught: parser work on unbounded input would retain an unbounded URL
  // attack surface before room persistence or navigation.
  it("rejects input above the shared URL bound before parsing", () => {
    expect(canonicalizeRoomSourceUrl(
      `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${"a".repeat(2_048)}`,
    )).toEqual({ ok: false, code: "URL_TOO_LONG" });
  });

  // Break caught: a successful canonicalization that cannot pass the strict
  // descriptor schema leaves future callback consumers with an impossible value.
  it("returns only strict-schema-valid descriptors within every generated bound", () => {
    const maxYouTubeId = "a".repeat(
      MAX_VIDEO_FINGERPRINT_CHARS - "youtube|".length,
    );
    const maxCrunchyrollId = "b".repeat(
      MAX_VIDEO_FINGERPRINT_CHARS - "crunchyroll|watch/".length,
    );
    const inputs = [
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      `https://www.youtube.com/watch?v=${maxYouTubeId}`,
      `https://www.crunchyroll.com/watch/${maxCrunchyrollId}/renamed-episode`,
    ];

    for (const input of inputs) {
      const result = canonicalizeRoomSourceUrl(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(RoomSourceDescriptorSchema.safeParse(result.source).success).toBe(true);
      expect(result.source.videoFingerprint.length).toBeLessThanOrEqual(
        MAX_VIDEO_FINGERPRINT_CHARS,
      );
      expect(result.source.sourceUrl.length).toBeLessThanOrEqual(MAX_URL_CHARS);
      expect(result.source.canonicalUrl.length).toBeLessThanOrEqual(MAX_URL_CHARS);
    }
  });

  // Break caught: accepting an identifier one character beyond the fingerprint
  // limit would make the canonicalizer emit a descriptor the shared schema rejects.
  it.each([
    [
      `https://www.youtube.com/watch?v=${"a".repeat(MAX_VIDEO_FINGERPRINT_CHARS - "youtube|".length + 1)}`,
      "UNSUPPORTED_ROUTE",
    ],
    [
      `https://www.crunchyroll.com/watch/${"b".repeat(MAX_VIDEO_FINGERPRINT_CHARS - "crunchyroll|watch/".length + 1)}`,
      "UNSUPPORTED_ROUTE",
    ],
  ])("rejects an identity beyond the generated descriptor bounds", (input, code) => {
    expect(canonicalizeRoomSourceUrl(input)).toEqual({ ok: false, code });
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
