import type { Participant } from "@anidachi/protocol";
import {
  Room,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_HTTP_BASE } from "./constants";
import type {
  GhostVideo,
  IncomingP2PSignal,
  LiveVoiceStatus,
  MediaTransportName,
} from "./media-types";
import { loadP2PIceServers, refreshP2PIceServers } from "./p2p-ice";
import { P2PMediaController } from "./p2p-media";

export type { GhostVideo, LiveVoiceStatus } from "./media-types";

export interface GhostCamSession {
  activeSpeakerIds: string[];
  startVoiceTalk: () => Promise<void>;
  stopVoiceTalk: () => Promise<void>;
  unlockAudio: () => Promise<void>;
  videos: GhostVideo[];
  voiceMessage: string | null;
  voiceStatus: LiveVoiceStatus;
}

interface GhostCamOptions {
  cameraEnabled: boolean;
  connected: boolean;
  incomingP2PSignals: IncomingP2PSignal[];
  onCameraStatus: (enabled: boolean) => void;
  participant: Participant | null;
  participants: Participant[];
  roomId: string | null;
  roomToken: string | null;
  sendP2PSignal: IncomingP2PSignalSender;
  transport: MediaTransportName;
  voiceTalkActive: boolean;
}

type IncomingP2PSignalSender = (toUserId: string, signal: IncomingP2PSignal["signal"]) => void;

const GHOST_CAM_VIDEO_OPTIONS = {
  resolution: { width: 240, height: 240 },
  frameRate: 10,
};

const GHOST_CAM_VIDEO_PUBLISH_OPTIONS = {
  videoCodec: "vp8",
  simulcast: false,
} satisfies TrackPublishOptions;

const LIVE_VOICE_AUDIO_OPTIONS: AudioCaptureOptions = {
  autoGainControl: true,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
};

const LIVE_VOICE_PUBLISH_OPTIONS: TrackPublishOptions = {
  dtx: true,
  red: true,
};

export function useGhostCam(options: GhostCamOptions): GhostCamSession {
  const liveKitSession = useLiveKitGhostCam({
    ...options,
    connected: options.connected && options.transport === "livekit",
  });
  const p2pSession = useP2PGhostCam({
    ...options,
    connected: options.connected && options.transport === "p2p",
  });

  return options.transport === "p2p" ? p2pSession : liveKitSession;
}

function useLiveKitGhostCam(options: {
  cameraEnabled: boolean;
  connected: boolean;
  roomId: string | null;
  participant: Participant | null;
  onCameraStatus: (enabled: boolean) => void;
  voiceTalkActive: boolean;
}): GhostCamSession {
  const {
    cameraEnabled,
    connected: shouldConnect,
    onCameraStatus,
    participant,
    roomId,
    voiceTalkActive,
  } = options;
  const [videos, setVideos] = useState<GhostVideo[]>([]);
  const [connected, setConnected] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<LiveVoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const roomRef = useRef<Room | null>(null);
  const connectedRef = useRef(false);
  const microphoneEnabledRef = useRef(false);
  const microphoneStartingRef = useRef(false);
  const voiceTalkActiveRef = useRef(false);

  useEffect(() => {
    if (!shouldConnect || !roomId || !participant) {
      setVideos([]);
      setConnected(false);
      setActiveSpeakerIds([]);
      setVoiceStatus("idle");
      setVoiceMessage(null);
      return;
    }

    const activeRoomId = roomId;
    const activeParticipant = participant;
    let disposed = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    const audioElementsByParticipant = new Map<string, HTMLAudioElement>();
    roomRef.current = room;
    connectedRef.current = false;
    microphoneEnabledRef.current = false;
    microphoneStartingRef.current = false;

    const upsertVideo = (video: GhostVideo) => {
      setVideos((current) => {
        const withoutExisting = current.filter((item) => {
          if (item.participantId === video.participantId) {
            item.element.remove();
            return false;
          }

          return true;
        });
        return [...withoutExisting, video];
      });
    };

    const removeVideo = (participantId: string) => {
      setVideos((current) => {
        for (const item of current) {
          if (item.participantId === participantId) {
            item.element.remove();
          }
        }
        return current.filter((item) => item.participantId !== participantId);
      });
    };

    const removeAudio = (participantId: string) => {
      const element = audioElementsByParticipant.get(participantId);
      if (!element) {
        return;
      }

      element.remove();
      audioElementsByParticipant.delete(participantId);
    };

    room.on(RoomEvent.TrackSubscribed, (track, _publication, remoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        removeAudio(remoteParticipant.identity);
        const element = track.attach() as HTMLAudioElement;
        element.autoplay = true;
        element.volume = 1;
        audioElementsByParticipant.set(remoteParticipant.identity, element);
        void element.play().catch(() => {
          setVoiceMessage("Click Anidachi once to enable voice playback.");
        });
        return;
      }

      if (track.kind !== Track.Kind.Video) {
        return;
      }

      const element = track.attach() as HTMLVideoElement;
      element.autoplay = true;
      element.playsInline = true;
      element.muted = true;
      upsertVideo({ participantId: remoteParticipant.identity, element, local: false });
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, remoteParticipant) => {
      for (const element of track.detach()) {
        element.remove();
      }

      if (track.kind === Track.Kind.Audio) {
        removeAudio(remoteParticipant.identity);
        return;
      }

      if (track.kind === Track.Kind.Video) {
        removeVideo(remoteParticipant.identity);
      }
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setActiveSpeakerIds(speakers.map((speaker) => speaker.identity));
    });

    async function connect() {
      try {
        const response = await fetch(`${API_HTTP_BASE}/livekit/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: activeRoomId,
            identity: activeParticipant.id,
            name: activeParticipant.displayName,
          }),
        });

        if (!response.ok) {
          throw new Error(`LiveKit token failed: ${response.status}`);
        }

        const payload = (await response.json()) as { serverUrl: string; token: string };
        if (disposed) {
          return;
        }

        await room.connect(payload.serverUrl, payload.token);
        connectedRef.current = true;
        setConnected(true);
        onCameraStatus(false);
      } catch (error) {
        console.warn("[Anidachi] Ghost Cam failed", error);
        setConnected(false);
        setVoiceStatus("error");
        setVoiceMessage(error instanceof Error ? error.message : "LiveKit connection failed.");
        onCameraStatus(false);
      }
    }

    void connect();

    return () => {
      disposed = true;
      connectedRef.current = false;
      microphoneEnabledRef.current = false;
      microphoneStartingRef.current = false;
      voiceTalkActiveRef.current = false;
      roomRef.current = null;
      onCameraStatus(false);
      setConnected(false);
      setVoiceStatus("idle");
      setVoiceMessage(null);
      setActiveSpeakerIds([]);
      setVideos((current) => {
        for (const item of current) {
          item.element.remove();
        }
        return [];
      });
      for (const element of audioElementsByParticipant.values()) {
        element.remove();
      }
      audioElementsByParticipant.clear();
      room.disconnect();
    };
  }, [onCameraStatus, participant, roomId, shouldConnect]);

  useEffect(() => {
    if (!shouldConnect || !participant || !connected) {
      return;
    }

    let cancelled = false;
    const activeRoom = roomRef.current;
    const activeParticipant = participant;
    if (!activeRoom) {
      return;
    }

    async function syncCamera(room: Room, participantId: string) {
      try {
        await room.localParticipant.setCameraEnabled(
          cameraEnabled,
          GHOST_CAM_VIDEO_OPTIONS,
          GHOST_CAM_VIDEO_PUBLISH_OPTIONS,
        );

        if (cancelled) {
          return;
        }

        if (!cameraEnabled) {
          setVideos((current) => {
            for (const item of current) {
              if (item.local) {
                item.element.remove();
              }
            }
            return current.filter((item) => !item.local);
          });
          onCameraStatus(false);
          return;
        }

        const publication = Array.from(room.localParticipant.videoTrackPublications.values()).find(
          (item) => item.track,
        );
        const track = publication?.track;
        if (track) {
          const element = track.attach() as HTMLVideoElement;
          element.autoplay = true;
          element.playsInline = true;
          element.muted = true;
          setVideos((current) => {
            const withoutLocal = current.filter((item) => {
              if (item.local) {
                item.element.remove();
                return false;
              }

              return true;
            });
            return [...withoutLocal, { participantId, element, local: true }];
          });
        }
        onCameraStatus(true);
      } catch (error) {
        console.warn("[Anidachi] Ghost Cam camera toggle failed", error);
        onCameraStatus(false);
      }
    }

    void syncCamera(activeRoom, activeParticipant.id);

    return () => {
      cancelled = true;
    };
  }, [cameraEnabled, connected, onCameraStatus, participant, shouldConnect]);

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !connectedRef.current) {
      return;
    }

    await room.startAudio().catch(() => undefined);
  }, []);

  const startVoiceTalk = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !connectedRef.current) {
      setVoiceStatus("connecting");
      setVoiceMessage("Voice is connecting...");
      return;
    }

    if (microphoneEnabledRef.current) {
      setVoiceStatus("talking");
      return;
    }

    if (microphoneStartingRef.current) {
      setVoiceStatus("connecting");
      return;
    }

    voiceTalkActiveRef.current = true;
    microphoneStartingRef.current = true;
    setVoiceStatus("connecting");
    setVoiceMessage(null);

    try {
      await room.startAudio().catch(() => undefined);
      await room.localParticipant.setMicrophoneEnabled(
        true,
        LIVE_VOICE_AUDIO_OPTIONS,
        LIVE_VOICE_PUBLISH_OPTIONS,
      );

      if (!voiceTalkActiveRef.current) {
        await room.localParticipant.setMicrophoneEnabled(false);
        microphoneEnabledRef.current = false;
        setVoiceStatus("idle");
        return;
      }

      microphoneEnabledRef.current = true;
      setVoiceStatus("talking");
    } catch (error) {
      microphoneEnabledRef.current = false;
      setVoiceStatus("error");
      setVoiceMessage(error instanceof Error ? error.message : "Microphone failed.");
    } finally {
      microphoneStartingRef.current = false;
    }
  }, []);

  const stopVoiceTalk = useCallback(async () => {
    voiceTalkActiveRef.current = false;
    const room = roomRef.current;
    if (!room || !connectedRef.current) {
      microphoneEnabledRef.current = false;
      microphoneStartingRef.current = false;
      setVoiceStatus("idle");
      return;
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      console.warn("[Anidachi] Voice mute failed", error);
    } finally {
      microphoneEnabledRef.current = false;
      microphoneStartingRef.current = false;
      setVoiceStatus("idle");
    }
  }, []);

  useEffect(() => {
    voiceTalkActiveRef.current = voiceTalkActive;

    if (!voiceTalkActive) {
      void stopVoiceTalk();
      return;
    }

    void startVoiceTalk();
  }, [startVoiceTalk, stopVoiceTalk, voiceTalkActive]);

  return {
    activeSpeakerIds,
    startVoiceTalk,
    stopVoiceTalk,
    unlockAudio,
    videos,
    voiceMessage,
    voiceStatus,
  };
}

function useP2PGhostCam(options: GhostCamOptions): GhostCamSession {
  const {
    cameraEnabled,
    connected: shouldConnect,
    incomingP2PSignals,
    onCameraStatus,
    participant,
    participants,
    roomId,
    roomToken,
    sendP2PSignal,
    voiceTalkActive,
  } = options;
  const [videos, setVideos] = useState<GhostVideo[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<LiveVoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const controllerRef = useRef<P2PMediaController | null>(null);
  const cameraEnabledRef = useRef(cameraEnabled);
  const incomingP2PSignalsRef = useRef(incomingP2PSignals);
  const participantsRef = useRef(participants);
  const voiceTalkActiveRef = useRef(voiceTalkActive);
  const lastSignalSequenceRef = useRef(0);
  // Read at fetch time so ICE refreshes use the current room token without
  // re-running the heavy P2P connect effect when the token rotates.
  const iceAuthRef = useRef<{ roomId: string; roomToken: string } | null>(null);
  iceAuthRef.current = roomId && roomToken ? { roomId, roomToken } : null;

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  useEffect(() => {
    incomingP2PSignalsRef.current = incomingP2PSignals;
  }, [incomingP2PSignals]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    voiceTalkActiveRef.current = voiceTalkActive;
  }, [voiceTalkActive]);

  useEffect(() => {
    if (!shouldConnect || !participant) {
      controllerRef.current?.disconnect();
      controllerRef.current = null;
      setVideos([]);
      setActiveSpeakerIds([]);
      setVoiceStatus("idle");
      setVoiceMessage(null);
      lastSignalSequenceRef.current = 0;
      return;
    }

    let disposed = false;
    const activeParticipant = participant;
    setVoiceStatus("connecting");

    async function connectP2P() {
      const iceServers = await loadP2PIceServers(iceAuthRef.current ?? undefined);
      if (disposed) {
        return;
      }

      const controller = new P2PMediaController({
        iceServers,
        localParticipant: activeParticipant,
        onActiveSpeakerIdsChange: setActiveSpeakerIds,
        onCameraStatus,
        onVideosChange: setVideos,
        onVoiceMessageChange: setVoiceMessage,
        onVoiceStatusChange: setVoiceStatus,
        refreshIceServers: () => refreshP2PIceServers(iceAuthRef.current ?? undefined),
        sendSignal: sendP2PSignal,
      });

      controllerRef.current = controller;
      controller.updateParticipants(
        participantsRef.current.length ? participantsRef.current : [activeParticipant],
      );
      replayPendingP2PSignals(controller, incomingP2PSignalsRef.current, lastSignalSequenceRef);
      void controller.setCameraEnabled(cameraEnabledRef.current);
      if (voiceTalkActiveRef.current) {
        void controller.startVoiceTalk();
      } else {
        setVoiceStatus("idle");
      }
    }

    void connectP2P();

    return () => {
      disposed = true;
      controllerRef.current?.disconnect();
      controllerRef.current = null;
    };
  }, [onCameraStatus, participant, sendP2PSignal, shouldConnect]);

  useEffect(() => {
    controllerRef.current?.updateParticipants(
      participants.length ? participants : participant ? [participant] : [],
    );
  }, [participant, participants]);

  useEffect(() => {
    void controllerRef.current?.setCameraEnabled(cameraEnabled);
  }, [cameraEnabled]);

  useEffect(() => {
    if (!voiceTalkActive) {
      void controllerRef.current?.stopVoiceTalk();
      return;
    }

    void controllerRef.current?.startVoiceTalk();
  }, [voiceTalkActive]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    for (const item of incomingP2PSignals) {
      if (item.sequence <= lastSignalSequenceRef.current) {
        continue;
      }

      lastSignalSequenceRef.current = item.sequence;
      void controller.handleSignal(item.fromUserId, item.signal);
    }
  }, [incomingP2PSignals]);

  useEffect(() => {
    if (!shouldConnect) {
      return;
    }

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        return;
      }

      controllerRef.current?.notifyPageLeaving("pagehide");
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        controllerRef.current?.recoverDisconnectedPeers("visibilitychange");
      }
    };
    const handleOnline = () => {
      controllerRef.current?.recoverDisconnectedPeers("online");
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shouldConnect]);

  const startVoiceTalk = useCallback(async () => {
    await controllerRef.current?.startVoiceTalk();
  }, []);

  const stopVoiceTalk = useCallback(async () => {
    await controllerRef.current?.stopVoiceTalk();
  }, []);

  const unlockAudio = useCallback(async () => {
    await controllerRef.current?.unlockAudio();
  }, []);

  return {
    activeSpeakerIds,
    startVoiceTalk,
    stopVoiceTalk,
    unlockAudio,
    videos,
    voiceMessage,
    voiceStatus,
  };
}

function replayPendingP2PSignals(
  controller: P2PMediaController,
  incomingP2PSignals: IncomingP2PSignal[],
  lastSignalSequenceRef: { current: number },
): void {
  for (const item of incomingP2PSignals) {
    if (item.sequence <= lastSignalSequenceRef.current) {
      continue;
    }

    lastSignalSequenceRef.current = item.sequence;
    void controller.handleSignal(item.fromUserId, item.signal);
  }
}
