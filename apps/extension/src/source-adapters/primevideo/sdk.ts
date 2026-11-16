import type { PrimeSnapshot } from "./contract";
import { object, readPrimePage, type ObjectValue, type PrimePage } from "./metadata";
type Method = (...args: number[]) => unknown;
export type PrimeSdk = { context: ObjectValue; webPlayer: ObjectValue; titleApi: ObjectValue; timelineApi: ObjectValue; playerFacade: unknown; playback: ObjectValue; video: HTMLVideoElement; page: PrimePage;
  snapshot: Omit<PrimeSnapshot, "generation">; seekAllowed: boolean; pauseAllowed: boolean; rateAllowed: boolean };
function method(module: ObjectValue, key: string): Method | null { return typeof module[key] === "function" ? (module[key] as Method).bind(module) : null; }
export function callPrime(module: ObjectValue, key: string, ...args: number[]): unknown {
  const invoke = method(module, key); if (!invoke) throw new Error("Prime API unavailable"); return invoke(...args);
}
/** Only the observed root and child/sibling fiber links; no arbitrary account graph traversal. */
export function resolvePrimeContext(root: HTMLElement): ObjectValue | null {
  const start = object(object(object(Reflect.get(root, "_reactRootContainer"))._internalRoot).current);
  const queue: ObjectValue[] = [start], seen = new Set<object>(), candidates = new Set<ObjectValue>();
  for (let index = 0; index < queue.length; index++) {
    if (index >= 600) return null;
    const fiber = queue[index]!; if (seen.has(fiber)) continue; seen.add(fiber);
    const context = object(object(fiber.memoizedProps).context);
    if (context.webPlayer && context.playback && context.title && context.timeline && context.adPlayback && context.recapStore && context.playbackControlsPolicy) candidates.add(context);
    for (const key of ["child", "sibling"]) if (fiber[key] && typeof fiber[key] === "object") queue.push(object(fiber[key]));
  }
  return candidates.size === 1 ? [...candidates][0]! : null;
}
export function inspectPrimeSdk(documentValue: Document = document): PrimeSdk | null {
  try {
    const root = documentValue.getElementById("dv-web-player"); if (!root) return null;
    const videos = [...root.querySelectorAll("video")].filter(video => video.isConnected);
    if (videos.length !== 1) return null;
    const video = videos[0]!, context = resolvePrimeContext(root); if (!context) return null;
    const webPlayer = object(context.webPlayer), playback = object(context.playback), title = object(context.title), timeline = object(context.timeline),
      ad = object(context.adPlayback), recap = object(context.recapStore), policy = object(context.playbackControlsPolicy);
    if (webPlayer.isPlayerOpen !== true || webPlayer.hasPlaybackInitiated !== true) return null;
    for (const key of ["play", "pause", "seek", "getPlaybackState", "getContentState", "getPlaybackRate"]) if (!method(playback, key)) return null;
    const info = object(callPrime(title, "getTitleInfo"));
    if (webPlayer.currentTitleId !== info.titleId) return null;
    const page = readPrimePage(documentValue, info, object(object(context.playerInfo).info).territory, context.webLocale); if (!page) return null;
    const timelineInfo = object(callPrime(timeline, "getTimelineInfo"));
    const position = playback.position, end = timelineInfo.endPositionMs, rate = callPrime(playback, "getPlaybackRate");
    if (typeof position !== "number" || !Number.isFinite(position) || typeof end !== "number" || !Number.isFinite(end) ||
      position < 0 || end <= 0 || end > 604800000 || position > end || typeof rate !== "number" || !Number.isFinite(rate) || rate < 0.25 || rate > 4) return null;
    const itemType = object(object(object(timeline.playhead).item).contentInfo).contentType;
    const adBreak = callPrime(ad, "getAdBreakInfo"), adPlayback = callPrime(ad, "getAdPlaybackInfo"), adTimer = callPrime(ad, "isAdTimerShowing");
    const recapInfo = object(callPrime(recap, "getRecapInfo"));
    const playbackState = callPrime(playback, "getPlaybackState"), contentState = callPrime(playback, "getContentState");
    const controls = object(callPrime(policy, "getPolicy"));
    let phase: PrimeSnapshot["phase"] = "unsupported";
    const main = info.videoMaterialType === "Feature" && title.videoMaterialType === "Feature" && itemType === "Feature" &&
      adBreak === null && adPlayback === null && adTimer === false && recapInfo.currentRecapIndex === null &&
      recapInfo.isRecapPlaying === false && recapInfo.maxSlateDurationExceeded === false && recapInfo.recaps === null &&
      recapInfo.shouldShowSlate === false && recapInfo.slateUrl === null;
    if (itemType === "Advertisement" || adBreak !== null && typeof adBreak === "object" || adPlayback !== null && typeof adPlayback === "object" || adTimer === true ||
      recapInfo.isRecapPlaying === true || recapInfo.shouldShowSlate === true) phase = "interstitial";
    else if (main && ["Playing", "Paused"].includes(String(playbackState))) {
      phase = contentState === "Ready" && video.readyState >= 2 && !video.seeking ? "content" : "buffering";
    }
    return { context, webPlayer, titleApi: title, timelineApi: timeline, playerFacade: playback.player, playback, video, page, seekAllowed: controls.seekForwardEnabled === true && controls.seekBackwardEnabled === true,
      pauseAllowed: controls.pauseEnabled === true, rateAllowed: playback.playbackSpeedEnabled === true && !!method(object(playback.player), "setPlaybackRate"),
      snapshot: { contentId: page.contentId, phase, currentTime: position / 1000, duration: end / 1000,
        playing: phase === "content" && playbackState === "Playing", playbackRate: rate, metadata: page.metadata } };
  } catch { return null; }
}
