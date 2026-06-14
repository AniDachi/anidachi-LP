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
import { P2PMediaController } from "../../apps/extension/src/p2p-media";

interface StartOptions {
  roomId: string;
  token: string;
  sub: string;
  role: "host" | "viewer";
  sessionId: string;
  iceServers?: RTCIceServer[];
}

interface HarnessState {
  status: RoomConnectionStatus;
  participantCount: number;
  remoteVideoCount: number;
  remoteFramesDecoded: number;
  candidatePairTypes: string[];
  peerHealth: string[];
}

class Harness {
  private client: RoomClient | null = null;
  private controller: P2PMediaController | null = null;
  private status: RoomConnectionStatus = "idle";
  private participants: Participant[] = [];
  private readonly seenSignals = new Set<string>();
  private readonly remoteVideos = new Map<string, HTMLVideoElement>();

  async start(options: StartOptions): Promise<void> {
    const self: Participant = {
      id: options.sub,
      displayName: options.sub,
      role: options.role === "host" ? "host" : "viewer",
      cameraEnabled: false,
      syncStatus: "unknown",
      lastSeenAt: 0,
    };

    const client = new RoomClient();
    this.client = client;

    this.controller = new P2PMediaController({
      iceServers: options.iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }],
      localParticipant: self,
      onActiveSpeakerIdsChange: () => undefined,
      onCameraStatus: () => undefined,
      onVoiceMessageChange: () => undefined,
      onVoiceStatusChange: () => undefined,
      onVideosChange: (videos) => {
        // Attach remote video elements to the DOM so the browser decodes
        // incoming frames (the metric the TTFM assertion reads).
        for (const video of videos) {
          if (video.local) continue;
          if (!this.remoteVideos.has(video.participantId)) {
            video.element.style.width = "120px";
            video.element.muted = true;
            video.element.playsInline = true;
            document.body.appendChild(video.element);
            this.remoteVideos.set(video.participantId, video.element);
            void video.element.play().catch(() => undefined);
          }
        }
      },
      sendSignal: (toUserId: string, signal: P2PSignal) => {
        if (toUserId === self.id) return;
        client.send({
          type: "P2P_SIGNAL",
          clientSignalId: crypto.randomUUID(),
          roomId: options.roomId,
          fromUserId: self.id,
          senderConnectionId: client.senderConnectionId,
          toUserId,
          signal,
        });
      },
    });

    client.connect({
      roomId: options.roomId,
      roomToken: options.token,
      participant: self,
      videoFingerprint: "harness",
      participantSessionId: options.sessionId,
      onStatus: (status) => {
        this.status = status;
      },
      onEvent: (event) => this.onServerEvent(self.id, event),
    });

    await this.waitForStatus("connected", 8000);
    await this.controller.setCameraEnabled(true);
  }

  private onServerEvent(selfId: string, event: ServerEvent): void {
    if (event.type === "ROOM_SNAPSHOT") {
      this.participants = event.participants;
      this.controller?.updateParticipants(this.participants);
      return;
    }
    if (event.type === "PARTICIPANT_JOINED") {
      this.participants = [
        ...this.participants.filter((p) => p.id !== event.participant.id),
        event.participant,
      ];
      this.controller?.updateParticipants(this.participants);
      return;
    }
    if (event.type === "PARTICIPANT_LEFT") {
      this.participants = this.participants.filter((p) => p.id !== event.participant.id);
      this.controller?.updateParticipants(this.participants);
      return;
    }
    if (event.type === "P2P_SIGNAL" && event.toUserId === selfId) {
      const key = `${event.fromUserId}:${event.senderConnectionId}:${event.clientSignalId}`;
      if (this.seenSignals.has(key)) return;
      this.seenSignals.add(key);
      void this.controller?.handleSignal(event.fromUserId, event.signal);
    }
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
    const peerHealth: string[] = [];
    if (this.controller) {
      const stats = (await this.controller.getStats()) as {
        peers?: Array<{ stats?: Record<string, unknown>; health?: string }>;
      };
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
        if (peer.health) peerHealth.push(peer.health);
      }
    }
    return {
      status: this.status,
      participantCount: this.participants.length,
      remoteVideoCount: this.remoteVideos.size,
      remoteFramesDecoded,
      candidatePairTypes,
      peerHealth,
    };
  }

  async startVoice(): Promise<void> {
    await this.controller?.startVoiceTalk();
  }

  async stopVoice(): Promise<void> {
    await this.controller?.stopVoiceTalk();
  }

  /** Max inbound audio bytes received across peers — proves audio actually flows. */
  async remoteAudioBytes(): Promise<number> {
    let bytes = 0;
    if (this.controller) {
      const stats = (await this.controller.getStats()) as {
        peers?: Array<{ stats?: Record<string, unknown> }>;
      };
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
