import { expect, it } from "vitest";
import { createWebsiteRoomFromApi, connectWebsiteRoomFromApi } from "../src/room-client";
import { sanitizePrivacySafeData } from "../src/privacy-sanitizer";
it("routes create/connect with expected owner through the background transport", async () => {
  const seen: Headers[] = [];
  const request = async (_url: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers));
    return Response.json({ roomId: "room-a", roomToken: "room-token", shareableLink: "https://example.test/room-a", quota: { remainingSeconds: 480, resetAt: "2026-11-04T00:00:00Z" } });
  };
  expect((await createWebsiteRoomFromApi("access", "session-a", undefined, { ownerUserId: "owner-a", request })).quota?.remainingSeconds).toBe(480);
  expect((await connectWebsiteRoomFromApi("room-a", "access", "session-a", { ownerUserId: "owner-a", request })).quota?.remainingSeconds).toBe(480);
  expect(seen.map(h => h.get("x-anidachi-hosting-owner"))).toEqual(["owner-a", "owner-a"]);
});
it("redacts Free20 header, context tokens and marker names while preserving structured diagnostic context", () => {
  expect(sanitizePrivacySafeData({ "x-anidachi-free20-context": "private", context: "signed-private", browser: "a".repeat(64), installation: "b".repeat(64), browserHash: "private", installationHash: "private", browserMarker: "private", installationMarker: "private", contextDetails: { status: 428, phase: "enrollment" }, contextMetadata: "useful", browserInfo: { browser: "Chrome" }, nested: { context: { status: 503, reason: "unavailable" } } })).toEqual({ "x-anidachi-free20-context": "<redacted>", context: "<redacted>", browser: "<redacted>", installation: "<redacted>", browserHash: "<redacted>", installationHash: "<redacted>", browserMarker: "<redacted>", installationMarker: "<redacted>", contextDetails: { status: 428, phase: "enrollment" }, contextMetadata: "useful", browserInfo: { browser: "Chrome" }, nested: { context: { status: 503, reason: "unavailable" } } });
});
