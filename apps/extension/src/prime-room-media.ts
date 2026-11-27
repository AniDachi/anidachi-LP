import type {Participant, RoomMediaKind, ServerEvent, VoiceMode} from "@anidachi/protocol";
import type {GhostVideo, SignalingTransportReady} from "./media-types";
import {loadP2PIceServers, refreshP2PIceServers} from "./p2p-ice";
import {canReceiveP2PSignalFromParticipant, P2PMediaController, selectP2PMediaParticipants} from "./p2p-media";
import type {PrimeMediaScope} from "./prime-media-access";
import {PrimeMediaOwnerAccess} from "./prime-media-owner-access";
import {emptyPrimeMediaState, PrimeMediaCommandSchema, type PrimeMediaState} from "./prime-room-media-types";
import type {RoomClient, RoomConnectionStatus} from "./room-client";
import type {ParticipantAudioPreference} from "./voice-audio-preferences";

type InboundSignal = Extract<ServerEvent, {type: "P2P_SIGNAL"}>;
export function createPrimeRoomMedia(
  client: RoomClient, local: Participant, emit: (value: unknown) => void,
  room: PrimeMediaScope & {roomToken: string},
) {
  const gestures = new Map<RoomMediaKind, number>();
  const remoteVoice = new Set<string>();
  let controller: P2PMediaController | null = null;
  let participants: Participant[] = [];
  let versioned = true;
  let roomGeneration = -1, sourceGeneration = -1;
  let closed = false, attached = true, snapshotReady = false, loading = false;
  let cameraWanted = false, microphoneWanted = false;
  let microphoneOwner: string | undefined;
  let mode: VoiceMode = "push-to-talk";
  let release: "immediate" | "warm" = "immediate";
  let ready: SignalingTransportReady | null = null;
  let pendingSignals: InboundSignal[] = [];
  let outputs: Record<string, ParticipantAudioPreference> = {};
  let outputsReady = false;
  let videos: GhostVideo[] = [];
  let state: PrimeMediaState = {...emptyPrimeMediaState};
  let previousCamera = "", previousMic = "";

  const publish = () => { if (!closed && attached) emit(state); };
  const patch = (change: Partial<PrimeMediaState>) => { state = {...state, ...change}; publish(); };
  const access = new PrimeMediaOwnerAccess(room, permissionRequests => patch({permissionRequests}));
  const snapshot = () => versioned ? client.media?.snapshot ?? null : undefined;
  const authorized = (device: RoomMediaKind) => snapshotReady && !closed && (versioned
    ? Boolean(client.media?.canCapture(device))
    : participants.some(p => p.id === local.id && p.connected !== false && p.mediaSeat === "joined"));
  function refreshVideos() {
    const grants = snapshot();
    const allowed = videos.filter(video => {
      const participant = participants.find(p => p.id === video.participantId && p.connected !== false);
      if (!snapshotReady || !participant) return false;
      if (video.local) return authorized("camera");
      return versioned ? grants?.participants.some(p => p.participantSessionId === participant.participantSessionId && p.cameraGranted)
        : participant.mediaSeat === "joined" && participant.cameraEnabled;
    });
    access.update(allowed);
    const next = allowed.map(({participantId, local, element}) =>
      ({participantId, local, revision: (element.srcObject as MediaStream).id}));
    if (JSON.stringify(next) !== JSON.stringify(state.videos)) patch({videos: next});
  }
  function reconcile() {
    const camera = authorized("camera"), microphone = authorized("microphone");
    const captures = {camera: client.media?.captureIntent("camera"), microphone: client.media?.captureIntent("microphone")};
    const voice = new Set(remoteVoice);
    if (microphoneWanted && microphone) voice.add(local.id);
    const media = snapshot();
    const peers = versioned ? participants : selectP2PMediaParticipants(participants, local.id, cameraWanted && camera, voice);
    controller?.updateParticipants(snapshotReady ? peers : [], new Set(participants.filter(p => p.mediaSeat === "joined").map(p => p.id)), media);
    controller?.setCaptureAuthority(camera, microphone, captures);
    refreshVideos();
    if (!controller) return;
    const camOn = camera && (versioned || cameraWanted);
    const micOn = microphone && microphoneWanted &&
      (!versioned || microphoneOwner === captures.microphone?.requestId);
    const camKey = JSON.stringify([camOn, captures.camera?.requestId]);
    const micKey = JSON.stringify([micOn, captures.microphone?.requestId, mode, release]);
    if (camKey !== previousCamera) { previousCamera = camKey; void controller.setCameraEnabled(camOn); }
    if (micKey !== previousMic) { previousMic = micKey; void controller.setMicrophonePublishing(micOn, release, mode); }
  }
  function signal(event: InboundSignal) {
    if (!snapshotReady || event.roomId !== room.roomId || event.toUserId !== local.id ||
        event.roomGeneration !== roomGeneration || event.sourceGeneration !== sourceGeneration ||
        !canReceiveP2PSignalFromParticipant(participants, local.id, event.fromUserId, cameraWanted, remoteVoice, snapshot())) return;
    if (!controller) {
      if (pendingSignals.length < 128) pendingSignals.push(event);
      return;
    }
    const target = controller;
    void target.handleSignal(event.fromUserId, event.signal, event).then(accepted => {
      if (!accepted || closed || target !== controller || versioned) return;
      if (target.isRemoteVoicePublishing(event.fromUserId)) remoteVoice.add(event.fromUserId);
      else remoteVoice.delete(event.fromUserId);
      reconcile();
    });
  }
  async function start() {
    if (closed || loading || controller || !snapshotReady || !outputsReady) return;
    loading = true;
    try {
      const iceServers = await loadP2PIceServers(room);
      if (closed || !snapshotReady) return;
      controller = new P2PMediaController({
        localParticipant: local, videoOnlyTiles: true, iceServers, refreshIceServers: () => refreshP2PIceServers(room),
        captureDevice: (device, constraints, current) => {
          const requestId = client.media?.captureIntent(device)?.requestId;
          const permissionCurrent = () => authorized(device) && requestId === client.media?.captureIntent(device)?.requestId &&
            (versioned || device !== "camera" || cameraWanted);
          const gestureExpires = gestures.get(device) ?? 0;
          gestures.delete(device);
          return access.capture(device, constraints, () => current() && permissionCurrent(),
            () => permissionCurrent() && gestureExpires >= Date.now());
        },
        onActiveSpeakerIdsChange: activeSpeakerIds => patch({activeSpeakerIds}),
        onCameraStatus: enabled => {
          if (!closed) client.send({type: enabled ? "CAMERA_ON" : "CAMERA_OFF", roomId: room.roomId, userId: local.id});
        },
        onVideosChange: next => { videos = next; refreshVideos(); },
        onVoiceMessageChange: voiceMessage => patch({voiceMessage}),
        onMicrophoneStatusChange: microphoneStatus => patch({microphoneStatus}),
        onMicrophoneTerminalFailure: failure => { microphoneWanted = false; patch({microphoneTerminalFailure: failure}); },
        onMediaTerminalFailure: failure => {
          if (client.releaseFailedMedia(failure.intent)) {
            if (failure.media === "microphone") microphoneWanted = false;
            reconcile();
          }
        },
        sendSignal: (toUserId, signal, {senderMediaSessionId}) =>
          !closed && snapshotReady ? client.send({type: "P2P_SIGNAL", clientSignalId: crypto.randomUUID(),
            roomId: room.roomId, fromUserId: local.id, toUserId, senderConnectionId: client.senderConnectionId,
            senderMediaSessionId, roomGeneration, sourceGeneration, signal}) : "dropped",
      });
      controller.replaceParticipantAudioOutputs(outputs);
      reconcile();
      if (ready) void controller.handleSignalingTransportReady(ready);
      const backlog = pendingSignals;
      pendingSignals = [];
      backlog.forEach(signal);
    } catch {
      if (!closed) patch({voiceMessage: "Media relay is temporarily unavailable."});
    } finally { loading = false; }
  }
  function close() {
    if (closed) return;
    closed = true; snapshotReady = false;
    access.close();
    controller?.disconnect();
    controller = null;
    pendingSignals = [];
  }
  return {
    onEvent(event: ServerEvent) {
      if (closed) return;
      switch (event.type) {
        case "ROOM_ENDED": close(); return;
        case "ROOM_SNAPSHOT":
          if (event.roomId !== room.roomId || event.roomGeneration < roomGeneration) return;
          participants = event.participants;
          snapshotReady = participants.some(p => p.id === local.id && p.connected !== false &&
            (!p.participantSessionId || p.participantSessionId === room.participantSessionId));
          roomGeneration = event.roomGeneration;
          sourceGeneration = event.sourceGeneration;
          // The legacy snapshot has no version field. A legacy publisher must
          // hold an actual joined seat; v2/v3 participants have mediaSeat "none".
          versioned = !!client.media?.snapshot || !participants.some(p => p.id === local.id && p.mediaSeat === "joined");
          break;
        case "SOURCE_CHANGED":
          if (event.roomGeneration === roomGeneration && event.sourceGeneration > sourceGeneration) sourceGeneration = event.sourceGeneration;
          return;
        case "PARTICIPANT_JOINED":
          participants = [...participants.filter(p => p.id !== event.participant.id), event.participant]; break;
        case "PARTICIPANT_LEFT":
          participants = participants.filter(p => p.id !== event.participant.id);
          remoteVoice.delete(event.participant.id); break;
        case "P2P_SIGNAL": signal(event); return;
        case "ROOM_MEDIA_SNAPSHOT": versioned = true; break;
        case "MEDIA_INTENT_ACK": case "MEDIA_INTENT_ERROR": case "MEDIA_SEAT_RESULT": break;
        default: return;
      }
      reconcile();
      void start();
    },
    onStatus(status: RoomConnectionStatus) {
      if (status === "error" || status === "closed") {
        snapshotReady = false;
        pendingSignals = [];
        reconcile();
      }
    },
    onTransportReady(next: SignalingTransportReady) {
      ready = next;
      void controller?.handleSignalingTransportReady(next);
    },
    onCommand(input: unknown) {
      if (closed) return;
      const parsed = PrimeMediaCommandSchema.safeParse(input);
      if (!parsed.success) return;
      const command = parsed.data;
      switch (command.type) {
        case "state": publish(); return;
        case "gesture": gestures.set(command.device, Date.now() + 120_000); return;
        case "camera": cameraWanted = command.enabled; break;
        case "microphone":
          if (versioned && (!command.requestId || command.requestId !== client.media?.captureIntent("microphone")?.requestId)) return;
          mode = command.mode;
          release = command.release;
          microphoneWanted = command.enabled;
          microphoneOwner = command.requestId;
          if (command.enabled) patch({microphoneTerminalFailure: null});
          break;
        case "reconcile": break;
        case "unlock": void controller?.unlockAudio(); return;
        case "outputs":
          outputs = command.preferences;
          outputsReady = true;
          controller?.replaceParticipantAudioOutputs(outputs);
          void start();
          return;
        case "output": outputs = {...outputs, [command.id]: command.preference}; controller?.setParticipantAudioOutput(command.id, command.preference); return;
        case "stats":
          void Promise.resolve(controller?.getStats()).then(stats => {
            if (attached && !closed) emit({type: "prime-media-stats", id: command.id, stats: stats ?? null});
          });
          return;
      }
      reconcile();
      void start();
    },
    onDetach() {
      attached = false;
      gestures.clear();
      access.detach();
      if (mode === "push-to-talk") { microphoneWanted = false; release = "immediate"; reconcile(); }
    },
    onAttach() { attached = true; access.attach(); publish(); },
    close,
  };
}
