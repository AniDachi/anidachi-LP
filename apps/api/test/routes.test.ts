import { describe, expect, it } from "vitest";
import app from "../src/index";

describe("worker routes", () => {
  it("does not expose the legacy LiveKit token endpoint", async () => {
    const response = await app.request(
      "/livekit/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "room-1",
          identity: "user-1",
          name: "AniDachi user",
        }),
      },
      {},
    );

    expect(response.status).toBe(404);
  });
});
