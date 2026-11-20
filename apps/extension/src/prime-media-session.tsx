import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import type {VoiceMode} from "@anidachi/protocol";
import type {GhostCamOptions, GhostCamSession} from "./ghost-cam";
import type {P2PMediaDiagnostics} from "./p2p-media";
import {mediaAccessChannel, permissionPage, tilePage, type PrimeDevicePrompt} from "./prime-media-access";
import {emptyPrimeMediaState, type PrimeMediaBridge, type PrimeMediaReply} from "./prime-room-media-types";
import type {ParticipantAudioPreference} from "./voice-audio-preferences";

export interface PrimeGhostVideo {
  persistent: true;
  revision: string;
  local: boolean;
  participantId: string;
}

export function PrimeDevicePermissionPrompt({device, ticket}: PrimeDevicePrompt) {
  return <iframe hidden tabIndex={-1} title={`AniDachi ${device} permission`} allow={device}
    src={chrome.runtime.getURL(permissionPage) + "#" + ticket} />;
}

export function PrimeCameraTile({participantId, fallback}: {participantId: string; fallback: string}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    const frame = ref.current!;
    const origin = chrome.runtime.getURL("").slice(0, -1);
    let active = true;
    const receive = (event: MessageEvent) => {
      if (!event.isTrusted || event.origin !== origin || event.source !== frame.contentWindow ||
          event.data?.channel !== mediaAccessChannel) return;
      if (event.data.action === "playing") {
        frame.setAttribute("data-prime-camera-playing", "");
      } else if (event.data.action === "request") {
        frame.removeAttribute("data-prime-camera-playing");
        void chrome.runtime.sendMessage({channel: mediaAccessChannel, action: "ticket", participantId}).then(ticket => {
          if (active && typeof ticket === "string")
            frame.contentWindow?.postMessage({channel: mediaAccessChannel, ticket}, origin);
        }).catch(() => {});
      }
    };
    window.addEventListener("message", receive);
    return () => {
      active = false;
      window.removeEventListener("message", receive);
    };
  }, [participantId]);

  return <>
    <span className="prime-camera-fallback" aria-hidden="true">{fallback}</span>
    <iframe ref={ref} className="prime-camera-frame" title="AniDachi camera" src={chrome.runtime.getURL(tilePage)} tabIndex={-1} aria-hidden="true"
      onLoad={event => event.currentTarget.removeAttribute("data-prime-camera-playing")} />
  </>;
}

export function usePrimeGhostCam(bridge: PrimeMediaBridge | null, options: GhostCamOptions): GhostCamSession {
  const [state, setState] = useState(emptyPrimeMediaState);
  const pending = useRef(new Map<string, (stats: P2PMediaDiagnostics | null) => void>());
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(() => {
    if (!bridge || !options.roomId) return;
    const requests = pending.current;
    const unsubscribe = bridge.subscribeMedia(value => {
      const reply = value as PrimeMediaReply;
      if (reply?.type === "prime-media-state") setState(reply);
      if (reply?.type === "prime-media-stats") requests.get(reply.id)?.(reply.stats);
    });
    bridge.sendMediaCommand({type: "state"});
    return () => {
      unsubscribe();
      for (const finish of requests.values()) finish(null);
      setState(emptyPrimeMediaState);
    };
  }, [bridge, options.roomId, options.participant?.id]);

  useEffect(() => {
    if (bridge && options.connected && options.participantAudioPreferencesReady)
      bridge.sendMediaCommand({type: "outputs", preferences: options.participantAudioPreferences});
  }, [bridge, options.connected, options.participantAudioPreferencesReady, options.participantAudioPreferences]);
  useEffect(() => {
    if (bridge && options.connected && options.mediaSnapshot === undefined)
      bridge.sendMediaCommand({type: "camera", enabled: options.cameraEnabled});
  }, [bridge, options.connected, options.mediaSnapshot, options.cameraEnabled]);

  const setMicrophonePublishing = useCallback(async (enabled: boolean, release: "warm" | "immediate", mode?: VoiceMode) => {
    const opts = optionsRef.current;
    if (!opts.connected || !opts.participantAudioPreferencesReady) return;
    // Unmount belongs to the document. The owner releases a held PTT on port detach.
    if (!mode && release === "immediate") return;
    bridge?.sendMediaCommand({type: "microphone", enabled, release, mode: mode ?? "push-to-talk",
      requestId: opts.captureIntents?.microphone?.requestId});
  }, [bridge]);
  const getDiagnostics = useCallback(async () => {
    if (!bridge) return null;
    const id = crypto.randomUUID();
    return new Promise<P2PMediaDiagnostics | null>(resolve => {
      const timeout = window.setTimeout(() => finish(null), 3000);
      const finish = (stats: P2PMediaDiagnostics | null) => {
        window.clearTimeout(timeout);
        pending.current.delete(id);
        resolve(stats);
      };
      pending.current.set(id, finish);
      bridge.sendMediaCommand({type: "stats", id});
    });
  }, [bridge]);
  const setParticipantAudioOutput = useCallback((id: string, preference: ParticipantAudioPreference) => {
    bridge?.sendMediaCommand({type: "output", id, preference});
  }, [bridge]);
  const unlockAudio = useCallback(async () => { bridge?.sendMediaCommand({type: "unlock"}); }, [bridge]);
  const reconcileMediaAuthority = useCallback(() => { bridge?.sendMediaCommand({type: "reconcile"}); }, [bridge]);
  const stop = useCallback(() => {
    // The same terminal handler synchronously closes the room client and its media owner.
    setState(emptyPrimeMediaState);
  }, []);
  const videos = useMemo(() => state.videos.map(video => ({...video, persistent: true as const})), [state.videos]);
  return {...state, videos, reconcileMediaAuthority, stop, setMicrophonePublishing, getDiagnostics, setParticipantAudioOutput, unlockAudio};
}
