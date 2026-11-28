import { detectSourceAdapter } from "../../src/source-adapters/registry";
import { sourceProviderFromUrl } from "../../src/source-adapters/core/source-url";
import { isOverlayAllowedOnPage } from "../../src/overlay-mount";
import * as metadata from "../../src/source-adapters/hbomax/metadata";
import { afterEach, expect, it, vi } from "vitest";
import { detectHboMaxAdapter, hbomaxDefinition } from "../../src/source-adapters/hbomax/definition";

import { startHboClock } from "../../src/source-adapters/hbomax/native-clock";

let stopClock: (() => void) | undefined;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const nextId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const url = (id: string) => "https://www.hbomax.com/video/watch/" + id;
const go = (href: string) => vi.stubGlobal("location", new URL(href));
function fixture(prefix = 0, adDuration = 0) {
  go(url(id));
  document.body.innerHTML = '<video src="preview"></video><div data-testid="playerContainer"><video data-testid="VideoElement" src="blob:first"></video><div data-testid="overlay-root"><div data-testid="ad" style="visibility:hidden"></div><div data-testid="playback_controls"><div data-testid="control_footer"><div data-testid="player-ux-scrubber-position" aria-valuemax="3112"></div></div></div></div></div>';
  const video = document.querySelector<HTMLVideoElement>('[data-testid="VideoElement"]')!;
  const player = video.parentElement!;
  for (const element of [video, player]) {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 720));
  }
  Object.defineProperty(video, "duration", { configurable: true, value: 3112 + prefix + adDuration });
  Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
  const main = { type: "main", startMs: prefix * 1000, durationMs: 3112000 };
  const timeline = {
    _videoElement: video, _isInitialized: true,
    getPlayheadData: (ms: number) => ({ contentPlayheadMs: Math.max(0, ms - adDuration * 1000) }),
    getStreamPlayhead: (ms: number) => ms + adDuration * 1000,
  };
  const controls = {
    _rootElement: player, _lastLoadedContentMetadata: { videoId: id, id: "edit" },
    _playbackEngineAdapter: { _activeLoadContext: { contentId: "edit" },
      _activeStreamInfo: { streamMode: "VOD", videoPeriods: [main] }, _timelineManager: timeline },
  };
  Reflect.set(player.querySelector('[data-testid="overlay-root"]')!, "__reactFiber$test",
    { return: { memoizedProps: { playerCallbacks: { mediator: { _playerControls: controls } } } } });
  stopClock = startHboClock(document);
  return { controls, main, timeline, adapter: detectHboMaxAdapter(document)!, video, player };
}
afterEach(() => {
  stopClock?.();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("binds the main video on a watch page and ignores unrelated previews and catalogue routes", () => {
  const { adapter, player } = fixture();
  expect(adapter.getSourceDescriptor()).toMatchObject({ provider: "hbomax", sourceUrl: url(id), duration: 3112 });
  expect(adapter.getOverlayBinding()).toMatchObject({ mountTarget: player, useNativePlayerDoubleClick: true });
  expect(hbomaxDefinition.detect(document.querySelector("video")!)).toBeNull();
  go("https://www.hbomax.com/show/" + id);
  expect(detectHboMaxAdapter(document)).toBeNull();
  expect(adapter.getSourceDescriptor()).toBeUndefined();
});

it("withholds a recycled video while only the URL has changed", () => {
  const { adapter, video } = fixture();
  go(url(nextId));
  expect(detectHboMaxAdapter(document)).toBeNull();
  expect(adapter.getPlaybackSnapshot().phase).toBe("transition");
  video.src = "blob:second";
  expect(detectHboMaxAdapter(document)?.getFingerprint()).toBe("hbomax|video/watch/" + nextId);
});

it("rebinds a reused MediaSource only after the native timeline confirms the new episode", () => {
  const { controls, adapter } = fixture();
  go(url(nextId));
  expect(detectHboMaxAdapter(document)).toBeNull();
  controls._lastLoadedContentMetadata.videoId = nextId;
  const next = detectHboMaxAdapter(document);
  expect(next).not.toBe(adapter);
  expect(next?.getFingerprint()).toBe("hbomax|video/watch/" + nextId);
});

it("reads the same-show Up Next queue only for the current episode and edition", () => {
  const { adapter, controls, video } = fixture(15, 10);
  video.currentTime = 100;
  const showId = "fff09eaf-17c3-446b-be32-8a0d47e4ccf1";
  Object.assign(controls._lastLoadedContentMetadata, { videoType: "EPISODE", showId });
  Object.assign(controls._playbackEngineAdapter._activeStreamInfo, { videoAboutToEndMs: 3105000 });
  const next = { videoId: nextId, showId, videoType: "EPISODE" };
  const queue = { _videoId: id, _contentMetadata: { id: "edit" }, upNextContentMetaData: next };
  Object.assign(controls, { _overlayCoordinator: { _overlays: [
    { id: "up_next", _controller: { adaptors: new Map([["upNext", queue]]) } },
  ] } });
  expect(adapter.getEpisodeSuccessor()).toEqual({ fingerprint: "hbomax|video/watch/" + nextId, creditsStart: 3090 });
  next.showId = id;
  expect(adapter.getEpisodeSuccessor()).toBeUndefined();
  next.showId = showId;
  next.videoType = "MOVIE";
  expect(adapter.getEpisodeSuccessor()).toBeUndefined();
  next.videoType = "EPISODE";
  queue._contentMetadata.id = "previous-edition";
  expect(adapter.getEpisodeSuccessor()).toBeUndefined();
  queue._contentMetadata.id = "edit";
  queue._videoId = nextId;
  expect(adapter.getEpisodeSuccessor()).toBeUndefined();
});

it("identifies the first episode of the next season from the loaded player when its catalog page is missing", () => {
  const { controls, video, player } = fixture();
  const showId = "fff09eaf-17c3-446b-be32-8a0d47e4ccf1";
  go(url(nextId));
  vi.spyOn(document, "location", "get").mockReturnValue(location);
  video.src = "blob:season-two";
  const next = detectHboMaxAdapter(document)!;
  Object.assign(controls._lastLoadedContentMetadata, {
    videoType: "EPISODE", showId, seasonNumber: 2, episodeNumber: 1,
    title: "Adventure Time", subtitle: "It Came From the Nightosphere",
  });
  expect(next.getSourceDescriptor()).toBeUndefined(); // The previous video is still loaded.
  controls._lastLoadedContentMetadata.videoId = nextId;
  player.insertAdjacentHTML("beforeend", '<div data-testid="content-metadata"><span data-testid="player-ux-asset-title">Adventure Time</span><span data-testid="player-ux-season-episode">S2 E1</span><span data-testid="player-ux-asset-subtitle">It Came From the Nightosphere</span></div>');
  expect(next.getSourceDescriptor()).toMatchObject({
    hbomaxIdentity: { kind: "episode", providerSeriesId: showId, providerEpisodeIdentifier: nextId },
    seriesTitle: "Adventure Time", episodeTitle: "It Came From the Nightosphere", seasonNumber: 2, episodeNumber: 1,
  });
  Object.assign(controls._lastLoadedContentMetadata, { videoType: "MOVIE" });
  expect(next.getSourceDescriptor()?.hbomaxIdentity).toBeUndefined();
});

it("rejects ambiguous main videos", () => {
  const { player, video } = fixture();
  const other = video.cloneNode() as HTMLVideoElement;
  player.append(other);
  vi.spyOn(other, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 720));
  expect(detectHboMaxAdapter(document)).toBeNull();
});

it("suppresses remote changes and timeline events during visible ads", () => {
  const { adapter, video, player } = fixture();
  const emit = vi.fn();
  const unsubscribe = adapter.subscribe(emit);
  const ad = player.querySelector<HTMLElement>('[data-testid="ad"]')!;
  ad.style.visibility = "visible";
  vi.spyOn(ad, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 720));
  video.dispatchEvent(new Event("play"));
  expect(emit.mock.calls.map(([event]) => event.type)).toEqual(["phasechange"]);
  expect(adapter.getPlaybackSnapshot().phase).toBe("interstitial");
  adapter.seek(10);
  expect(video.currentTime).toBe(0);
  expect(adapter.getSourceDescriptor()).toBeUndefined();
  unsubscribe();
});

it("accepts personal resume only on matching ready content, with a live intent", async () => {
  const { adapter, video } = fixture();
  const target = { sourceUrl: url(id), expiresAt: Date.now() + 60000, currentTime: 18, intentId: "test" };
  expect(await adapter.seekPersonalResume(target, () => false)).toBe("cancelled");
  expect(await adapter.seekPersonalResume(target, () => true)).toBe("consumed");
  expect(video.currentTime).toBe(18);
  expect(await adapter.getPersonalResumeReadiness({ ...target, sourceUrl: url(nextId) })).toBe("cancelled");
});

it("pauses confirmed episode content during a seek, while ignoring promos and stale episodes", () => {
  const { adapter, video } = fixture(15);
  video.currentTime = 90;
  Object.defineProperty(video, "seeking", { configurable: true, value: true });
  Object.defineProperty(video, "readyState", { configurable: true, value: 1 });
  const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
  expect(adapter.getPlaybackSnapshot().phase).toBe("buffering");
  adapter.pause();
  expect(pause).toHaveBeenCalledOnce();

  video.currentTime = 3;
  adapter.pause();
  go(url(nextId));
  video.currentTime = 90;
  adapter.pause();
  expect(pause).toHaveBeenCalledOnce();
});

it("reserves space for the native toolbar only while its ancestor is visible", () => {
  const { adapter, player } = fixture();
  const footer = player.querySelector<HTMLElement>('[data-testid="control_footer"]')!;
  vi.spyOn(footer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 552, 1280, 168));
  expect(adapter.getOverlayGeometry().safeInsets.bottomPx).toBe(168);
  footer.parentElement!.style.opacity = "0";
  expect(adapter.getOverlayGeometry().safeInsets.bottomPx).toBe(0);
});

it("blocks playback updates when the provider's timeline and media duration disagree", async () => {
  const { adapter, player, video } = fixture();
  player.querySelector('[data-testid="player-ux-scrubber-position"]')!.setAttribute("aria-valuemax", "18");
  expect(adapter.getPlaybackSnapshot().phase).toBe("transition");
  await expect(adapter.play()).rejects.toThrow();
  adapter.seek(12);
  expect(video.currentTime).toBe(0);
});

it("navigates to canonical watch URLs carrying the requested room, and rejects mismatched descriptors", async () => {
  const { adapter } = fixture();
  const descriptor = adapter.getSourceDescriptor()!;
  const context = { roomProvider: "hbomax" as const, signal: new AbortController().signal, roomId: "room-1" };
  const assign = vi.fn();
  vi.stubGlobal("location", { href: url(id), origin: "https://www.hbomax.com", assign });
  expect(await hbomaxDefinition.ensureSource(descriptor, context)).toEqual({ status: "already-current" });
  const other = { ...descriptor, sourceUrl: url(nextId), canonicalUrl: url(nextId) };
  expect(await hbomaxDefinition.ensureSource(other, context)).toMatchObject({ status: "unsupported" });
  const result = await hbomaxDefinition.ensureSource({ ...other, videoFingerprint: "hbomax|video/watch/" + nextId }, context);
  expect(result).toMatchObject({ status: "navigation-started" });
  expect(assign).toHaveBeenCalledWith(url(nextId) + "#anidachiRoom=room-1");
});

it("keeps the active adapter live when HBO replaces the MediaSource on the same route", () => {
  const { adapter, video } = fixture();
  video.src = "blob:recovered";
  expect(detectHboMaxAdapter(document)).toBe(adapter);
  expect(adapter.getPlaybackSnapshot().phase).toBe("content");
  go(url(nextId));
  expect(detectHboMaxAdapter(document)).toBeNull();
});

it("includes only normalized, provider-owned metadata posters in a room descriptor", () => {
  const { adapter } = fixture();
  const poster = "https://images.cdn.prd.api.discomax.com/abcd/title.jpg";
  const value: metadata.HboMaxPlaybackMetadata = {
    title: "Movie", displayTitle: "Movie", episodeTitle: "Movie", episodeNumber: null, seasonTitle: null,
    seasonNumber: null, artworkUrl: poster + "?w=256",
    identity: { kind: "movie", providerMovieId: nextId, providerPlaybackId: id },
  };
  const read = vi.spyOn(metadata, "readHboMaxPlaybackMetadata").mockReturnValue(value);
  expect(adapter.getSourceDescriptor()?.posterUrl).toBe(poster);
  read.mockReturnValue({ ...value, artworkUrl: "https://example.com/tracker.jpg" });
  expect(adapter.getSourceDescriptor()?.posterUrl).toBeUndefined();
});

it("uses the visible footer when HBO mounts desktop and compact controls together", () => {
  const { adapter, player } = fixture();
  const hiddenFooter = player.querySelector<HTMLElement>('[data-testid="control_footer"]')!;
  const activeFooter = hiddenFooter.cloneNode(false) as HTMLElement;
  hiddenFooter.style.display = "none";
  hiddenFooter.after(activeFooter);
  vi.spyOn(activeFooter, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 600, 1240, 120));
  expect(adapter.getOverlayGeometry().safeInsets.bottomPx).toBe(120);
});

it.each(["https://www.hbomax.com:8443", "https://play.max.com:8443", "https://help.hbomax.com"])(
  "keeps unsupported HBO surfaces out of the generic adapter on %s", origin => {
    fixture();
    const href = origin + "/video/watch/" + id;
    go(href);
    expect(isOverlayAllowedOnPage(href)).toBe(false);
    expect(sourceProviderFromUrl(href)).toBeNull();
    expect(detectSourceAdapter(document)).toBeNull();
  },
);

it.each([[0, 0], [29.959, 0], [8.45, 13]])("maps episode time both ways with a %ss promo and %ss inserted ad", (prefix, ad) => {
  const { video, adapter, main } = fixture(prefix, ad);
  video.currentTime = 171 + prefix + ad;
  expect(adapter.getState().hostTime).toBeCloseTo(171);
  expect(adapter.getSourceDescriptor()?.duration).toBe(3112);
  adapter.seek(81.5);
  expect(video.currentTime).toBeCloseTo(81.5 + prefix + ad);
  if (prefix > 0) {
    video.currentTime = ad + 1;
    expect(adapter.getPlaybackSnapshot().phase).toBe("interstitial");
    adapter.seek(81.5);
    expect(video.currentTime).toBe(ad + 1);
    main.startMs = 0; // Same episode reloaded with a different playlist.
    expect(adapter.getState().hostTime).toBeCloseTo(1);
  }
});

it("can play through a guest promo while preserving its local playhead", async () => {
  const { adapter, video } = fixture(15);
  const play = vi.spyOn(video, "play").mockResolvedValue();
  await adapter.resumeInterstitial(AbortSignal.abort());
  expect(play).not.toHaveBeenCalled();
  await adapter.resumeInterstitial(new AbortController().signal);
  expect(play).toHaveBeenCalledOnce();
  expect(video.currentTime).toBe(0);
});

it("waits for a matching loaded episode and a usable native timeline", () => {
  const { controls, adapter, video, timeline } = fixture();
  controls._lastLoadedContentMetadata.videoId = nextId;
  expect(adapter.getPlaybackSnapshot().phase).toBe("transition");
  adapter.seek(50);
  expect(video.currentTime).toBe(0);
  controls._lastLoadedContentMetadata.videoId = id;
  timeline._isInitialized = false;
  expect(adapter.getSourceDescriptor()).toBeUndefined();
});
