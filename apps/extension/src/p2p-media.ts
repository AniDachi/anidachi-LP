import type {
  P2PIceCandidate,
  P2PSignal,
  Participant,
} from "@anidachi/protocol";
import { logDebug } from "./debug-log";
import type { GhostVideo, LiveVoiceStatus } from "./media-types";

const P2P_MAX_REMOTE_PARTICIPANTS = 3;
const P2P_VIDEO_BITRATE_BPS = 150_000;
const P2P_AUDIO_BITRATE_BPS = 24_000;
const P2P_RENEGOTIATE_REQUEST_COOLDOWN_MS = 1_000;
const P2P_ICE_RESTART_COOLDOWN_MS = 8_000;
const P2P_ICE_RESTART_REQUEST_COOLDOWN_MS = 3_000;
const P2P_DISCONNECTED_RESTART_DELAY_MS = 3_500;
const P2P_AUDIO_TRANSCEIVER_DIRECTION: RTCRtpTransceiverDirection = "sendrecv";
/** Keep the mic warm this long after release so repeat push-to-talk is instant. */
const P2P_MIC_IDLE_RELEASE_MS = 60_000;
/** Reconcile desired-vs-actual media/connection state on this cadence (Block 5.3). */
const P2P_RECONCILE_INTERVAL_MS = 5_000;
const P2P_AUDIO_ACTIVITY_LEVEL_THRESHOLD = 0.01;
const P2P_AUDIO_ACTIVITY_MIN_PACKET_DELTA = 2;
const P2P_AUDIO_ACTIVITY_MIN_BYTE_DELTA = 120;
const P2P_AUDIO_QUIET_SAMPLES_BEFORE_CLEAR = 2;
const P2P_AUDIO_STALL_SAMPLES_BEFORE_RECOVERY = 2;
const P2P_VIDEO_ACTIVITY_MIN_FRAME_DELTA = 1;
const P2P_VIDEO_ACTIVITY_MIN_BYTE_DELTA = 1024;
const P2P_VIDEO_STALL_SAMPLES_BEFORE_RECOVERY = 2;
const P2P_MEDIA_STALL_RECOVERY_COOLDOWN_MS = 12_000;
const P2P_SIGNAL_DEDUPE_TTL_MS = 30_000;
const P2P_SIGNAL_DEDUPE_CAP = 240;

type P2PMediaKind = "audio" | "video";

interface P2PCodecPreferenceResult {
  codecs?: string[];
  error?: string;
  key?: string;
  status: "applied" | "empty" | "failed" | "unsupported";
}

/**
 * Pure reconciliation decision for one peer: should we restart ICE (the
 * connection is down) or re-sync media (steady state — catches drift from a
 * lost renegotiate/signal)? Exported for unit testing.
 */
export function reconcilePeerAction(
  connectionState: RTCPeerConnectionState,
  iceConnectionState: RTCIceConnectionState,
): "restart-ice" | "sync" {
  const down = (s: string) => s === "disconnected" || s === "failed";
  return down(connectionState) || down(iceConnectionState)
    ? "restart-ice"
    : "sync";
}

export type PeerHealth = "good" | "degraded" | "recovering";
/** RTT above this on an otherwise-connected peer counts as degraded. */
const P2P_DEGRADED_RTT_SECONDS = 0.4;

type P2PNetworkSignal = "online" | "offline" | "connection-change";

type NetworkInformationLike = EventTarget & {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  type?: string;
};

/**
 * Pure per-peer health classification from connection state + round-trip time
 * (Block 5.4). "recovering" = not connected; "degraded" = connected but slow;
 * "good" = connected and responsive. Exported for unit testing.
 */
export function classifyPeerHealth(
  connectionState: RTCPeerConnectionState,
  roundTripTimeSeconds: number | undefined,
): PeerHealth {
  if (connectionState !== "connected") {
    return "recovering";
  }
  if (
    typeof roundTripTimeSeconds === "number" &&
    roundTripTimeSeconds > P2P_DEGRADED_RTT_SECONDS
  ) {
    return "degraded";
  }
  return "good";
}

export function shouldProactivelyRestartIceForNetworkSignal(
  signal: P2PNetworkSignal,
  navigatorOnline: boolean | undefined,
): boolean {
  if (navigatorOnline === false) {
    return false;
  }

  return signal === "online" || signal === "connection-change";
}

export type P2PIceRestartDecision =
  | "restart"
  | "request-remote-restart"
  | "suppress-cooldown"
  | "suppress-closed";

export function decideP2PIceRestart(
  shouldInitiateOffers: boolean,
  signalingState: RTCSignalingState,
  nowMs: number,
  lastIceRestartAtMs: number,
  cooldownMs = P2P_ICE_RESTART_COOLDOWN_MS,
): P2PIceRestartDecision {
  if (signalingState === "closed") {
    return "suppress-closed";
  }

  if (!shouldInitiateOffers) {
    return "request-remote-restart";
  }

  if (nowMs - lastIceRestartAtMs < cooldownMs) {
    return "suppress-cooldown";
  }

  return "restart";
}

export function createP2PMediaSignalDedupeKey(
  fromUserId: string,
  signal: P2PSignal,
): string | null {
  if (signal.kind === "offer" || signal.kind === "answer") {
    return `${fromUserId}:${signal.kind}:${hashString(signal.sdp.sdp)}`;
  }

  if (signal.kind === "ice") {
    return `${fromUserId}:ice:${hashString(
      [
        signal.candidate.candidate,
        signal.candidate.sdpMid ?? "",
        signal.candidate.sdpMLineIndex ?? "",
        signal.candidate.usernameFragment ?? "",
      ].join("|"),
    )}`;
  }

  return null;
}

export function rememberP2PMediaSignalFingerprint(
  recent: Map<string, number>,
  key: string | null,
  nowMs: number,
  ttlMs = P2P_SIGNAL_DEDUPE_TTL_MS,
  cap = P2P_SIGNAL_DEDUPE_CAP,
): "accept" | "drop-duplicate" {
  if (!key) {
    return "accept";
  }

  pruneRecentP2PSignalFingerprints(recent, nowMs, ttlMs, cap);
  if (recent.has(key)) {
    recent.set(key, nowMs);
    return "drop-duplicate";
  }

  recent.set(key, nowMs);
  pruneRecentP2PSignalFingerprints(recent, nowMs, ttlMs, cap);
  return "accept";
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const OPEN_RELAY_TURN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const P2P_VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    width: { ideal: 240, max: 320 },
    height: { ideal: 240, max: 320 },
    frameRate: { ideal: 10, max: 12 },
  },
};

const P2P_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    autoGainControl: true,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: false,
};

export function getP2PAudioTransceiverDirection(): RTCRtpTransceiverDirection {
  return P2P_AUDIO_TRANSCEIVER_DIRECTION;
}

export function p2pAudioTrackSwapNeedsNegotiation(
  currentDirection: RTCRtpTransceiverDirection | null,
): boolean {
  return currentDirection !== P2P_AUDIO_TRANSCEIVER_DIRECTION;
}

export function selectPreferredP2PCodecCapabilities(
  kind: P2PMediaKind,
  codecs: RTCRtpCodec[],
): RTCRtpCodec[] {
  return codecs
    .map((codec, index) => ({
      codec,
      index,
      rank: p2pCodecPreferenceRank(kind, codec),
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.codec);
}

export function summarizeP2PCodecPreferenceOrder(
  codecs: RTCRtpCodec[],
): string[] {
  return codecs.map((codec) => summarizeP2PCodecCapability(codec));
}

interface AudioActivityStats {
  audioLevel?: number;
  bytesReceived?: number;
  jitter?: number;
  packetsReceived?: number;
}

export type RemoteAudioActivity = "active" | "quiet" | "unknown";
export type RemoteAudioFlowActivity =
  | "flowing"
  | "missing"
  | "not-expected"
  | "stalled"
  | "unknown";

export function classifyRemoteAudioActivity(
  previous: AudioActivityStats | undefined,
  current: AudioActivityStats | undefined,
): RemoteAudioActivity {
  if (!current) {
    return "unknown";
  }

  if (
    typeof current.audioLevel === "number" &&
    current.audioLevel >= P2P_AUDIO_ACTIVITY_LEVEL_THRESHOLD
  ) {
    return "active";
  }

  if (!previous) {
    return "unknown";
  }

  const packetDelta =
    typeof current.packetsReceived === "number" &&
    typeof previous.packetsReceived === "number"
      ? current.packetsReceived - previous.packetsReceived
      : 0;
  const byteDelta =
    typeof current.bytesReceived === "number" &&
    typeof previous.bytesReceived === "number"
      ? current.bytesReceived - previous.bytesReceived
      : 0;

  if (
    packetDelta >= P2P_AUDIO_ACTIVITY_MIN_PACKET_DELTA ||
    byteDelta >= P2P_AUDIO_ACTIVITY_MIN_BYTE_DELTA
  ) {
    return "active";
  }

  return "quiet";
}

export function classifyRemoteAudioFlowActivity(
  previous: AudioActivityStats | undefined,
  current: AudioActivityStats | undefined,
  remoteAudioExpected: boolean,
  connectionState: RTCPeerConnectionState,
): RemoteAudioFlowActivity {
  if (!remoteAudioExpected) {
    return "not-expected";
  }

  if (connectionState !== "connected") {
    return "unknown";
  }

  if (!current) {
    return "missing";
  }

  if (!previous) {
    return "unknown";
  }

  return classifyRemoteAudioActivity(previous, current) === "active"
    ? "flowing"
    : "stalled";
}

interface VideoActivityStats {
  bytesReceived?: number;
  framesDecoded?: number;
}

export type RemoteVideoActivity =
  | "flowing"
  | "missing"
  | "not-expected"
  | "stalled"
  | "unknown";

export function classifyRemoteVideoActivity(
  previous: VideoActivityStats | undefined,
  current: VideoActivityStats | undefined,
  remoteVideoExpected: boolean,
  connectionState: RTCPeerConnectionState,
): RemoteVideoActivity {
  if (!remoteVideoExpected) {
    return "not-expected";
  }

  if (connectionState !== "connected") {
    return "unknown";
  }

  if (!current) {
    return "missing";
  }

  if (!previous) {
    return "unknown";
  }

  const frameDelta =
    typeof current.framesDecoded === "number" &&
    typeof previous.framesDecoded === "number"
      ? current.framesDecoded - previous.framesDecoded
      : 0;
  const byteDelta =
    typeof current.bytesReceived === "number" &&
    typeof previous.bytesReceived === "number"
      ? current.bytesReceived - previous.bytesReceived
      : 0;

  if (
    frameDelta >= P2P_VIDEO_ACTIVITY_MIN_FRAME_DELTA ||
    byteDelta >= P2P_VIDEO_ACTIVITY_MIN_BYTE_DELTA
  ) {
    return "flowing";
  }

  return "stalled";
}

export function selectP2PMediaParticipants(
  participants: Participant[],
  localParticipantId: string,
  localMediaWanted: boolean,
): Participant[] {
  return participants.filter((participant) => {
    if (participant.id === localParticipantId) {
      return localMediaWanted || participant.cameraEnabled;
    }

    return participant.cameraEnabled;
  });
}

export function canReceiveP2PSignalFromParticipant(
  participants: Participant[],
  localParticipantId: string,
  remoteParticipantId: string,
  localMediaWanted: boolean,
): boolean {
  if (localParticipantId === remoteParticipantId) {
    return false;
  }

  const mediaParticipants = selectP2PMediaParticipants(
    participants,
    localParticipantId,
    localMediaWanted,
  );
  const mediaParticipantIds = new Set(
    mediaParticipants.map((participant) => participant.id),
  );
  return (
    mediaParticipantIds.has(localParticipantId) &&
    mediaParticipantIds.has(remoteParticipantId)
  );
}

interface P2PPeer {
  audioCodecPreferencesKey: string | null;
  audioTransceiver: RTCRtpTransceiver | null;
  disconnectedRestartTimerId: number | null;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  iceRestartCount: number;
  lastAudioStallRecoveryAt: number;
  lastIceRestartAt: number;
  lastIceRestartRequestAt: number;
  lastRenegotiationRequestAt: number;
  lastMediaStallRecoveryAt: number;
  makingOffer: boolean;
  mediaSyncing: boolean;
  negotiationQueued: boolean;
  needsNegotiation: boolean;
  pendingIceCandidates: P2PIceCandidate[];
  pc: RTCPeerConnection;
  polite: boolean;
  recentSignalFingerprints: Map<string, number>;
  remoteVideoExpected: boolean;
  remoteVideoStallSamples: number;
  remoteUserId: string;
  videoCodecPreferencesKey: string | null;
  videoTransceiver: RTCRtpTransceiver | null;
}

interface P2PMediaControllerOptions {
  iceServers?: RTCIceServer[];
  localParticipant: Participant;
  onActiveSpeakerIdsChange: (ids: string[]) => void;
  onCameraStatus: (enabled: boolean) => void;
  onVideosChange: (videos: GhostVideo[]) => void;
  onVoiceMessageChange: (message: string | null) => void;
  onVoiceStatusChange: (status: LiveVoiceStatus) => void;
  refreshIceServers?: () => Promise<RTCIceServer[]>;
  sendSignal: (toUserId: string, signal: P2PSignal) => void;
}

type IceCandidateStatsSnapshot = RTCStats & {
  candidateType?: string;
  protocol?: string;
  relayProtocol?: string;
  url?: string;
};

export class P2PMediaController {
  private iceServers: RTCIceServer[];
  private readonly localParticipant: Participant;
  private readonly onActiveSpeakerIdsChange: (ids: string[]) => void;
  private readonly onCameraStatus: (enabled: boolean) => void;
  private readonly onVideosChange: (videos: GhostVideo[]) => void;
  private readonly onVoiceMessageChange: (message: string | null) => void;
  private readonly onVoiceStatusChange: (status: LiveVoiceStatus) => void;
  private readonly refreshIceServers?: () => Promise<RTCIceServer[]>;
  private readonly sendSignal: (toUserId: string, signal: P2PSignal) => void;
  private readonly peers = new Map<string, P2PPeer>();
  private readonly videosByParticipant = new Map<string, GhostVideo>();
  private readonly audioElementsByParticipant = new Map<
    string,
    HTMLAudioElement
  >();
  private readonly remoteSpeakingIds = new Set<string>();
  private readonly remoteAudioActivityByPeer = new Map<
    string,
    RemoteAudioActivity
  >();
  private readonly remoteAudioExpectedByPeer = new Set<string>();
  private readonly remoteAudioFlowActivityByPeer = new Map<
    string,
    RemoteAudioFlowActivity
  >();
  private readonly remoteAudioStatsByPeer = new Map<
    string,
    AudioActivityStats
  >();
  private readonly remoteAudioStallSamplesByPeer = new Map<string, number>();
  private readonly remoteAudioQuietSamplesByPeer = new Map<string, number>();
  private readonly remoteVideoActivityByPeer = new Map<
    string,
    RemoteVideoActivity
  >();
  private readonly remoteVideoStatsByPeer = new Map<
    string,
    VideoActivityStats
  >();
  private cameraStarting = false;
  private disposed = false;
  private localAudioStream: MediaStream | null = null;
  private localAudioTrack: MediaStreamTrack | null = null;
  private localVideoStream: MediaStream | null = null;
  private localVideoTrack: MediaStreamTrack | null = null;
  private wantsCamera = false;
  private wantsVoiceTalk = false;
  private voiceStarting = false;
  private voiceTalking = false;
  // The mic track is kept warm between presses (track.enabled toggled) so
  // repeat push-to-talk is instant, then released after an idle timeout for
  // privacy (Block 5.2).
  private micReleaseTimerId: number | null = null;
  // Periodic desired-vs-actual reconciliation so a lost signal self-heals
  // instead of leaving a peer stuck (Block 5.3).
  private reconcileTimerId: number | null = null;
  // Last classified health per peer, for transition logging + observability (Block 5.4).
  private readonly healthByPeer = new Map<string, PeerHealth>();
  // Re-acquire the camera when a device change kills the current track —
  // unplugged webcam, switched camera, Bluetooth handoff (Block 5.5).
  private readonly onDeviceChange = () => this.handleDeviceChange();
  private readonly networkInformation = getNetworkInformation();
  private readonly onWindowOnline = () => this.handleNetworkSignal("online");
  private readonly onWindowOffline = () => this.handleNetworkSignal("offline");
  private readonly onNetworkInformationChange = () =>
    this.handleNetworkSignal("connection-change");

  constructor(options: P2PMediaControllerOptions) {
    this.iceServers = options.iceServers?.length
      ? options.iceServers
      : getDefaultP2PIceServers();
    this.localParticipant = options.localParticipant;
    this.onActiveSpeakerIdsChange = options.onActiveSpeakerIdsChange;
    this.onCameraStatus = options.onCameraStatus;
    this.onVideosChange = options.onVideosChange;
    this.onVoiceMessageChange = options.onVoiceMessageChange;
    this.onVoiceStatusChange = options.onVoiceStatusChange;
    this.refreshIceServers = options.refreshIceServers;
    this.sendSignal = options.sendSignal;
    this.reconcileTimerId = window.setInterval(() => {
      this.reconcile("interval");
      void this.samplePeerHealth();
    }, P2P_RECONCILE_INTERVAL_MS);
    navigator.mediaDevices?.addEventListener?.(
      "devicechange",
      this.onDeviceChange,
    );
    window.addEventListener?.("online", this.onWindowOnline);
    window.addEventListener?.("offline", this.onWindowOffline);
    this.networkInformation?.addEventListener?.(
      "change",
      this.onNetworkInformationChange,
    );
    logDebug("p2p.controller", "created", {
      localParticipantId: options.localParticipant.id,
      iceServers: summarizeIceServers(this.iceServers),
    });
  }

  /**
   * On a device change, re-acquire the camera only if it was wanted but the
   * current track is dead (unplug/switch). Guarded so a spurious devicechange
   * never churns a healthy camera (Block 5.5).
   */
  private handleDeviceChange(): void {
    if (this.disposed || !this.wantsCamera) {
      return;
    }
    if (this.localVideoTrack && this.localVideoTrack.readyState === "live") {
      return;
    }

    logDebug("p2p.camera", "re-acquire after device change", {
      localParticipantId: this.localParticipant.id,
      trackState: this.localVideoTrack?.readyState ?? "none",
    });
    this.localVideoStream = null;
    this.localVideoTrack = null;
    void this.setCameraEnabled(true);
  }

  /**
   * Bring every peer's actual state back to the desired one: restart ICE for a
   * down connection, otherwise re-run the idempotent media sync (which only
   * renegotiates on real drift). Self-heals a lost renegotiate/signal without
   * waiting for another event (Block 5.3).
   */
  reconcile(reason: string): void {
    if (this.disposed || !this.peers.size) {
      return;
    }

    for (const peer of this.peers.values()) {
      if (peer.pc.signalingState === "closed") {
        continue;
      }

      const action = reconcilePeerAction(
        peer.pc.connectionState,
        peer.pc.iceConnectionState,
      );
      if (action === "restart-ice") {
        void this.restartPeerIce(peer, `reconcile:${reason}`);
      } else {
        void this.syncPeerMediaAndNegotiate(peer, `reconcile:${reason}`, false);
      }
    }
  }

  updateParticipants(participants: Participant[]): void {
    if (this.disposed) {
      return;
    }

    const remoteIds = participants
      .map((participant) => participant.id)
      .filter((id) => id !== this.localParticipant.id)
      .slice(0, P2P_MAX_REMOTE_PARTICIPANTS);
    const remoteIdSet = new Set(remoteIds);
    const remoteParticipantsById = new Map(
      participants.map((participant) => [participant.id, participant]),
    );
    logDebug("p2p.participants", "update", {
      localParticipantId: this.localParticipant.id,
      remoteIds,
      totalParticipants: participants.length,
      existingPeerIds: Array.from(this.peers.keys()),
    });

    for (const [remoteId] of this.peers) {
      if (!remoteIdSet.has(remoteId)) {
        logDebug("p2p.peer", "close missing participant", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: remoteId,
        });
        this.closePeer(remoteId, false);
      }
    }

    for (const remoteId of remoteIds) {
      const isNewPeer = !this.peers.has(remoteId);
      const peer = this.ensurePeer(remoteId);
      const remoteVideoExpected = Boolean(
        remoteParticipantsById.get(remoteId)?.cameraEnabled,
      );
      if (peer.remoteVideoExpected !== remoteVideoExpected) {
        peer.remoteVideoExpected = remoteVideoExpected;
        peer.remoteVideoStallSamples = 0;
        this.remoteVideoActivityByPeer.set(
          remoteId,
          remoteVideoExpected ? "unknown" : "not-expected",
        );
        this.remoteVideoStatsByPeer.delete(remoteId);
        logDebug("p2p.video", "remote video expectation changed", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: remoteId,
          remoteVideoExpected,
        });
      }
      void this.syncPeerMediaAndNegotiate(
        peer,
        isNewPeer ? "peer-created" : "participants",
        isNewPeer,
      );
      if (isNewPeer && this.voiceTalking) {
        this.sendSignal(peer.remoteUserId, { kind: "voice-start" });
      }
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.wantsCamera = enabled;

    if (!enabled) {
      await this.stopCamera();
      return;
    }

    if (this.localVideoTrack) {
      this.onCameraStatus(true);
      return;
    }

    if (this.cameraStarting) {
      return;
    }

    this.cameraStarting = true;
    logDebug("p2p.camera", "getUserMedia start", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        P2P_VIDEO_CONSTRAINTS,
      );
      if (this.disposed || !this.wantsCamera) {
        stopStream(stream);
        this.onCameraStatus(false);
        return;
      }

      const track = stream.getVideoTracks()[0];
      if (!track) {
        stopStream(stream);
        throw new Error("Camera did not return a video track.");
      }

      track.contentHint = "motion";
      track.addEventListener(
        "ended",
        () => {
          logDebug("p2p.camera", "local track ended", {
            localParticipantId: this.localParticipant.id,
            wantsCamera: this.wantsCamera,
          });
          if (this.localVideoTrack !== track) {
            return;
          }

          this.localVideoStream = null;
          this.localVideoTrack = null;
          this.removeVideo(this.localParticipant.id);
          this.onCameraStatus(false);
          if (this.wantsCamera && !this.disposed) {
            void this.setCameraEnabled(true);
          }
        },
        { once: true },
      );
      this.localVideoStream = stream;
      this.localVideoTrack = track;
      logDebug("p2p.camera", "local track ready", {
        localParticipantId: this.localParticipant.id,
        trackState: track.readyState,
        settings: track.getSettings(),
      });
      this.upsertVideo({
        participantId: this.localParticipant.id,
        element: createVideoElement(stream, true),
        local: true,
      });

      for (const peer of this.peers.values()) {
        const changed = await this.syncPeerMedia(peer);
        if (changed || !this.shouldInitiateOffers(peer)) {
          this.queueNegotiation(peer, "camera-start");
        }
      }

      this.onCameraStatus(true);
    } catch (error) {
      console.warn("[Anidachi] P2P camera failed", error);
      logDebug("p2p.camera", "failed", {
        localParticipantId: this.localParticipant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      this.onCameraStatus(false);
      this.onVoiceMessageChange(
        error instanceof Error ? error.message : "P2P camera failed.",
      );
    } finally {
      this.cameraStarting = false;
    }
  }

  async startVoiceTalk(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.wantsVoiceTalk = true;

    if (this.voiceTalking) {
      this.onVoiceStatusChange("talking");
      return;
    }

    if (this.voiceStarting) {
      this.onVoiceStatusChange("connecting");
      return;
    }

    this.clearMicReleaseTimer();

    // Warm mic from a recent press: just re-enable the existing track. No
    // getUserMedia, no track/transceiver churn — the encoder is already warm
    // so audio resumes near-instantly (Block 5.2).
    if (this.localAudioTrack && this.localAudioTrack.readyState === "live") {
      this.localAudioTrack.enabled = true;
      this.voiceTalking = true;
      for (const peer of this.peers.values()) {
        this.sendSignal(peer.remoteUserId, { kind: "voice-start" });
      }
      this.publishActiveSpeakerIds();
      this.onVoiceStatusChange("talking");
      logDebug("p2p.voice", "resumed warm mic", {
        localParticipantId: this.localParticipant.id,
        peerCount: this.peers.size,
      });
      return;
    }

    this.voiceStarting = true;
    this.onVoiceStatusChange("connecting");
    this.onVoiceMessageChange(null);
    logDebug("p2p.voice", "getUserMedia start", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        P2P_AUDIO_CONSTRAINTS,
      );
      if (this.disposed || !this.wantsVoiceTalk) {
        stopStream(stream);
        this.onVoiceStatusChange("idle");
        return;
      }

      const track = stream.getAudioTracks()[0];
      if (!track) {
        stopStream(stream);
        throw new Error("Microphone did not return an audio track.");
      }

      track.addEventListener(
        "ended",
        () => {
          logDebug("p2p.voice", "local track ended", {
            localParticipantId: this.localParticipant.id,
            wantsVoiceTalk: this.wantsVoiceTalk,
          });
          if (
            this.localAudioTrack === track &&
            this.wantsVoiceTalk &&
            !this.disposed
          ) {
            void this.stopVoiceTalk();
          }
        },
        { once: true },
      );
      this.localAudioStream = stream;
      this.localAudioTrack = track;
      this.voiceTalking = true;
      logDebug("p2p.voice", "local track ready", {
        localParticipantId: this.localParticipant.id,
        trackState: track.readyState,
        settings: track.getSettings(),
      });

      for (const peer of this.peers.values()) {
        const needsMediaOffer = this.peerNeedsMediaOffer(peer);
        const negotiationNeeded = await this.syncPeerMedia(peer);
        if (needsMediaOffer || negotiationNeeded) {
          this.queueNegotiation(peer, "voice-start");
        }
        this.sendSignal(peer.remoteUserId, { kind: "voice-start" });
      }

      this.publishActiveSpeakerIds();
      this.onVoiceStatusChange("talking");
    } catch (error) {
      console.warn("[Anidachi] P2P voice failed", error);
      logDebug("p2p.voice", "failed", {
        localParticipantId: this.localParticipant.id,
        error: error instanceof Error ? error.message : String(error),
      });
      this.voiceTalking = false;
      this.onVoiceStatusChange("error");
      this.onVoiceMessageChange(
        error instanceof Error ? error.message : "P2P voice failed.",
      );
    } finally {
      this.voiceStarting = false;
    }
  }

  async stopVoiceTalk(): Promise<void> {
    logDebug("p2p.voice", "stop", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
    });
    this.wantsVoiceTalk = false;
    this.voiceStarting = false;
    this.voiceTalking = false;

    // Mute by disabling the track (DTX sends ~no bytes) but keep it warm so a
    // repeat press resumes instantly. Release the mic after an idle timeout for
    // privacy (Block 5.2). The audio transceiver/sender are untouched, so this
    // never renegotiates.
    if (this.localAudioTrack) {
      this.localAudioTrack.enabled = false;
      this.scheduleMicRelease();
    }

    for (const peer of this.peers.values()) {
      this.sendSignal(peer.remoteUserId, { kind: "voice-stop" });
    }

    this.publishActiveSpeakerIds();
    this.onVoiceStatusChange("idle");
  }

  async unlockAudio(): Promise<void> {
    for (const element of this.audioElementsByParticipant.values()) {
      await element.play().catch(() => undefined);
    }
  }

  private scheduleMicRelease(): void {
    this.clearMicReleaseTimer();
    this.micReleaseTimerId = window.setTimeout(() => {
      this.micReleaseTimerId = null;
      if (!this.voiceTalking && !this.disposed) {
        this.releaseMic();
      }
    }, P2P_MIC_IDLE_RELEASE_MS);
  }

  private clearMicReleaseTimer(): void {
    if (this.micReleaseTimerId !== null) {
      window.clearTimeout(this.micReleaseTimerId);
      this.micReleaseTimerId = null;
    }
  }

  private releaseMic(): void {
    stopStream(this.localAudioStream);
    this.localAudioStream = null;
    this.localAudioTrack = null;
    for (const peer of this.peers.values()) {
      void peer.audioTransceiver?.sender
        .replaceTrack(null)
        .catch(() => undefined);
    }
    logDebug("p2p.voice", "released idle mic", {
      localParticipantId: this.localParticipant.id,
    });
  }

  async handleSignal(fromUserId: string, signal: P2PSignal): Promise<void> {
    if (this.disposed || fromUserId === this.localParticipant.id) {
      return;
    }

    logDebug("p2p.signal", "received", {
      localParticipantId: this.localParticipant.id,
      fromUserId,
      kind: signal.kind,
      summary: summarizeSignal(signal),
    });

    if (signal.kind === "voice-start") {
      this.remoteAudioExpectedByPeer.add(fromUserId);
      this.remoteAudioFlowActivityByPeer.set(fromUserId, "unknown");
      this.remoteAudioStallSamplesByPeer.set(fromUserId, 0);
      this.remoteAudioQuietSamplesByPeer.set(fromUserId, 0);
      this.remoteAudioActivityByPeer.set(fromUserId, "active");
      this.remoteSpeakingIds.add(fromUserId);
      this.publishActiveSpeakerIds();
      return;
    }

    if (signal.kind === "voice-stop") {
      this.remoteAudioExpectedByPeer.delete(fromUserId);
      this.remoteAudioFlowActivityByPeer.set(fromUserId, "not-expected");
      this.remoteAudioStallSamplesByPeer.set(fromUserId, 0);
      this.remoteAudioActivityByPeer.set(fromUserId, "quiet");
      this.remoteAudioQuietSamplesByPeer.set(
        fromUserId,
        P2P_AUDIO_QUIET_SAMPLES_BEFORE_CLEAR,
      );
      this.remoteSpeakingIds.delete(fromUserId);
      this.publishActiveSpeakerIds();
      return;
    }

    if (signal.kind === "bye") {
      this.closePeer(fromUserId, false);
      return;
    }

    const peer = this.ensurePeer(fromUserId);

    if (signal.kind === "restart-ice") {
      if (this.shouldInitiateOffers(peer)) {
        void this.restartPeerIce(peer, "remote-request");
      } else {
        logDebug("p2p.ice", "ignored restart request on answerer side", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
        });
      }
      return;
    }

    if (signal.kind === "renegotiate") {
      if (this.shouldInitiateOffers(peer)) {
        void this.syncPeerMediaAndNegotiate(peer, "remote-renegotiate", true);
      } else {
        logDebug(
          "p2p.negotiation",
          "ignored renegotiate request on answerer side",
          {
            localParticipantId: this.localParticipant.id,
            remoteUserId: fromUserId,
          },
        );
      }
      return;
    }

    const dedupeKey = createP2PMediaSignalDedupeKey(fromUserId, signal);
    if (
      rememberP2PMediaSignalFingerprint(
        peer.recentSignalFingerprints,
        dedupeKey,
        Date.now(),
      ) === "drop-duplicate"
    ) {
      logDebug("p2p.signal", "drop duplicate media signal", {
        localParticipantId: this.localParticipant.id,
        fromUserId,
        kind: signal.kind,
        fingerprint: dedupeKey,
      });
      return;
    }

    try {
      if (signal.kind === "ice") {
        if (!peer.pc.remoteDescription) {
          peer.pendingIceCandidates = [
            ...peer.pendingIceCandidates,
            signal.candidate,
          ].slice(-40);
          logDebug(
            "p2p.ice",
            "queued remote candidate before remote description",
            {
              localParticipantId: this.localParticipant.id,
              remoteUserId: fromUserId,
              candidateType: getCandidateType(signal.candidate.candidate),
              queued: peer.pendingIceCandidates.length,
            },
          );
          return;
        }

        await peer.pc.addIceCandidate(signal.candidate);
        logDebug("p2p.ice", "added remote candidate", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          candidateType: getCandidateType(signal.candidate.candidate),
        });
        return;
      }

      const description: RTCSessionDescriptionInit = signal.sdp;
      const readyForOffer =
        !peer.makingOffer &&
        (peer.pc.signalingState === "stable" ||
          peer.isSettingRemoteAnswerPending);
      const offerCollision = description.type === "offer" && !readyForOffer;
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) {
        logDebug("p2p.signal", "ignored offer collision", {
          localParticipantId: this.localParticipant.id,
          fromUserId,
          signalingState: peer.pc.signalingState,
          makingOffer: peer.makingOffer,
        });
        return;
      }

      peer.isSettingRemoteAnswerPending = description.type === "answer";
      try {
        await peer.pc.setRemoteDescription(description);
        logDebug("p2p.sdp", "set remote description", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          type: description.type,
          summary: summarizeSdp(description.sdp ?? ""),
        });
        await this.flushPendingIceCandidates(peer);
      } finally {
        peer.isSettingRemoteAnswerPending = false;
      }

      if (description.type === "offer") {
        await this.syncPeerMedia(peer);
        await peer.pc.setLocalDescription();
        logDebug("p2p.sdp", "created answer", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          summary: summarizeSdp(peer.pc.localDescription?.sdp ?? ""),
        });
        this.sendLocalDescription(peer);
      }
    } catch (error) {
      if (peer.ignoreOffer) {
        return;
      }

      console.warn("[Anidachi] P2P signal failed", error);
      logDebug("p2p.signal", "failed", {
        localParticipantId: this.localParticipant.id,
        fromUserId,
        kind: signal.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getStats(): Promise<Record<string, unknown>> {
    const peers = await Promise.all(
      Array.from(this.peers.values()).map(async (peer) => {
        const stats = summarizeStats(await peer.pc.getStats());
        const rtt = (
          stats.candidatePair as { currentRoundTripTime?: number } | undefined
        )?.currentRoundTripTime;
        return {
          remoteUserId: peer.remoteUserId,
          connectionState: peer.pc.connectionState,
          iceRestartCount: peer.iceRestartCount,
          iceConnectionState: peer.pc.iceConnectionState,
          signalingState: peer.pc.signalingState,
          health: classifyPeerHealth(peer.pc.connectionState, rtt),
          remoteAudioActivity:
            this.remoteAudioActivityByPeer.get(peer.remoteUserId) ?? "unknown",
          remoteAudioFlowActivity:
            this.remoteAudioFlowActivityByPeer.get(peer.remoteUserId) ??
            "unknown",
          remoteVideoActivity:
            this.remoteVideoActivityByPeer.get(peer.remoteUserId) ?? "unknown",
          stats,
        };
      }),
    );

    return { peers };
  }

  /** Classify each peer's health and log transitions for observability (Block 5.4). */
  private async samplePeerHealth(): Promise<void> {
    if (this.disposed) {
      return;
    }

    for (const peer of this.peers.values()) {
      let rtt: number | undefined;
      let stats: Record<string, unknown> | null = null;
      try {
        stats = summarizeStats(await peer.pc.getStats());
        rtt = (
          stats.candidatePair as { currentRoundTripTime?: number } | undefined
        )?.currentRoundTripTime;
      } catch {
        rtt = undefined;
      }

      if (stats) {
        this.updateRemoteAudioActivityFromStats(peer, stats);
        this.updateRemoteVideoActivityFromStats(peer, stats);
      }

      const health = classifyPeerHealth(peer.pc.connectionState, rtt);
      if (this.healthByPeer.get(peer.remoteUserId) !== health) {
        this.healthByPeer.set(peer.remoteUserId, health);
        logDebug("p2p.health", health, {
          localParticipantId: this.localParticipant.id,
          remoteUserId: peer.remoteUserId,
          connectionState: peer.pc.connectionState,
          roundTripTime: rtt,
        });
      }
    }

    for (const remoteId of Array.from(this.healthByPeer.keys())) {
      if (!this.peers.has(remoteId)) {
        this.healthByPeer.delete(remoteId);
      }
    }
  }

  private updateRemoteVideoActivityFromStats(
    peer: P2PPeer,
    stats: Record<string, unknown>,
  ): void {
    const current = stats.videoInbound as VideoActivityStats | undefined;
    const previous = this.remoteVideoStatsByPeer.get(peer.remoteUserId);
    const activity = classifyRemoteVideoActivity(
      previous,
      current,
      peer.remoteVideoExpected,
      peer.pc.connectionState,
    );

    if (current) {
      this.remoteVideoStatsByPeer.set(peer.remoteUserId, {
        bytesReceived: current.bytesReceived,
        framesDecoded: current.framesDecoded,
      });
    }

    this.remoteVideoActivityByPeer.set(peer.remoteUserId, activity);

    if (activity === "flowing" || activity === "not-expected") {
      peer.remoteVideoStallSamples = 0;
      return;
    }

    if (activity === "unknown") {
      return;
    }

    peer.remoteVideoStallSamples += 1;
    logDebug("p2p.video", "remote video not flowing", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      activity,
      stallSamples: peer.remoteVideoStallSamples,
      expected: peer.remoteVideoExpected,
      connectionState: peer.pc.connectionState,
      iceConnectionState: peer.pc.iceConnectionState,
      stats: current ?? null,
    });

    if (
      peer.remoteVideoStallSamples < P2P_VIDEO_STALL_SAMPLES_BEFORE_RECOVERY
    ) {
      return;
    }

    const now = Date.now();
    if (
      now - peer.lastMediaStallRecoveryAt <
      P2P_MEDIA_STALL_RECOVERY_COOLDOWN_MS
    ) {
      return;
    }

    peer.lastMediaStallRecoveryAt = now;
    peer.remoteVideoStallSamples = 0;
    logDebug("p2p.video", "recover stalled remote video", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      activity,
      reason: "video-stall",
    });
    void this.restartPeerIce(peer, `media-stall:${activity}`);
  }

  private updateRemoteAudioActivityFromStats(
    peer: P2PPeer,
    stats: Record<string, unknown>,
  ): void {
    const current = stats.audioInbound as AudioActivityStats | undefined;
    const previous = this.remoteAudioStatsByPeer.get(peer.remoteUserId);
    const activity = classifyRemoteAudioActivity(previous, current);
    this.updateRemoteAudioFlowActivityFromStats(peer, previous, current);
    if (current) {
      this.remoteAudioStatsByPeer.set(peer.remoteUserId, {
        audioLevel: current.audioLevel,
        bytesReceived: current.bytesReceived,
        jitter: current.jitter,
        packetsReceived: current.packetsReceived,
      });
    }

    if (activity === "unknown") {
      return;
    }

    this.remoteAudioActivityByPeer.set(peer.remoteUserId, activity);

    if (activity === "active") {
      this.remoteAudioQuietSamplesByPeer.set(peer.remoteUserId, 0);
      if (!this.remoteSpeakingIds.has(peer.remoteUserId)) {
        this.remoteSpeakingIds.add(peer.remoteUserId);
        logDebug("p2p.audio", "remote activity detected", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: peer.remoteUserId,
          source: "stats",
          stats: current,
        });
        this.publishActiveSpeakerIds();
      }
      return;
    }

    const quietSamples =
      (this.remoteAudioQuietSamplesByPeer.get(peer.remoteUserId) ?? 0) + 1;
    this.remoteAudioQuietSamplesByPeer.set(peer.remoteUserId, quietSamples);
    if (
      quietSamples >= P2P_AUDIO_QUIET_SAMPLES_BEFORE_CLEAR &&
      this.remoteSpeakingIds.delete(peer.remoteUserId)
    ) {
      logDebug("p2p.audio", "remote activity quiet", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        quietSamples,
        source: "stats",
      });
      this.publishActiveSpeakerIds();
    }
  }

  private updateRemoteAudioFlowActivityFromStats(
    peer: P2PPeer,
    previous: AudioActivityStats | undefined,
    current: AudioActivityStats | undefined,
  ): void {
    const flowActivity = classifyRemoteAudioFlowActivity(
      previous,
      current,
      this.remoteAudioExpectedByPeer.has(peer.remoteUserId),
      peer.pc.connectionState,
    );

    this.remoteAudioFlowActivityByPeer.set(peer.remoteUserId, flowActivity);

    if (flowActivity === "flowing" || flowActivity === "not-expected") {
      this.remoteAudioStallSamplesByPeer.set(peer.remoteUserId, 0);
      return;
    }

    if (flowActivity === "unknown") {
      return;
    }

    const stallSamples =
      (this.remoteAudioStallSamplesByPeer.get(peer.remoteUserId) ?? 0) + 1;
    this.remoteAudioStallSamplesByPeer.set(peer.remoteUserId, stallSamples);
    logDebug("p2p.audio", "remote expected audio not flowing", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      activity: flowActivity,
      stallSamples,
      expected: true,
      connectionState: peer.pc.connectionState,
      iceConnectionState: peer.pc.iceConnectionState,
      stats: current ?? null,
    });

    if (stallSamples < P2P_AUDIO_STALL_SAMPLES_BEFORE_RECOVERY) {
      return;
    }

    const now = Date.now();
    if (
      now - peer.lastAudioStallRecoveryAt <
      P2P_MEDIA_STALL_RECOVERY_COOLDOWN_MS
    ) {
      return;
    }

    peer.lastAudioStallRecoveryAt = now;
    this.remoteAudioStallSamplesByPeer.set(peer.remoteUserId, 0);
    logDebug("p2p.audio", "recover stalled remote audio", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      activity: flowActivity,
      reason: "audio-stall",
    });
    void this.restartPeerIce(peer, `media-stall:audio-${flowActivity}`);
  }

  notifyPageLeaving(reason: string): void {
    if (this.disposed || !this.peers.size) {
      return;
    }

    logDebug("p2p.lifecycle", "send bye before page leave", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
      reason,
    });
    for (const peer of this.peers.values()) {
      this.sendSignal(peer.remoteUserId, { kind: "bye" });
    }
  }

  recoverDisconnectedPeers(reason: string): void {
    if (this.disposed || !this.peers.size) {
      return;
    }

    logDebug("p2p.lifecycle", "recover disconnected peers", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
      reason,
    });
    if (reason === "online") {
      this.restartAllPeerIce(`recover:${reason}`);
      return;
    }

    // Reconciliation already restarts ICE for down peers and re-syncs the rest.
    this.reconcile(`recover:${reason}`);
  }

  disconnect(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.wantsCamera = false;
    this.wantsVoiceTalk = false;
    this.clearMicReleaseTimer();
    if (this.reconcileTimerId !== null) {
      window.clearInterval(this.reconcileTimerId);
      this.reconcileTimerId = null;
    }
    navigator.mediaDevices?.removeEventListener?.(
      "devicechange",
      this.onDeviceChange,
    );
    window.removeEventListener?.("online", this.onWindowOnline);
    window.removeEventListener?.("offline", this.onWindowOffline);
    this.networkInformation?.removeEventListener?.(
      "change",
      this.onNetworkInformationChange,
    );
    for (const peer of this.peers.values()) {
      this.sendSignal(peer.remoteUserId, { kind: "bye" });
    }
    for (const remoteId of Array.from(this.peers.keys())) {
      this.closePeer(remoteId, false);
    }

    stopStream(this.localVideoStream);
    stopStream(this.localAudioStream);
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.localAudioStream = null;
    this.localAudioTrack = null;
    this.videosByParticipant.clear();
    for (const element of this.audioElementsByParticipant.values()) {
      element.remove();
    }
    this.audioElementsByParticipant.clear();
    this.remoteSpeakingIds.clear();
    this.remoteAudioActivityByPeer.clear();
    this.remoteAudioExpectedByPeer.clear();
    this.remoteAudioFlowActivityByPeer.clear();
    this.remoteAudioStatsByPeer.clear();
    this.remoteAudioStallSamplesByPeer.clear();
    this.remoteAudioQuietSamplesByPeer.clear();
    this.remoteVideoActivityByPeer.clear();
    this.remoteVideoStatsByPeer.clear();
    this.onVideosChange([]);
    this.publishActiveSpeakerIds();
    this.onCameraStatus(false);
    this.onVoiceStatusChange("idle");
    this.onVoiceMessageChange(null);
  }

  private ensurePeer(remoteUserId: string): P2PPeer {
    const existing = this.peers.get(remoteUserId);
    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection(
      createP2PRtcConfiguration(this.iceServers),
    );
    const peer: P2PPeer = {
      audioCodecPreferencesKey: null,
      audioTransceiver: null,
      disconnectedRestartTimerId: null,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      iceRestartCount: 0,
      lastAudioStallRecoveryAt: 0,
      lastIceRestartAt: 0,
      lastIceRestartRequestAt: 0,
      lastRenegotiationRequestAt: 0,
      lastMediaStallRecoveryAt: 0,
      makingOffer: false,
      mediaSyncing: false,
      negotiationQueued: false,
      needsNegotiation: false,
      pendingIceCandidates: [],
      pc,
      polite: isPoliteP2PPeer(this.localParticipant.id, remoteUserId),
      recentSignalFingerprints: new Map(),
      remoteVideoExpected: false,
      remoteVideoStallSamples: 0,
      remoteUserId,
      videoCodecPreferencesKey: null,
      videoTransceiver: null,
    };
    logDebug("p2p.peer", "created", {
      localParticipantId: this.localParticipant.id,
      remoteUserId,
      polite: peer.polite,
      iceServers: summarizeIceServers(this.iceServers),
    });

    pc.addEventListener("icecandidate", (event) => {
      const candidate = toP2PIceCandidate(event.candidate);
      if (!candidate) {
        logDebug("p2p.ice", "local gathering complete", {
          localParticipantId: this.localParticipant.id,
          remoteUserId,
        });
        return;
      }

      logDebug("p2p.ice", "local candidate", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        candidateType:
          event.candidate?.type ?? getCandidateType(candidate.candidate),
        protocol:
          event.candidate?.protocol ??
          getCandidateProtocol(candidate.candidate),
      });
      this.sendSignal(remoteUserId, { kind: "ice", candidate });
    });

    pc.addEventListener("negotiationneeded", () => {
      logDebug("p2p.negotiation", "needed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
      });
      this.queueNegotiation(peer, "negotiationneeded");
    });

    pc.addEventListener("signalingstatechange", () => {
      logDebug("p2p.state", "signaling", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        signalingState: pc.signalingState,
      });
      if (pc.signalingState === "stable" && peer.needsNegotiation) {
        this.queueNegotiation(peer, "stable");
      }
    });

    pc.addEventListener("icegatheringstatechange", () => {
      logDebug("p2p.state", "ice gathering", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        iceGatheringState: pc.iceGatheringState,
      });
    });

    pc.addEventListener("iceconnectionstatechange", () => {
      logDebug("p2p.state", "ice connection", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        iceConnectionState: pc.iceConnectionState,
      });
      if (
        ["connected", "completed", "checking"].includes(pc.iceConnectionState)
      ) {
        this.clearPeerDisconnectTimer(peer);
      }

      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        void this.logSelectedCandidatePair(peer);
      }

      if (pc.iceConnectionState === "disconnected") {
        this.schedulePeerIceRestart(
          peer,
          "ice-disconnected",
          P2P_DISCONNECTED_RESTART_DELAY_MS,
        );
      }

      if (pc.iceConnectionState === "failed") {
        void this.restartPeerIce(peer, "ice-failed");
      }
    });

    pc.addEventListener("connectionstatechange", () => {
      logDebug("p2p.state", "connection", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        connectionState: pc.connectionState,
      });
      if (["failed", "closed"].includes(pc.connectionState)) {
        this.remoteSpeakingIds.delete(remoteUserId);
        this.publishActiveSpeakerIds();
      }

      if (pc.connectionState === "connected") {
        this.clearPeerDisconnectTimer(peer);
        void this.logSelectedCandidatePair(peer);
      }

      if (pc.connectionState === "disconnected") {
        this.schedulePeerIceRestart(
          peer,
          "connection-disconnected",
          P2P_DISCONNECTED_RESTART_DELAY_MS,
        );
      }

      if (pc.connectionState === "failed") {
        void this.restartPeerIce(peer, "connection-failed");
      }
    });

    pc.addEventListener("icecandidateerror", (event) => {
      logDebug("p2p.ice", "candidate error", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        address: event.address,
        port: event.port,
        url: event.url,
        errorCode: event.errorCode,
        errorText: event.errorText,
      });
    });

    pc.addEventListener("track", (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      logDebug("p2p.track", "received", {
        localParticipantId: this.localParticipant.id,
        remoteUserId,
        kind: event.track.kind,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streamId: stream.id,
      });

      if (event.track.kind === "video") {
        this.upsertVideo({
          participantId: remoteUserId,
          element: createVideoElement(stream, false),
          local: false,
        });
        event.track.addEventListener("unmute", () => {
          logDebug("p2p.track", "video unmuted", {
            localParticipantId: this.localParticipant.id,
            remoteUserId,
          });
        });
        event.track.addEventListener(
          "ended",
          () => {
            logDebug("p2p.track", "video ended", {
              localParticipantId: this.localParticipant.id,
              remoteUserId,
              trackId: event.track.id,
            });
            if (this.videoElementUsesTrack(remoteUserId, event.track)) {
              this.removeVideo(remoteUserId);
            }
          },
          { once: true },
        );
        return;
      }

      if (event.track.kind === "audio") {
        this.removeAudio(remoteUserId);
        const element = document.createElement("audio");
        element.autoplay = true;
        element.volume = 1;
        element.srcObject = stream;
        this.audioElementsByParticipant.set(remoteUserId, element);
        void element.play().catch(() => {
          logDebug("p2p.audio", "autoplay blocked", {
            localParticipantId: this.localParticipant.id,
            remoteUserId,
          });
          this.onVoiceMessageChange(
            "Click Anidachi once to enable voice playback.",
          );
        });
        event.track.addEventListener(
          "ended",
          () => {
            logDebug("p2p.track", "audio ended", {
              localParticipantId: this.localParticipant.id,
              remoteUserId,
              trackId: event.track.id,
            });
            if (this.audioElementUsesTrack(remoteUserId, event.track)) {
              this.removeAudio(remoteUserId);
            }
          },
          { once: true },
        );
      }
    });

    this.peers.set(remoteUserId, peer);
    return peer;
  }

  private async syncPeerMediaAndNegotiate(
    peer: P2PPeer,
    reason: string,
    forceOffer: boolean,
  ): Promise<void> {
    if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
      return;
    }

    peer.mediaSyncing = true;
    let changed = false;
    try {
      changed = await this.syncPeerMedia(peer);
    } finally {
      peer.mediaSyncing = false;
    }
    if (forceOffer || changed) {
      this.queueNegotiation(peer, reason);
    }
  }

  private async syncPeerMedia(peer: P2PPeer): Promise<boolean> {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return false;
    }

    this.refreshPeerTransceivers(peer);
    let negotiationNeeded = false;
    if (!peer.videoTransceiver || !peer.audioTransceiver) {
      if (!this.shouldInitiateOffers(peer)) {
        logDebug("p2p.media", "waiting for remote offer before sender sync", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: peer.remoteUserId,
          hasRemoteDescription: Boolean(peer.pc.remoteDescription),
          hasVideoTransceiver: Boolean(peer.videoTransceiver),
          hasAudioTransceiver: Boolean(peer.audioTransceiver),
        });
        return false;
      }

      negotiationNeeded = this.ensureOffererTransceivers(peer);
    }

    const videoTransceiver = peer.videoTransceiver;
    const audioTransceiver = peer.audioTransceiver;
    if (!videoTransceiver || !audioTransceiver) {
      return false;
    }

    const nextVideoDirection = this.localVideoTrack ? "sendrecv" : "recvonly";
    if (videoTransceiver.sender.track !== this.localVideoTrack) {
      await videoTransceiver.sender.replaceTrack(this.localVideoTrack);
    }
    if (videoTransceiver.direction !== nextVideoDirection) {
      videoTransceiver.direction = nextVideoDirection;
      negotiationNeeded = true;
    }
    await configureSender(videoTransceiver.sender, P2P_VIDEO_BITRATE_BPS, 12);

    if (audioTransceiver.sender.track !== this.localAudioTrack) {
      await audioTransceiver.sender.replaceTrack(this.localAudioTrack);
    }
    if (audioTransceiver.direction !== P2P_AUDIO_TRANSCEIVER_DIRECTION) {
      audioTransceiver.direction = P2P_AUDIO_TRANSCEIVER_DIRECTION;
      negotiationNeeded = true;
    }
    await configureSender(audioTransceiver.sender, P2P_AUDIO_BITRATE_BPS);

    if (negotiationNeeded) {
      logDebug("p2p.media", "synced senders", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        videoDirection: videoTransceiver.direction,
        audioDirection: audioTransceiver.direction,
        hasVideoTrack: Boolean(this.localVideoTrack),
        hasAudioTrack: Boolean(this.localAudioTrack),
        transceivers: summarizeTransceivers(peer.pc),
      });
    }

    return negotiationNeeded;
  }

  private refreshPeerTransceivers(peer: P2PPeer): void {
    peer.audioTransceiver = findMediaTransceiver(
      peer.pc,
      "audio",
      peer.audioTransceiver,
    );
    peer.videoTransceiver = findMediaTransceiver(
      peer.pc,
      "video",
      peer.videoTransceiver,
    );
    this.applyPeerCodecPreferences(peer);
  }

  private ensureOffererTransceivers(peer: P2PPeer): boolean {
    let created = false;

    if (!peer.audioTransceiver) {
      peer.audioTransceiver = peer.pc.addTransceiver("audio", {
        direction: P2P_AUDIO_TRANSCEIVER_DIRECTION,
      });
      created = true;
      logDebug("p2p.media", "created offerer audio transceiver", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        transceivers: summarizeTransceivers(peer.pc),
      });
    }

    if (!peer.videoTransceiver) {
      peer.videoTransceiver = peer.pc.addTransceiver("video", {
        direction: "recvonly",
      });
      created = true;
      logDebug("p2p.media", "created offerer video transceiver", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        transceivers: summarizeTransceivers(peer.pc),
      });
    }

    this.applyPeerCodecPreferences(peer);
    return created;
  }

  private applyPeerCodecPreferences(peer: P2PPeer): void {
    if (peer.audioTransceiver) {
      peer.audioCodecPreferencesKey = this.applyPeerCodecPreference(
        peer,
        "audio",
        peer.audioTransceiver,
        peer.audioCodecPreferencesKey,
      );
    }

    if (peer.videoTransceiver) {
      peer.videoCodecPreferencesKey = this.applyPeerCodecPreference(
        peer,
        "video",
        peer.videoTransceiver,
        peer.videoCodecPreferencesKey,
      );
    }
  }

  private applyPeerCodecPreference(
    peer: P2PPeer,
    kind: P2PMediaKind,
    transceiver: RTCRtpTransceiver,
    previousKey: string | null,
  ): string | null {
    const result = applyP2PCodecPreferences(transceiver, kind);
    const nextKey = `${result.status}:${result.key ?? result.error ?? ""}`;
    if (nextKey === previousKey) {
      return previousKey;
    }

    if (result.status === "applied") {
      logDebug("p2p.codec", "preferences applied", {
        codecs: result.codecs,
        kind,
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
      });
      return nextKey;
    }

    if (result.status === "failed") {
      logDebug("p2p.codec", "preferences failed", {
        error: result.error,
        kind,
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
      });
      return nextKey;
    }

    return nextKey;
  }

  private peerNeedsMediaOffer(peer: P2PPeer): boolean {
    this.refreshPeerTransceivers(peer);
    return (
      !peer.videoTransceiver ||
      !peer.audioTransceiver ||
      p2pAudioTrackSwapNeedsNegotiation(peer.audioTransceiver.direction)
    );
  }

  private queueNegotiation(peer: P2PPeer, _reason: string): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      logDebug("p2p.negotiation", "skip closed/disposed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        reason: _reason,
      });
      return;
    }

    if (
      peer.mediaSyncing ||
      peer.pc.signalingState !== "stable" ||
      peer.makingOffer
    ) {
      peer.needsNegotiation = true;
      logDebug("p2p.negotiation", "deferred", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        reason: _reason,
        mediaSyncing: peer.mediaSyncing,
        signalingState: peer.pc.signalingState,
        makingOffer: peer.makingOffer,
      });
      return;
    }

    if (!this.shouldInitiateOffers(peer)) {
      peer.needsNegotiation = false;
      this.requestRemoteRenegotiation(peer, _reason);
      return;
    }

    if (peer.negotiationQueued) {
      return;
    }

    peer.negotiationQueued = true;
    logDebug("p2p.negotiation", "queued", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      reason: _reason,
    });
    queueMicrotask(() => {
      if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
        return;
      }

      peer.negotiationQueued = false;
      void this.createAndSendOffer(peer);
    });
  }

  private async createAndSendOffer(peer: P2PPeer): Promise<void> {
    if (!this.shouldInitiateOffers(peer)) {
      peer.needsNegotiation = false;
      this.requestRemoteRenegotiation(peer, "offer-attempt");
      return;
    }

    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.mediaSyncing ||
      peer.makingOffer ||
      peer.pc.signalingState !== "stable"
    ) {
      peer.needsNegotiation = true;
      return;
    }

    peer.needsNegotiation = false;
    peer.makingOffer = true;

    try {
      await peer.pc.setLocalDescription();
      logDebug("p2p.sdp", "created local description", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        type: peer.pc.localDescription?.type,
        summary: summarizeSdp(peer.pc.localDescription?.sdp ?? ""),
      });
      this.sendLocalDescription(peer);
    } catch (error) {
      console.warn("[Anidachi] P2P offer failed", error);
      logDebug("p2p.negotiation", "offer failed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      peer.makingOffer = false;
    }
  }

  private sendLocalDescription(peer: P2PPeer): void {
    if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
      return;
    }

    const description = peer.pc.localDescription;
    if (
      !description ||
      (description.type !== "offer" && description.type !== "answer")
    ) {
      return;
    }

    if (description.type === "offer") {
      logDebug("p2p.signal", "send offer", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        summary: summarizeSdp(description.sdp),
      });
      this.sendSignal(peer.remoteUserId, {
        kind: "offer",
        sdp: { type: "offer", sdp: description.sdp },
      });
      return;
    }

    logDebug("p2p.signal", "send answer", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      summary: summarizeSdp(description.sdp),
    });
    this.sendSignal(peer.remoteUserId, {
      kind: "answer",
      sdp: { type: "answer", sdp: description.sdp },
    });
  }

  private async stopCamera(): Promise<void> {
    this.wantsCamera = false;
    logDebug("p2p.camera", "stop", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
    });
    stopStream(this.localVideoStream);
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.removeVideo(this.localParticipant.id);

    for (const peer of this.peers.values()) {
      if (peer.videoTransceiver) {
        await peer.videoTransceiver.sender
          .replaceTrack(null)
          .catch(() => undefined);
        peer.videoTransceiver.direction = "recvonly";
      }
      this.queueNegotiation(peer, "camera-stop");
    }

    this.onCameraStatus(false);
  }

  private upsertVideo(video: GhostVideo): void {
    this.removeVideo(video.participantId);
    this.videosByParticipant.set(video.participantId, video);
    logDebug("p2p.video", "upsert", {
      localParticipantId: this.localParticipant.id,
      participantId: video.participantId,
      local: video.local,
      totalVideos: this.videosByParticipant.size,
    });
    void video.element.play().catch(() => undefined);
    this.publishVideos();
  }

  private removeVideo(participantId: string): void {
    const existing = this.videosByParticipant.get(participantId);
    if (!existing) {
      return;
    }

    existing.element.remove();
    existing.element.srcObject = null;
    this.videosByParticipant.delete(participantId);
    logDebug("p2p.video", "remove", {
      localParticipantId: this.localParticipant.id,
      participantId,
      totalVideos: this.videosByParticipant.size,
    });
    this.publishVideos();
  }

  private removeAudio(participantId: string): void {
    const existing = this.audioElementsByParticipant.get(participantId);
    if (!existing) {
      return;
    }

    existing.pause();
    existing.remove();
    existing.srcObject = null;
    this.audioElementsByParticipant.delete(participantId);
    this.remoteAudioActivityByPeer.delete(participantId);
    this.remoteAudioFlowActivityByPeer.delete(participantId);
    this.remoteAudioStatsByPeer.delete(participantId);
    this.remoteAudioStallSamplesByPeer.delete(participantId);
    this.remoteAudioQuietSamplesByPeer.delete(participantId);
    if (this.remoteSpeakingIds.delete(participantId)) {
      this.publishActiveSpeakerIds();
    }
  }

  private videoElementUsesTrack(
    participantId: string,
    track: MediaStreamTrack,
  ): boolean {
    const video = this.videosByParticipant.get(participantId);
    return mediaElementUsesTrack(video?.element ?? null, track);
  }

  private audioElementUsesTrack(
    participantId: string,
    track: MediaStreamTrack,
  ): boolean {
    return mediaElementUsesTrack(
      this.audioElementsByParticipant.get(participantId) ?? null,
      track,
    );
  }

  private publishVideos(): void {
    this.onVideosChange(Array.from(this.videosByParticipant.values()));
  }

  private publishActiveSpeakerIds(): void {
    this.onActiveSpeakerIdsChange([
      ...(this.voiceTalking ? [this.localParticipant.id] : []),
      ...Array.from(this.remoteSpeakingIds),
    ]);
  }

  private closePeer(remoteUserId: string, notifyRemote: boolean): void {
    const peer = this.peers.get(remoteUserId);
    if (!peer) {
      return;
    }

    if (notifyRemote) {
      this.sendSignal(remoteUserId, { kind: "bye" });
    }

    this.peers.delete(remoteUserId);
    this.clearPeerDisconnectTimer(peer);
    peer.pc.close();
    this.removeVideo(remoteUserId);
    this.removeAudio(remoteUserId);
    this.remoteSpeakingIds.delete(remoteUserId);
    this.remoteAudioActivityByPeer.delete(remoteUserId);
    this.remoteAudioExpectedByPeer.delete(remoteUserId);
    this.remoteAudioFlowActivityByPeer.delete(remoteUserId);
    this.remoteAudioStatsByPeer.delete(remoteUserId);
    this.remoteAudioStallSamplesByPeer.delete(remoteUserId);
    this.remoteAudioQuietSamplesByPeer.delete(remoteUserId);
    this.remoteVideoActivityByPeer.delete(remoteUserId);
    this.remoteVideoStatsByPeer.delete(remoteUserId);
    this.publishActiveSpeakerIds();
  }

  private async flushPendingIceCandidates(peer: P2PPeer): Promise<void> {
    if (!peer.pc.remoteDescription || !peer.pendingIceCandidates.length) {
      return;
    }

    const pending = peer.pendingIceCandidates;
    peer.pendingIceCandidates = [];
    for (const candidate of pending) {
      await peer.pc.addIceCandidate(candidate).catch((error) => {
        console.warn("[Anidachi] P2P queued ICE failed", error);
      });
    }
  }

  private handleNetworkSignal(signal: P2PNetworkSignal): void {
    const navigatorOnline =
      typeof navigator.onLine === "boolean" ? navigator.onLine : undefined;
    const networkInformation = getNetworkInformation();
    logDebug("p2p.network", signal, {
      localParticipantId: this.localParticipant.id,
      online: navigatorOnline ?? null,
      peerCount: this.peers.size,
      network: summarizeNetworkInformation(networkInformation),
    });

    if (
      this.disposed ||
      !this.peers.size ||
      !shouldProactivelyRestartIceForNetworkSignal(signal, navigatorOnline)
    ) {
      return;
    }

    this.restartAllPeerIce(`network:${signal}`);
  }

  private restartAllPeerIce(reason: string): void {
    if (this.disposed || !this.peers.size) {
      return;
    }

    for (const peer of this.peers.values()) {
      if (peer.pc.signalingState === "closed") {
        continue;
      }
      void this.restartPeerIce(peer, reason);
    }
  }

  private async restartPeerIce(peer: P2PPeer, reason: string): Promise<void> {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return;
    }

    const now = Date.now();
    const decision = decideP2PIceRestart(
      this.shouldInitiateOffers(peer),
      peer.pc.signalingState,
      now,
      peer.lastIceRestartAt,
    );

    if (decision === "request-remote-restart") {
      this.requestRemoteIceRestart(peer, reason);
      return;
    }

    if (decision !== "restart") {
      logDebug("p2p.ice", "restart suppressed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        reason,
        decision,
        cooldownRemainingMs:
          decision === "suppress-cooldown"
            ? Math.max(
                0,
                P2P_ICE_RESTART_COOLDOWN_MS - (now - peer.lastIceRestartAt),
              )
            : 0,
        iceRestartCount: peer.iceRestartCount,
      });
      return;
    }

    peer.lastIceRestartAt = now;
    peer.iceRestartCount += 1;
    this.clearPeerDisconnectTimer(peer);
    await this.refreshPeerIceServers(peer, reason);
    logDebug("p2p.ice", "restart", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      iceRestartCount: peer.iceRestartCount,
      reason,
    });
    peer.pc.restartIce();
    this.queueNegotiation(peer, reason);
  }

  private async refreshPeerIceServers(
    peer: P2PPeer,
    reason: string,
  ): Promise<void> {
    if (!this.refreshIceServers) {
      return;
    }

    try {
      const iceServers = await this.refreshIceServers();
      if (
        !iceServers.length ||
        this.disposed ||
        this.peers.get(peer.remoteUserId) !== peer
      ) {
        return;
      }

      this.iceServers = iceServers;
      peer.pc.setConfiguration(createP2PRtcConfiguration(iceServers));
      logDebug("p2p.ice-config", "refreshed before restart", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        reason,
        iceServers: summarizeIceServers(iceServers),
      });
    } catch (error) {
      logDebug("p2p.ice-config", "refresh before restart failed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private schedulePeerIceRestart(
    peer: P2PPeer,
    reason: string,
    delayMs: number,
  ): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed" ||
      peer.disconnectedRestartTimerId !== null
    ) {
      return;
    }

    peer.disconnectedRestartTimerId = window.setTimeout(() => {
      peer.disconnectedRestartTimerId = null;
      if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
        return;
      }

      if (
        peer.pc.connectionState === "disconnected" ||
        peer.pc.connectionState === "failed" ||
        peer.pc.iceConnectionState === "disconnected" ||
        peer.pc.iceConnectionState === "failed"
      ) {
        void this.restartPeerIce(peer, reason);
      }
    }, delayMs);
  }

  private clearPeerDisconnectTimer(peer: P2PPeer): void {
    if (peer.disconnectedRestartTimerId === null) {
      return;
    }

    window.clearTimeout(peer.disconnectedRestartTimerId);
    peer.disconnectedRestartTimerId = null;
  }

  private requestRemoteRenegotiation(peer: P2PPeer, reason: string): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return;
    }

    const now = Date.now();
    if (
      now - peer.lastRenegotiationRequestAt <
      P2P_RENEGOTIATE_REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    peer.lastRenegotiationRequestAt = now;
    logDebug("p2p.negotiation", "request remote renegotiate", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      reason,
    });
    this.sendSignal(peer.remoteUserId, { kind: "renegotiate" });
  }

  private requestRemoteIceRestart(peer: P2PPeer, reason: string): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return;
    }

    const now = Date.now();
    if (
      now - peer.lastIceRestartRequestAt <
      P2P_ICE_RESTART_REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    peer.lastIceRestartRequestAt = now;
    logDebug("p2p.ice", "request remote restart", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      reason,
    });
    this.sendSignal(peer.remoteUserId, { kind: "restart-ice" });
  }

  private shouldInitiateOffers(peer: P2PPeer): boolean {
    return shouldInitiateP2POffers(this.localParticipant.id, peer.remoteUserId);
  }

  private async logSelectedCandidatePair(peer: P2PPeer): Promise<void> {
    const report = await peer.pc.getStats().catch(() => null);
    if (!report) {
      return;
    }

    const summary = summarizeStats(report);
    logDebug("p2p.stats", "connected candidate pair", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      summary,
    });
  }
}

function getNetworkInformation(): NetworkInformationLike | null {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function summarizeNetworkInformation(
  networkInformation: NetworkInformationLike | null,
): Record<string, unknown> | null {
  if (!networkInformation) {
    return null;
  }

  return {
    downlink: networkInformation.downlink,
    effectiveType: networkInformation.effectiveType,
    rtt: networkInformation.rtt,
    saveData: networkInformation.saveData,
    type: networkInformation.type,
  };
}

function createP2PRtcConfiguration(
  iceServers: RTCIceServer[],
): RTCConfiguration {
  return {
    bundlePolicy: "max-bundle",
    iceTransportPolicy:
      import.meta.env.WXT_P2P_FORCE_RELAY === "true" ? "relay" : "all",
    iceServers,
    rtcpMuxPolicy: "require",
  };
}

function applyP2PCodecPreferences(
  transceiver: RTCRtpTransceiver,
  kind: P2PMediaKind,
): P2PCodecPreferenceResult {
  if (typeof transceiver.setCodecPreferences !== "function") {
    return { status: "unsupported" };
  }

  const codecs = getP2PCodecCapabilities(kind);
  if (!codecs.length) {
    return { status: "empty" };
  }

  const preferred = selectPreferredP2PCodecCapabilities(kind, codecs);
  const codecSummary = summarizeP2PCodecPreferenceOrder(preferred);
  try {
    transceiver.setCodecPreferences(preferred);
    return {
      codecs: codecSummary,
      key: codecSummary.join("|"),
      status: "applied",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      key: codecSummary.join("|"),
      status: "failed",
    };
  }
}

function getP2PCodecCapabilities(kind: P2PMediaKind): RTCRtpCodec[] {
  const receiverCapabilities =
    typeof RTCRtpReceiver !== "undefined"
      ? RTCRtpReceiver.getCapabilities?.(kind)
      : null;
  if (receiverCapabilities?.codecs?.length) {
    return receiverCapabilities.codecs;
  }

  const senderCapabilities =
    typeof RTCRtpSender !== "undefined"
      ? RTCRtpSender.getCapabilities?.(kind)
      : null;
  return senderCapabilities?.codecs ?? [];
}

function p2pCodecPreferenceRank(
  kind: P2PMediaKind,
  codec: RTCRtpCodec,
): number {
  const mimeType = codec.mimeType.toLowerCase();

  if (kind === "audio") {
    if (mimeType === "audio/red" && codec.clockRate === 48_000) {
      return 0;
    }
    if (mimeType === "audio/opus") {
      return 1;
    }
    if (mimeType === "audio/telephone-event") {
      return 50;
    }
    if (mimeType === "audio/cn") {
      return 60;
    }
    return 20;
  }

  if (mimeType === "video/vp8") {
    return 0;
  }
  if (mimeType === "video/h264") {
    return 1;
  }
  if (mimeType === "video/vp9") {
    return 2;
  }
  if (mimeType === "video/av1") {
    return 3;
  }
  if (mimeType === "video/rtx") {
    return 10;
  }
  if (mimeType === "video/red") {
    return 11;
  }
  if (mimeType === "video/ulpfec") {
    return 12;
  }
  if (mimeType === "video/flexfec") {
    return 13;
  }
  return 30;
}

function summarizeP2PCodecCapability(codec: RTCRtpCodec): string {
  const parts = [codec.mimeType.toLowerCase(), String(codec.clockRate)];
  if (typeof codec.channels === "number") {
    parts.push(String(codec.channels));
  }
  if (codec.sdpFmtpLine) {
    parts.push(codec.sdpFmtpLine);
  }
  return parts.join("/");
}

export function getDefaultP2PIceServers(): RTCIceServer[] {
  const configured = parseIceServers(import.meta.env.WXT_P2P_ICE_SERVERS_JSON);
  if (configured.length) {
    return configured;
  }

  const enableOpenRelay =
    import.meta.env.WXT_P2P_ENABLE_OPEN_RELAY_TURN === "true";
  return enableOpenRelay
    ? [...DEFAULT_STUN_SERVERS, ...OPEN_RELAY_TURN_SERVERS]
    : DEFAULT_STUN_SERVERS;
}

export function getDirectP2PStunServers(): RTCIceServer[] {
  return DEFAULT_STUN_SERVERS;
}

export function isPoliteP2PPeer(
  localUserId: string,
  remoteUserId: string,
): boolean {
  if (localUserId === remoteUserId) {
    return false;
  }

  return localUserId > remoteUserId;
}

export function shouldInitiateP2POffers(
  localUserId: string,
  remoteUserId: string,
): boolean {
  return (
    localUserId !== remoteUserId && !isPoliteP2PPeer(localUserId, remoteUserId)
  );
}

function parseIceServers(value: string | undefined): RTCIceServer[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isIceServer);
  } catch {
    return [];
  }
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const urls = (value as RTCIceServer).urls;
  return (
    typeof urls === "string" ||
    (Array.isArray(urls) && urls.every((url) => typeof url === "string"))
  );
}

function createVideoElement(
  stream: MediaStream,
  muted: boolean,
): HTMLVideoElement {
  const element = document.createElement("video");
  element.autoplay = true;
  element.muted = muted;
  element.playsInline = true;
  element.srcObject = stream;
  return element;
}

function mediaElementUsesTrack(
  element: HTMLMediaElement | null,
  track: MediaStreamTrack,
): boolean {
  const stream = element?.srcObject;
  return (
    stream instanceof MediaStream &&
    stream.getTracks().some((item) => item.id === track.id)
  );
}

function findMediaTransceiver(
  pc: RTCPeerConnection,
  kind: "audio" | "video",
  current: RTCRtpTransceiver | null,
): RTCRtpTransceiver | null {
  if (current && transceiverKind(current) === kind) {
    return current;
  }

  return (
    pc
      .getTransceivers()
      .find((transceiver) => transceiverKind(transceiver) === kind) ?? null
  );
}

function transceiverKind(
  transceiver: RTCRtpTransceiver,
): "audio" | "video" | null {
  const receiverKind = transceiver.receiver.track.kind;
  if (receiverKind === "audio" || receiverKind === "video") {
    return receiverKind;
  }

  const senderKind = transceiver.sender.track?.kind;
  return senderKind === "audio" || senderKind === "video" ? senderKind : null;
}

function summarizeTransceivers(
  pc: RTCPeerConnection,
): Array<Record<string, unknown>> {
  return pc.getTransceivers().map((transceiver, index) => ({
    index,
    mid: transceiver.mid,
    kind: transceiverKind(transceiver),
    direction: transceiver.direction,
    currentDirection: transceiver.currentDirection,
    hasSenderTrack: Boolean(transceiver.sender.track),
  }));
}

function stopStream(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function toP2PIceCandidate(
  candidate: RTCIceCandidate | null,
): P2PIceCandidate | null {
  if (!candidate?.candidate) {
    return null;
  }

  const json = candidate.toJSON();
  const payload: P2PIceCandidate = { candidate: candidate.candidate };
  if (json.sdpMid !== undefined) {
    payload.sdpMid = json.sdpMid;
  }
  if (json.sdpMLineIndex !== undefined) {
    payload.sdpMLineIndex = json.sdpMLineIndex;
  }
  if (json.usernameFragment !== undefined) {
    payload.usernameFragment = json.usernameFragment;
  }
  return payload;
}

function summarizeIceServers(
  servers: RTCIceServer[],
): Array<Record<string, unknown>> {
  return servers.map((server) => ({
    urls: server.urls,
    hasUsername: Boolean(server.username),
    hasCredential: Boolean(server.credential),
  }));
}

function summarizeSignal(signal: P2PSignal): Record<string, unknown> {
  if (signal.kind === "offer" || signal.kind === "answer") {
    return {
      type: signal.sdp.type,
      ...summarizeSdp(signal.sdp.sdp),
    };
  }

  if (signal.kind === "ice") {
    return {
      candidateType: getCandidateType(signal.candidate.candidate),
      protocol: getCandidateProtocol(signal.candidate.candidate),
      sdpMid: signal.candidate.sdpMid,
      sdpMLineIndex: signal.candidate.sdpMLineIndex,
    };
  }

  return {};
}

function summarizeSdp(sdp: string): Record<string, unknown> {
  const codecs = Array.from(
    sdp.matchAll(/^a=rtpmap:\d+ ([^/\r\n]+)/gim),
    (match) => match[1]?.toLowerCase(),
  ).filter(Boolean);

  return {
    length: sdp.length,
    audioMLine: /m=audio/.test(sdp),
    videoMLine: /m=video/.test(sdp),
    codecs: Array.from(new Set(codecs)),
    audioOpusInbandFec: /a=fmtp:\d+ .*useinbandfec=1/i.test(sdp),
    audioRed:
      codecs.includes("red") &&
      /m=audio[\s\S]*a=rtpmap:\d+ red\/48000/i.test(sdp),
    videoRtx: codecs.includes("rtx"),
    videoUlpfec: codecs.includes("ulpfec"),
    videoFlexfec: codecs.includes("flexfec"),
    sendrecv: countMatches(sdp, /a=sendrecv/g),
    sendonly: countMatches(sdp, /a=sendonly/g),
    recvonly: countMatches(sdp, /a=recvonly/g),
    inactive: countMatches(sdp, /a=inactive/g),
    relayCandidates: countMatches(sdp, / typ relay /g),
    srflxCandidates: countMatches(sdp, / typ srflx /g),
    hostCandidates: countMatches(sdp, / typ host /g),
  };
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function pruneRecentP2PSignalFingerprints(
  recent: Map<string, number>,
  nowMs: number,
  ttlMs: number,
  cap: number,
): void {
  for (const [key, seenAt] of recent) {
    if (nowMs - seenAt > ttlMs) {
      recent.delete(key);
    }
  }

  const maxSize = Math.max(0, cap);
  while (recent.size > maxSize) {
    const oldestKey = recent.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    recent.delete(oldestKey);
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getCandidateType(candidate: string): string | null {
  return candidate.match(/ typ ([a-z0-9]+)/i)?.[1] ?? null;
}

function getCandidateProtocol(candidate: string): string | null {
  return (
    candidate.match(/ candidate:\S+ \d+ ([a-z]+)/i)?.[1]?.toLowerCase() ?? null
  );
}

async function configureSender(
  sender: RTCRtpSender,
  maxBitrate: number,
  maxFramerate?: number,
): Promise<void> {
  if (!sender.track) {
    return;
  }

  const parameters = sender.getParameters();
  parameters.encodings = parameters.encodings?.length
    ? parameters.encodings
    : [{}];
  const firstEncoding = parameters.encodings[0];
  if (!firstEncoding) {
    return;
  }

  firstEncoding.maxBitrate = maxBitrate;
  if (maxFramerate !== undefined) {
    firstEncoding.maxFramerate = maxFramerate;
    // Ghost Cam is motion presence at a low frame rate: keep the frame rate
    // steady and let resolution drop under pressure instead (Block 5.5).
    parameters.degradationPreference = "maintain-framerate";
  }

  await sender.setParameters(parameters).catch(() => undefined);
}

function summarizeStats(report: RTCStatsReport): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const stat of report.values()) {
    if (stat.type === "candidate-pair" && stat.state === "succeeded") {
      const localCandidate = report.get(stat.localCandidateId) as
        | IceCandidateStatsSnapshot
        | undefined;
      const remoteCandidate = report.get(stat.remoteCandidateId) as
        | IceCandidateStatsSnapshot
        | undefined;
      const localCandidateType = localCandidate?.candidateType;
      const remoteCandidateType = remoteCandidate?.candidateType;
      summary.candidatePair = {
        availableOutgoingBitrate: stat.availableOutgoingBitrate,
        bytesReceived: stat.bytesReceived,
        bytesSent: stat.bytesSent,
        currentRoundTripTime: stat.currentRoundTripTime,
        direct:
          localCandidateType !== "relay" &&
          remoteCandidateType !== "relay" &&
          Boolean(localCandidateType || remoteCandidateType),
        localCandidateType,
        localProtocol: localCandidate?.protocol,
        localRelayProtocol: localCandidate?.relayProtocol,
        remoteCandidateType,
        remoteProtocol: remoteCandidate?.protocol,
        remoteRelayProtocol: remoteCandidate?.relayProtocol,
      };
    }

    if (stat.type === "outbound-rtp" && stat.kind === "video") {
      summary.videoOutbound = {
        bytesSent: stat.bytesSent,
        framesPerSecond: stat.framesPerSecond,
        qualityLimitationReason: stat.qualityLimitationReason,
      };
    }

    if (stat.type === "inbound-rtp" && stat.kind === "video") {
      summary.videoInbound = {
        bytesReceived: stat.bytesReceived,
        framesPerSecond: stat.framesPerSecond,
        framesDecoded: stat.framesDecoded,
      };
    }

    if (stat.type === "outbound-rtp" && stat.kind === "audio") {
      summary.audioOutbound = {
        bytesSent: stat.bytesSent,
        packetsSent: stat.packetsSent,
      };
    }

    if (stat.type === "inbound-rtp" && stat.kind === "audio") {
      summary.audioInbound = {
        bytesReceived: stat.bytesReceived,
        packetsReceived: stat.packetsReceived,
        audioLevel: stat.audioLevel,
        jitter: stat.jitter,
      };
    }
  }

  return summary;
}
