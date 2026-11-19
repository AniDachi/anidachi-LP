import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import { expect, it, vi } from "vitest";
import { PrimeBrowsingRoom, PrimeHostVisit } from "../../../src/source-adapters/primevideo/browsing-room";
import { isPrimeRoomBrowsingPage } from "../../../src/source-adapters/primevideo/url";

function title(id: string): WatchSourceDescriptor {
  const sourceUrl = `https://www.primevideo.com/detail/${id}`;
  return { provider: "primevideo", sourceUrl, canonicalUrl: sourceUrl, title: id, videoFingerprint: `primevideo|detail/${id}` };
}
const first = title("0SXKMY213EM2FCKUVVKUW95I2C");
const next = title("0FX1R3RCDS4LZSFJ9KPUBXJFAA");
const visit = crypto.randomUUID();
function state(source: WatchSourceDescriptor, playing: boolean, primePlayerVisit = visit): PlaybackState {
  return { videoFingerprint: source.videoFingerprint, playing, primePlayerVisit, hostTime: 30, playbackRate: 1, updatedAt: 10000 };
}

it("pauses the old host visit on close and publishes a new visit only when the reopened title plays", () => {
  const host = new PrimeHostVisit();
  const event = { type: "HOST_STATE" as const, roomId: "room", source: first, state: state(first, true) };
  const began = host.playback(event)!;
  expect(host.playback(event)?.state.primePlayerVisit).toBe(began.state.primePlayerVisit);
  expect(host.close("room")?.state).toMatchObject({ playing: false, primePlayerVisit: began.state.primePlayerVisit });
  expect(host.close("room")).toBeNull();
  expect(host.playback({ ...event, state: state(first, false) })).toBeNull();
  expect(host.playback(event)?.state.primePlayerVisit).not.toBe(began.state.primePlayerVisit);
  expect(host.close("another-room")).toBeNull();
});

it("ignores old host heartbeats and an unopened title, follows once when playing, cancels on leave", () => {
  const guest = new PrimeBrowsingRoom();
  const launch = vi.fn(async (_source: WatchSourceDescriptor, _room: string, _signal: AbortSignal) => true);
  guest.setRoom("room");
  guest.receive(state(first, true), first, launch);
  guest.setBrowsing(true);
  guest.receive(state(first, true), first, launch);
  guest.receive(state(next, false), next, launch);
  expect(launch).not.toHaveBeenCalled();
  guest.receive(state(next, true), undefined, launch);
  guest.receive(state(next, true), next, launch);
  expect(launch).toHaveBeenCalledExactlyOnceWith(next, "room", expect.any(AbortSignal));
  guest.setRoom(null);
  expect(launch.mock.calls[0]![2].aborted).toBe(true);
});

it("restores a browsing guest's baseline and recognizes a deliberate same-title launch", () => {
  const guest = new PrimeBrowsingRoom();
  const launch = vi.fn(async () => true);
  guest.setRoom("room");
  guest.setBrowsing(true, { fingerprint: first.videoFingerprint, visit });
  guest.receive(state(first, true), first, launch);
  guest.receive(state(first, false, crypto.randomUUID()), first, launch);
  expect(launch).not.toHaveBeenCalled();
  guest.receive(state(first, true, crypto.randomUUID()), first, launch);
  expect(launch).toHaveBeenCalledTimes(1);
});

it.each([
  ["https://www.primevideo.com/region/na/", true],
  ["https://www.primevideo.com/region/na/storefront?contentType=tv", true],
  ["https://www.amazon.de/-/en/gp/video/search", true],
  ["https://www.amazon.com/Amazon-Video/b", true],
  ["https://www.amazon.com/dp/B0HCJ112J8", false],
  ["https://www.amazon.com/gp/video/settings", false],
  ["https://www.amazon.de/-/en/gp/cart/view.html", false],
  ["https://www.primevideo.com/help", false],
  ["https://www.primevideo.com.example.org/storefront", false],
])("recognizes a Prime browsing surface at %s", (url, expected) => {
  expect(isPrimeRoomBrowsingPage(url as string)).toBe(expected);
});
