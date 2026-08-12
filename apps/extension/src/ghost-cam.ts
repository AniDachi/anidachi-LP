import type { Participant, VoiceMode } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { logDebug } from "./debug-log";
import type {
  GhostVideo,
  IncomingP2PSignal,
  MicrophoneStatus,
  MicrophoneTerminalFailure,
  RoomSendDisposition,
  SignalingTransportReady,
} from "./media-types";
import { loadP2PIceServers, refreshP2PIceServers } from "./p2p-ice";
import {
  canReceiveP2PSignalFromParticipant,
  type P2PMediaDiagnostics,
  P2PMediaController,
  selectP2PMediaParticipants,
} from "./p2p-media";
import type { ParticipantAudioPreference } from "./voice-audio-preferences";

export type { GhostVideo, MicrophoneStatus } from "./media-types";

export interface GhostCamSession {
  activeSpeakerIds: string[];
  getDiagnostics: () => Promise<P2PMediaDiagnostics | null>;
  microphoneStatus: MicrophoneStatus;
  microphoneTerminalFailure: MicrophoneTerminalFailure | null;
  setMicrophonePublishing: (
    enabled: boolean,
    release: "warm" | "immediate",
    voiceMode?: VoiceMode,
  ) => Promise<void>;
  setParticipantAudioOutput: (
    participantId: string,
    preference: ParticipantAudioPreference,
  ) => void;
  unlockAudio: () => Promise<void>;
  videos: GhostVideo[];
  voiceMessage: string | null;
}

interface GhostCamOptions {
  cameraEnabled: boolean;
  connected: boolean;
  incomingP2PSignals: IncomingP2PSignal[];
  onCameraStatus: (enabled: boolean) => void;
  participant: Participant | null;
  participantAudioPreferenceScope: string | null;
  participantAudioPreferences: Readonly<
    Record<string, ParticipantAudioPreference>
  >;
  participantAudioPreferencesReady: boolean;
  participants: Participant[];
  roomGeneration: number;
  roomId: string | null;
  roomToken: string | null;
  sendP2PSignal: IncomingP2PSignalSender;
  signalingTransportReady: SignalingTransportReady | null;
  sourceGeneration: number;
}

type IncomingP2PSignalSender = (
  toUserId: string,
  signal: IncomingP2PSignal["signal"],
  senderMediaSessionId: string,
) => RoomSendDisposition;

export function useGhostCam(options: GhostCamOptions): GhostCamSession {
  return useP2PGhostCam(options);
}

function useP2PGhostCam(options: GhostCamOptions): GhostCamSession {
  const {
    cameraEnabled,
    connected: shouldConnect,
    incomingP2PSignals,
    onCameraStatus,
    participant,
    participantAudioPreferenceScope,
    participantAudioPreferences,
    participantAudioPreferencesReady,
    participants,
    roomId,
    roomToken,
    roomGeneration,
    sendP2PSignal,
    signalingTransportReady,
    sourceGeneration,
  } = options;
  const [videos, setVideos] = useState<GhostVideo[]>([]);
  const [microphoneStatus, setMicrophoneStatus] =
    useState<MicrophoneStatus>("off");
  const [microphoneTerminalFailure, setMicrophoneTerminalFailure] =
    useState<MicrophoneTerminalFailure | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<string[]>([]);
  const controllerRef = useRef<P2PMediaController | null>(null);
  const cameraEnabledRef = useRef(cameraEnabled);
  const incomingP2PSignalsRef = useRef(incomingP2PSignals);
  const onCameraStatusRef = useRef(onCameraStatus);
  const participantRef = useRef(participant);
  const participantsRef = useRef(participants);
  const roomGenerationRef = useRef(roomGeneration);
  const sendP2PSignalRef = useRef(sendP2PSignal);
  const signalingTransportReadyRef = useRef(signalingTransportReady);
  const sourceGenerationRef = useRef(sourceGeneration);
  const microphonePublishingRef = useRef(false);
  const microphoneReleaseRef = useRef<"warm" | "immediate">("warm");
  const microphoneVoiceModeRef = useRef<VoiceMode>("push-to-talk");
  const microphoneScopeKeyRef = useRef<string | null>(null);
  const participantAudioPreferencesRef = useRef(participantAudioPreferences);
  const remoteVoiceParticipantIdsRef = useRef<Set<string>>(new Set());
  const lastSignalSequenceRef = useRef(0);
  const participantId = participant?.id ?? null;
  // Read at fetch time so ICE refreshes use the current room token without
  // re-running the heavy P2P connect effect when the token rotates.
  const iceAuthRef = useRef<{ roomId: string; roomToken: string } | null>(null);
  iceAuthRef.current = roomId && roomToken ? { roomId, roomToken } : null;

  // Publication participants: remotes that announced voice-start, plus the
  // local user while microphone publication is wanted. Measured speaking is a
  // separate concern and must not decide whether the media peer exists.
  const getVoiceParticipantIds = useCallback((activeParticipant: Participant) => {
    const voiceParticipantIds = new Set(remoteVoiceParticipantIdsRef.current);
    if (microphonePublishingRef.current) {
      voiceParticipantIds.add(activeParticipant.id);
    }
    return voiceParticipantIds;
  }, []);

  const getMediaParticipants = useCallback(
    (activeParticipant: Participant) =>
      selectP2PMediaParticipants(
        participantsRef.current.length ? participantsRef.current : [activeParticipant],
        activeParticipant.id,
        cameraEnabledRef.current,
        getVoiceParticipantIds(activeParticipant),
      ),
    [getVoiceParticipantIds],
  );

  const getMediaSeatParticipantIds = useCallback(
    (activeParticipant: Participant) =>
      new Set(
        (
          participantsRef.current.length
            ? participantsRef.current
            : [activeParticipant]
        )
          .filter((item) => item.mediaSeat === "joined")
          .map((item) => item.id),
      ),
    [],
  );

  const updateControllerParticipants = useCallback(
    (activeParticipant: Participant | null = participantRef.current) => {
      if (!activeParticipant) {
        controllerRef.current?.updateParticipants([], new Set());
        return;
      }
      const mediaSeatParticipantIds =
        getMediaSeatParticipantIds(activeParticipant);
      for (const participantId of remoteVoiceParticipantIdsRef.current) {
        if (!mediaSeatParticipantIds.has(participantId)) {
          remoteVoiceParticipantIdsRef.current.delete(participantId);
        }
      }
      controllerRef.current?.updateParticipants(
        getMediaParticipants(activeParticipant),
        mediaSeatParticipantIds,
      );
    },
    [getMediaParticipants, getMediaSeatParticipantIds],
  );

  useEffect(() => {
    cameraEnabledRef.current = cameraEnabled;
  }, [cameraEnabled]);

  useEffect(() => {
    onCameraStatusRef.current = onCameraStatus;
  }, [onCameraStatus]);

  useEffect(() => {
    incomingP2PSignalsRef.current = incomingP2PSignals;
  }, [incomingP2PSignals]);

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  useEffect(() => {
    participantAudioPreferencesRef.current = participantAudioPreferences;
    if (participantAudioPreferencesReady) {
      controllerRef.current?.replaceParticipantAudioOutputs(
        participantAudioPreferences,
      );
    }
  }, [participantAudioPreferences, participantAudioPreferencesReady]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    sendP2PSignalRef.current = sendP2PSignal;
  }, [sendP2PSignal]);

  useEffect(() => {
    signalingTransportReadyRef.current = signalingTransportReady;
    if (signalingTransportReady) {
      void controllerRef.current?.handleSignalingTransportReady(signalingTransportReady);
    }
  }, [signalingTransportReady]);

  useEffect(() => {
    if (
      roomGenerationRef.current !== roomGeneration ||
      sourceGenerationRef.current !== sourceGeneration
    ) {
      lastSignalSequenceRef.current = 0;
    }
    roomGenerationRef.current = roomGeneration;
    sourceGenerationRef.current = sourceGeneration;
  }, [roomGeneration, sourceGeneration]);

  useEffect(() => {
    const microphoneScopeKey =
      shouldConnect &&
      roomId &&
      participantId &&
      participantAudioPreferencesReady
        ? `${roomId}\u0000${participantId}\u0000${
            participantAudioPreferenceScope ?? "anonymous"
          }`
        : null;
    if (microphoneScopeKeyRef.current !== microphoneScopeKey) {
      microphonePublishingRef.current = false;
      microphoneReleaseRef.current = "immediate";
      microphoneVoiceModeRef.current = "push-to-talk";
      microphoneScopeKeyRef.current = microphoneScopeKey;
      setMicrophoneTerminalFailure(null);
    }

    if (
      !shouldConnect ||
      !roomId ||
      !participantId ||
      !participantAudioPreferencesReady
    ) {
      controllerRef.current?.disconnect();
      controllerRef.current = null;
      remoteVoiceParticipantIdsRef.current.clear();
      setVideos([]);
      setActiveSpeakerIds([]);
      setMicrophoneStatus("off");
      setMicrophoneTerminalFailure(null);
      setVoiceMessage(null);
      lastSignalSequenceRef.current = 0;
      return;
    }

    let disposed = false;
    let ownedController: P2PMediaController | null = null;
    const activeParticipant = participantRef.current;
    if (!activeParticipant || activeParticipant.id !== participantId) {
      return;
    }
    const sessionParticipant: Participant = activeParticipant;
    remoteVoiceParticipantIdsRef.current.clear();
    setMicrophoneStatus(
      microphonePublishingRef.current ? "connecting" : "off",
    );

    async function connectP2P() {
      let iceServers: RTCIceServer[];
      try {
        iceServers = await loadP2PIceServers(iceAuthRef.current ?? undefined);
      } catch (error) {
        if (disposed) {
          return;
        }

        logDebug("p2p.ice-config", "initial setup failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        setMicrophoneStatus(
          microphonePublishingRef.current ? "error" : "off",
        );
        setVoiceMessage("Media relay is temporarily unavailable.");
        return;
      }

      if (disposed) {
        return;
      }

      const controller = new P2PMediaController({
        iceServers,
        localParticipant: sessionParticipant,
        onActiveSpeakerIdsChange: setActiveSpeakerIds,
        onCameraStatus: (enabled) => onCameraStatusRef.current(enabled),
        onMicrophoneTerminalFailure: (failure) => {
          microphonePublishingRef.current = false;
          microphoneReleaseRef.current = "immediate";
          setMicrophoneTerminalFailure(failure);
          updateControllerParticipants(sessionParticipant);
        },
        onVideosChange: setVideos,
        onVoiceMessageChange: setVoiceMessage,
        onMicrophoneStatusChange: setMicrophoneStatus,
        refreshIceServers: () => refreshP2PIceServers(iceAuthRef.current ?? undefined),
        sendSignal: (toUserId, signal, metadata) =>
          sendP2PSignalRef.current(toUserId, signal, metadata.senderMediaSessionId),
      });
      controller.replaceParticipantAudioOutputs(
        participantAudioPreferencesRef.current,
      );

      ownedController = controller;
      controllerRef.current = controller;
      await controller.setCameraEnabled(cameraEnabledRef.current);
      if (disposed) {
        return;
      }
      controller.updateParticipants(
        getMediaParticipants(sessionParticipant),
        getMediaSeatParticipantIds(sessionParticipant),
      );
      await replayPendingP2PSignals(
        controller,
        incomingP2PSignalsRef.current,
        lastSignalSequenceRef,
        participantsRef.current.length
          ? participantsRef.current
          : [sessionParticipant],
        sessionParticipant.id,
        remoteVoiceParticipantIdsRef.current,
        roomGeneration,
        sourceGeneration,
      );
      controller.updateParticipants(
        getMediaParticipants(sessionParticipant),
        getMediaSeatParticipantIds(sessionParticipant),
      );
      const readyTransport = signalingTransportReadyRef.current;
      if (readyTransport) {
        await controller.handleSignalingTransportReady(readyTransport);
      }
      await controller.setMicrophonePublishing(
        microphonePublishingRef.current,
        microphoneReleaseRef.current,
        microphoneVoiceModeRef.current,
      );
    }

    void connectP2P();

    return () => {
      disposed = true;
      if (ownedController && controllerRef.current === ownedController) {
        ownedController.disconnect();
        controllerRef.current = null;
      }
    };
  }, [
    getMediaParticipants,
    getMediaSeatParticipantIds,
    participantId,
    participantAudioPreferenceScope,
    participantAudioPreferencesReady,
    roomGeneration,
    roomId,
    shouldConnect,
    sourceGeneration,
  ]);

  useEffect(() => {
    if (!participantId) {
      controllerRef.current?.updateParticipants([], new Set());
      return;
    }

    const activeParticipant = participantRef.current;
    if (!activeParticipant || activeParticipant.id !== participantId) {
      controllerRef.current?.updateParticipants([], new Set());
      return;
    }

    updateControllerParticipants(activeParticipant);
  }, [participantId, participants, updateControllerParticipants]);

  useEffect(() => {
    void controllerRef.current?.setCameraEnabled(cameraEnabled);
    if (!participantId) {
      return;
    }

    const activeParticipant = participantRef.current;
    if (!activeParticipant || activeParticipant.id !== participantId) {
      return;
    }

    updateControllerParticipants(activeParticipant);
  }, [cameraEnabled, participantId, updateControllerParticipants]);

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
      if (
        !p2pSignalMatchesActiveGeneration(
          item,
          roomGenerationRef.current,
          sourceGenerationRef.current,
        )
      ) {
        continue;
      }

      const activeParticipant = participantRef.current;
      const activeParticipants = participantsRef.current.length
        ? participantsRef.current
        : activeParticipant
          ? [activeParticipant]
          : [];
      if (!participantId || !activeParticipant) {
        continue;
      }

      if (!activeParticipants.some((participant) => participant.id === item.fromUserId)) {
        continue;
      }

      const voiceParticipantIds = getVoiceParticipantIds(activeParticipant);
      const canReceiveSignal = canReceiveP2PSignalFromParticipant(
        activeParticipants,
        participantId,
        item.fromUserId,
        cameraEnabledRef.current,
        voiceParticipantIds,
      );

      if (item.signal.kind === "voice-start") {
        if (!canReceiveSignal) {
          logDebug("p2p.signal", "drop voice from inactive media participant", {
            fromUserId: item.fromUserId,
            kind: item.signal.kind,
            localParticipantId: participantId,
          });
          continue;
        }
        void controller
          .handleSignal(
            item.fromUserId,
            item.signal,
            p2pSignalMetadata(item),
          )
          .then((accepted) => {
            if (!accepted) {
              return;
            }
            if (
              syncRemoteVoiceParticipant(
                controller,
                item.fromUserId,
                remoteVoiceParticipantIdsRef.current,
              )
            ) {
              updateControllerParticipants();
            }
          });
        continue;
      }

      if (item.signal.kind === "voice-stop") {
        void controller
          .handleSignal(
            item.fromUserId,
            item.signal,
            p2pSignalMetadata(item),
          )
          .then((accepted) => {
            if (!accepted) {
              return;
            }
            if (
              syncRemoteVoiceParticipant(
                controller,
                item.fromUserId,
                remoteVoiceParticipantIdsRef.current,
              )
            ) {
              updateControllerParticipants();
            }
          });
        continue;
      }

      const hasExistingPeer = controller.hasPeer(item.fromUserId);
      if (!hasExistingPeer && !canReceiveSignal) {
        logDebug("p2p.signal", "drop inactive media participant", {
          localParticipantId: participantId,
          fromUserId: item.fromUserId,
          hasExistingPeer,
          kind: item.signal.kind,
          localCameraWanted: cameraEnabledRef.current,
          localCameraEnabled: activeParticipant.cameraEnabled,
          remoteCameraEnabled:
            activeParticipants.find((participant) => participant.id === item.fromUserId)
              ?.cameraEnabled ?? null,
          voiceParticipantIds: Array.from(voiceParticipantIds),
        });
        continue;
      }

      void controller
        .handleSignal(
          item.fromUserId,
          item.signal,
          p2pSignalMetadata(item),
        )
        .then((accepted) => {
          if (
            accepted &&
            syncRemoteVoiceParticipant(
              controller,
              item.fromUserId,
              remoteVoiceParticipantIdsRef.current,
            )
          ) {
            updateControllerParticipants();
          }
        });
    }
  }, [
    getVoiceParticipantIds,
    incomingP2PSignals,
    participantId,
    updateControllerParticipants,
  ]);

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

  const setMicrophonePublishing = useCallback(
    async (
      enabled: boolean,
      release: "warm" | "immediate",
      voiceMode: VoiceMode = microphoneVoiceModeRef.current,
    ) => {
      microphonePublishingRef.current = enabled;
      microphoneReleaseRef.current = release;
      microphoneVoiceModeRef.current = voiceMode;
      if (enabled) {
        setMicrophoneTerminalFailure(null);
      }
      updateControllerParticipants();
      await controllerRef.current?.setMicrophonePublishing(
        enabled,
        release,
        voiceMode,
      );
      updateControllerParticipants();
    },
    [updateControllerParticipants],
  );

  const unlockAudio = useCallback(async () => {
    await controllerRef.current?.unlockAudio();
  }, []);

  const getDiagnostics = useCallback(async () => {
    return (await controllerRef.current?.getStats()) ?? null;
  }, []);

  const setParticipantAudioOutput = useCallback(
    (
      targetParticipantId: string,
      preference: ParticipantAudioPreference,
    ) => {
      controllerRef.current?.setParticipantAudioOutput(
        targetParticipantId,
        preference,
      );
    },
    [],
  );

  return {
    activeSpeakerIds,
    getDiagnostics,
    microphoneStatus,
    microphoneTerminalFailure,
    setMicrophonePublishing,
    setParticipantAudioOutput,
    unlockAudio,
    videos,
    voiceMessage,
  };
}

async function replayPendingP2PSignals(
  controller: P2PMediaController,
  incomingP2PSignals: IncomingP2PSignal[],
  lastSignalSequenceRef: { current: number },
  participants: Participant[],
  localParticipantId: string,
  remoteVoiceParticipantIds: Set<string>,
  roomGeneration: number,
  sourceGeneration: number,
): Promise<void> {
  for (const item of incomingP2PSignals) {
    if (item.sequence <= lastSignalSequenceRef.current) {
      continue;
    }

    lastSignalSequenceRef.current = item.sequence;
    if (!p2pSignalMatchesActiveGeneration(item, roomGeneration, sourceGeneration)) {
      continue;
    }
    if (
      item.signal.kind !== "voice-stop" &&
      !canReceiveP2PSignalFromParticipant(
        participants,
        localParticipantId,
        item.fromUserId,
        false,
      )
    ) {
      continue;
    }

    const accepted = await controller.handleSignal(item.fromUserId, item.signal, {
      senderConnectionId: item.senderConnectionId,
      ...(item.senderMediaSessionId
        ? { senderMediaSessionId: item.senderMediaSessionId }
        : {}),
    });
    if (!accepted) {
      continue;
    }
    syncRemoteVoiceParticipant(
      controller,
      item.fromUserId,
      remoteVoiceParticipantIds,
    );
  }
}

function syncRemoteVoiceParticipant(
  controller: P2PMediaController,
  participantId: string,
  remoteVoiceParticipantIds: Set<string>,
): boolean {
  const publishing = controller.isRemoteVoicePublishing(participantId);
  if (publishing) {
    const size = remoteVoiceParticipantIds.size;
    remoteVoiceParticipantIds.add(participantId);
    return remoteVoiceParticipantIds.size !== size;
  }
  return remoteVoiceParticipantIds.delete(participantId);
}

function p2pSignalMetadata(item: IncomingP2PSignal) {
  return {
    senderConnectionId: item.senderConnectionId,
    ...(item.senderMediaSessionId
      ? { senderMediaSessionId: item.senderMediaSessionId }
      : {}),
  };
}

function p2pSignalMatchesActiveGeneration(
  item: IncomingP2PSignal,
  roomGeneration: number,
  sourceGeneration: number,
): boolean {
  if (roomGeneration > 0 && item.roomGeneration !== roomGeneration) {
    return false;
  }

  if (sourceGeneration > 0 && item.sourceGeneration !== sourceGeneration) {
    return false;
  }

  return true;
}
