import { describe, expect, it } from "vitest";
import { buildRoomShareableUrl } from "../src/room-url";

describe("room URL helpers", () => {
  it("builds shareable room URLs on the AniDachi website, not the current video page", () => {
    expect(buildRoomShareableUrl("room 1", "https://staging.anidachi.app")).toBe(
      "https://staging.anidachi.app/room/room%201",
    );
  });

  it("encodes room ids as a single path segment", () => {
    expect(buildRoomShareableUrl("abc/def", "https://staging.anidachi.app/base")).toBe(
      "https://staging.anidachi.app/room/abc%2Fdef",
    );
  });
});
