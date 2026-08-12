/**
 * Browser harness entry for the real-WebRTC two-browser P2P test (Block 1.5).
 *
 * It bundles the *actual* extension P2P engine (`P2PMediaController`) and room
 * transport (`RoomClient`) — the same code that ships — and exposes a small
 * window API the Playwright runner drives. The glue here mirrors the overlay's
 * wiring (participant feed + P2P_SIGNAL envelope) so the test exercises the real
 * negotiation/ICE/reconnect logic, not a re-implementation.
 */
import type { Participant, P2PSignal, ServerEvent } from "@anidachi/protocol";
import { RoomClient, type RoomConnectionStatus } from "../../apps/extension/src/room-client";
import { P2PMediaController, selectP2PMediaParticipants } from "../../apps/extension/src/p2p-media";
import type { ParticipantAudioPreference } from "../../apps/extension/src/voice-audio-preferences";

const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
  navigator.mediaDevices,
);
let microphoneCaptureCount = 0;
navigator.mediaDevices.getUserMedia = async (constraints) => {
  if (
    typeof constraints === "object" &&
    constraints !== null &&
    Boolean(constraints.audio)
  ) {
    microphoneCaptureCount += 1;
  }
  return nativeGetUserMedia(constraints);
};

interface StartOptions {
  roomId: string;
  token: string;
  sub: string;
  role: "host" | "viewer";
  sessionId: string;
  iceServers?: RTCIceServer[];
  cameraEnabled?: boolean;
}

interface HarnessState {
  status: RoomConnectionStatus;
  participantCount: number;
  cameraEnabledCount: number;
  remoteVideoCount: number;
  remoteFramesDecoded: number;
  candidatePairTypes: string[];
  iceRestartCounts: number[];
  peerHealth: string[];
  microphonePublishingWanted: boolean;
  microphonePublishing: boolean;
  microphoneCaptureCount: number;
  localSpeaking: boolean;
  remoteAudioExpectedIds: string[];
  remoteAudioActivity: string[];
  remoteAudioFlowActivity: string[];
  participantAudioOutputs: Array<{
    remoteUserId: string;
    muted: boolean;
    volume: number;
  }>;
  remoteVideoActivity: string[];
}

class Harness {
  private client: RoomClient | null = null;
  private controller: P2PMediaController | null = null;
  private options: StartOptions | null = null;
  private status: RoomConnectionStatus = "idle";
  private participants: Participant[] = [];
  private self: Participant | null = null;
  private lastSeenP2PServerSeq = 0;
  private readonly seenSignals = new Set<string>();
  private readonly remoteVideos = new Map<string, HTMLVideoElement>();
  private dropNextSignalKind: P2PSignal["kind"] | null = null;
  private readonly droppedSignalCounts = new Map<P2PSignal["kind"], number>();

  constructor() {
    window.addEventListener("online", () => {
      void this.reconnect("online");
      this.controller?.recoverDisconnectedPeers("online");
    });
  }

  async start(options: StartOptions): Promise<void> {
    this.options = options;
    const self: Participant = {
      id: options.sub,
      displayName: options.sub,
      role: options.role === "host" ? "host" : "viewer",
      cameraEnabled: false,
      mediaSeat: "none",
      syncStatus: "unknown",
      lastSeenAt: 0,
    };
    this.self = self;

    this.ensureController(options, self);
    const cameraEnabled = options.cameraEnabled !== false;
    if (cameraEnabled) {
      await this.controller?.setCameraEnabled(true);
      self.cameraEnabled = true;
    }
    this.connectClient(options, self);
    await this.waitForStatus("connected", 8000);
    if (cameraEnabled) {
      this.client?.send({
        type: "CAMERA_ON",
        roomId: options.roomId,
        userId: self.id,
      });
    }
  }

  private ensureController(options: StartOptions, self: Participant): P2PMediaController {
    if (!this.controller) {
      this.controller = new P2PMediaController({
        iceServers: options.iceServers ?? [],
        localParticipant: self,
        onActiveSpeakerIdsChange: () => undefined,
        onCameraStatus: (enabled) => {
          self.cameraEnabled = enabled;
          this.client?.send({
            type: enabled ? "CAMERA_ON" : "CAMERA_OFF",
            roomId: options.roomId,
            userId: self.id,
          });
        },
        onMicrophoneStatusChange: () => undefined,
        onMicrophoneTerminalFailure: () => undefined,
        onVoiceMessageChange: () => undefined,
        onVideosChange: (videos) => {
          // Attach remote video elements to the DOM so the browser decodes
          // incoming frames (the metric the TTFM assertion reads).
          const nextRemoteIds = new Set(
            videos.filter((video) => !video.local).map((video) => video.participantId),
          );
          for (const [participantId, element] of this.remoteVideos) {
            if (nextRemoteIds.has(participantId)) continue;
            element.remove();
            element.srcObject = null;
            this.remoteVideos.delete(participantId);
          }
          for (const video of videos) {
            if (video.local) continue;
            if (this.remoteVideos.get(video.participantId) !== video.element) {
              const existing = this.remoteVideos.get(video.participantId);
              existing?.remove();
              if (existing) existing.srcObject = null;
              video.element.style.width = "120px";
              video.element.muted = true;
              video.element.playsInline = true;
              document.body.appendChild(video.element);
              this.remoteVideos.set(video.participantId, video.element);
              void video.element.play().catch(() => undefined);
            }
          }
        },
        sendSignal: (toUserId, signal, metadata) => {
          if (toUserId === self.id) return "dropped";
          if (this.dropNextSignalKind === signal.kind) {
            this.dropNextSignalKind = null;
            this.droppedSignalCounts.set(
              signal.kind,
              (this.droppedSignalCounts.get(signal.kind) ?? 0) + 1,
            );
            return "dropped";
          }
          const currentClient = this.client;
          if (!currentClient) return "dropped";
          return currentClient.send({
            type: "P2P_SIGNAL",
            clientSignalId: crypto.randomUUID(),
            roomId: options.roomId,
            fromUserId: self.id,
            senderConnectionId: currentClient.senderConnectionId,
            senderMediaSessionId: metadata.senderMediaSessionId,
            toUserId,
            signal,
          });
        },
      });
    }

    return this.controller;
  }

  private connectClient(options: StartOptions, self: Participant, reconnect = false): void {
    const client = new RoomClient();
    this.client = client;
    this.ensureController(options, self);

    client.connect({
      roomId: options.roomId,
      roomToken: options.token,
      participant: self,
      videoFingerprint: "harness",
      participantSessionId: options.sessionId,
      lastSeenP2PServerSeq: this.lastSeenP2PServerSeq,
      reconnect,
      onStatus: (status) => {
        this.status = status;
      },
      onEvent: (event) => this.onServerEvent(self.id, event),
      onTransportReady: (ready) => {
        void this.controller?.handleSignalingTransportReady(ready);
      },
    });
  }

  async reconnect(reason: string): Promise<void> {
    if (!this.options || !this.self) {
      return;
    }

    this.client?.close();
    this.status = "connecting";
    this.connectClient(this.options, this.self, true);
    await this.waitForStatus("connected", 8000);
    this.controller?.recoverDisconnectedPeers(reason);
  }

  private onServerEvent(selfId: string, event: ServerEvent): void {
    if (event.type === "ROOM_SNAPSHOT") {
      this.participants = event.participants;
      this.updateControllerParticipants();
      return;
    }
    if (event.type === "PARTICIPANT_JOINED") {
      this.participants = [
        ...this.participants.filter((p) => p.id !== event.participant.id),
        event.participant,
      ];
      this.updateControllerParticipants();
      return;
    }
    if (event.type === "PARTICIPANT_LEFT") {
      this.participants = this.participants.filter((p) => p.id !== event.participant.id);
      this.updateControllerParticipants();
      return;
    }
    if (event.type === "P2P_SIGNAL" && event.toUserId === selfId) {
      if (event.serverSeq !== undefined) {
        this.lastSeenP2PServerSeq = Math.max(this.lastSeenP2PServerSeq, event.serverSeq);
      }
      const key = `${event.fromUserId}:${event.senderConnectionId}:${event.clientSignalId}`;
      if (this.seenSignals.has(key)) return;
      this.seenSignals.add(key);
      void this.controller?.handleSignal(event.fromUserId, event.signal, {
        senderConnectionId: event.senderConnectionId,
        senderMediaSessionId: event.senderMediaSessionId,
      });
    }
  }

  private updateControllerParticipants(): void {
    if (!this.controller || !this.self) {
      return;
    }

    this.controller.updateParticipants(
      selectP2PMediaParticipants(this.participants, this.self.id, this.self.cameraEnabled),
    );
  }

  private async waitForStatus(target: RoomConnectionStatus, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.status === target) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`timeout waiting for status ${target} (got ${this.status})`);
  }

  async getState(): Promise<HarnessState> {
    let remoteFramesDecoded = 0;
    const candidatePairTypes: string[] = [];
    const iceRestartCounts: number[] = [];
    const peerHealth: string[] = [];
    const remoteAudioActivity: string[] = [];
    const remoteAudioFlowActivity: string[] = [];
    const participantAudioOutputs: HarnessState["participantAudioOutputs"] = [];
    const remoteVideoActivity: string[] = [];
    let microphonePublishingWanted = false;
    let microphonePublishing = false;
    let localSpeaking = false;
    let remoteAudioExpectedIds: string[] = [];
    if (this.controller) {
      const stats = await this.controller.getStats();
      microphonePublishingWanted = stats.microphonePublishingWanted;
      microphonePublishing = stats.microphonePublishing;
      localSpeaking = stats.localSpeaking;
      remoteAudioExpectedIds = stats.remoteAudioExpectedIds;
      for (const peer of stats.peers ?? []) {
        const inbound = peer.stats?.videoInbound as { framesDecoded?: number } | undefined;
        if (inbound?.framesDecoded) {
          remoteFramesDecoded = Math.max(remoteFramesDecoded, inbound.framesDecoded);
        }
        const pair = peer.stats?.candidatePair as
          | { localCandidateType?: string; remoteCandidateType?: string }
          | undefined;
        if (pair?.localCandidateType) {
          candidatePairTypes.push(`${pair.localCandidateType}/${pair.remoteCandidateType ?? "?"}`);
        }
        if (typeof peer.iceRestartCount === "number") iceRestartCounts.push(peer.iceRestartCount);
        if (peer.health) peerHealth.push(peer.health);
        remoteAudioActivity.push(peer.remoteAudioActivity);
        if (peer.remoteAudioFlowActivity) {
          remoteAudioFlowActivity.push(peer.remoteAudioFlowActivity);
        }
        participantAudioOutputs.push({
          remoteUserId: peer.remoteUserId,
          ...peer.participantAudioOutput,
        });
        if (peer.remoteVideoActivity) {
          remoteVideoActivity.push(peer.remoteVideoActivity);
        }
      }
    }
    return {
      status: this.status,
      participantCount: this.participants.length,
      cameraEnabledCount: this.participants.filter((participant) => participant.cameraEnabled)
        .length,
      remoteVideoCount: this.remoteVideos.size,
      remoteFramesDecoded,
      candidatePairTypes,
      iceRestartCounts,
      peerHealth,
      microphonePublishingWanted,
      microphonePublishing,
      microphoneCaptureCount,
      localSpeaking,
      remoteAudioExpectedIds,
      remoteAudioActivity,
      remoteAudioFlowActivity,
      participantAudioOutputs,
      remoteVideoActivity,
    };
  }

  async startVoice(): Promise<void> {
    await this.controller?.setMicrophonePublishing(true, "warm");
  }

  async stopVoice(): Promise<void> {
    await this.controller?.setMicrophonePublishing(false, "warm");
  }

  async startOpenMic(): Promise<void> {
    await this.controller?.setMicrophonePublishing(true, "immediate");
  }

  async stopOpenMic(): Promise<void> {
    await this.controller?.setMicrophonePublishing(false, "immediate");
  }

  setParticipantAudioOutput(
    participantId: string,
    preference: ParticipantAudioPreference,
  ): void {
    this.controller?.setParticipantAudioOutput(participantId, preference);
  }

  dropNextSignal(kind: P2PSignal["kind"]): void {
    this.dropNextSignalKind = kind;
  }

  getDroppedSignalCount(kind: P2PSignal["kind"]): number {
    return this.droppedSignalCounts.get(kind) ?? 0;
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    await this.controller?.setCameraEnabled(enabled);
  }

  /** Max inbound audio bytes received across peers — proves audio actually flows. */
  async remoteAudioBytes(): Promise<number> {
    let bytes = 0;
    if (this.controller) {
      const stats = await this.controller.getStats();
      for (const peer of stats.peers ?? []) {
        const inbound = peer.stats?.audioInbound as { bytesReceived?: number } | undefined;
        if (inbound?.bytesReceived) bytes = Math.max(bytes, inbound.bytesReceived);
      }
    }
    return bytes;
  }

  stop(): void {
    this.controller?.disconnect();
    this.client?.close();
  }
}

declare global {
  interface Window {
    AnidachiHarness: Harness;
  }
}

window.AnidachiHarness = new Harness();
