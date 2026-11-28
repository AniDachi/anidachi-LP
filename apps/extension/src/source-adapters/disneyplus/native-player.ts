import { disneyControlsPortal } from "./dom";
import { DisneyPlusProviderIdSchema, disneyPlusPlaybackId } from "@anidachi/protocol";

const requestEvent = "anidachi:disney-transport";
const replyEvent = "anidachi:disney-transport-result";
type Action = "read" | "play" | "pause" | number;

export type DisneyTransportState = {
  generation: number;
  phase: "content" | "interstitial" | "transition";
  currentTime: number;
  duration: number;
  gestureRequired: boolean;
  accepted: boolean;
  nextEpisode?: { id: string; creditsStart: number };
};

type PlayerUI = HTMLElement & {
  commandBus?: { dispatchCommand(type: string, payload: Record<string, unknown>): boolean };
  latestUiState?: {
    playbackId?: string;
    streamDetails?: { isVOD?: boolean; noSeek?: boolean };
    clickToPlayOverlay?: { visible?: boolean };
    interstitials?: { isInterstitialPlaying?: boolean };
    playbackCriteria?: { current?: { metadata?: { upNextData?: {
      type?: string; sequentialEpisode?: boolean; item?: { id?: string };
    }[] } } };
    continuousPlay?: { endCard?: { ux?: { visible?: boolean } } };
    timeline?: {
      timeline?: { type?: string; playheadPositionMs?: number; programDurationMs?: number };
      markers?: { editorial?: { label?: string; startPositionMs?: number }[] };
    };
  };
};

// The content script can reach Disney's DOM, but only MAIN can call the
// transport used by the controls. Exchange just playback values, synchronously.
export function disneyTransport(doc: Document, action: Action): DisneyTransportState | null {
  const portal = disneyControlsPortal(doc);
  if (!portal) return null;
  let result: DisneyTransportState | null = null;
  const receive = (event: Event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "string" || event.detail.length > 512) return;
    try {
      const value = JSON.parse(event.detail);
      if (value && Number.isSafeInteger(value.generation) && ["content", "interstitial", "transition"].includes(value.phase) &&
          Number.isFinite(value.currentTime) && Number.isFinite(value.duration) &&
          typeof value.accepted === "boolean" && typeof value.gestureRequired === "boolean") {
        if (value.nextEpisode && !(DisneyPlusProviderIdSchema.safeParse(value.nextEpisode.id).success &&
            Number.isFinite(value.nextEpisode.creditsStart) && value.nextEpisode.creditsStart >= 0 &&
            value.nextEpisode.creditsStart <= value.duration)) delete value.nextEpisode;
        result = value;
      }
    } catch { /* Ignore unrelated page events. */ }
  };
  portal.addEventListener(replyEvent, receive);
  try {
    portal.dispatchEvent(new CustomEvent(requestEvent, { bubbles: true, detail: action }));
  } finally {
    portal.removeEventListener(replyEvent, receive);
  }
  return result;
}

export function listenDisneyTransport(doc: Document): () => void {
  let playbackId: string | undefined;
  let generation = 0;
  const handle = (event: Event) => {
    if (!(event instanceof CustomEvent) || !(event.target instanceof HTMLElement) ||
        event.target !== disneyControlsPortal(doc)) return;
    const ui = event.target as PlayerUI;
    const state = ui.latestUiState;
    if (!state || typeof ui.commandBus?.dispatchCommand !== "function") return;
    const action: unknown = event.detail;
    if (action !== "read" && action !== "play" && action !== "pause" &&
        !(typeof action === "number" && Number.isFinite(action) && action >= 0)) return;
    if (playbackId !== state.playbackId) { playbackId = state.playbackId; generation++; }
    const timeline = state.timeline?.timeline;
    const position = timeline?.playheadPositionMs;
    const duration = timeline?.programDurationMs;
    const ad = state.interstitials?.isInterstitialPlaying === true;
    const upNext = state.playbackCriteria?.current?.metadata?.upNextData?.[0];
    const nextId = upNext?.type === "upNext" && upNext.sequentialEpisode === true ? upNext.item?.id : undefined;
    // The end card changes the URL before the previous program clock is retired.
    const handingOff = state.continuousPlay?.endCard?.ux?.visible === true ||
      (!!nextId && disneyPlusPlaybackId(location.href) === nextId);
    const vod = !!playbackId && !ad && !handingOff && state.streamDetails?.isVOD === true && timeline?.type === "VOD" &&
      typeof duration === "number" && Number.isFinite(duration) && duration > 0 &&
      typeof position === "number" && Number.isFinite(position) && position >= 0 && position <= duration;
    let accepted = action === "read";
    if (vod && action !== "read" && !state.streamDetails?.noSeek) {
      if (typeof action === "number") {
        if (action <= duration / 1000) accepted = ui.commandBus.dispatchCommand("seek", {
          fromPlayheadPositionSecs: position / 1000, toPlayheadPositionSecs: action,
          proposedTime: action * 1000, label: "AniDachi",
        });
      } else {
        accepted = ui.commandBus.dispatchCommand(action, { playheadPosition: position, label: "AniDachi" });
      }
    }
    const result: DisneyTransportState = {
      generation, phase: ad ? "interstitial" : vod ? "content" : "transition",
      currentTime: vod ? position / 1000 : 0, duration: vod ? duration / 1000 : 0,
      accepted, gestureRequired: state.clickToPlayOverlay?.visible === true,
    };
    if (vod && nextId && DisneyPlusProviderIdSchema.safeParse(nextId).success) {
      const editorial = state.timeline?.markers?.editorial;
      const start = Array.isArray(editorial) ? editorial.find(marker => marker.label === "up_next")?.startPositionMs : undefined;
      result.nextEpisode = { id: nextId, creditsStart: typeof start === "number" && start >= 0 && start <= duration ? start / 1000 : duration / 1000 };
    }
    ui.dispatchEvent(new CustomEvent(replyEvent, { detail: JSON.stringify(result) }));
  };
  doc.addEventListener(requestEvent, handle);
  return () => doc.removeEventListener(requestEvent, handle);
}
