import { afterEach, describe, expect, it, vi } from "vitest";
import { detectDisneyPlusAdapter } from "../../src/source-adapters/disneyplus/definition";
import { createDisneyPlusSourceNavigator } from "../../src/source-adapters/disneyplus/navigation";
import { isDisneyPlusOrigin } from "../../src/source-adapters/disneyplus/url";

const id = "affa8341-0000-4000-8000-0e3cc0627184";
const nextId = "326bafd1-0000-4000-8000-0e3cc0627184";
const origin = "https://www.disneyplus.com";
const url = (key: string) => `${origin}/play/${key}`;
const setLocation = (href: string) => vi.stubGlobal("location", new URL(href));

function fixture() {
  setLocation(`${origin}/pt-br/play/${id}`);
  document.body.innerHTML = `<video class="hive-video" src="preview"></video>
    <div class="pbx-player-surface"><disney-web-player>
      <div class="media-element-container"><video hidden></video><video class="hive-video" src="blob:first"></video></div>
    </disney-web-player></div><disney-web-player-ui></disney-web-player-ui>`;
  const video = document.querySelector<HTMLVideoElement>(".media-element-container .hive-video")!;
  vi.spyOn(video, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 720));
  Object.defineProperty(video, "duration", { configurable: true, value: 24 });
  Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
  video.currentTime = 5;
  const ui = document.querySelector("disney-web-player-ui")!.attachShadow({ mode: "open" });
  ui.innerHTML = "<progress-bar></progress-bar>";
  const controls = ui.querySelector("progress-bar")!.attachShadow({ mode: "open" });
  controls.innerHTML = `<div class="progress-bar__container progress-bar__vod"><div class="progress-bar__seekable-range"
    role="slider" aria-valuemin="0" aria-valuemax="3016" aria-valuenow="69"></div></div>`;
  const slider = controls.querySelector<HTMLElement>("[role=slider]")!;
  const fill = document.createElement("div");
  fill.dataset.qa = "progress-bar.progress";
  slider.append(fill);
  const setPlayed = (time: number) => { fill.style.width = `${time / 3016 * 100}%`; };
  setPlayed(69);
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 30, 800, 12));
  return { video, slider, controls, setPlayed, adapter: detectDisneyPlusAdapter(document)! };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Disney+ player", () => {
  it("selects the visible Hive movie and uses the native VOD slider for its content clock and full duration", () => {
    const { adapter, video } = fixture();
    expect(adapter.getSourceDescriptor()?.duration).toBe(3016);
    expect(adapter.video).toBe(video);
    expect(adapter.getSourceDescriptor()).toMatchObject({
      provider: "disneyplus", sourceUrl: url(id), videoFingerprint: `disneyplus|play/${id}`, duration: 3016,
    });
    expect(adapter.getPlaybackSnapshot()).toMatchObject({ phase: "content", contentTime: expect.closeTo(69) });
    expect(adapter.getOverlayBinding().mountTarget).toBe(document.querySelector(".pbx-player-surface"));
    expect(adapter.getState().hostTime).toBeCloseTo(69);
  });

  it("continues from the Disney+ clock while controls are hidden and waits for calibration after a discontinuity", () => {
    const { adapter, video, slider, controls, setPlayed } = fixture();
    expect(adapter.getCurrentTime()).toBeCloseTo(69);
    slider.remove();
    video.currentTime = 6.5;
    expect(adapter.getCurrentTime()).toBeCloseTo(70.5);
    video.currentTime = 100;
    expect(adapter.getPlaybackSnapshot().phase).toBe("transition");
    expect(adapter.getSourceDescriptor()).toBeUndefined();
    controls.querySelector(".progress-bar__vod")!.append(slider);
    expect(adapter.getSourceDescriptor()).toBeUndefined();
    slider.setAttribute("aria-valuenow", "1200");
    setPlayed(1200);
    expect(adapter.getCurrentTime()).toBeCloseTo(1200);
  });

  it("uses the advancing played bar even when the accessible seek cursor stays on the last requested time", () => {
    const { adapter, controls, slider, setPlayed } = fixture();
    setPlayed(125);
    slider.setAttribute("aria-valuenow", "70");
    expect(adapter.getCurrentTime()).toBeCloseTo(125);
    slider.querySelector("[data-qa]")!.remove();
    const remaining = document.createElement("time-remaining-indicator");
    controls.append(remaining);
    remaining.attachShadow({ mode: "open" }).innerHTML = '<div data-qa="time-remaining-indicator.container">48:10</div>';
    expect(adapter.getCurrentTime()).toBe(126);
  });

  it("reveals the separate controls portal to calibrate while the native controls are initially absent", () => {
    const { adapter, slider, controls } = fixture();
    const track = slider.parentElement!;
    track.remove();
    const ui = document.querySelector("disney-web-player-ui")!;
    const onMove = vi.fn(() => controls.append(track));
    ui.addEventListener("mousemove", onMove, { once: true });
    expect(adapter.getSourceDescriptor()).toBeUndefined();
    const dispose = adapter.subscribe(() => {});
    expect(onMove).toHaveBeenCalledOnce();
    expect(adapter.getPlaybackSnapshot().phase).toBe("content");
    dispose();
  });

  it("refuses stale sources, catalog previews, and a reused element that still has the previous MediaSource", () => {
    const { adapter, video, slider, setPlayed } = fixture();
    expect(adapter.getSourceDescriptor()?.duration).toBe(3016);
    setLocation(`${origin}/pt-br/home`);
    expect(detectDisneyPlusAdapter(document)).toBeNull();
    expect(adapter.getSourceDescriptor()).toBeUndefined();
    setLocation(url(nextId));
    expect(detectDisneyPlusAdapter(document)).toBeNull();
    video.src = "blob:second";
    const next = detectDisneyPlusAdapter(document);
    expect(next?.getFingerprint()).toBe(`disneyplus|play/${nextId}`);
    expect(next?.getSourceDescriptor()).toBeUndefined();
    slider.setAttribute("aria-valuenow", "0");
    setPlayed(0);
    expect(next?.getSourceDescriptor()?.sourceUrl).toBe(url(nextId));
    expect(adapter.getSourceDescriptor()).toBeUndefined();
  });

  it("holds content commands through advertising or an invalid VOD slider and recalibrates on return", async () => {
    const { adapter, video, slider, controls, setPlayed } = fixture();
    expect(adapter.getCurrentTime()).toBeCloseTo(69);
    const ad = document.createElement("div");
    ad.setAttribute("aria-label", "Advertisement");
    vi.spyOn(ad, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 50, 20));
    controls.append(ad);
    const play = vi.spyOn(video, "play").mockResolvedValue();
    expect(adapter.getPlaybackSnapshot().phase).toBe("interstitial");
    expect(adapter.getSourceDescriptor()).toBeUndefined();
    await expect(adapter.play()).rejects.toThrow();
    expect(play).not.toHaveBeenCalled();
    ad.remove();
    slider.setAttribute("aria-disabled", "true");
    expect(adapter.getPlaybackSnapshot().phase).toBe("transition");
    slider.removeAttribute("aria-disabled");
    slider.setAttribute("aria-valuenow", "70");
    setPlayed(70);
    expect(adapter.getCurrentTime()).toBeCloseTo(70);
  });

  it("waits for the separate portal to update after Disney swaps the entire video element", () => {
    const { adapter, video, setPlayed } = fixture();
    expect(adapter.getSourceDescriptor()).toBeDefined();
    setLocation(url(nextId));
    const replacement = document.createElement("video");
    replacement.className = "hive-video";
    replacement.src = "blob:new-film";
    Object.defineProperty(replacement, "readyState", { value: 4 });
    vi.spyOn(replacement, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 720));
    video.replaceWith(replacement);
    const next = detectDisneyPlusAdapter(document)!;
    expect(next.getSourceDescriptor()).toBeUndefined();
    setPlayed(7);
    expect(next.getSourceDescriptor()?.sourceUrl).toBe(url(nextId));
  });

  it("uses the full slider for a far seek and consumes personal resume only at the confirmed position", async () => {
    const { adapter, video, slider, setPlayed } = fixture();
    const targetTime = 1508;
    const input = vi.fn((event: PointerEvent) => {
      expect(event.clientX).toBe(420);
      slider.setAttribute("aria-valuenow", String(targetTime));
      setPlayed(targetTime);
    });
    slider.addEventListener("pointerup", input);
    const intent = { currentTime: targetTime, sourceUrl: url(id), expiresAt: Date.now() + 10_000, intentId: "resume" };
    expect(await adapter.getPersonalResumeReadiness(intent)).toBe("ready");
    expect(await adapter.seekPersonalResume(intent, () => true)).toBe("consumed");
    expect(input).toHaveBeenCalledOnce();
    expect(video.currentTime).toBe(5);
  });

  it("isolates native play, pause, and rate commands and removes all player listeners", async () => {
    const { adapter, video, slider } = fixture();
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
    const notify = vi.fn();
    const dispose = adapter.subscribe(notify);
    await adapter.play();
    expect(play).toHaveBeenCalledOnce();
    adapter.pause();
    expect(pause).toHaveBeenCalledOnce();
    video.dispatchEvent(new Event("pause"));
    expect(notify).toHaveBeenCalledWith({ type: "pause", time: expect.closeTo(69) });
    dispose();
    dispose();
    notify.mockClear();
    video.dispatchEvent(new Event("play"));
    expect(notify).not.toHaveBeenCalled();
    slider.remove();
    setLocation(url(nextId));
    adapter.setPlaybackRate(1.5);
    expect(video.playbackRate).toBe(1);
    await expect(adapter.play()).rejects.toThrow();
    adapter.pause();
    expect(pause).toHaveBeenCalledTimes(1);
  });
});

describe("Disney+ guest navigation", () => {
  const source = { provider: "disneyplus" as const, canonicalUrl: url(nextId), sourceUrl: url(nextId),
    title: "Episode", videoFingerprint: `disneyplus|play/${nextId}` };
  const context = { roomId: "test-room", roomProvider: "disneyplus" as const, signal: new AbortController().signal };
  it("preserves the guest's locale and only the AniDachi room hash", async () => {
    const assign = vi.fn();
    const ensure = createDisneyPlusSourceNavigator({ currentHref: () => `${origin}/pt-br/home`, assign });
    const expected = `${origin}/pt-br/play/${nextId}#anidachiRoom=test-room`;
    expect(await ensure(source, context)).toEqual({ status: "navigation-started", targetUrl: expected });
    expect(assign).toHaveBeenCalledWith(expected);
    const current = createDisneyPlusSourceNavigator({ currentHref: () => `${origin}/en/play/${nextId}`, assign });
    expect(await current(source, context)).toEqual({ status: "already-current" });
  });

  it.each([
    "http://www.disneyplus.com", "https://www.disneyplus.com.evil.example", "https://user@www.disneyplus.com",
    "https://www.disneyplus.com:443", "https://www.disneyplus.com\\@evil.example", "https://evil.example",
  ])("rejects foreign or unsafe origins %s", async (foreign) => {
    const assign = vi.fn();
    const unsafe = `${foreign}/play/${nextId}`;
    const ensure = createDisneyPlusSourceNavigator({ currentHref: () => url(id), assign });
    expect(await ensure({ ...source, sourceUrl: unsafe }, context)).toMatchObject({ status: "unsupported" });
    expect(isDisneyPlusOrigin(unsafe)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
