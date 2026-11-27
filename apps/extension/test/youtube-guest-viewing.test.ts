import { describe, expect, it, vi } from "vitest";
import type { RoomSessionRecord } from "../src/room-session-storage";
import { YouTubeGuestViewing } from "../src/source-adapters/youtube/guest-viewing";

const home = "https://www.youtube.com/";
const hostVideo = home + "watch?v=aaaaaaaaaaa";
const otherVideo = home + "watch?v=bbbbbbbbbbb";
function playback(url = hostVideo, playing = true) {
  return { sourceUrl: url, videoFingerprint: "youtube|" + new URL(url).searchParams.get("v"),
    updatedAt: 3000, hostTime: 97, playing, playbackRate: 1 };
}
function setup(href = home) {
  const local = { href, record: { version: 1, revision: 0, roomId: "room", ownerUserId: "viewer",
    participantSessionId: "session", cameraEnabled: false, voiceMode: "push-to-talk" } as RoomSessionRecord };
  const ctx = {
    session: () => local.record, href: () => local.href,
    playerFingerprint: () => local.href.includes("/watch?") ? playback(local.href).videoFingerprint : null,
    apply: vi.fn(), suspend: vi.fn(), offer: vi.fn(), navigate: vi.fn(),
    persist: vi.fn(async (_record: RoomSessionRecord, fingerprint: string | null) => {
      local.record = { ...local.record, youtubeFollowing: fingerprint };
      return true;
    }),
  };
  const mount = () => { const viewing = new YouTubeGuestViewing(ctx); viewing.bind(local.record); return viewing; };
  return { local, ctx, mount, viewing: mount() };
}

describe("YouTube viewing in a room", () => {
  it("offers the current host video without moving a browsing guest or controlling personal playback", () => {
    const { viewing, local, ctx, mount } = setup();
    viewing.catalog();
    viewing.receive(playback());
    local.href = otherVideo;
    viewing.refresh();
    viewing.receive(playback(hostVideo, false));
    const restored = mount();
    restored.receive(playback(otherVideo));
    expect(restored.together()).toBe(false);
    expect(ctx.offer.mock.calls).toEqual([[hostVideo], [otherVideo]]);
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.apply).not.toHaveBeenCalled();
  });

  it.each(["sleeve", "host sync"])("%s takes a viewer to the exact paused video once and restores it on load", async action => {
    const { ctx, local, mount, viewing } = setup(otherVideo);
    const state = playback(hostVideo, false);
    viewing.receive(state);
    if (action === "sleeve") await viewing.join();
    else { viewing.receive(state, undefined, true); await Promise.resolve(); }
    viewing.receive(state);
    expect(ctx.navigate.mock.calls).toEqual([[hostVideo]]);
    local.href = hostVideo;
    const restored = mount();
    restored.receive(state);
    expect(restored.together()).toBe(true);
    expect(ctx.apply).toHaveBeenLastCalledWith(state);
  });

  it("syncs in place after a direct invite, offers a new host title and leaves a different guest title under local control", async () => {
    const { ctx, local, viewing } = setup(hostVideo);
    viewing.receive(playback());
    expect(viewing.together()).toBe(true);
    viewing.receive(playback(hostVideo, false), undefined, true);
    expect(ctx.apply).toHaveBeenLastCalledWith(playback(hostVideo, false));
    local.href = otherVideo;
    expect(viewing.together()).toBe(false);
    viewing.refresh();
    expect(ctx.offer).toHaveBeenLastCalledWith(hostVideo);
    viewing.receive(playback(otherVideo));
    expect(viewing.together()).toBe(false);
    await viewing.join();
    expect(ctx.apply).toHaveBeenLastCalledWith(playback(otherVideo));
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it("cancels an outstanding jump after a source change or room exit and clears an offer in the catalog", async () => {
    const { ctx, local, viewing } = setup();
    viewing.receive(playback());
    const join = viewing.join();
    viewing.receive(playback(otherVideo));
    await join;
    const another = viewing.join();
    local.record = { ...local.record, participantSessionId: "another" };
    await another;
    expect(ctx.navigate).not.toHaveBeenCalled();
    viewing.bind(local.record);
    viewing.receive(playback());
    viewing.receive({ ...playback(), hostSurface: "catalog" }, undefined, true);
    expect(ctx.offer).toHaveBeenLastCalledWith(null);
  });

  it("rejects non-watch destinations, duplicate video ids and mismatched fingerprints", () => {
    const { ctx, viewing } = setup();
    for (const url of [otherVideo, home + "shorts/aaaaaaaaaaa", hostVideo + "&v=bbbbbbbbbbb", "https://example.org/"]) {
      viewing.receive({ ...playback(), sourceUrl: url }, undefined, true);
    }
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.offer).not.toHaveBeenCalled();
  });
});
