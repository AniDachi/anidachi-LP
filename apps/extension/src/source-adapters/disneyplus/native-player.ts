import { disneyControlsPortal } from "./dom";

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
};

type PlayerUI = HTMLElement & {
  commandBus?: { dispatchCommand(type: string, payload: Record<string, unknown>): boolean };
  latestUiState?: {
    playbackId?: string;
    streamDetails?: { isVOD?: boolean; noSeek?: boolean };
    clickToPlayOverlay?: { visible?: boolean };
    interstitials?: { isInterstitialPlaying?: boolean };
    timeline?: { timeline?: { type?: string; playheadPositionMs?: number; programDurationMs?: number } };
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
          typeof value.accepted === "boolean" && typeof value.gestureRequired === "boolean") result = value;
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
    const vod = !!playbackId && !ad && state.streamDetails?.isVOD === true && timeline?.type === "VOD" &&
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
    ui.dispatchEvent(new CustomEvent(replyEvent, { detail: JSON.stringify(result) }));
  };
  doc.addEventListener(requestEvent, handle);
  return () => doc.removeEventListener(requestEvent, handle);
}
