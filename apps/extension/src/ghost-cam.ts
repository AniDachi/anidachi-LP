import type { Participant } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { logDebug } from "./debug-log";
import type { GhostVideo, IncomingP2PSignal, LiveVoiceStatus } from "./media-types";
import { loadP2PIceServers, refreshP2PIceServers } from "./p2p-ice";
import {
  canReceiveP2PSignalFromParticipant,
  P2PMediaController,
  selectP2PMediaParticipants,
} from "./p2p-media";

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
  roomGeneration: number;
  roomId: string | null;
  roomToken: string | null;
  sendP2PSignal: IncomingP2PSignalSender;
  sourceGeneration: number;
  voiceTalkActive: boolean;
}

type IncomingP2PSignalSender = (toUserId: string, signal: IncomingP2PSignal["signal"]) => void;

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
    participants,
    roomId,
    roomToken,
    roomGeneration,
    sendP2PSignal,
    sourceGeneration,
    voiceTalkActive,
  } = options;
  const [videos, setVideos] = useState<GhostVideo[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<LiveVoiceStatus>("idle");
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
  const sourceGenerationRef = useRef(sourceGeneration);
  const voiceTalkActiveRef = useRef(voiceTalkActive);
  const remoteVoiceParticipantIdsRef = useRef<Set<string>>(new Set());
  const lastSignalSequenceRef = useRef(0);
  const participantId = participant?.id ?? null;
  // Read at fetch time so ICE refreshes use the current room token without
  // re-running the heavy P2P connect effect when the token rotates.
  const iceAuthRef = useRef<{ roomId: string; roomToken: string } | null>(null);
  iceAuthRef.current = roomId && roomToken ? { roomId, roomToken } : null;

  // Live-voice participants: remotes that announced voice-start, plus the
  // local user while push-to-talk is held. selectP2PMediaParticipants pairs a
  // talking participant with everyone in the room, so nobody else needs to be
  // force-added here.
  const getVoiceParticipantIds = useCallback((activeParticipant: Participant) => {
    const voiceParticipantIds = new Set(remoteVoiceParticipantIdsRef.current);
    if (voiceTalkActiveRef.current) {
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

  const updateControllerParticipants = useCallback(
    (activeParticipant: Participant | null = participantRef.current) => {
      if (!activeParticipant) {
        controllerRef.current?.updateParticipants([]);
        return;
      }
      controllerRef.current?.updateParticipants(getMediaParticipants(activeParticipant));
    },
    [getMediaParticipants],
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
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    sendP2PSignalRef.current = sendP2PSignal;
  }, [sendP2PSignal]);

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
    voiceTalkActiveRef.current = voiceTalkActive;
  }, [voiceTalkActive]);

  useEffect(() => {
    if (!shouldConnect || !roomId || !participantId) {
      controllerRef.current?.disconnect();
      controllerRef.current = null;
      remoteVoiceParticipantIdsRef.current.clear();
      setVideos([]);
      setActiveSpeakerIds([]);
      setVoiceStatus("idle");
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
    setVoiceStatus("connecting");

    async function connectP2P() {
      let iceServers: RTCIceServer[];
      try {
        iceServers = await loadP2PIceServers(iceAuthRef.current ?? undefined);
      } catch (error) {
        if (disposed) {
          return;
        }

        console.warn("[Anidachi] P2P ICE setup failed", error);
        setVoiceStatus("error");
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
        onVideosChange: setVideos,
        onVoiceMessageChange: setVoiceMessage,
        onVoiceStatusChange: setVoiceStatus,
        refreshIceServers: () => refreshP2PIceServers(iceAuthRef.current ?? undefined),
        sendSignal: (toUserId, signal) => sendP2PSignalRef.current(toUserId, signal),
      });

      ownedController = controller;
      controllerRef.current = controller;
      rememberPendingVoiceParticipants(
        incomingP2PSignalsRef.current,
        remoteVoiceParticipantIdsRef.current,
        participantsRef.current.length ? participantsRef.current : [sessionParticipant],
        sessionParticipant.id,
        roomGeneration,
        sourceGeneration,
      );
      await controller.setCameraEnabled(cameraEnabledRef.current);
      if (disposed) {
        return;
      }
      controller.updateParticipants(getMediaParticipants(sessionParticipant));
      replayPendingP2PSignals(
        controller,
        incomingP2PSignalsRef.current,
        lastSignalSequenceRef,
        roomGeneration,
        sourceGeneration,
      );
      if (voiceTalkActiveRef.current) {
        void controller.startVoiceTalk();
      } else {
        setVoiceStatus("idle");
      }
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
    participantId,
    roomGeneration,
    roomId,
    shouldConnect,
    sourceGeneration,
  ]);

  useEffect(() => {
    if (!participantId) {
      controllerRef.current?.updateParticipants([]);
      return;
    }

    const activeParticipant = participantRef.current;
    if (!activeParticipant || activeParticipant.id !== participantId) {
      controllerRef.current?.updateParticipants([]);
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
    if (!voiceTalkActive) {
      void (async () => {
        await controllerRef.current?.stopVoiceTalk();
        updateControllerParticipants();
      })();
      return;
    }

    updateControllerParticipants();
    void controllerRef.current?.startVoiceTalk();
  }, [updateControllerParticipants, voiceTalkActive]);

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

      if (item.signal.kind === "voice-start") {
        remoteVoiceParticipantIdsRef.current.add(item.fromUserId);
        updateControllerParticipants(activeParticipant);
        void controller.handleSignal(
          item.fromUserId,
          item.signal,
          p2pSignalMetadata(item),
        );
        continue;
      }

      if (item.signal.kind === "voice-stop") {
        void controller.handleSignal(
          item.fromUserId,
          item.signal,
          p2pSignalMetadata(item),
        );
        remoteVoiceParticipantIdsRef.current.delete(item.fromUserId);
        updateControllerParticipants(activeParticipant);
        continue;
      }

      const voiceParticipantIds = getVoiceParticipantIds(activeParticipant);
      const hasExistingPeer = controller.hasPeer(item.fromUserId);
      if (
        !hasExistingPeer &&
        !canReceiveP2PSignalFromParticipant(
          activeParticipants,
          participantId,
          item.fromUserId,
          cameraEnabledRef.current,
          voiceParticipantIds,
        )
      ) {
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

      void controller.handleSignal(
        item.fromUserId,
        item.signal,
        p2pSignalMetadata(item),
      );
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

function rememberPendingVoiceParticipants(
  incomingP2PSignals: IncomingP2PSignal[],
  remoteVoiceParticipantIds: Set<string>,
  participants: Participant[],
  localParticipantId: string,
  roomGeneration: number,
  sourceGeneration: number,
): void {
  const participantIds = new Set(participants.map((participant) => participant.id));
  for (const item of incomingP2PSignals) {
    if (!p2pSignalMatchesActiveGeneration(item, roomGeneration, sourceGeneration)) {
      continue;
    }
    if (item.fromUserId === localParticipantId || !participantIds.has(item.fromUserId)) {
      continue;
    }
    if (item.signal.kind === "voice-start") {
      remoteVoiceParticipantIds.add(item.fromUserId);
    } else if (item.signal.kind === "voice-stop") {
      remoteVoiceParticipantIds.delete(item.fromUserId);
    }
  }
}

function replayPendingP2PSignals(
  controller: P2PMediaController,
  incomingP2PSignals: IncomingP2PSignal[],
  lastSignalSequenceRef: { current: number },
  roomGeneration: number,
  sourceGeneration: number,
): void {
  for (const item of incomingP2PSignals) {
    if (item.sequence <= lastSignalSequenceRef.current) {
      continue;
    }

    lastSignalSequenceRef.current = item.sequence;
    if (!p2pSignalMatchesActiveGeneration(item, roomGeneration, sourceGeneration)) {
      continue;
    }

    void controller.handleSignal(item.fromUserId, item.signal, {
      senderConnectionId: item.senderConnectionId,
    });
  }
}

function p2pSignalMetadata(item: IncomingP2PSignal) {
  return {
    senderConnectionId: item.senderConnectionId,
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
