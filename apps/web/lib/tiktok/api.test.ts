import test from "node:test";
import assert from "node:assert/strict";
import { initInboxVideoPost, type TikTokCredentials } from "@/lib/tiktok/api";

const baseCreds: TikTokCredentials = {
  openId: "open-id-1",
  username: "acct",
  accessToken: "token",
  refreshToken: "refresh",
  accessTokenExpiry: Date.now() + 24 * 60 * 60 * 1000,
  refreshTokenExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
};

test("sends description for TikTok video init when provided", async () => {
  const originalFetch = global.fetch;
  const calls: Array<{ url: string; body: unknown }> = [];

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({ data: { publish_id: "pub_123" }, error: { code: "ok" } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const publishId = await initInboxVideoPost(
      baseCreds,
      "https://example.com/video.mp4",
      "hook title",
      "full body with hashtags and context",
    );
    assert.equal(publishId, "pub_123");

    assert.equal(calls.length, 1);
    const payload = calls[0].body as {
      post_info?: { title?: string; description?: string };
    };
    assert.equal(payload.post_info?.title, "hook title");
    assert.equal(
      payload.post_info?.description,
      "full body with hashtags and context",
    );
  } finally {
    global.fetch = originalFetch;
  }
});
