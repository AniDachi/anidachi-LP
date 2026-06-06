import { describe, expect, it } from "vitest";
import { prioritizeDirectIceServers } from "../src/p2p-ice";
import { getDefaultP2PIceServers } from "../src/p2p-media";

describe("P2P ICE server prioritization", () => {
  it("does not include OpenRelay TURN servers by default", () => {
    expect(JSON.stringify(getDefaultP2PIceServers())).not.toContain("openrelay");
  });

  it("keeps STUN-only servers before TURN fallback servers", () => {
    const servers = prioritizeDirectIceServers(
      [
        {
          urls: [
            "turn:turn.cloudflare.com:3478?transport=udp",
            "stun:stun.cloudflare.com:3478",
            "turns:turn.cloudflare.com:443?transport=tcp",
          ],
          username: "user",
          credential: "pass",
        },
      ],
      [{ urls: "stun:stun.l.google.com:19302" }],
    );

    expect(servers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["stun:stun.l.google.com:19302"] },
      {
        urls: [
          "turn:turn.cloudflare.com:3478?transport=udp",
          "turns:turn.cloudflare.com:443?transport=tcp",
        ],
        username: "user",
        credential: "pass",
      },
    ]);
  });

  it("deduplicates STUN URLs without dropping TURN credentials", () => {
    const servers = prioritizeDirectIceServers(
      [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:3478"] },
        {
          urls: "turn:turn.cloudflare.com:3478?transport=udp",
          username: "user",
          credential: "pass",
        },
      ],
      [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun1.l.google.com:19302"] }],
    );

    expect(servers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["stun:stun1.l.google.com:19302"] },
      {
        urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
        username: "user",
        credential: "pass",
      },
    ]);
  });
});
