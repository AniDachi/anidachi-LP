import type {
  P2PIceCandidate,
  P2PSignal,
  Participant,
  VoiceMode,
} from "@anidachi/protocol";
import { logDebug } from "./debug-log";
import {
  createLocalAudioLevelMeter,
  type LocalAudioLevelMeter,
} from "./local-audio-level-meter";
import type {
  GhostVideo,
  MicrophoneStatus,
  MicrophoneTerminalFailure,
  MicrophoneTerminalFailureReason,
  RoomSendDisposition,
  SignalingTransportReady,
} from "./media-types";
import {
  classifyAudioSpeechActivity,
  classifyAudioTransportFlow,
  type AudioActivityStats,
  type AudioSpeechActivity,
  type AudioTransportFlow,
  type SpeakingHysteresisState,
  updateSpeakingHysteresis,
} from "./voice-activity";
import {
  getDefaultParticipantAudioPreference,
  normalizeParticipantAudioPreference,
  type ParticipantAudioPreference,
} from "./voice-audio-preferences";

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
const P2P_AUDIO_ACTIVITY_SAMPLE_INTERVAL_MS = 200;
const P2P_AUDIO_RECOVERY_GRACE_MS = P2P_DISCONNECTED_RESTART_DELAY_MS;
const P2P_AUDIO_STALL_SAMPLES_BEFORE_RECOVERY = 2;
const P2P_AUDIO_FLOW_LOG_INTERVAL_MS = 2_500;
const P2P_VIDEO_ACTIVITY_MIN_FRAME_DELTA = 1;
const P2P_VIDEO_ACTIVITY_MIN_BYTE_DELTA = 1024;
const P2P_VIDEO_STALL_SAMPLES_BEFORE_RECOVERY = 2;
const P2P_MEDIA_STALL_RECOVERY_COOLDOWN_MS = 12_000;
const P2P_CAMERA_REACQUIRE_BASE_DELAY_MS = 1_000;
const P2P_CAMERA_REACQUIRE_MAX_DELAY_MS = 8_000;
const P2P_CAMERA_REACQUIRE_FAILURE_WINDOW_MS = 15_000;
const P2P_CAMERA_REACQUIRE_MAX_FAILURES = 3;
const P2P_CAMERA_STABLE_RESET_MS = 30_000;
const P2P_MICROPHONE_REACQUIRE_BASE_DELAY_MS = 250;
const P2P_MICROPHONE_REACQUIRE_MAX_DELAY_MS = 2_000;
const P2P_MICROPHONE_REACQUIRE_FAILURE_WINDOW_MS = 10_000;
const P2P_MICROPHONE_REACQUIRE_MAX_FAILURES = 3;
const P2P_MICROPHONE_STABLE_RESET_MS = 20_000;
const P2P_SIGNAL_DEDUPE_TTL_MS = 30_000;
const P2P_SIGNAL_DEDUPE_CAP = 240;
const P2P_RETIRED_SIGNAL_SOURCE_CAP = 8;
/**
 * When a participant stops publishing (camera off, voice released) keep the
 * peer connection warm for this long instead of tearing it down. A camera
 * re-toggle or the next push-to-talk then reuses the connected pair instead
 * of paying a full ICE setup, and rapid camera flapping no longer churns the
 * remote side. "bye" and disconnect still close immediately.
 */
const P2P_IDLE_PEER_LINGER_MS = 30_000;

type P2PMediaKind = "audio" | "video";
type P2PCameraState = "off" | "starting" | "live" | "recovering" | "unavailable";

interface P2PVideoSenderSyncInput {
  cameraState: P2PCameraState;
  hasLocalVideoTrack: boolean;
  publicCameraEnabled: boolean;
  wantsCamera: boolean;
}

export interface P2PVideoSenderSyncPlan {
  desiredDirection: RTCRtpTransceiverDirection;
  replaceTrackWithNull: boolean;
}

export function planP2PVideoSenderSync(
  input: P2PVideoSenderSyncInput,
): P2PVideoSenderSyncPlan {
  const cameraRecovering =
    input.wantsCamera &&
    input.publicCameraEnabled &&
    input.cameraState === "recovering";

  if (input.hasLocalVideoTrack || cameraRecovering) {
    return {
      desiredDirection: "sendrecv",
      replaceTrackWithNull: false,
    };
  }

  return {
    desiredDirection: "recvonly",
    replaceTrackWithNull: true,
  };
}

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

export interface P2PSignalConnectionDecision {
  accept: boolean;
  nextSenderConnectionId: string | null;
  nextSenderMediaSessionId?: string | null;
  reason:
    | "current-connection"
    | "current-media-session"
    | "first-connection"
    | "missing-metadata"
    | "new-media-session"
    | "new-publisher-connection"
    | "stale-connection";
}

export interface P2PSignalMetadata {
  senderConnectionId?: string | null;
  senderMediaSessionId?: string | null;
}

export interface LocalP2PSignalMetadata {
  senderMediaSessionId: string;
}

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

export function decideP2PSignalConnection(
  currentSenderConnectionId: string | null,
  incomingSenderConnectionId: string | null | undefined,
  signalKind: P2PSignal["kind"],
  currentSenderMediaSessionId?: string | null,
  incomingSenderMediaSessionId?: string | null,
): P2PSignalConnectionDecision {
  if (incomingSenderMediaSessionId) {
    if (currentSenderMediaSessionId === incomingSenderMediaSessionId) {
      if (
        signalKind === "bye" &&
        currentSenderConnectionId &&
        incomingSenderConnectionId &&
        currentSenderConnectionId !== incomingSenderConnectionId
      ) {
        return {
          accept: false,
          nextSenderConnectionId: currentSenderConnectionId,
          nextSenderMediaSessionId: currentSenderMediaSessionId,
          reason: "stale-connection",
        };
      }

      return {
        accept: true,
        nextSenderConnectionId:
          signalKind === "bye"
            ? null
            : (incomingSenderConnectionId ?? currentSenderConnectionId),
        nextSenderMediaSessionId:
          signalKind === "bye" ? null : currentSenderMediaSessionId,
        reason: "current-media-session",
      };
    }

    if (signalKind === "bye") {
      return {
        accept: false,
        nextSenderConnectionId: currentSenderConnectionId,
        nextSenderMediaSessionId: currentSenderMediaSessionId ?? null,
        reason: "stale-connection",
      };
    }

    return {
      accept: true,
      nextSenderConnectionId:
        incomingSenderConnectionId ?? currentSenderConnectionId,
      nextSenderMediaSessionId: incomingSenderMediaSessionId,
      reason: "new-media-session",
    };
  }

  if (
    currentSenderMediaSessionId &&
    currentSenderConnectionId &&
    incomingSenderConnectionId &&
    currentSenderConnectionId !== incomingSenderConnectionId
  ) {
    return {
      accept: false,
      nextSenderConnectionId: currentSenderConnectionId,
      nextSenderMediaSessionId: currentSenderMediaSessionId,
      reason: "stale-connection",
    };
  }

  if (!incomingSenderConnectionId) {
    return {
      accept: true,
      nextSenderConnectionId: currentSenderConnectionId,
      reason: "missing-metadata",
    };
  }

  if (!currentSenderConnectionId) {
    return {
      accept: true,
      nextSenderConnectionId:
        signalKind === "bye" ? null : incomingSenderConnectionId,
      reason: "first-connection",
    };
  }

  if (currentSenderConnectionId === incomingSenderConnectionId) {
    return {
      accept: true,
      nextSenderConnectionId:
        signalKind === "bye" ? null : currentSenderConnectionId,
      reason: "current-connection",
    };
  }

  if (signalKind === "offer" || signalKind === "voice-start") {
    return {
      accept: true,
      nextSenderConnectionId: incomingSenderConnectionId,
      reason: "new-publisher-connection",
    };
  }

  return {
    accept: false,
    nextSenderConnectionId: currentSenderConnectionId,
    reason: "stale-connection",
  };
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

export function hasRecentP2PMediaSignalFingerprint(
  recent: Map<string, number>,
  key: string | null,
  nowMs: number,
  ttlMs = P2P_SIGNAL_DEDUPE_TTL_MS,
  cap = P2P_SIGNAL_DEDUPE_CAP,
): boolean {
  if (!key) {
    return false;
  }

  pruneRecentP2PSignalFingerprints(recent, nowMs, ttlMs, cap);
  return recent.has(key);
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
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

interface VideoActivityStats {
  bytesReceived?: number;
  framesDecoded?: number;
}

interface VideoInboundStats extends VideoActivityStats {
  framesPerSecond?: number;
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
      : undefined;
  const byteDelta =
    typeof current.bytesReceived === "number" &&
    typeof previous.bytesReceived === "number"
      ? current.bytesReceived - previous.bytesReceived
      : undefined;

  if (
    typeof byteDelta === "number" &&
    byteDelta >= P2P_VIDEO_ACTIVITY_MIN_BYTE_DELTA
  ) {
    return "flowing";
  }

  if (typeof frameDelta === "number") {
    return frameDelta >= P2P_VIDEO_ACTIVITY_MIN_FRAME_DELTA
      ? "flowing"
      : "stalled";
  }

  return "stalled";
}

/**
 * Live media is restricted to server-assigned media seats. A peer pair exists
 * only among joined media-seat participants when media flows in at least one
 * direction:
 *  - video: a local publisher pairs with every media-seat receiver, while any
 *    remote publisher stays connected so local camera-off remains receive-only;
 *  - voice: either side is a live-voice participant. Listeners without a
 *    camera must still get a connection to hear the talker when they hold a
 *    media seat.
 * The local participant is part of the media set whenever it has at least
 * one pair or publishes anything itself.
 */
export function selectP2PMediaParticipants(
  participants: Participant[],
  localParticipantId: string,
  localMediaWanted: boolean,
  voiceParticipantIds: ReadonlySet<string> = new Set(),
): Participant[] {
  const mediaParticipants = participants.filter(
    (participant) => participant.mediaSeat === "joined",
  );
  const local = mediaParticipants.find(
    (participant) => participant.id === localParticipantId,
  );
  if (!local) {
    return [];
  }
  const localVoice = voiceParticipantIds.has(localParticipantId);
  const localVideo = localMediaWanted || Boolean(local?.cameraEnabled);
  const pairedRemoteIds = new Set(
    mediaParticipants
      .filter(
        (participant) =>
          participant.id !== localParticipantId &&
          (localVideo ||
            participant.cameraEnabled ||
            localVoice ||
            voiceParticipantIds.has(participant.id)),
      )
      .map((participant) => participant.id),
  );
  const localIncluded = pairedRemoteIds.size > 0 || localVideo || localVoice;

  return mediaParticipants.filter((participant) =>
    participant.id === localParticipantId
      ? localIncluded
      : pairedRemoteIds.has(participant.id),
  );
}

export function canReceiveP2PSignalFromParticipant(
  participants: Participant[],
  localParticipantId: string,
  remoteParticipantId: string,
  _localMediaWanted: boolean,
  _voiceParticipantIds: ReadonlySet<string> = new Set(),
): boolean {
  if (localParticipantId === remoteParticipantId) {
    return false;
  }

  const joinedMediaSeatIds = new Set(
    participants
      .filter((participant) => participant.mediaSeat === "joined")
      .map((participant) => participant.id),
  );

  // Camera and voice state arrive through room events independently from P2P
  // signaling. Seat membership is the stable authorization boundary; requiring
  // replicated media state here can drop the first offer from a new publisher.
  return (
    joinedMediaSeatIds.has(localParticipantId) &&
    joinedMediaSeatIds.has(remoteParticipantId)
  );
}

interface P2PPeer {
  audioCodecPreferencesKey: string | null;
  audioTransceiver: RTCRtpTransceiver | null;
  disconnectedRestartTimerId: number | null;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  iceRestartCount: number;
  lastCandidatePairLogKey: string | null;
  lastAudioFlowLogAt: number;
  lastAudioStallRecoveryAt: number;
  lastIceRestartAt: number;
  lastIceRestartRequestAt: number;
  lastRenegotiationRequestAt: number;
  lastSignalingRecoveryConnectionId: string | null;
  lastMediaStallRecoveryAt: number;
  makingOffer: boolean;
  mediaSyncChain: Promise<void>;
  mediaSyncPendingCount: number;
  mediaSyncing: boolean;
  negotiationQueued: boolean;
  needsNegotiation: boolean;
  pendingCloseTimerId: number | null;
  pendingIceCandidates: P2PIceCandidate[];
  pc: RTCPeerConnection;
  polite: boolean;
  recentSignalFingerprints: Map<string, number>;
  renegotiationRetryTimerId: number | null;
  remoteVideoExpected: boolean;
  remoteVideoStallSamples: number;
  remoteUserId: string;
  signalingRecoveryNeeded: boolean;
  videoCodecPreferencesKey: string | null;
  videoTransceiver: RTCRtpTransceiver | null;
}

interface P2PMediaControllerOptions {
  iceServers?: RTCIceServer[];
  localParticipant: Participant;
  onActiveSpeakerIdsChange: (ids: string[]) => void;
  onCameraStatus: (enabled: boolean) => void;
  onMicrophoneTerminalFailure: (
    failure: MicrophoneTerminalFailure,
  ) => void;
  onVideosChange: (videos: GhostVideo[]) => void;
  onVoiceMessageChange: (message: string | null) => void;
  onMicrophoneStatusChange: (status: MicrophoneStatus) => void;
  refreshIceServers?: () => Promise<RTCIceServer[]>;
  sendSignal: (
    toUserId: string,
    signal: P2PSignal,
    metadata: LocalP2PSignalMetadata,
  ) => RoomSendDisposition;
}

export interface P2PMediaPeerDiagnostics {
  remoteUserId: string;
  connectionState: RTCPeerConnectionState;
  iceRestartCount: number;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  health: PeerHealth;
  remoteAudioExpected: boolean;
  remoteAudioActivity: AudioSpeechActivity;
  remoteAudioFlowActivity: AudioTransportFlow;
  remoteVideoActivity: RemoteVideoActivity;
  participantAudioOutput: ParticipantAudioPreference;
  statsStatus: "available" | "unavailable";
  stats: Record<string, unknown>;
}

export interface P2PMediaDiagnostics {
  microphonePublishingWanted: boolean;
  microphonePublishing: boolean;
  localSpeaking: boolean;
  remoteAudioExpectedIds: string[];
  peers: P2PMediaPeerDiagnostics[];
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
  private readonly onMicrophoneTerminalFailure: (
    failure: MicrophoneTerminalFailure,
  ) => void;
  private readonly onVideosChange: (videos: GhostVideo[]) => void;
  private readonly onVoiceMessageChange: (message: string | null) => void;
  private readonly onMicrophoneStatusChange: (status: MicrophoneStatus) => void;
  private readonly refreshIceServers?: () => Promise<RTCIceServer[]>;
  private readonly sendSignalToTransport: P2PMediaControllerOptions["sendSignal"];
  private readonly peers = new Map<string, P2PPeer>();
  private readonly microphonePublicationModeByPeer = new Map<
    string,
    VoiceMode
  >();
  private readonly peerOperationChains = new Map<string, Promise<unknown>>();
  private readonly senderConnectionIdsByPeer = new Map<string, string>();
  private readonly senderMediaSessionIdsByPeer = new Map<string, string>();
  private readonly retiredSenderConnectionIdsByPeer = new Map<
    string,
    Set<string>
  >();
  private readonly retiredSenderMediaSessionIdsByPeer = new Map<
    string,
    Set<string>
  >();
  private readonly videosByParticipant = new Map<string, GhostVideo>();
  private readonly audioElementsByParticipant = new Map<
    string,
    HTMLAudioElement
  >();
  private readonly participantAudioOutputPreferences = new Map<
    string,
    ParticipantAudioPreference
  >();
  private readonly remotePushToTalkIds = new Set<string>();
  private readonly remoteSpeakingIds = new Set<string>();
  private readonly remoteAudioExpectationGenerationByPeer = new Map<
    string,
    number
  >();
  private readonly remoteAudioActivityByPeer = new Map<
    string,
    AudioSpeechActivity
  >();
  private readonly remoteAudioExpectedByPeer = new Set<string>();
  private readonly remoteAudioExpectedAtByPeer = new Map<string, number>();
  private readonly remoteAudioFlowActivityByPeer = new Map<
    string,
    AudioTransportFlow
  >();
  private readonly remoteAudioFreshnessBaselineByPeer = new Map<
    string,
    AudioActivityStats
  >();
  private readonly remoteAudioFreshnessRequiredByPeer = new Set<string>();
  private readonly remoteAudioStatsByPeer = new Map<
    string,
    AudioActivityStats
  >();
  private readonly remoteAudioStallSamplesByPeer = new Map<string, number>();
  private readonly remoteSpeakingHysteresisByPeer = new Map<
    string,
    SpeakingHysteresisState
  >();
  private readonly remoteVideoActivityByPeer = new Map<
    string,
    RemoteVideoActivity
  >();
  private readonly remoteVideoStatsByPeer = new Map<
    string,
    VideoActivityStats
  >();
  private cameraFailureTimestamps: number[] = [];
  private cameraIntentGeneration = 0;
  private cameraReacquireTimerId: number | null = null;
  private cameraStableTimerId: number | null = null;
  private cameraStartingGeneration: number | null = null;
  private cameraState: P2PCameraState = "off";
  private disposed = false;
  private localAudioLevelMeter: LocalAudioLevelMeter | null = null;
  private localAudioStream: MediaStream | null = null;
  private localAudioTrack: MediaStreamTrack | null = null;
  private microphoneFailureTimestamps: number[] = [];
  private microphoneIntentGeneration = 0;
  private microphoneReacquireTimerId: number | null = null;
  private microphoneStableTimerId: number | null = null;
  private localVideoStream: MediaStream | null = null;
  private localVideoTrack: MediaStreamTrack | null = null;
  private publicCameraEnabled = false;
  private lastSignalingTransportReadyId: string | null = null;
  private wantsCamera = false;
  private microphonePublishingWanted = false;
  private microphoneVoiceMode: VoiceMode = "push-to-talk";
  private microphoneStartingGeneration: number | null = null;
  private microphonePublishing = false;
  private localSpeaking = false;
  private localSpeakingHysteresis: SpeakingHysteresisState = {
    quietSamples: 0,
    speaking: false,
  };
  private audioActivityTimerId: number | null = null;
  private localAudioActivitySampling = false;
  private readonly remoteAudioActivitySamplingByPeer = new Map<
    string,
    P2PPeer
  >();
  readonly mediaSessionId = `media-${crypto.randomUUID()}`;
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
    this.iceServers = options.iceServers ?? getDefaultP2PIceServers();
    this.localParticipant = options.localParticipant;
    this.onActiveSpeakerIdsChange = options.onActiveSpeakerIdsChange;
    this.onCameraStatus = options.onCameraStatus;
    this.onMicrophoneTerminalFailure = options.onMicrophoneTerminalFailure;
    this.onVideosChange = options.onVideosChange;
    this.onVoiceMessageChange = options.onVoiceMessageChange;
    this.onMicrophoneStatusChange = options.onMicrophoneStatusChange;
    this.refreshIceServers = options.refreshIceServers;
    this.sendSignalToTransport = options.sendSignal;
    this.publicCameraEnabled = options.localParticipant.cameraEnabled;
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
      mediaSessionId: this.mediaSessionId,
      iceServers: summarizeIceServers(this.iceServers),
    });
  }

  private sendSignal(toUserId: string, signal: P2PSignal): RoomSendDisposition {
    const disposition = this.sendSignalToTransport(toUserId, signal, {
      senderMediaSessionId: this.mediaSessionId,
    });
    if (disposition !== "sent") {
      logDebug("p2p.signal", "transport did not send immediately", {
        disposition,
        kind: signal.kind,
        localParticipantId: this.localParticipant.id,
        remoteUserId: toUserId,
      });
    }
    return disposition;
  }

  private sendMicrophonePublicationState(
    remoteUserId: string,
    publishing: boolean,
    force = false,
  ): void {
    const signaledMode =
      this.microphonePublicationModeByPeer.get(remoteUserId);
    if (
      !force &&
      (publishing
        ? signaledMode === this.microphoneVoiceMode
        : signaledMode === undefined)
    ) {
      return;
    }

    const disposition = this.sendSignal(
      remoteUserId,
      publishing
        ? {
            kind: "voice-start",
            voiceMode: this.microphoneVoiceMode,
          }
        : { kind: "voice-stop" },
    );
    if (disposition === "dropped") {
      return;
    }

    if (publishing) {
      this.microphonePublicationModeByPeer.set(
        remoteUserId,
        this.microphoneVoiceMode,
      );
    } else {
      this.microphonePublicationModeByPeer.delete(remoteUserId);
    }
  }

  private sendMicrophonePublicationStateToAll(
    publishing: boolean,
    force = false,
  ): void {
    for (const peer of this.peers.values()) {
      this.sendMicrophonePublicationState(
        peer.remoteUserId,
        publishing,
        force,
      );
    }
  }

  private isMicrophonePublicationExpected(): boolean {
    return this.microphonePublishing || this.microphonePublishingWanted;
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
    if (this.cameraState === "unavailable") {
      this.cameraFailureTimestamps = [];
    }
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.scheduleCameraReacquire("device-change");
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

      // A peer awaiting its linger close is on the way out; restarting its
      // ICE or renegotiating would just churn a connection nobody publishes
      // on. If the participant returns, ensurePeer cancels the close and the
      // next reconcile tick picks the peer up again.
      if (peer.pendingCloseTimerId !== null) {
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

  updateParticipants(
    participants: Participant[],
    mediaSeatParticipantIds?: ReadonlySet<string>,
  ): void {
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

    for (const [remoteId, peer] of this.peers) {
      if (!remoteIdSet.has(remoteId)) {
        if (
          mediaSeatParticipantIds &&
          !mediaSeatParticipantIds.has(remoteId)
        ) {
          this.closePeer(remoteId, false);
          continue;
        }
        if (
          this.remoteAudioExpectedByPeer.has(remoteId) ||
          this.remotePushToTalkIds.has(remoteId) ||
          this.remoteSpeakingIds.has(remoteId)
        ) {
          this.resetRemoteAudioPublicationState(remoteId, true);
        }
        this.schedulePeerLingerClose(peer);
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
        isNewPeer && this.shouldInitiateOffers(peer),
      );
      if (isNewPeer && this.isMicrophonePublicationExpected()) {
        this.sendMicrophonePublicationState(peer.remoteUserId, true);
      }
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (!enabled) {
      await this.stopCamera();
      return;
    }

    if (!this.wantsCamera) {
      this.cameraIntentGeneration += 1;
    }
    this.wantsCamera = true;
    this.onVoiceMessageChange(null);
    await this.acquireCamera("user-request", this.cameraIntentGeneration);
  }

  private async acquireCamera(reason: string, intentGeneration: number): Promise<void> {
    if (
      this.disposed ||
      !this.wantsCamera ||
      intentGeneration !== this.cameraIntentGeneration
    ) {
      return;
    }

    if (this.localVideoTrack?.readyState === "live") {
      this.cameraState = "live";
      this.setPublicCameraEnabled(true, reason);
      return;
    }

    if (this.cameraStartingGeneration === intentGeneration) {
      return;
    }

    this.clearCameraReacquireTimer();
    this.clearCameraStableTimer();
    this.cameraStartingGeneration = intentGeneration;
    this.cameraState = this.publicCameraEnabled ? "recovering" : "starting";
    logDebug("p2p.camera", "getUserMedia start", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
      reason,
      state: this.cameraState,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        P2P_VIDEO_CONSTRAINTS,
      );
      if (
        this.disposed ||
        !this.wantsCamera ||
        intentGeneration !== this.cameraIntentGeneration
      ) {
        stopStream(stream);
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
        () => this.handleLocalVideoTrackEnded(track),
        { once: true },
      );
      this.localVideoStream = stream;
      this.localVideoTrack = track;
      this.cameraState = "live";
      logDebug("p2p.camera", "local track ready", {
        localParticipantId: this.localParticipant.id,
        trackState: track.readyState,
        settings: track.getSettings(),
        reason,
      });
      this.scheduleCameraStableReset();
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

      this.setPublicCameraEnabled(true, "track-ready");
    } catch (error) {
      if (intentGeneration !== this.cameraIntentGeneration) {
        return;
      }
      logDebug("p2p.camera", "failed", {
        localParticipantId: this.localParticipant.id,
        error: error instanceof Error ? error.message : String(error),
        reason,
        state: this.cameraState,
      });
      if (this.wantsCamera && this.publicCameraEnabled && !this.disposed) {
        this.scheduleCameraReacquire("get-user-media-failed", error);
      } else {
        this.cameraState = "unavailable";
        this.setPublicCameraEnabled(false, "camera-failed");
        this.onVoiceMessageChange(formatCameraErrorMessage(error));
      }
    } finally {
      if (this.cameraStartingGeneration === intentGeneration) {
        this.cameraStartingGeneration = null;
      }
    }
  }

  private handleLocalVideoTrackEnded(track: MediaStreamTrack): void {
    logDebug("p2p.camera", "local track ended", {
      localParticipantId: this.localParticipant.id,
      state: this.cameraState,
      wantsCamera: this.wantsCamera,
    });
    if (this.localVideoTrack !== track) {
      return;
    }

    this.clearCameraStableTimer();
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.removeVideo(this.localParticipant.id);

    if (this.wantsCamera && !this.disposed) {
      this.cameraState = "recovering";
      this.scheduleCameraReacquire("track-ended");
      return;
    }

    this.cameraState = "off";
    this.setPublicCameraEnabled(false, "track-ended");
  }

  private scheduleCameraReacquire(reason: string, error?: unknown): void {
    if (this.disposed || !this.wantsCamera) {
      return;
    }
    if (this.cameraReacquireTimerId !== null) {
      return;
    }

    const now = Date.now();
    this.cameraFailureTimestamps = [
      ...this.cameraFailureTimestamps.filter(
        (timestamp) => now - timestamp <= P2P_CAMERA_REACQUIRE_FAILURE_WINDOW_MS,
      ),
      now,
    ];

    if (
      this.cameraFailureTimestamps.length >= P2P_CAMERA_REACQUIRE_MAX_FAILURES
    ) {
      this.giveUpCameraRecovery(reason, error);
      return;
    }

    const delay = Math.min(
      P2P_CAMERA_REACQUIRE_BASE_DELAY_MS *
        2 ** Math.max(0, this.cameraFailureTimestamps.length - 1),
      P2P_CAMERA_REACQUIRE_MAX_DELAY_MS,
    );
    this.cameraState = "recovering";
    logDebug("p2p.camera", "schedule re-acquire", {
      delay,
      failures: this.cameraFailureTimestamps.length,
      localParticipantId: this.localParticipant.id,
      reason,
    });
    this.cameraReacquireTimerId = window.setTimeout(() => {
      this.cameraReacquireTimerId = null;
      if (this.disposed || !this.wantsCamera) {
        return;
      }
      void this.acquireCamera(
        `reacquire:${reason}`,
        this.cameraIntentGeneration,
      );
    }, delay);
  }

  private giveUpCameraRecovery(reason: string, error?: unknown): void {
    this.clearCameraReacquireTimer();
    this.clearCameraStableTimer();
    this.cameraState = "unavailable";
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.removeVideo(this.localParticipant.id);
    logDebug("p2p.camera", "recovery give up", {
      failures: this.cameraFailureTimestamps.length,
      localParticipantId: this.localParticipant.id,
      reason,
    });
    this.setPublicCameraEnabled(false, "recovery-give-up");
    this.onVoiceMessageChange(formatCameraErrorMessage(error));
  }

  private setPublicCameraEnabled(enabled: boolean, reason: string): void {
    if (this.publicCameraEnabled === enabled) {
      return;
    }

    this.publicCameraEnabled = enabled;
    logDebug("p2p.camera", "public status", {
      enabled,
      localParticipantId: this.localParticipant.id,
      reason,
    });
    this.onCameraStatus(enabled);
  }

  private scheduleCameraStableReset(): void {
    this.clearCameraStableTimer();
    this.cameraStableTimerId = window.setTimeout(() => {
      this.cameraStableTimerId = null;
      this.cameraFailureTimestamps = [];
      logDebug("p2p.camera", "stable reset", {
        localParticipantId: this.localParticipant.id,
      });
    }, P2P_CAMERA_STABLE_RESET_MS);
  }

  private clearCameraReacquireTimer(): void {
    if (this.cameraReacquireTimerId === null) {
      return;
    }

    window.clearTimeout(this.cameraReacquireTimerId);
    this.cameraReacquireTimerId = null;
  }

  private clearCameraStableTimer(): void {
    if (this.cameraStableTimerId === null) {
      return;
    }

    window.clearTimeout(this.cameraStableTimerId);
    this.cameraStableTimerId = null;
  }

  async setMicrophonePublishing(
    enabled: boolean,
    release: "warm" | "immediate",
    voiceMode: VoiceMode = this.microphoneVoiceMode,
  ): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.microphoneVoiceMode = voiceMode;

    if (!enabled) {
      const wasPublishing =
        this.microphonePublishingWanted ||
        this.microphoneStartingGeneration !== null ||
        this.microphonePublishing ||
        Boolean(this.localAudioTrack?.enabled);

      if (!wasPublishing) {
        logDebug("p2p.voice", "publication stop ignored", {
          localParticipantId: this.localParticipant.id,
          peerCount: this.peers.size,
          reason: "already-off",
        });
        this.sendMicrophonePublicationStateToAll(false);
        this.onMicrophoneStatusChange("off");
        return;
      }

      logDebug("p2p.voice", "publication stop", {
        localParticipantId: this.localParticipant.id,
        peerCount: this.peers.size,
        release,
      });
      this.microphoneIntentGeneration += 1;
      this.microphonePublishingWanted = false;
      this.microphoneStartingGeneration = null;
      this.microphonePublishing = false;
      this.clearLocalSpeaking();
      this.clearMicrophoneReacquireTimer();
      this.clearMicrophoneStableTimer();

      // Push to talk keeps a disabled track warm briefly for responsive repeat
      // presses. Open mic and privacy/terminal paths release capture now.
      if (this.localAudioTrack) {
        this.localAudioTrack.enabled = false;
        if (release === "immediate") {
          this.clearMicReleaseTimer();
          this.releaseMic();
        } else {
          this.scheduleMicRelease();
        }
      }

      this.sendMicrophonePublicationStateToAll(false);
      this.updateAudioActivitySampler();
      this.onMicrophoneStatusChange("off");
      return;
    }

    if (!this.microphonePublishingWanted) {
      this.microphoneIntentGeneration += 1;
    }
    this.microphonePublishingWanted = true;
    this.clearMicrophoneReacquireTimer();
    this.clearMicReleaseTimer();

    if (voiceMode === "push-to-talk") {
      this.sendMicrophonePublicationStateToAll(true);
    }

    if (this.microphonePublishing && this.localAudioTrack?.readyState === "live") {
      this.sendMicrophonePublicationStateToAll(true);
      this.onMicrophoneStatusChange("on");
      return;
    }

    if (this.microphoneStartingGeneration === this.microphoneIntentGeneration) {
      this.onMicrophoneStatusChange("connecting");
      return;
    }

    // Warm mic from a recent press: just re-enable the existing track. No
    // getUserMedia, no track/transceiver churn — the encoder is already warm
    // so audio resumes near-instantly (Block 5.2).
    if (this.localAudioTrack && this.localAudioTrack.readyState === "live") {
      this.localAudioTrack.enabled = true;
      this.microphonePublishing = true;
      for (const peer of this.peers.values()) {
        const needsMediaOffer = this.peerNeedsMediaOffer(peer);
        const negotiationNeeded = await this.syncPeerMedia(peer);
        if (needsMediaOffer || negotiationNeeded) {
          this.queueNegotiation(peer, "voice-resume");
        }
        this.sendMicrophonePublicationState(peer.remoteUserId, true);
      }
      this.updateAudioActivitySampler();
      this.onMicrophoneStatusChange("on");
      logDebug("p2p.voice", "resumed warm mic", {
        localParticipantId: this.localParticipant.id,
        peerCount: this.peers.size,
      });
      return;
    }

    await this.acquireMicrophoneTrack("user-request", this.microphoneIntentGeneration);
  }

  private async acquireMicrophoneTrack(reason: string, intentGeneration: number): Promise<void> {
    if (
      this.disposed ||
      !this.microphonePublishingWanted ||
      intentGeneration !== this.microphoneIntentGeneration
    ) {
      return;
    }

    if (this.localAudioTrack?.readyState === "live") {
      this.localAudioTrack.enabled = true;
      this.microphonePublishing = true;
      this.updateAudioActivitySampler();
      this.onMicrophoneStatusChange("on");
      return;
    }

    if (this.microphoneStartingGeneration === intentGeneration) {
      this.onMicrophoneStatusChange("connecting");
      return;
    }

    this.microphoneStartingGeneration = intentGeneration;
    this.onMicrophoneStatusChange("connecting");
    this.onVoiceMessageChange(null);
    logDebug("p2p.voice", "getUserMedia start", {
      localParticipantId: this.localParticipant.id,
      peerCount: this.peers.size,
      reason,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        P2P_AUDIO_CONSTRAINTS,
      );
      if (
        this.disposed ||
        !this.microphonePublishingWanted ||
        intentGeneration !== this.microphoneIntentGeneration
      ) {
        stopStream(stream);
        return;
      }

      const track = stream.getAudioTracks()[0];
      if (!track) {
        stopStream(stream);
        throw new Error("Microphone did not return an audio track.");
      }

      track.addEventListener(
        "ended",
        () => this.handleLocalAudioTrackEnded(track),
        { once: true },
      );
      this.localAudioStream = stream;
      this.localAudioTrack = track;
      this.replaceLocalAudioLevelMeter(
        createLocalAudioLevelMeter(stream, track),
      );
      this.microphonePublishing = true;
      this.scheduleMicrophoneStableReset();
      logDebug("p2p.voice", "local track ready", {
        localParticipantId: this.localParticipant.id,
        reason,
        trackState: track.readyState,
        settings: track.getSettings(),
      });

      for (const peer of this.peers.values()) {
        const needsMediaOffer = this.peerNeedsMediaOffer(peer);
        const negotiationNeeded = await this.syncPeerMedia(peer);
        if (needsMediaOffer || negotiationNeeded) {
          this.queueNegotiation(peer, "voice-start");
        }
        this.sendMicrophonePublicationState(peer.remoteUserId, true);
      }

      this.updateAudioActivitySampler();
      this.onMicrophoneStatusChange("on");
    } catch (error) {
      if (intentGeneration !== this.microphoneIntentGeneration) {
        return;
      }
      logDebug("p2p.voice", "failed", {
        localParticipantId: this.localParticipant.id,
        error: error instanceof Error ? error.message : String(error),
        reason,
      });
      const terminalReason = classifyMicrophoneTerminalFailure(error);
      if (terminalReason) {
        this.failMicrophonePublication(error, terminalReason);
      } else if (this.microphonePublishingWanted && !this.disposed) {
        this.scheduleMicrophoneReacquire("get-user-media-failed", error);
      } else {
        this.microphonePublishing = false;
        this.clearLocalSpeaking();
        this.updateAudioActivitySampler();
        this.onMicrophoneStatusChange("error");
        this.onVoiceMessageChange(formatMicrophoneErrorMessage(error));
      }
    } finally {
      if (this.microphoneStartingGeneration === intentGeneration) {
        this.microphoneStartingGeneration = null;
      }
    }
  }

  async unlockAudio(): Promise<void> {
    for (const [participantId, element] of this.audioElementsByParticipant) {
      this.applyParticipantAudioOutput(participantId, element);
      await element.play().catch(() => undefined);
    }
  }

  setParticipantAudioOutput(
    participantId: string,
    preference: ParticipantAudioPreference,
  ): void {
    const normalized = normalizeParticipantAudioPreference(preference);
    this.participantAudioOutputPreferences.set(participantId, normalized);
    const element = this.audioElementsByParticipant.get(participantId);
    if (element) {
      this.applyParticipantAudioOutput(participantId, element);
    }
  }

  replaceParticipantAudioOutputs(
    preferences: Readonly<Record<string, ParticipantAudioPreference>>,
  ): void {
    this.participantAudioOutputPreferences.clear();
    for (const [participantId, preference] of Object.entries(preferences)) {
      this.participantAudioOutputPreferences.set(
        participantId,
        normalizeParticipantAudioPreference(preference),
      );
    }
    for (const [participantId, element] of this.audioElementsByParticipant) {
      this.applyParticipantAudioOutput(participantId, element);
    }
  }

  private scheduleMicRelease(): void {
    this.clearMicReleaseTimer();
    this.micReleaseTimerId = window.setTimeout(() => {
      this.micReleaseTimerId = null;
      if (!this.microphonePublishing && !this.disposed) {
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

  private handleLocalAudioTrackEnded(track: MediaStreamTrack): void {
    logDebug("p2p.voice", "local track ended", {
      localParticipantId: this.localParticipant.id,
      microphonePublishingWanted: this.microphonePublishingWanted,
      microphonePublishing: this.microphonePublishing,
    });
    if (this.localAudioTrack !== track) {
      return;
    }

    this.clearMicrophoneStableTimer();
    this.replaceLocalAudioLevelMeter(null);
    this.localAudioStream = null;
    this.localAudioTrack = null;
    for (const peer of this.peers.values()) {
      void peer.audioTransceiver?.sender
        .replaceTrack(null)
        .catch(() => undefined);
    }

    if (this.microphonePublishingWanted && !this.disposed) {
      // Holding V is the user's intent. A transient MediaStreamTrack ended event
      // should recover the mic, not publish voice-stop and make the remote side
      // flicker.
      this.microphonePublishing = true;
      this.clearLocalSpeaking();
      this.updateAudioActivitySampler();
      this.onMicrophoneStatusChange("connecting");
      this.scheduleMicrophoneReacquire("track-ended");
      return;
    }

    this.microphonePublishing = false;
    this.clearLocalSpeaking();
    this.updateAudioActivitySampler();
    this.onMicrophoneStatusChange("off");
  }

  private scheduleMicrophoneReacquire(reason: string, error?: unknown): void {
    if (this.disposed || !this.microphonePublishingWanted) {
      return;
    }
    if (this.microphoneReacquireTimerId !== null) {
      return;
    }

    const now = Date.now();
    this.microphoneFailureTimestamps = [
      ...this.microphoneFailureTimestamps.filter(
        (timestamp) => now - timestamp <= P2P_MICROPHONE_REACQUIRE_FAILURE_WINDOW_MS,
      ),
      now,
    ];

    if (this.microphoneFailureTimestamps.length >= P2P_MICROPHONE_REACQUIRE_MAX_FAILURES) {
      this.giveUpMicrophoneRecovery(reason, error);
      return;
    }

    const delay = Math.min(
      P2P_MICROPHONE_REACQUIRE_BASE_DELAY_MS *
        2 ** Math.max(0, this.microphoneFailureTimestamps.length - 1),
      P2P_MICROPHONE_REACQUIRE_MAX_DELAY_MS,
    );
    this.onMicrophoneStatusChange("connecting");
    logDebug("p2p.voice", "schedule re-acquire", {
      delay,
      failures: this.microphoneFailureTimestamps.length,
      localParticipantId: this.localParticipant.id,
      reason,
    });
    this.microphoneReacquireTimerId = window.setTimeout(() => {
      this.microphoneReacquireTimerId = null;
      if (this.disposed || !this.microphonePublishingWanted) {
        return;
      }
      void this.acquireMicrophoneTrack(
        `reacquire:${reason}`,
        this.microphoneIntentGeneration,
      );
    }, delay);
  }

  private giveUpMicrophoneRecovery(reason: string, error?: unknown): void {
    this.failMicrophonePublication(error, "recovery-exhausted", reason);
  }

  private failMicrophonePublication(
    error: unknown,
    reason: MicrophoneTerminalFailureReason,
    recoveryReason?: string,
  ): void {
    this.clearMicrophoneReacquireTimer();
    this.clearMicrophoneStableTimer();
    this.clearMicReleaseTimer();
    this.microphonePublishingWanted = false;
    this.microphoneIntentGeneration += 1;
    this.microphoneStartingGeneration = null;
    this.microphonePublishing = false;
    this.releaseMic();
    logDebug("p2p.voice", "terminal failure", {
      failures: this.microphoneFailureTimestamps.length,
      localParticipantId: this.localParticipant.id,
      reason,
      recoveryReason: recoveryReason ?? null,
      errorName: microphoneErrorName(error) || null,
    });
    this.sendMicrophonePublicationStateToAll(false);
    this.clearLocalSpeaking();
    this.updateAudioActivitySampler();
    const message = formatMicrophoneErrorMessage(error);
    this.onMicrophoneStatusChange("error");
    this.onVoiceMessageChange(message);
    this.onMicrophoneTerminalFailure({
      errorName: microphoneErrorName(error) || null,
      message,
      reason,
    });
  }

  private scheduleMicrophoneStableReset(): void {
    this.clearMicrophoneStableTimer();
    this.microphoneStableTimerId = window.setTimeout(() => {
      this.microphoneStableTimerId = null;
      this.microphoneFailureTimestamps = [];
      logDebug("p2p.voice", "stable reset", {
        localParticipantId: this.localParticipant.id,
      });
    }, P2P_MICROPHONE_STABLE_RESET_MS);
  }

  private clearMicrophoneReacquireTimer(): void {
    if (this.microphoneReacquireTimerId === null) {
      return;
    }

    window.clearTimeout(this.microphoneReacquireTimerId);
    this.microphoneReacquireTimerId = null;
  }

  private clearMicrophoneStableTimer(): void {
    if (this.microphoneStableTimerId === null) {
      return;
    }

    window.clearTimeout(this.microphoneStableTimerId);
    this.microphoneStableTimerId = null;
  }

  private releaseMic(): void {
    this.replaceLocalAudioLevelMeter(null);
    stopStream(this.localAudioStream);
    this.localAudioStream = null;
    this.localAudioTrack = null;
    for (const peer of this.peers.values()) {
      void peer.audioTransceiver?.sender
        .replaceTrack(null)
        .catch(() => undefined);
    }
    logDebug("p2p.voice", "released microphone", {
      localParticipantId: this.localParticipant.id,
    });
  }

  private replaceLocalAudioLevelMeter(
    meter: LocalAudioLevelMeter | null,
  ): void {
    if (this.localAudioLevelMeter === meter) {
      return;
    }
    this.localAudioLevelMeter?.close();
    this.localAudioLevelMeter = meter;
  }

  async handleSignal(
    fromUserId: string,
    signal: P2PSignal,
    metadata: P2PSignalMetadata = {},
  ): Promise<boolean> {
    return this.enqueuePeerOperation(fromUserId, () =>
      this.handleSignalNow(fromUserId, signal, metadata),
    );
  }

  private enqueuePeerOperation<Result>(
    remoteUserId: string,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const previous =
      this.peerOperationChains.get(remoteUserId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.peerOperationChains.set(remoteUserId, next);
    const cleanup = () => {
      if (this.peerOperationChains.get(remoteUserId) === next) {
        this.peerOperationChains.delete(remoteUserId);
      }
    };
    next.then(cleanup, cleanup);
    return next;
  }

  private async handleSignalNow(
    fromUserId: string,
    signal: P2PSignal,
    metadata: P2PSignalMetadata,
  ): Promise<boolean> {
    if (this.disposed || fromUserId === this.localParticipant.id) {
      return false;
    }

    logDebug("p2p.signal", "received", {
      localParticipantId: this.localParticipant.id,
      fromUserId,
      kind: signal.kind,
      senderConnectionId: metadata.senderConnectionId ?? null,
      senderMediaSessionId: metadata.senderMediaSessionId ?? null,
      summary: summarizeSignal(signal),
    });

    const previousSenderConnectionId =
      this.senderConnectionIdsByPeer.get(fromUserId) ?? null;
    const previousSenderMediaSessionId =
      this.senderMediaSessionIdsByPeer.get(fromUserId) ?? null;
    const incomingSenderConnectionId = metadata.senderConnectionId ?? null;
    const incomingSenderMediaSessionId = metadata.senderMediaSessionId ?? null;
    if (
      incomingSenderMediaSessionId &&
      this.retiredSenderMediaSessionIdsByPeer
        .get(fromUserId)
        ?.has(incomingSenderMediaSessionId)
    ) {
      logDebug("p2p.signal", "drop retired media session", {
        incomingSenderMediaSessionId,
        kind: signal.kind,
        localParticipantId: this.localParticipant.id,
        remoteUserId: fromUserId,
      });
      return false;
    }
    if (
      incomingSenderMediaSessionId &&
      incomingSenderMediaSessionId === previousSenderMediaSessionId &&
      incomingSenderConnectionId &&
      this.retiredSenderConnectionIdsByPeer
        .get(fromUserId)
        ?.has(incomingSenderConnectionId)
    ) {
      logDebug("p2p.signal", "drop retired transport", {
        incomingSenderConnectionId,
        incomingSenderMediaSessionId,
        kind: signal.kind,
        localParticipantId: this.localParticipant.id,
        remoteUserId: fromUserId,
      });
      return false;
    }

    const connectionDecision = decideP2PSignalConnection(
      previousSenderConnectionId,
      incomingSenderConnectionId,
      signal.kind,
      previousSenderMediaSessionId,
      incomingSenderMediaSessionId,
    );
    if (!connectionDecision.accept) {
      logDebug("p2p.signal", "drop stale sender connection", {
        currentSenderConnectionId: previousSenderConnectionId,
        currentSenderMediaSessionId: previousSenderMediaSessionId,
        incomingSenderConnectionId,
        incomingSenderMediaSessionId,
        kind: signal.kind,
        localParticipantId: this.localParticipant.id,
        reason: connectionDecision.reason,
        remoteUserId: fromUserId,
      });
      return false;
    }

    const senderConnectionChanged =
      Boolean(previousSenderConnectionId) &&
      Boolean(connectionDecision.nextSenderConnectionId) &&
      previousSenderConnectionId !== connectionDecision.nextSenderConnectionId;
    const senderMediaSessionChanged =
      Boolean(previousSenderMediaSessionId) &&
      Boolean(connectionDecision.nextSenderMediaSessionId) &&
      previousSenderMediaSessionId !==
        connectionDecision.nextSenderMediaSessionId;

    if (senderMediaSessionChanged && previousSenderMediaSessionId) {
      rememberRetiredSignalSource(
        this.retiredSenderMediaSessionIdsByPeer,
        fromUserId,
        previousSenderMediaSessionId,
      );
      this.retiredSenderConnectionIdsByPeer.delete(fromUserId);
      const existingPeer = this.peers.get(fromUserId);
      if (existingPeer) {
        existingPeer.recentSignalFingerprints.clear();
        existingPeer.pendingIceCandidates = [];
        existingPeer.remoteVideoStallSamples = 0;
      }
      this.remoteVideoStatsByPeer.delete(fromUserId);
      this.resetRemoteAudioPublicationState(fromUserId, true);
      logDebug("p2p.signal", "media session changed", {
        incomingSenderMediaSessionId,
        localParticipantId: this.localParticipant.id,
        previousSenderMediaSessionId,
        remoteUserId: fromUserId,
      });
    } else if (
      senderConnectionChanged &&
      incomingSenderMediaSessionId &&
      incomingSenderMediaSessionId === previousSenderMediaSessionId &&
      previousSenderConnectionId
    ) {
      rememberRetiredSignalSource(
        this.retiredSenderConnectionIdsByPeer,
        fromUserId,
        previousSenderConnectionId,
      );
    }

    if (
      senderConnectionChanged &&
      !incomingSenderMediaSessionId &&
      (signal.kind === "offer" || signal.kind === "voice-start")
    ) {
      logDebug("p2p.signal", "replace legacy peer for new sender connection", {
        kind: signal.kind,
        localParticipantId: this.localParticipant.id,
        previousSenderConnectionId,
        remoteUserId: fromUserId,
        senderConnectionId: connectionDecision.nextSenderConnectionId,
      });
      this.closePeer(fromUserId, false);
    }

    if (connectionDecision.nextSenderConnectionId) {
      this.senderConnectionIdsByPeer.set(
        fromUserId,
        connectionDecision.nextSenderConnectionId,
      );
    } else {
      this.senderConnectionIdsByPeer.delete(fromUserId);
    }
    if (connectionDecision.nextSenderMediaSessionId !== undefined) {
      if (connectionDecision.nextSenderMediaSessionId) {
        this.senderMediaSessionIdsByPeer.set(
          fromUserId,
          connectionDecision.nextSenderMediaSessionId,
        );
      } else {
        this.senderMediaSessionIdsByPeer.delete(fromUserId);
      }
    }

    if (signal.kind === "voice-start") {
      const pushToTalkIndicatorChanged =
        signal.voiceMode === "push-to-talk"
          ? !this.remotePushToTalkIds.has(fromUserId)
          : this.remotePushToTalkIds.has(fromUserId);
      if (signal.voiceMode === "push-to-talk") {
        this.remotePushToTalkIds.add(fromUserId);
      } else {
        this.remotePushToTalkIds.delete(fromUserId);
      }
      if (pushToTalkIndicatorChanged) {
        this.publishActiveSpeakerIds();
      }

      if (this.remoteAudioExpectedByPeer.has(fromUserId)) {
        logDebug("p2p.audio", "remote voice-start ignored", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          reason: "already-expected",
        });
        return true;
      }

      const peer = this.ensurePeer(fromUserId);
      if (typeof peer.pc.getTransceivers === "function") {
        void this.syncPeerMediaAndNegotiate(peer, "remote-voice-start", false);
      }
      this.remoteAudioExpectedByPeer.add(fromUserId);
      this.advanceRemoteAudioExpectationGeneration(fromUserId);
      this.remoteAudioExpectedAtByPeer.set(fromUserId, Date.now());
      this.remoteAudioFlowActivityByPeer.set(fromUserId, "unknown");
      this.remoteAudioStallSamplesByPeer.set(fromUserId, 0);
      this.remoteSpeakingHysteresisByPeer.set(fromUserId, {
        quietSamples: 0,
        speaking: false,
      });
      this.remoteAudioActivityByPeer.set(fromUserId, "unknown");
      logDebug("p2p.audio", "remote voice expected", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: fromUserId,
        peerConnectionState: peer.pc.connectionState,
        peerIceConnectionState: peer.pc.iceConnectionState,
      });
      this.updateAudioActivitySampler();
      return true;
    }

    if (signal.kind === "voice-stop") {
      if (
        !this.remoteAudioExpectedByPeer.has(fromUserId) &&
        !this.remotePushToTalkIds.has(fromUserId) &&
        !this.remoteSpeakingIds.has(fromUserId)
      ) {
        logDebug("p2p.audio", "remote voice-stop ignored", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          reason: "already-quiet",
        });
        return true;
      }

      this.remoteAudioExpectedByPeer.delete(fromUserId);
      this.advanceRemoteAudioExpectationGeneration(fromUserId);
      this.remoteAudioExpectedAtByPeer.delete(fromUserId);
      this.remoteAudioFlowActivityByPeer.set(fromUserId, "not-expected");
      this.remoteAudioFreshnessBaselineByPeer.delete(fromUserId);
      this.remoteAudioFreshnessRequiredByPeer.delete(fromUserId);
      this.remoteAudioStallSamplesByPeer.set(fromUserId, 0);
      this.remoteAudioActivityByPeer.set(fromUserId, "quiet");
      this.remoteSpeakingHysteresisByPeer.delete(fromUserId);
      this.remotePushToTalkIds.delete(fromUserId);
      this.remoteSpeakingIds.delete(fromUserId);
      logDebug("p2p.audio", "remote voice stopped", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: fromUserId,
      });
      this.publishActiveSpeakerIds();
      this.updateAudioActivitySampler();
      return true;
    }

    if (signal.kind === "bye") {
      this.closePeer(fromUserId, false);
      return true;
    }

    const peer = this.ensurePeer(fromUserId);
    if (senderConnectionChanged && !incomingSenderMediaSessionId) {
      peer.recentSignalFingerprints.clear();
      peer.remoteVideoStallSamples = 0;
      this.remoteVideoStatsByPeer.delete(fromUserId);
      this.remoteAudioStatsByPeer.delete(fromUserId);
      logDebug("p2p.signal", "legacy sender connection changed", {
        localParticipantId: this.localParticipant.id,
        previousSenderConnectionId,
        remoteUserId: fromUserId,
        senderConnectionId: connectionDecision.nextSenderConnectionId,
      });
    } else if (senderConnectionChanged) {
      logDebug("p2p.signal", "signaling transport changed", {
        localParticipantId: this.localParticipant.id,
        previousSenderConnectionId,
        remoteUserId: fromUserId,
        senderConnectionId: connectionDecision.nextSenderConnectionId,
        senderMediaSessionId: incomingSenderMediaSessionId,
      });
    }

    if (signal.kind === "restart-ice") {
      if (this.shouldInitiateOffers(peer)) {
        void this.restartPeerIce(peer, "remote-request");
      } else {
        logDebug("p2p.ice", "ignored restart request on answerer side", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
        });
      }
      return true;
    }

    if (signal.kind === "renegotiate") {
      if (this.shouldInitiateOffers(peer)) {
        await this.recoverPeerNegotiation(peer, "remote-renegotiate", true);
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
      return true;
    }

    const dedupeKey = createP2PMediaSignalDedupeKey(fromUserId, signal);
    if (
      hasRecentP2PMediaSignalFingerprint(
        peer.recentSignalFingerprints,
        dedupeKey,
        Date.now(),
      )
    ) {
      logDebug("p2p.signal", "drop duplicate media signal", {
        localParticipantId: this.localParticipant.id,
        fromUserId,
        kind: signal.kind,
        fingerprint: dedupeKey,
      });
      return false;
    }

    try {
      if (signal.kind === "ice") {
        if (!peer.pc.remoteDescription) {
          const alreadyQueued = peer.pendingIceCandidates.some(
            (candidate) =>
              createP2PMediaSignalDedupeKey(fromUserId, {
                kind: "ice",
                candidate,
              }) === dedupeKey,
          );
          if (!alreadyQueued) {
            peer.pendingIceCandidates = [
              ...peer.pendingIceCandidates,
              signal.candidate,
            ].slice(-40);
          }
          logDebug(
            "p2p.ice",
            "queued remote candidate before remote description",
            {
              localParticipantId: this.localParticipant.id,
              remoteUserId: fromUserId,
              candidateType: getCandidateType(signal.candidate.candidate),
              queued: peer.pendingIceCandidates.length,
              duplicatePending: alreadyQueued,
            },
          );
          return true;
        }

        await peer.pc.addIceCandidate(signal.candidate);
        rememberP2PMediaSignalFingerprint(
          peer.recentSignalFingerprints,
          dedupeKey,
          Date.now(),
        );
        logDebug("p2p.ice", "added remote candidate", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          candidateType: getCandidateType(signal.candidate.candidate),
        });
        return true;
      }

      const description: RTCSessionDescriptionInit = signal.sdp;
      if (
        description.type === "answer" &&
        peer.pc.signalingState !== "have-local-offer"
      ) {
        logDebug("p2p.signal", "drop stale answer", {
          localParticipantId: this.localParticipant.id,
          fromUserId,
          signalingState: peer.pc.signalingState,
        });
        return false;
      }
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
        return false;
      }

      peer.isSettingRemoteAnswerPending = description.type === "answer";
      try {
        await peer.pc.setRemoteDescription(description);
        rememberP2PMediaSignalFingerprint(
          peer.recentSignalFingerprints,
          dedupeKey,
          Date.now(),
        );
        if (description.type === "answer") {
          peer.signalingRecoveryNeeded = false;
        }
        logDebug("p2p.sdp", "set remote description", {
          localParticipantId: this.localParticipant.id,
          remoteUserId: fromUserId,
          type: description.type,
          summary: summarizeP2PSdp(description.sdp ?? ""),
        });
        await this.flushPendingIceCandidates(peer);
      } finally {
        peer.isSettingRemoteAnswerPending = false;
      }

      if (description.type === "offer") {
        peer.signalingRecoveryNeeded =
          (await this.createAndSendAnswer(peer)) !== "sent";
      }
      return true;
    } catch (error) {
      if (peer.ignoreOffer) {
        return false;
      }

      if (peer.pc.signalingState === "have-remote-offer") {
        peer.signalingRecoveryNeeded = true;
      }

      logDebug("p2p.signal", "failed", {
        localParticipantId: this.localParticipant.id,
        fromUserId,
        kind: signal.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getStats(): Promise<P2PMediaDiagnostics> {
    const peers = await Promise.all(
      Array.from(this.peers.values()).map(async (peer) => {
        let stats: Record<string, unknown> = {};
        let statsStatus: P2PMediaPeerDiagnostics["statsStatus"] = "available";
        try {
          stats = summarizeStats(await peer.pc.getStats());
        } catch {
          statsStatus = "unavailable";
        }
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
          remoteAudioExpected: this.remoteAudioExpectedByPeer.has(
            peer.remoteUserId,
          ),
          remoteAudioActivity:
            this.remoteAudioActivityByPeer.get(peer.remoteUserId) ?? "unknown",
          remoteAudioFlowActivity:
            this.remoteAudioFlowActivityByPeer.get(peer.remoteUserId) ??
            "unknown",
          remoteVideoActivity:
            this.remoteVideoActivityByPeer.get(peer.remoteUserId) ?? "unknown",
          participantAudioOutput: {
            ...(this.participantAudioOutputPreferences.get(peer.remoteUserId) ??
              getDefaultParticipantAudioPreference()),
          },
          statsStatus,
          stats,
        };
      }),
    );

    return {
      microphonePublishingWanted: this.microphonePublishingWanted,
      microphonePublishing: this.microphonePublishing,
      localSpeaking: this.localSpeaking,
      remoteAudioExpectedIds: [...this.remoteAudioExpectedByPeer].sort(),
      peers,
    };
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

    if (activity === "stalled") {
      peer.remoteVideoStallSamples += 1;
      logDebug("p2p.video", "remote video stalled", {
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
        peer.remoteVideoStallSamples <
        P2P_VIDEO_STALL_SAMPLES_BEFORE_RECOVERY
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
      void this.restartPeerIce(peer, "media-stall:video-stalled");
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
    logDebug("p2p.video", "recover missing remote video", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      activity,
      reason: "video-missing",
    });
    this.queueNegotiation(peer, `media-missing:${activity}`);
  }

  private updateAudioActivitySampler(): void {
    const shouldRun =
      !this.disposed &&
      (this.microphonePublishing || this.remoteAudioExpectedByPeer.size > 0);

    if (shouldRun && this.audioActivityTimerId === null) {
      this.audioActivityTimerId = window.setInterval(() => {
        void this.sampleAudioActivity();
      }, P2P_AUDIO_ACTIVITY_SAMPLE_INTERVAL_MS);
      return;
    }

    if (!shouldRun && this.audioActivityTimerId !== null) {
      window.clearInterval(this.audioActivityTimerId);
      this.audioActivityTimerId = null;
    }
  }

  private async sampleAudioActivity(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      await Promise.all([
        this.sampleLocalAudioActivity(),
        ...Array.from(this.remoteAudioExpectedByPeer, (remoteUserId) =>
          this.sampleRemoteAudioActivity(remoteUserId),
        ),
      ]);
    } finally {
      this.updateAudioActivitySampler();
    }
  }

  private async sampleLocalAudioActivity(): Promise<void> {
    if (this.localAudioActivitySampling) {
      return;
    }

    this.localAudioActivitySampling = true;
    try {
      await this.sampleLocalAudioActivityOnce();
    } finally {
      this.localAudioActivitySampling = false;
    }
  }

  private async sampleLocalAudioActivityOnce(): Promise<void> {
    const track = this.localAudioTrack;
    if (
      !this.microphonePublishing ||
      !track ||
      track.readyState !== "live" ||
      !track.enabled
    ) {
      this.clearLocalSpeaking();
      return;
    }

    const sender = Array.from(this.peers.values())
      .map((peer) => peer.audioTransceiver?.sender)
      .find(
        (candidate): candidate is RTCRtpSender =>
          Boolean(
            candidate?.track &&
              candidate.track.kind === "audio" &&
              candidate.track.id === track.id,
          ),
      );
    const localAudioLevelMeter =
      this.localAudioLevelMeter?.track === track
        ? this.localAudioLevelMeter
        : null;
    if (!sender && !localAudioLevelMeter) {
      this.clearLocalSpeaking();
      return;
    }

    let current: AudioActivityStats | undefined;
    if (sender) {
      try {
        const stats = summarizeStats(await sender.getStats());
        current = stats.audioSource as AudioActivityStats | undefined;
      } catch {
        current = undefined;
      }
    }

    if (current?.audioLevel === undefined && localAudioLevelMeter) {
      const audioLevel = localAudioLevelMeter.sample();
      current =
        audioLevel === undefined
          ? undefined
          : {
              audioLevel,
            };
    }

    if (
      this.disposed ||
      !this.microphonePublishing ||
      this.localAudioTrack !== track ||
      track.readyState !== "live" ||
      !track.enabled
    ) {
      return;
    }

    const activity = classifyAudioSpeechActivity(current);
    const next = updateSpeakingHysteresis(
      this.localSpeakingHysteresis,
      activity,
    );
    this.localSpeakingHysteresis = next;
    if (this.localSpeaking !== next.speaking) {
      this.localSpeaking = next.speaking;
      this.publishActiveSpeakerIds();
    }
  }

  private async sampleRemoteAudioActivity(
    remoteUserId: string,
  ): Promise<void> {
    const peer = this.peers.get(remoteUserId);
    if (!peer) {
      return;
    }

    if (this.remoteAudioActivitySamplingByPeer.get(remoteUserId) === peer) {
      return;
    }

    this.remoteAudioActivitySamplingByPeer.set(remoteUserId, peer);
    try {
      await this.sampleRemoteAudioActivityOnce(remoteUserId);
    } finally {
      if (this.remoteAudioActivitySamplingByPeer.get(remoteUserId) === peer) {
        this.remoteAudioActivitySamplingByPeer.delete(remoteUserId);
      }
    }
  }

  private async sampleRemoteAudioActivityOnce(
    remoteUserId: string,
  ): Promise<void> {
    const peer = this.peers.get(remoteUserId);
    if (!peer || !this.remoteAudioExpectedByPeer.has(remoteUserId)) {
      return;
    }
    const expectationGeneration =
      this.remoteAudioExpectationGenerationByPeer.get(remoteUserId) ?? 0;

    let current: AudioActivityStats | undefined;
    const receiver = peer.audioTransceiver?.receiver;
    try {
      const stats = receiver
        ? summarizeStats(await receiver.getStats())
        : {};
      current = stats.audioInbound as AudioActivityStats | undefined;
    } catch {
      current = undefined;
    }

    if (
      this.disposed ||
      this.peers.get(remoteUserId) !== peer ||
      !this.remoteAudioExpectedByPeer.has(remoteUserId) ||
      this.remoteAudioExpectationGenerationByPeer.get(remoteUserId) !==
        expectationGeneration
    ) {
      return;
    }

    const previous = this.remoteAudioStatsByPeer.get(remoteUserId);
    if (current) {
      this.remoteAudioStatsByPeer.set(remoteUserId, {
        audioLevel: current.audioLevel,
        bytesReceived: current.bytesReceived,
        jitter: current.jitter,
        packetsReceived: current.packetsReceived,
      });
    }

    const element = this.audioElementsByParticipant.get(remoteUserId);
    const receiverTrack = getAudioTrackFromElement(element);
    const flowActivity = classifyAudioTransportFlow({
      connectionState: peer.pc.connectionState,
      current,
      expected: true,
      previous,
      receiverTrackMuted: receiverTrack?.muted ?? false,
      receiverTrackState: receiverTrack?.readyState ?? "missing",
    });
    this.updateRemoteAudioFlowActivity(
      peer,
      flowActivity,
      current,
    );

    const freshForSpeech = this.acceptRemoteAudioStatsFreshness(
      remoteUserId,
      current,
    );
    const speechActivity = freshForSpeech
      ? classifyAudioSpeechActivity(current)
      : "unknown";
    this.remoteAudioActivityByPeer.set(remoteUserId, speechActivity);
    const previousHysteresis =
      this.remoteSpeakingHysteresisByPeer.get(remoteUserId) ?? {
        quietSamples: 0,
        speaking: false,
      };
    const nextHysteresis = updateSpeakingHysteresis(
      previousHysteresis,
      speechActivity,
    );
    this.remoteSpeakingHysteresisByPeer.set(
      remoteUserId,
      nextHysteresis,
    );

    const wasPublishedAsSpeaking = this.remoteSpeakingIds.has(remoteUserId);
    if (nextHysteresis.speaking) {
      this.remoteSpeakingIds.add(remoteUserId);
    } else {
      this.remoteSpeakingIds.delete(remoteUserId);
    }
    if (wasPublishedAsSpeaking !== nextHysteresis.speaking) {
      logDebug(
        "p2p.audio",
        nextHysteresis.speaking
          ? "remote activity detected"
          : "remote activity quiet",
        {
          localParticipantId: this.localParticipant.id,
          remoteUserId,
          quietSamples: nextHysteresis.quietSamples,
          source: "audio-sampler",
          stats: current ?? null,
        },
      );
      this.publishActiveSpeakerIds();
    }
  }

  private updateRemoteAudioFlowActivity(
    peer: P2PPeer,
    flowActivity: AudioTransportFlow,
    current: AudioActivityStats | undefined,
  ): void {
    const previousFlowActivity =
      this.remoteAudioFlowActivityByPeer.get(peer.remoteUserId);
    this.remoteAudioFlowActivityByPeer.set(peer.remoteUserId, flowActivity);

    const now = Date.now();
    if (
      previousFlowActivity !== flowActivity ||
      now - peer.lastAudioFlowLogAt >= P2P_AUDIO_FLOW_LOG_INTERVAL_MS
    ) {
      peer.lastAudioFlowLogAt = now;
      logDebug("p2p.audio", "remote flow sample", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        activity: flowActivity,
        connectionState: peer.pc.connectionState,
        iceConnectionState: peer.pc.iceConnectionState,
        stats: current ?? null,
      });
    }

    if (flowActivity === "flowing" || flowActivity === "not-expected") {
      this.remoteAudioStallSamplesByPeer.set(peer.remoteUserId, 0);
      return;
    }

    if (flowActivity === "unknown") {
      return;
    }

    const expectedAt =
      this.remoteAudioExpectedAtByPeer.get(peer.remoteUserId) ?? now;
    if (now - expectedAt < P2P_AUDIO_RECOVERY_GRACE_MS) {
      this.remoteAudioStallSamplesByPeer.set(peer.remoteUserId, 0);
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

  private acceptRemoteAudioStatsFreshness(
    remoteUserId: string,
    current: AudioActivityStats | undefined,
  ): boolean {
    if (!this.remoteAudioFreshnessRequiredByPeer.has(remoteUserId)) {
      return true;
    }

    if (!current) {
      return false;
    }

    const baseline =
      this.remoteAudioFreshnessBaselineByPeer.get(remoteUserId);
    if (!baseline) {
      this.remoteAudioFreshnessBaselineByPeer.set(remoteUserId, current);
      return false;
    }

    if (!audioActivityStatsChanged(baseline, current)) {
      return false;
    }

    this.remoteAudioFreshnessRequiredByPeer.delete(remoteUserId);
    this.remoteAudioFreshnessBaselineByPeer.delete(remoteUserId);
    return true;
  }

  private resetRemoteAudioPublicationState(
    remoteUserId: string,
    requireFreshStats = false,
  ): void {
    const previousStats = this.remoteAudioStatsByPeer.get(remoteUserId);
    if (requireFreshStats) {
      this.remoteAudioFreshnessRequiredByPeer.add(remoteUserId);
      if (previousStats) {
        this.remoteAudioFreshnessBaselineByPeer.set(
          remoteUserId,
          previousStats,
        );
      } else {
        this.remoteAudioFreshnessBaselineByPeer.delete(remoteUserId);
      }
    } else {
      this.remoteAudioFreshnessRequiredByPeer.delete(remoteUserId);
      this.remoteAudioFreshnessBaselineByPeer.delete(remoteUserId);
    }
    this.remoteAudioExpectedByPeer.delete(remoteUserId);
    this.advanceRemoteAudioExpectationGeneration(remoteUserId);
    this.remoteAudioExpectedAtByPeer.delete(remoteUserId);
    this.remoteAudioActivityByPeer.set(remoteUserId, "quiet");
    this.remoteAudioFlowActivityByPeer.set(remoteUserId, "not-expected");
    this.remoteAudioStatsByPeer.delete(remoteUserId);
    this.remoteAudioStallSamplesByPeer.set(remoteUserId, 0);
    this.remoteSpeakingHysteresisByPeer.delete(remoteUserId);
    const pushToTalkChanged =
      this.remotePushToTalkIds.delete(remoteUserId);
    const measuredSpeakingChanged =
      this.remoteSpeakingIds.delete(remoteUserId);
    const speakingChanged = pushToTalkChanged || measuredSpeakingChanged;
    if (speakingChanged) {
      this.publishActiveSpeakerIds();
    }
    this.updateAudioActivitySampler();
  }

  private advanceRemoteAudioExpectationGeneration(
    remoteUserId: string,
  ): number {
    const next =
      (this.remoteAudioExpectationGenerationByPeer.get(remoteUserId) ?? 0) + 1;
    this.remoteAudioExpectationGenerationByPeer.set(remoteUserId, next);
    return next;
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

  async handleSignalingTransportReady(
    ready: SignalingTransportReady,
  ): Promise<void> {
    if (
      this.disposed ||
      this.lastSignalingTransportReadyId === ready.senderConnectionId
    ) {
      return;
    }

    this.lastSignalingTransportReadyId = ready.senderConnectionId;
    logDebug("p2p.lifecycle", "signaling transport ready", {
      localParticipantId: this.localParticipant.id,
      mediaSessionId: this.mediaSessionId,
      peerCount: this.peers.size,
      reconnect: ready.reconnect,
      senderConnectionId: ready.senderConnectionId,
    });

    // The Worker snapshot is authoritative and can reset ephemeral camera state
    // during a rejoin. Republish actual local intent only after that snapshot.
    this.onCameraStatus(this.publicCameraEnabled);
    this.sendMicrophonePublicationStateToAll(
      this.isMicrophonePublicationExpected(),
      true,
    );

    if (!ready.reconnect) {
      return;
    }

    await Promise.all(
      Array.from(this.peers.values()).map((peer) =>
        this.enqueuePeerOperation(peer.remoteUserId, async () => {
          if (
            this.disposed ||
            this.peers.get(peer.remoteUserId) !== peer ||
            peer.lastSignalingRecoveryConnectionId === ready.senderConnectionId
          ) {
            return;
          }
          peer.lastSignalingRecoveryConnectionId = ready.senderConnectionId;
          await this.recoverPeerNegotiation(
            peer,
            `signaling-transport:${ready.senderConnectionId}`,
            ready.forceMediaResync === true,
          );
        }),
      ),
    );
  }

  private async recoverPeerNegotiation(
    peer: P2PPeer,
    reason: string,
    forceOffer: boolean,
  ): Promise<void> {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return;
    }

    if (peer.pc.signalingState === "have-remote-offer") {
      try {
        peer.signalingRecoveryNeeded =
          (await this.createAndSendAnswer(peer)) !== "sent";
      } catch (error) {
        peer.signalingRecoveryNeeded = true;
        logDebug("p2p.negotiation", "answer recovery failed", {
          error: error instanceof Error ? error.message : String(error),
          localParticipantId: this.localParticipant.id,
          reason,
          remoteUserId: peer.remoteUserId,
        });
      }
      return;
    }

    if (peer.pc.signalingState === "have-local-offer" && !peer.makingOffer) {
      await this.replacePeerForNegotiationRecovery(peer, reason);
      return;
    }

    if (peer.pc.signalingState !== "stable") {
      logDebug("p2p.negotiation", "recovery deferred for active signaling", {
        localParticipantId: this.localParticipant.id,
        reason,
        remoteUserId: peer.remoteUserId,
        signalingState: peer.pc.signalingState,
      });
      return;
    }

    const healthy =
      peer.pc.connectionState === "connected" &&
      peer.pc.iceConnectionState === "connected";
    if (healthy && !forceOffer && !peer.signalingRecoveryNeeded) {
      return;
    }

    await this.syncPeerMedia(peer);
    if (this.shouldInitiateOffers(peer)) {
      await this.createAndSendOffer(peer);
      return;
    }

    peer.signalingRecoveryNeeded =
      this.requestRemoteRenegotiation(peer, reason, true) !== "sent";
  }

  private async replacePeerForNegotiationRecovery(
    peer: P2PPeer,
    reason: string,
  ): Promise<void> {
    await peer.mediaSyncChain;
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return;
    }

    const remoteUserId = peer.remoteUserId;
    logDebug("p2p.negotiation", "replace peer with stale local offer", {
      localParticipantId: this.localParticipant.id,
      reason,
      remoteUserId,
    });
    this.closePeer(remoteUserId, true, true);
    const replacement = this.ensurePeer(remoteUserId);
    // `bye` clears the remote publication expectation. The replacement peer
    // must therefore announce the current state again, even though the local
    // publication intent itself survived the technical peer rebuild.
    this.microphonePublicationModeByPeer.delete(remoteUserId);
    if (this.isMicrophonePublicationExpected()) {
      this.sendMicrophonePublicationState(remoteUserId, true, true);
    }
    await this.syncPeerMedia(replacement);
    if (this.shouldInitiateOffers(replacement)) {
      await this.createAndSendOffer(replacement);
      return;
    }

    replacement.signalingRecoveryNeeded =
      this.requestRemoteRenegotiation(
        replacement,
        `${reason}:replacement`,
        true,
      ) !== "sent";
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

  hasPeer(remoteUserId: string): boolean {
    const peer = this.peers.get(remoteUserId);
    return Boolean(peer && peer.pc.signalingState !== "closed");
  }

  isRemoteVoicePublishing(remoteUserId: string): boolean {
    return this.remoteAudioExpectedByPeer.has(remoteUserId);
  }

  disconnect(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.cameraIntentGeneration += 1;
    this.microphoneIntentGeneration += 1;
    this.wantsCamera = false;
    this.microphonePublishingWanted = false;
    this.microphonePublishing = false;
    this.cameraStartingGeneration = null;
    this.microphoneStartingGeneration = null;
    this.clearCameraReacquireTimer();
    this.clearCameraStableTimer();
    this.clearMicrophoneReacquireTimer();
    this.clearMicrophoneStableTimer();
    this.clearMicReleaseTimer();
    if (this.reconcileTimerId !== null) {
      window.clearInterval(this.reconcileTimerId);
      this.reconcileTimerId = null;
    }
    if (this.audioActivityTimerId !== null) {
      window.clearInterval(this.audioActivityTimerId);
      this.audioActivityTimerId = null;
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
    this.peerOperationChains.clear();
    this.senderConnectionIdsByPeer.clear();
    this.senderMediaSessionIdsByPeer.clear();
    this.retiredSenderConnectionIdsByPeer.clear();
    this.retiredSenderMediaSessionIdsByPeer.clear();
    this.lastSignalingTransportReadyId = null;

    this.replaceLocalAudioLevelMeter(null);
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
    this.remotePushToTalkIds.clear();
    this.remoteSpeakingIds.clear();
    this.remoteAudioExpectationGenerationByPeer.clear();
    this.remoteAudioActivityByPeer.clear();
    this.remoteAudioActivitySamplingByPeer.clear();
    this.remoteAudioExpectedByPeer.clear();
    this.remoteAudioExpectedAtByPeer.clear();
    this.remoteAudioFlowActivityByPeer.clear();
    this.remoteAudioFreshnessBaselineByPeer.clear();
    this.remoteAudioFreshnessRequiredByPeer.clear();
    this.remoteAudioStatsByPeer.clear();
    this.remoteAudioStallSamplesByPeer.clear();
    this.remoteSpeakingHysteresisByPeer.clear();
    this.remoteVideoActivityByPeer.clear();
    this.remoteVideoStatsByPeer.clear();
    this.localSpeaking = false;
    this.localSpeakingHysteresis = {
      quietSamples: 0,
      speaking: false,
    };
    this.onVideosChange([]);
    this.publishActiveSpeakerIds();
    this.cameraState = "off";
    this.setPublicCameraEnabled(false, "disconnect");
    this.onMicrophoneStatusChange("off");
    this.onVoiceMessageChange(null);
  }

  private ensurePeer(remoteUserId: string): P2PPeer {
    const existing = this.peers.get(remoteUserId);
    if (existing) {
      // Any renewed use of the peer (participant re-published, signal arrived)
      // aborts a pending linger close.
      this.clearPeerLingerTimer(existing);
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
      lastCandidatePairLogKey: null,
      lastAudioFlowLogAt: 0,
      lastAudioStallRecoveryAt: 0,
      lastIceRestartAt: 0,
      lastIceRestartRequestAt: 0,
      lastRenegotiationRequestAt: 0,
      lastSignalingRecoveryConnectionId: null,
      lastMediaStallRecoveryAt: 0,
      makingOffer: false,
      mediaSyncChain: Promise.resolve(),
      mediaSyncPendingCount: 0,
      mediaSyncing: false,
      negotiationQueued: false,
      needsNegotiation: false,
      pendingCloseTimerId: null,
      pendingIceCandidates: [],
      pc,
      polite: isPoliteP2PPeer(this.localParticipant.id, remoteUserId),
      recentSignalFingerprints: new Map(),
      renegotiationRetryTimerId: null,
      remoteVideoExpected: false,
      remoteVideoStallSamples: 0,
      remoteUserId,
      signalingRecoveryNeeded: false,
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
        this.remoteSpeakingHysteresisByPeer.set(remoteUserId, {
          quietSamples: 0,
          speaking: false,
        });
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
        peer.remoteVideoStallSamples = 0;
        this.remoteVideoActivityByPeer.set(remoteUserId, "unknown");
        this.remoteVideoStatsByPeer.delete(remoteUserId);
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
        this.applyParticipantAudioOutput(remoteUserId, element);
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

    const changed = await this.syncPeerMedia(peer);
    // An offer attempt can be deferred while sender/transceiver state is being
    // synchronized. Drain that request as soon as the sync releases the peer;
    // otherwise no signaling-state event is guaranteed to wake it up again.
    if (forceOffer || changed || peer.needsNegotiation) {
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

    return this.enqueuePeerMediaMutation(peer, () =>
      this.syncPeerMediaNow(peer),
    );
  }

  private async enqueuePeerMediaMutation<T>(
    peer: P2PPeer,
    mutation: () => Promise<T>,
  ): Promise<T> {
    peer.mediaSyncPendingCount += 1;
    peer.mediaSyncing = true;
    const queuedMutation = peer.mediaSyncChain
      .catch(() => undefined)
      .then(mutation);
    peer.mediaSyncChain = queuedMutation.then(
      () => undefined,
      () => undefined,
    );

    try {
      return await queuedMutation;
    } finally {
      peer.mediaSyncPendingCount = Math.max(
        0,
        peer.mediaSyncPendingCount - 1,
      );
      peer.mediaSyncing = peer.mediaSyncPendingCount > 0;
      if (!peer.mediaSyncing && peer.needsNegotiation) {
        this.queueNegotiation(peer, "media-sync-drain");
      }
    }
  }

  private async syncPeerMediaNow(peer: P2PPeer): Promise<boolean> {
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

    const videoPlan = planP2PVideoSenderSync({
      cameraState: this.cameraState,
      hasLocalVideoTrack: Boolean(this.localVideoTrack),
      publicCameraEnabled: this.publicCameraEnabled,
      wantsCamera: this.wantsCamera,
    });
    if (this.localVideoTrack) {
      if (videoTransceiver.sender.track !== this.localVideoTrack) {
        await videoTransceiver.sender.replaceTrack(this.localVideoTrack);
      }
    } else if (
      videoPlan.replaceTrackWithNull &&
      videoTransceiver.sender.track !== null
    ) {
      await videoTransceiver.sender.replaceTrack(null);
    }
    if (videoTransceiver.direction !== videoPlan.desiredDirection) {
      videoTransceiver.direction = videoPlan.desiredDirection;
      negotiationNeeded = true;
    }
    await configureSender(videoTransceiver.sender, P2P_VIDEO_BITRATE_BPS, 12);

    if (audioTransceiver.sender.track !== this.localAudioTrack) {
      await audioTransceiver.sender.replaceTrack(this.localAudioTrack);
      logDebug("p2p.media", "audio sender track changed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        hasAudioTrack: Boolean(this.localAudioTrack),
        audioTrackEnabled: this.localAudioTrack?.enabled ?? false,
        audioTrackState: this.localAudioTrack?.readyState ?? null,
      });
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
        mediaSyncPendingCount: peer.mediaSyncPendingCount,
        signalingState: peer.pc.signalingState,
        makingOffer: peer.makingOffer,
      });
      return;
    }

    if (!this.shouldInitiateOffers(peer)) {
      peer.needsNegotiation =
        this.requestRemoteRenegotiation(peer, _reason) !== "sent";
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
      peer.needsNegotiation =
        this.requestRemoteRenegotiation(peer, "offer-attempt") !== "sent";
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
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(prepareP2PLocalDescription(offer));
      logDebug("p2p.sdp", "created local description", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        type: peer.pc.localDescription?.type,
        summary: summarizeP2PSdp(peer.pc.localDescription?.sdp ?? ""),
      });
      const disposition = this.sendLocalDescription(peer);
      peer.signalingRecoveryNeeded = disposition !== "sent";
      if (disposition !== "sent") {
        peer.needsNegotiation = true;
      }
    } catch (error) {
      logDebug("p2p.negotiation", "offer failed", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      peer.makingOffer = false;
    }
  }

  private async createAndSendAnswer(
    peer: P2PPeer,
  ): Promise<RoomSendDisposition> {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState !== "have-remote-offer"
    ) {
      return "dropped";
    }

    await this.syncPeerMedia(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(prepareP2PLocalDescription(answer));
    logDebug("p2p.sdp", "created answer", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      summary: summarizeP2PSdp(peer.pc.localDescription?.sdp ?? ""),
    });
    const disposition = this.sendLocalDescription(peer);
    if (disposition !== "dropped") {
      peer.needsNegotiation = false;
      this.clearPeerRenegotiationRetryTimer(peer);
    }
    return disposition;
  }

  private sendLocalDescription(peer: P2PPeer): RoomSendDisposition {
    if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
      return "dropped";
    }

    const description = peer.pc.localDescription;
    if (
      !description ||
      (description.type !== "offer" && description.type !== "answer")
    ) {
      return "dropped";
    }

    if (description.type === "offer") {
      logDebug("p2p.signal", "send offer", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
        summary: summarizeP2PSdp(description.sdp),
      });
      return this.sendSignal(peer.remoteUserId, {
        kind: "offer",
        sdp: { type: "offer", sdp: description.sdp },
      });
    }

    logDebug("p2p.signal", "send answer", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      summary: summarizeP2PSdp(description.sdp),
    });
    return this.sendSignal(peer.remoteUserId, {
      kind: "answer",
      sdp: { type: "answer", sdp: description.sdp },
    });
  }

  private async stopCamera(): Promise<void> {
    this.cameraIntentGeneration += 1;
    this.wantsCamera = false;
    this.cameraStartingGeneration = null;
    this.clearCameraReacquireTimer();
    this.clearCameraStableTimer();
    this.cameraFailureTimestamps = [];
    this.cameraState = "off";
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

    this.setPublicCameraEnabled(false, "camera-stop");
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
    this.remoteSpeakingHysteresisByPeer.delete(participantId);
    if (this.remoteSpeakingIds.delete(participantId)) {
      this.publishActiveSpeakerIds();
    }
  }

  private applyParticipantAudioOutput(
    participantId: string,
    element: HTMLAudioElement,
  ): void {
    const preference =
      this.participantAudioOutputPreferences.get(participantId) ??
      getDefaultParticipantAudioPreference();
    element.volume = preference.volume;
    element.muted = preference.muted;
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

  private clearLocalSpeaking(): void {
    const changed = this.localSpeaking;
    this.localSpeaking = false;
    this.localSpeakingHysteresis = {
      quietSamples: 0,
      speaking: false,
    };
    if (changed) {
      this.publishActiveSpeakerIds();
    }
  }

  private publishActiveSpeakerIds(): void {
    const activeSpeakerIds = new Set(this.remoteSpeakingIds);
    for (const participantId of this.remotePushToTalkIds) {
      activeSpeakerIds.add(participantId);
    }
    if (this.localSpeaking) {
      activeSpeakerIds.add(this.localParticipant.id);
    }
    this.onActiveSpeakerIdsChange(Array.from(activeSpeakerIds));
  }

  /**
   * The participant stopped publishing toward us (camera off, voice released)
   * or silently left. Stop expecting their video right away, but keep the
   * connection warm for the linger window so the next camera toggle or
   * push-to-talk reuses it. The media elements stay too: a reused peer never
   * re-fires ontrack, so removing them here would orphan resumed media — the
   * UI already hides the bubble via the participant's cameraEnabled flag, and
   * closePeer cleans the elements up when the linger expires.
   */
  private schedulePeerLingerClose(peer: P2PPeer): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed" ||
      peer.pendingCloseTimerId !== null
    ) {
      return;
    }

    peer.remoteVideoExpected = false;
    peer.remoteVideoStallSamples = 0;
    this.remoteVideoActivityByPeer.set(peer.remoteUserId, "not-expected");
    this.remoteVideoStatsByPeer.delete(peer.remoteUserId);
    logDebug("p2p.peer", "schedule linger close", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      lingerMs: P2P_IDLE_PEER_LINGER_MS,
    });
    peer.pendingCloseTimerId = window.setTimeout(() => {
      peer.pendingCloseTimerId = null;
      if (this.disposed || this.peers.get(peer.remoteUserId) !== peer) {
        return;
      }

      logDebug("p2p.peer", "close idle participant after linger", {
        localParticipantId: this.localParticipant.id,
        remoteUserId: peer.remoteUserId,
      });
      this.closePeer(peer.remoteUserId, false);
    }, P2P_IDLE_PEER_LINGER_MS);
  }

  private clearPeerLingerTimer(peer: P2PPeer): void {
    if (peer.pendingCloseTimerId === null) {
      return;
    }

    window.clearTimeout(peer.pendingCloseTimerId);
    peer.pendingCloseTimerId = null;
  }

  private closePeer(
    remoteUserId: string,
    notifyRemote: boolean,
    preserveSignalSource = false,
  ): void {
    const peer = this.peers.get(remoteUserId);
    if (!peer) {
      return;
    }

    if (notifyRemote) {
      this.sendSignal(remoteUserId, { kind: "bye" });
    }

    this.peers.delete(remoteUserId);
    if (!preserveSignalSource) {
      this.microphonePublicationModeByPeer.delete(remoteUserId);
    }
    this.clearPeerDisconnectTimer(peer);
    this.clearPeerLingerTimer(peer);
    this.clearPeerRenegotiationRetryTimer(peer);
    peer.pc.close();
    if (!preserveSignalSource) {
      this.senderConnectionIdsByPeer.delete(remoteUserId);
      this.senderMediaSessionIdsByPeer.delete(remoteUserId);
      this.retiredSenderConnectionIdsByPeer.delete(remoteUserId);
      this.retiredSenderMediaSessionIdsByPeer.delete(remoteUserId);
    }
    this.removeVideo(remoteUserId);
    this.removeAudio(remoteUserId);
    this.remotePushToTalkIds.delete(remoteUserId);
    this.remoteSpeakingIds.delete(remoteUserId);
    this.remoteAudioExpectationGenerationByPeer.delete(remoteUserId);
    this.remoteAudioActivityByPeer.delete(remoteUserId);
    this.remoteAudioActivitySamplingByPeer.delete(remoteUserId);
    this.remoteAudioExpectedByPeer.delete(remoteUserId);
    this.remoteAudioExpectedAtByPeer.delete(remoteUserId);
    this.remoteAudioFlowActivityByPeer.delete(remoteUserId);
    this.remoteAudioFreshnessBaselineByPeer.delete(remoteUserId);
    this.remoteAudioFreshnessRequiredByPeer.delete(remoteUserId);
    this.remoteAudioStatsByPeer.delete(remoteUserId);
    this.remoteAudioStallSamplesByPeer.delete(remoteUserId);
    this.remoteSpeakingHysteresisByPeer.delete(remoteUserId);
    this.remoteVideoActivityByPeer.delete(remoteUserId);
    this.remoteVideoStatsByPeer.delete(remoteUserId);
    this.publishActiveSpeakerIds();
    this.updateAudioActivitySampler();
  }

  private async flushPendingIceCandidates(peer: P2PPeer): Promise<void> {
    if (!peer.pc.remoteDescription || !peer.pendingIceCandidates.length) {
      return;
    }

    const pending = peer.pendingIceCandidates;
    peer.pendingIceCandidates = [];
    for (const candidate of pending) {
      try {
        await peer.pc.addIceCandidate(candidate);
        rememberP2PMediaSignalFingerprint(
          peer.recentSignalFingerprints,
          createP2PMediaSignalDedupeKey(peer.remoteUserId, {
            kind: "ice",
            candidate,
          }),
          Date.now(),
        );
      } catch (error) {
        logDebug("p2p.ice", "queued candidate failed", {
          error: error instanceof Error ? error.message : String(error),
          localParticipantId: this.localParticipant.id,
          remoteUserId: peer.remoteUserId,
        });
      }
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

  private requestRemoteRenegotiation(
    peer: P2PPeer,
    reason: string,
    force = false,
  ): RoomSendDisposition {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed"
    ) {
      return "dropped";
    }

    const now = Date.now();
    if (
      !force &&
      now - peer.lastRenegotiationRequestAt <
        P2P_RENEGOTIATE_REQUEST_COOLDOWN_MS
    ) {
      const retryAfterMs =
        P2P_RENEGOTIATE_REQUEST_COOLDOWN_MS -
        (now - peer.lastRenegotiationRequestAt);
      this.schedulePeerRenegotiationRetry(peer, reason, retryAfterMs);
      return "queued";
    }

    this.clearPeerRenegotiationRetryTimer(peer);
    peer.lastRenegotiationRequestAt = now;
    logDebug("p2p.negotiation", "request remote renegotiate", {
      localParticipantId: this.localParticipant.id,
      remoteUserId: peer.remoteUserId,
      reason,
    });
    return this.sendSignal(peer.remoteUserId, { kind: "renegotiate" });
  }

  private schedulePeerRenegotiationRetry(
    peer: P2PPeer,
    reason: string,
    delayMs: number,
  ): void {
    if (
      this.disposed ||
      this.peers.get(peer.remoteUserId) !== peer ||
      peer.pc.signalingState === "closed" ||
      peer.renegotiationRetryTimerId !== null
    ) {
      return;
    }

    logDebug("p2p.negotiation", "defer remote renegotiate", {
      delayMs,
      localParticipantId: this.localParticipant.id,
      reason,
      remoteUserId: peer.remoteUserId,
    });
    peer.renegotiationRetryTimerId = window.setTimeout(() => {
      peer.renegotiationRetryTimerId = null;
      if (
        this.disposed ||
        this.peers.get(peer.remoteUserId) !== peer ||
        peer.pc.signalingState === "closed" ||
        !peer.needsNegotiation
      ) {
        return;
      }

      this.queueNegotiation(peer, `cooldown-retry:${reason}`);
    }, Math.max(0, delayMs));
  }

  private clearPeerRenegotiationRetryTimer(peer: P2PPeer): void {
    if (peer.renegotiationRetryTimerId === null) {
      return;
    }

    window.clearTimeout(peer.renegotiationRetryTimerId);
    peer.renegotiationRetryTimerId = null;
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
    const candidatePair = summarizeP2PCandidatePairTelemetry(summary);
    if (!candidatePair) {
      return;
    }

    const logKey = JSON.stringify({
      iceRestartCount: peer.iceRestartCount,
      direct: candidatePair.direct,
      localCandidateType: candidatePair.localCandidateType,
      remoteCandidateType: candidatePair.remoteCandidateType,
      localProtocol: candidatePair.localProtocol,
      remoteProtocol: candidatePair.remoteProtocol,
      localRelayProtocol: candidatePair.localRelayProtocol,
      remoteRelayProtocol: candidatePair.remoteRelayProtocol,
    });
    if (peer.lastCandidatePairLogKey === logKey) {
      return;
    }
    peer.lastCandidatePairLogKey = logKey;

    logDebug("p2p.ice", "selected candidate pair", {
      iceRestartCount: peer.iceRestartCount,
      ...candidatePair,
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

export function createP2PRtcConfiguration(
  iceServers: RTCIceServer[],
): RTCConfiguration {
  return {
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 2,
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

function getAudioTrackFromElement(
  element: HTMLAudioElement | undefined,
): MediaStreamTrack | null {
  const stream = element?.srcObject;
  if (!(stream instanceof MediaStream)) {
    return null;
  }
  return stream.getAudioTracks()[0] ?? null;
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

function formatCameraErrorMessage(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "Camera access is blocked. Allow camera permission and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Camera not found. Connect a camera and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Camera settings are not supported by this device.";
  }
  return "Camera is unavailable. Close other apps using it and try again.";
}

function microphoneErrorName(error: unknown): string {
  return error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name)
    : "";
}

export function classifyMicrophoneTerminalFailure(
  error: unknown,
): MicrophoneTerminalFailureReason | null {
  const name = microphoneErrorName(error);
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError"
  ) {
    return "permission-denied";
  }
  if (name === "SecurityError") {
    return "security";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "device-not-found";
  }
  if (
    name === "OverconstrainedError" ||
    name === "ConstraintNotSatisfiedError" ||
    name === "TypeError"
  ) {
    return "constraints";
  }
  return null;
}

function formatMicrophoneErrorMessage(error: unknown): string {
  const name = microphoneErrorName(error);
  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  ) {
    return "Microphone access is blocked. Allow microphone access and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Microphone not found. Connect a microphone and try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Microphone is busy. Close other apps using it and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Microphone settings are not supported by this device.";
  }
  if (name === "TypeError") {
    return "Microphone settings are invalid. Reload the page and try again.";
  }
  return "Microphone is unavailable. Turn it off and try again.";
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

export function summarizeP2PCandidatePairTelemetry(
  statsSummary: Record<string, unknown>,
): Record<string, unknown> | null {
  const candidatePair = statsSummary.candidatePair;
  if (!candidatePair || typeof candidatePair !== "object") {
    return null;
  }

  const pair = candidatePair as Record<string, unknown>;
  const localCandidateType = readStringStat(pair.localCandidateType);
  const remoteCandidateType = readStringStat(pair.remoteCandidateType);
  const usedTurn =
    localCandidateType === "relay" || remoteCandidateType === "relay";
  const hasCandidateType = Boolean(localCandidateType || remoteCandidateType);

  const telemetry: Record<string, unknown> = {
    usedTurn,
  };
  copyDefinedStat(telemetry, "direct", hasCandidateType ? !usedTurn : undefined);
  copyDefinedStat(telemetry, "localCandidateType", localCandidateType);
  copyDefinedStat(telemetry, "remoteCandidateType", remoteCandidateType);
  copyDefinedStat(telemetry, "localProtocol", readStringStat(pair.localProtocol));
  copyDefinedStat(telemetry, "remoteProtocol", readStringStat(pair.remoteProtocol));
  copyDefinedStat(
    telemetry,
    "localRelayProtocol",
    readStringStat(pair.localRelayProtocol),
  );
  copyDefinedStat(
    telemetry,
    "remoteRelayProtocol",
    readStringStat(pair.remoteRelayProtocol),
  );
  copyDefinedStat(
    telemetry,
    "roundTripTime",
    readNumberStat(pair.currentRoundTripTime),
  );
  return telemetry;
}

function copyDefinedStat(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function readStringStat(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumberStat(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function summarizeSignal(signal: P2PSignal): Record<string, unknown> {
  if (signal.kind === "offer" || signal.kind === "answer") {
    return {
      type: signal.sdp.type,
      ...summarizeP2PSdp(signal.sdp.sdp),
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

function prepareP2PLocalDescription(
  description: RTCSessionDescriptionInit,
): RTCSessionDescriptionInit {
  if (
    !description.sdp ||
    (description.type !== "offer" && description.type !== "answer")
  ) {
    return description;
  }

  const sdp = enableP2POpusDtxAndInbandFec(description.sdp);
  return sdp === description.sdp ? description : { ...description, sdp };
}

export function enableP2POpusDtxAndInbandFec(sdp: string): string {
  const lineBreak = sdp.includes("\r\n") ? "\r\n" : "\n";
  const hasTrailingLineBreak = /\r?\n$/.test(sdp);
  const lines = sdp.replace(/\r?\n$/, "").split(/\r\n|\n/);
  const audioOpusPayloadTypes = getAudioOpusPayloadTypes(lines);
  if (!audioOpusPayloadTypes.size) {
    return sdp;
  }

  const existingOpusFmtpPayloadTypes = new Set(
    lines
      .map((line) => line.match(/^a=fmtp:(\d+)(?:\s+.*)?$/i)?.[1])
      .filter(
        (payloadType): payloadType is string =>
          payloadType !== undefined && audioOpusPayloadTypes.has(payloadType),
      ),
  );
  const patchedLines: string[] = [];
  const insertedOpusFmtpPayloadTypes = new Set<string>();

  for (const line of lines) {
    const fmtpMatch = line.match(/^a=fmtp:(\d+)(?:\s+(.*))?$/i);
    if (fmtpMatch && audioOpusPayloadTypes.has(fmtpMatch[1] ?? "")) {
      const payloadType = fmtpMatch[1] ?? "";
      patchedLines.push(
        formatOpusFmtpLine(payloadType, fmtpMatch[2] ?? ""),
      );
      continue;
    }

    patchedLines.push(line);

    const rtpmapMatch = line.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/i);
    if (rtpmapMatch && audioOpusPayloadTypes.has(rtpmapMatch[1] ?? "")) {
      const payloadType = rtpmapMatch[1] ?? "";
      if (
        !existingOpusFmtpPayloadTypes.has(payloadType) &&
        !insertedOpusFmtpPayloadTypes.has(payloadType)
      ) {
        patchedLines.push(formatOpusFmtpLine(payloadType, ""));
        insertedOpusFmtpPayloadTypes.add(payloadType);
      }
    }
  }

  return patchedLines.join(lineBreak) + (hasTrailingLineBreak ? lineBreak : "");
}

function formatOpusFmtpLine(payloadType: string, rawParams: string): string {
  const params = rawParams
    .split(";")
    .map((param) => param.trim())
    .filter(
      (param) =>
        param &&
        !/^useinbandfec\s*=/i.test(param) &&
        !/^usedtx\s*=/i.test(param),
    );

  params.push("useinbandfec=1", "usedtx=1");
  return `a=fmtp:${payloadType} ${params.join(";")}`;
}

function getAudioOpusPayloadTypes(lines: string[]): Set<string> {
  const payloadTypes = new Set<string>();
  let inAudioSection = false;

  for (const line of lines) {
    if (line.startsWith("m=")) {
      inAudioSection = line.startsWith("m=audio");
      continue;
    }

    if (!inAudioSection) {
      continue;
    }

    const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/i);
    if (match?.[1]) {
      payloadTypes.add(match[1]);
    }
  }

  return payloadTypes;
}

function hasOpusFmtpParam(
  sdp: string,
  name: "useinbandfec" | "usedtx",
): boolean {
  const lines = sdp.replace(/\r?\n$/, "").split(/\r\n|\n/);
  const audioOpusPayloadTypes = getAudioOpusPayloadTypes(lines);
  if (!audioOpusPayloadTypes.size) {
    return false;
  }

  return lines.some((line) => {
    const fmtpMatch = line.match(/^a=fmtp:(\d+)(?:\s+(.*))?$/i);
    return (
      Boolean(fmtpMatch?.[1]) &&
      audioOpusPayloadTypes.has(fmtpMatch?.[1] ?? "") &&
      new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*1(?:\\s*;|$)`, "i").test(
        fmtpMatch?.[2] ?? "",
      )
    );
  });
}

export function summarizeP2PSdp(sdp: string): Record<string, unknown> {
  const codecs = Array.from(
    sdp.matchAll(/^a=rtpmap:\d+ ([^/\r\n]+)/gim),
    (match) => match[1]?.toLowerCase(),
  ).filter(Boolean);

  return {
    length: sdp.length,
    audioMLine: /m=audio/.test(sdp),
    videoMLine: /m=video/.test(sdp),
    codecs: Array.from(new Set(codecs)),
    audioOpusInbandFec: hasOpusFmtpParam(sdp, "useinbandfec"),
    audioOpusDtx: hasOpusFmtpParam(sdp, "usedtx"),
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

function rememberRetiredSignalSource(
  retiredByPeer: Map<string, Set<string>>,
  remoteUserId: string,
  value: string,
): void {
  const retired = retiredByPeer.get(remoteUserId) ?? new Set<string>();
  retired.delete(value);
  retired.add(value);
  while (retired.size > P2P_RETIRED_SIGNAL_SOURCE_CAP) {
    const oldest = retired.values().next().value;
    if (oldest === undefined) {
      break;
    }
    retired.delete(oldest);
  }
  retiredByPeer.set(remoteUserId, retired);
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
  let changed = false;
  if (!parameters.encodings?.length) {
    parameters.encodings = [{}];
    changed = true;
  }
  const firstEncoding = parameters.encodings[0];
  if (!firstEncoding) {
    return;
  }

  if (firstEncoding.maxBitrate !== maxBitrate) {
    firstEncoding.maxBitrate = maxBitrate;
    changed = true;
  }
  if (maxFramerate !== undefined) {
    if (firstEncoding.maxFramerate !== maxFramerate) {
      firstEncoding.maxFramerate = maxFramerate;
      changed = true;
    }
    // Ghost Cam is motion presence at a low frame rate: keep the frame rate
    // steady and let resolution drop under pressure instead (Block 5.5).
    if (parameters.degradationPreference !== "maintain-framerate") {
      parameters.degradationPreference = "maintain-framerate";
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  await sender.setParameters(parameters).catch(() => undefined);
}

function addOptionalNumbers(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (typeof left === "number" && typeof right === "number") {
    return left + right;
  }
  return typeof left === "number" ? left : right;
}

function maxOptionalNumbers(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (typeof left === "number" && typeof right === "number") {
    return Math.max(left, right);
  }
  return typeof left === "number" ? left : right;
}

function audioActivityStatsChanged(
  previous: AudioActivityStats,
  current: AudioActivityStats,
): boolean {
  return (
    previous.audioLevel !== current.audioLevel ||
    previous.bytesReceived !== current.bytesReceived ||
    previous.jitter !== current.jitter ||
    previous.packetsReceived !== current.packetsReceived
  );
}

function mergeVideoInboundStats(
  current: VideoInboundStats | undefined,
  next: VideoInboundStats,
): VideoInboundStats {
  return {
    bytesReceived: addOptionalNumbers(current?.bytesReceived, next.bytesReceived),
    framesDecoded: addOptionalNumbers(current?.framesDecoded, next.framesDecoded),
    framesPerSecond: maxOptionalNumbers(
      current?.framesPerSecond,
      next.framesPerSecond,
    ),
  };
}

function mergeAudioInboundStats(
  current: AudioActivityStats | undefined,
  next: AudioActivityStats,
): AudioActivityStats {
  return {
    audioLevel: maxOptionalNumbers(current?.audioLevel, next.audioLevel),
    bytesReceived: addOptionalNumbers(
      current?.bytesReceived,
      next.bytesReceived,
    ),
    jitter: maxOptionalNumbers(current?.jitter, next.jitter),
    packetsReceived: addOptionalNumbers(
      current?.packetsReceived,
      next.packetsReceived,
    ),
  };
}

export function summarizeStats(report: RTCStatsReport): Record<string, unknown> {
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
      summary.videoInbound = mergeVideoInboundStats(
        summary.videoInbound as VideoInboundStats | undefined,
        {
          bytesReceived: stat.bytesReceived,
          framesPerSecond: stat.framesPerSecond,
          framesDecoded: stat.framesDecoded,
        },
      );
    }

    if (stat.type === "outbound-rtp" && stat.kind === "audio") {
      summary.audioOutbound = {
        bytesSent: stat.bytesSent,
        packetsSent: stat.packetsSent,
      };
    }

    if (stat.type === "media-source" && stat.kind === "audio") {
      summary.audioSource = {
        audioLevel: stat.audioLevel,
      };
    }

    if (stat.type === "inbound-rtp" && stat.kind === "audio") {
      summary.audioInbound = mergeAudioInboundStats(
        summary.audioInbound as AudioActivityStats | undefined,
        {
          audioLevel: stat.audioLevel,
          bytesReceived: stat.bytesReceived,
          jitter: stat.jitter,
          packetsReceived: stat.packetsReceived,
        },
      );
    }
  }

  return summary;
}
