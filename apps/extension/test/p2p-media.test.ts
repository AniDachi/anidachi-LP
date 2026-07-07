import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canReceiveP2PSignalFromParticipant,
  classifyRemoteAudioActivity,
  classifyRemoteAudioFlowActivity,
  classifyRemoteVideoActivity,
  classifyPeerHealth,
  P2PMediaController,
  planP2PVideoSenderSync,
  createP2PRtcConfiguration,
  createP2PMediaSignalDedupeKey,
  decideP2PSignalConnection,
  decideP2PIceRestart,
  enableP2POpusDtxAndInbandFec,
  getP2PAudioTransceiverDirection,
  isPoliteP2PPeer,
  p2pAudioTrackSwapNeedsNegotiation,
  reconcilePeerAction,
  rememberP2PMediaSignalFingerprint,
  selectPreferredP2PCodecCapabilities,
  selectP2PMediaParticipants,
  shouldProactivelyRestartIceForNetworkSignal,
  shouldInitiateP2POffers,
  summarizeStats,
  summarizeP2PCandidatePairTelemetry,
  summarizeP2PCodecPreferenceOrder,
  summarizeP2PSdp,
} from "../src/p2p-media";
import type { P2PSignal, Participant } from "@anidachi/protocol";
import type { GhostVideo, LiveVoiceStatus } from "../src/media-types";

function participant(
  id: string,
  cameraEnabled = false,
  mediaSeat: Participant["mediaSeat"] = "joined",
): Participant {
  return {
    id,
    displayName: id,
    role: id === "host" ? "host" : "viewer",
    cameraEnabled,
    mediaSeat,
    mediaSeatSource: mediaSeat === "joined" ? "auto" : undefined,
    syncStatus: "unknown",
    lastSeenAt: 1,
  };
}

function statsReportFrom(stats: Array<{ id: string } & Record<string, unknown>>): RTCStatsReport {
  return new Map(stats.map((stat) => [stat.id, stat])) as unknown as RTCStatsReport;
}

class FakeVideoTrack extends EventTarget {
  contentHint = "";
  enabled = true;
  readonly id: string;
  readonly kind = "video";
  readyState: MediaStreamTrackState = "live";

  constructor(id: string) {
    super();
    this.id = id;
  }

  end(): void {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }

  getSettings(): MediaTrackSettings {
    return { frameRate: 10, height: 180, width: 320 };
  }

  stop(): void {
    this.readyState = "ended";
  }
}

class FakeAudioTrack extends EventTarget {
  enabled = true;
  readonly id: string;
  readonly kind = "audio";
  readyState: MediaStreamTrackState = "live";

  constructor(id: string) {
    super();
    this.id = id;
  }

  end(): void {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }

  getSettings(): MediaTrackSettings {
    return { channelCount: 1 };
  }

  stop(): void {
    this.readyState = "ended";
  }
}

function fakeVideoStream(track: FakeVideoTrack): MediaStream {
  const stream = new MediaStream();
  Object.defineProperties(stream, {
    getAudioTracks: { value: () => [] },
    getTracks: { value: () => [track] },
    getVideoTracks: { value: () => [track] },
    id: { value: `stream-${track.id}` },
  });
  return stream;
}

function fakeAudioStream(track: FakeAudioTrack): MediaStream {
  const stream = new MediaStream();
  Object.defineProperties(stream, {
    getAudioTracks: { value: () => [track] },
    getTracks: { value: () => [track] },
    getVideoTracks: { value: () => [] },
    id: { value: `stream-${track.id}` },
  });
  return stream;
}

function installFakeMediaDevices(mediaDevices: MediaDevices): void {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices,
  });
}

function createP2PControllerHarness() {
  const activeSpeakerChanges: string[][] = [];
  const cameraStatuses: boolean[] = [];
  const messages: Array<string | null> = [];
  const videos: GhostVideo[][] = [];
  const voiceStatuses: LiveVoiceStatus[] = [];
  const signals: Array<{ signal: P2PSignal; toUserId: string }> = [];
  const controller = new P2PMediaController({
    iceServers: [],
    localParticipant: participant("host", false),
    onActiveSpeakerIdsChange: (ids) => activeSpeakerChanges.push(ids),
    onCameraStatus: (enabled) => cameraStatuses.push(enabled),
    onVideosChange: (items) => videos.push(items),
    onVoiceMessageChange: (message) => messages.push(message),
    onVoiceStatusChange: (status) => voiceStatuses.push(status),
    sendSignal: (toUserId, signal) => signals.push({ signal, toUserId }),
  });

  return {
    activeSpeakerChanges,
    cameraStatuses,
    controller,
    messages,
    signals,
    videos,
    voiceStatuses,
  };
}

function installStatsPeer(
  controller: P2PMediaController,
  remoteUserId: string,
  reports: RTCStatsReport[],
) {
  let reportIndex = 0;
  const getStats = vi.fn(async () => {
    const report = reports[Math.min(reportIndex, reports.length - 1)];
    reportIndex += 1;
    return report ?? statsReportFrom([]);
  });
  const pc = {
    close: vi.fn(),
    connectionState: "connected" as RTCPeerConnectionState,
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "v=0\r\n" })),
    getStats,
    iceConnectionState: "connected" as RTCIceConnectionState,
    localDescription: null as RTCSessionDescription | null,
    restartIce: vi.fn(),
    setConfiguration: vi.fn(),
    setLocalDescription: vi.fn(async (description: RTCSessionDescriptionInit) => {
      pc.localDescription = description as RTCSessionDescription;
    }),
    signalingState: "stable" as RTCSignalingState,
  };

  const peer = {
    audioCodecPreferencesKey: null,
    audioTransceiver: null,
    disconnectedRestartTimerId: null,
    ignoreOffer: false,
    isSettingRemoteAnswerPending: false,
    iceRestartCount: 0,
    lastAudioFlowLogAt: 0,
    lastAudioStallRecoveryAt: 0,
    lastCandidatePairLogKey: null,
    lastIceRestartAt: 0,
    lastIceRestartRequestAt: 0,
    lastMediaStallRecoveryAt: 0,
    lastRenegotiationRequestAt: 0,
    makingOffer: false,
    mediaSyncing: false,
    needsNegotiation: false,
    negotiationQueued: false,
    pc,
    pendingCloseTimerId: null,
    pendingIceCandidates: [],
    polite: true,
    recentSignalFingerprints: new Map(),
    remoteUserId,
    remoteVideoExpected: false,
    remoteVideoStallSamples: 0,
    videoCodecPreferencesKey: null,
    videoTransceiver: null,
  };

  (
    controller as unknown as {
      peers: Map<string, unknown>;
    }
  ).peers.set(remoteUserId, peer);

  return { getStats, pc };
}

async function sampleP2PPeerHealth(
  controller: P2PMediaController,
): Promise<void> {
  await (
    controller as unknown as {
      samplePeerHealth: () => Promise<void>;
    }
  ).samplePeerHealth();
}

describe("P2P camera local-track recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the public camera status on while scheduling delayed re-acquire after a local track ends", async () => {
    const firstTrack = new FakeVideoTrack("camera-1");
    const secondTrack = new FakeVideoTrack("camera-2");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeVideoStream(firstTrack))
      .mockResolvedValueOnce(fakeVideoStream(secondTrack));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { cameraStatuses, controller } = createP2PControllerHarness();

    await controller.setCameraEnabled(true);
    expect(cameraStatuses).toEqual([true]);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    firstTrack.end();

    expect(cameraStatuses).toEqual([true]);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(cameraStatuses).toEqual([true]);

    controller.disconnect();
  });

  it("cancels delayed camera recovery when the user turns the camera off", async () => {
    const firstTrack = new FakeVideoTrack("camera-1");
    const secondTrack = new FakeVideoTrack("camera-2");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeVideoStream(firstTrack))
      .mockResolvedValueOnce(fakeVideoStream(secondTrack));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { cameraStatuses, controller } = createP2PControllerHarness();

    await controller.setCameraEnabled(true);
    firstTrack.end();
    await controller.setCameraEnabled(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(cameraStatuses).toEqual([true, false]);

    controller.disconnect();
  });

  it("gives up after repeated rapid local track endings and publishes one camera off status", async () => {
    const tracks = [
      new FakeVideoTrack("camera-1"),
      new FakeVideoTrack("camera-2"),
      new FakeVideoTrack("camera-3"),
    ];
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeVideoStream(tracks[0]))
      .mockResolvedValueOnce(fakeVideoStream(tracks[1]))
      .mockResolvedValueOnce(fakeVideoStream(tracks[2]));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { cameraStatuses, controller, messages } = createP2PControllerHarness();

    await controller.setCameraEnabled(true);
    tracks[0].end();
    await vi.advanceTimersByTimeAsync(1_000);
    tracks[1].end();
    await vi.advanceTimersByTimeAsync(2_000);
    tracks[2].end();

    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(cameraStatuses).toEqual([true, false]);
    expect(messages.at(-1)).toContain("Camera is unavailable");

    await vi.advanceTimersByTimeAsync(8_000);
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(cameraStatuses).toEqual([true, false]);

    controller.disconnect();
  });
});

describe("P2P camera sender sync plan", () => {
  it("keeps the existing video sender stable while camera recovery is in progress", () => {
    expect(
      planP2PVideoSenderSync({
        cameraState: "recovering",
        hasLocalVideoTrack: false,
        publicCameraEnabled: true,
        wantsCamera: true,
      }),
    ).toEqual({
      desiredDirection: "sendrecv",
      replaceTrackWithNull: false,
    });
  });

  it("downgrades the video sender only when the camera is intentionally off", () => {
    expect(
      planP2PVideoSenderSync({
        cameraState: "off",
        hasLocalVideoTrack: false,
        publicCameraEnabled: false,
        wantsCamera: false,
      }),
    ).toEqual({
      desiredDirection: "recvonly",
      replaceTrackWithNull: true,
    });
  });
});

describe("P2P push-to-talk local-track recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("re-acquires the mic after a transient local track end without publishing voice-stop", async () => {
    const firstTrack = new FakeAudioTrack("mic-1");
    const secondTrack = new FakeAudioTrack("mic-2");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeAudioStream(firstTrack))
      .mockResolvedValueOnce(fakeAudioStream(secondTrack));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { activeSpeakerChanges, controller, signals, voiceStatuses } =
      createP2PControllerHarness();

    await controller.startVoiceTalk();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(activeSpeakerChanges.at(-1)).toEqual(["host"]);
    expect(voiceStatuses.at(-1)).toBe("talking");

    firstTrack.end();

    expect(activeSpeakerChanges.at(-1)).toEqual(["host"]);
    expect(voiceStatuses.at(-1)).toBe("connecting");
    expect(signals.map((item) => item.signal)).not.toContainEqual({
      kind: "voice-stop",
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(activeSpeakerChanges.at(-1)).toEqual(["host"]);
    expect(voiceStatuses.at(-1)).toBe("talking");

    controller.disconnect();
  });

  it("cancels pending mic recovery when push-to-talk is released", async () => {
    const firstTrack = new FakeAudioTrack("mic-1");
    const secondTrack = new FakeAudioTrack("mic-2");
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeAudioStream(firstTrack))
      .mockResolvedValueOnce(fakeAudioStream(secondTrack));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { activeSpeakerChanges, controller, voiceStatuses } =
      createP2PControllerHarness();

    await controller.startVoiceTalk();
    firstTrack.end();
    await controller.stopVoiceTalk();

    await vi.advanceTimersByTimeAsync(250);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(activeSpeakerChanges.at(-1)).toEqual([]);
    expect(voiceStatuses.at(-1)).toBe("idle");

    controller.disconnect();
  });

  it("gives up instead of looping forever after repeated rapid mic track endings", async () => {
    const tracks = [
      new FakeAudioTrack("mic-1"),
      new FakeAudioTrack("mic-2"),
      new FakeAudioTrack("mic-3"),
    ];
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(fakeAudioStream(tracks[0]))
      .mockResolvedValueOnce(fakeAudioStream(tracks[1]))
      .mockResolvedValueOnce(fakeAudioStream(tracks[2]));
    installFakeMediaDevices({
      addEventListener: vi.fn(),
      getUserMedia,
      removeEventListener: vi.fn(),
    } as unknown as MediaDevices);
    const { activeSpeakerChanges, controller, messages, voiceStatuses } =
      createP2PControllerHarness();

    await controller.startVoiceTalk();
    tracks[0].end();
    await vi.advanceTimersByTimeAsync(250);
    tracks[1].end();
    await vi.advanceTimersByTimeAsync(500);
    tracks[2].end();

    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(activeSpeakerChanges.at(-1)).toEqual([]);
    expect(voiceStatuses.at(-1)).toBe("error");
    expect(messages.at(-1)).toContain("Microphone is unavailable");

    await vi.advanceTimersByTimeAsync(2_000);
    expect(getUserMedia).toHaveBeenCalledTimes(3);

    controller.disconnect();
  });
});

describe("P2P perfect negotiation role helpers", () => {
  it("uses the lower deterministic participant id as the offer initiator", () => {
    expect(shouldInitiateP2POffers("participant-a", "participant-b")).toBe(
      true,
    );
    expect(isPoliteP2PPeer("participant-a", "participant-b")).toBe(false);
  });

  it("uses the higher deterministic participant id as the polite peer", () => {
    expect(shouldInitiateP2POffers("participant-b", "participant-a")).toBe(
      false,
    );
    expect(isPoliteP2PPeer("participant-b", "participant-a")).toBe(true);
  });

  it("does not initiate offers against the same participant id", () => {
    expect(shouldInitiateP2POffers("participant-a", "participant-a")).toBe(
      false,
    );
    expect(isPoliteP2PPeer("participant-a", "participant-a")).toBe(false);
  });

  it("keeps audio negotiated so push-to-talk can swap tracks without renegotiation", () => {
    expect(getP2PAudioTransceiverDirection()).toBe("sendrecv");
    expect(p2pAudioTrackSwapNeedsNegotiation("sendrecv")).toBe(false);
    expect(p2pAudioTrackSwapNeedsNegotiation("recvonly")).toBe(true);
    expect(p2pAudioTrackSwapNeedsNegotiation(null)).toBe(true);
  });
});

describe("P2P reconciliation decision", () => {
  it("restarts ICE when the connection or ICE transport is down", () => {
    expect(reconcilePeerAction("failed", "connected")).toBe("restart-ice");
    expect(reconcilePeerAction("disconnected", "connected")).toBe(
      "restart-ice",
    );
    expect(reconcilePeerAction("connected", "failed")).toBe("restart-ice");
    expect(reconcilePeerAction("connected", "disconnected")).toBe(
      "restart-ice",
    );
  });

  it("re-syncs media (idempotent) when the connection is healthy", () => {
    expect(reconcilePeerAction("connected", "connected")).toBe("sync");
    expect(reconcilePeerAction("connecting", "checking")).toBe("sync");
    expect(reconcilePeerAction("new", "new")).toBe("sync");
  });
});

describe("P2P network recovery decision", () => {
  it("restarts ICE after online or network change signals while the browser is online", () => {
    expect(shouldProactivelyRestartIceForNetworkSignal("online", true)).toBe(
      true,
    );
    expect(
      shouldProactivelyRestartIceForNetworkSignal("connection-change", true),
    ).toBe(true);
    expect(
      shouldProactivelyRestartIceForNetworkSignal("online", undefined),
    ).toBe(true);
  });

  it("does not churn ICE while the browser is offline", () => {
    expect(shouldProactivelyRestartIceForNetworkSignal("offline", true)).toBe(
      false,
    );
    expect(shouldProactivelyRestartIceForNetworkSignal("online", false)).toBe(
      false,
    );
    expect(
      shouldProactivelyRestartIceForNetworkSignal("connection-change", false),
    ).toBe(false);
  });
});

describe("P2P sender connection generation", () => {
  it("accepts the first connection-bearing signal", () => {
    expect(decideP2PSignalConnection(null, "conn-a", "offer")).toEqual({
      accept: true,
      nextSenderConnectionId: "conn-a",
      reason: "first-connection",
    });
  });

  it("drops stale lifecycle signals from an older sender connection", () => {
    expect(decideP2PSignalConnection("conn-new", "conn-old", "bye")).toEqual({
      accept: false,
      nextSenderConnectionId: "conn-new",
      reason: "stale-connection",
    });
  });

  it("switches to a newer publisher connection on a fresh offer", () => {
    expect(decideP2PSignalConnection("conn-old", "conn-new", "offer")).toEqual({
      accept: true,
      nextSenderConnectionId: "conn-new",
      reason: "new-publisher-connection",
    });
  });

  it("keeps the current connection when old ICE arrives after a reconnect", () => {
    expect(decideP2PSignalConnection("conn-new", "conn-old", "ice")).toEqual({
      accept: false,
      nextSenderConnectionId: "conn-new",
      reason: "stale-connection",
    });
  });
});

describe("P2P RTC configuration", () => {
  it("keeps normal ICE policy direct-first while pre-gathering candidates", () => {
    const iceServers = [{ urls: "stun:stun.cloudflare.com:3478" }];

    expect(createP2PRtcConfiguration(iceServers)).toEqual({
      bundlePolicy: "max-bundle",
      iceCandidatePoolSize: 2,
      iceTransportPolicy: "all",
      iceServers,
      rtcpMuxPolicy: "require",
    });
  });
});

describe("P2P candidate pair telemetry", () => {
  it("summarizes direct candidate pairs without network addresses", () => {
    expect(
      summarizeP2PCandidatePairTelemetry({
        candidatePair: {
          currentRoundTripTime: 0.042,
          localCandidateType: "host",
          localProtocol: "udp",
          remoteCandidateType: "srflx",
          remoteProtocol: "udp",
        },
      }),
    ).toEqual({
      direct: true,
      usedTurn: false,
      localCandidateType: "host",
      remoteCandidateType: "srflx",
      localProtocol: "udp",
      remoteProtocol: "udp",
      roundTripTime: 0.042,
    });
  });

  it("marks relay candidate pairs as TURN-backed without exposing candidates", () => {
    expect(
      summarizeP2PCandidatePairTelemetry({
        candidatePair: {
          currentRoundTripTime: 0.12,
          localCandidateType: "relay",
          localProtocol: "tcp",
          localRelayProtocol: "tls",
          remoteCandidateType: "relay",
          remoteProtocol: "tcp",
          remoteRelayProtocol: "tls",
        },
      }),
    ).toEqual({
      direct: false,
      usedTurn: true,
      localCandidateType: "relay",
      remoteCandidateType: "relay",
      localProtocol: "tcp",
      remoteProtocol: "tcp",
      localRelayProtocol: "tls",
      remoteRelayProtocol: "tls",
      roundTripTime: 0.12,
    });
  });

  it("returns null until WebRTC exposes a selected candidate pair", () => {
    expect(summarizeP2PCandidatePairTelemetry({})).toBeNull();
  });
});

describe("P2P ICE restart throttling decision", () => {
  it("lets the deterministic offerer restart ICE after the cooldown window", () => {
    expect(decideP2PIceRestart(true, "stable", 20_000, 10_000, 8_000)).toBe(
      "restart",
    );
  });

  it("suppresses restart churn inside the cooldown window", () => {
    expect(decideP2PIceRestart(true, "stable", 12_000, 10_000, 8_000)).toBe(
      "suppress-cooldown",
    );
  });

  it("asks the offerer side to restart when this peer is the answerer", () => {
    expect(decideP2PIceRestart(false, "stable", 20_000, 10_000, 8_000)).toBe(
      "request-remote-restart",
    );
  });

  it("does not act on a closed peer connection", () => {
    expect(decideP2PIceRestart(true, "closed", 20_000, 10_000, 8_000)).toBe(
      "suppress-closed",
    );
  });
});

describe("P2P media signal dedupe", () => {
  const offer: P2PSignal = {
    kind: "offer",
    sdp: { type: "offer", sdp: "v=0\r\na=sendrecv\r\n" },
  };
  const answer: P2PSignal = {
    kind: "answer",
    sdp: { type: "answer", sdp: "v=0\r\na=sendrecv\r\n" },
  };
  const ice: P2PSignal = {
    kind: "ice",
    candidate: {
      candidate:
        "candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host generation 0 ufrag abc network-id 1",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "abc",
    },
  };

  it("fingerprints duplicate SDP media signals without exposing the full SDP", () => {
    expect(createP2PMediaSignalDedupeKey("peer-a", offer)).toBe(
      createP2PMediaSignalDedupeKey("peer-a", offer),
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", offer)).not.toContain(
      offer.sdp.sdp,
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", offer)).not.toBe(
      createP2PMediaSignalDedupeKey("peer-b", offer),
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", offer)).not.toBe(
      createP2PMediaSignalDedupeKey("peer-a", answer),
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", offer)).not.toBe(
      createP2PMediaSignalDedupeKey("peer-a", {
        kind: "offer",
        sdp: { type: "offer", sdp: "v=0\r\na=recvonly\r\n" },
      }),
    );
  });

  it("fingerprints duplicate ICE candidates including their media line and ufrag", () => {
    expect(createP2PMediaSignalDedupeKey("peer-a", ice)).toBe(
      createP2PMediaSignalDedupeKey("peer-a", ice),
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", ice)).not.toContain(
      ice.candidate.candidate,
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", ice)).not.toBe(
      createP2PMediaSignalDedupeKey("peer-a", {
        kind: "ice",
        candidate: { ...ice.candidate, usernameFragment: "def" },
      }),
    );
    expect(createP2PMediaSignalDedupeKey("peer-a", ice)).not.toBe(
      createP2PMediaSignalDedupeKey("peer-a", {
        kind: "ice",
        candidate: {
          ...ice.candidate,
          candidate: `${ice.candidate.candidate} typ relay`,
        },
      }),
    );
  });

  it("does not dedupe control or voice signals", () => {
    for (const signal of [
      { kind: "voice-start" },
      { kind: "voice-stop" },
      { kind: "renegotiate" },
      { kind: "restart-ice" },
      { kind: "bye" },
    ] satisfies P2PSignal[]) {
      expect(createP2PMediaSignalDedupeKey("peer-a", signal)).toBeNull();
    }
  });

  it("accepts first media fingerprints, drops duplicate ones, then accepts after TTL", () => {
    const recent = new Map<string, number>();
    const key = createP2PMediaSignalDedupeKey("peer-a", offer);

    expect(rememberP2PMediaSignalFingerprint(recent, key, 1_000, 100)).toBe(
      "accept",
    );
    expect(rememberP2PMediaSignalFingerprint(recent, key, 1_050, 100)).toBe(
      "drop-duplicate",
    );
    expect(rememberP2PMediaSignalFingerprint(recent, key, 1_201, 100)).toBe(
      "accept",
    );
  });

  it("bounds the recent signal fingerprint cache", () => {
    const recent = new Map<string, number>();
    expect(
      rememberP2PMediaSignalFingerprint(recent, "a", 1_000, 10_000, 2),
    ).toBe("accept");
    expect(
      rememberP2PMediaSignalFingerprint(recent, "b", 1_001, 10_000, 2),
    ).toBe("accept");
    expect(
      rememberP2PMediaSignalFingerprint(recent, "c", 1_002, 10_000, 2),
    ).toBe("accept");

    expect(Array.from(recent.keys())).toEqual(["b", "c"]);
  });
});

describe("P2P peer health classification", () => {
  it("is recovering whenever the connection is not connected", () => {
    expect(classifyPeerHealth("connecting", undefined)).toBe("recovering");
    expect(classifyPeerHealth("disconnected", 0.05)).toBe("recovering");
    expect(classifyPeerHealth("failed", undefined)).toBe("recovering");
  });

  it("is good when connected and responsive, degraded when RTT is high", () => {
    expect(classifyPeerHealth("connected", 0.05)).toBe("good");
    expect(classifyPeerHealth("connected", undefined)).toBe("good");
    expect(classifyPeerHealth("connected", 0.6)).toBe("degraded");
  });
});

describe("P2P remote audio activity classification", () => {
  it("does not claim activity before a baseline exists", () => {
    expect(
      classifyRemoteAudioActivity(undefined, {
        bytesReceived: 100,
        packetsReceived: 1,
        audioLevel: 0,
      }),
    ).toBe("unknown");
  });

  it("uses audio level and RTP deltas as real activity signals", () => {
    expect(
      classifyRemoteAudioActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0.02 },
      ),
    ).toBe("active");
    expect(
      classifyRemoteAudioActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 180, packetsReceived: 12, audioLevel: 0 },
      ),
    ).toBe("active");
    expect(
      classifyRemoteAudioActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 240, packetsReceived: 10, audioLevel: 0 },
      ),
    ).toBe("active");
  });

  it("marks audio as quiet when stats stop moving", () => {
    expect(
      classifyRemoteAudioActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
      ),
    ).toBe("quiet");
  });

  it("does not relight a remote speaker from RTP stats after voice-stop", async () => {
    const { activeSpeakerChanges, controller } = createP2PControllerHarness();
    installStatsPeer(controller, "viewer", [
      statsReportFrom([
        {
          id: "viewer-audio",
          type: "inbound-rtp",
          kind: "audio",
          bytesReceived: 100,
          packetsReceived: 10,
          audioLevel: 0,
        },
      ]),
      statsReportFrom([
        {
          id: "viewer-audio",
          type: "inbound-rtp",
          kind: "audio",
          bytesReceived: 420,
          packetsReceived: 18,
          audioLevel: 0.04,
        },
      ]),
    ]);

    await controller.handleSignal("viewer", { kind: "voice-start" });
    expect(activeSpeakerChanges.at(-1)).toEqual(["viewer"]);

    await controller.handleSignal("viewer", { kind: "voice-stop" });
    expect(activeSpeakerChanges.at(-1)).toEqual([]);

    await sampleP2PPeerHealth(controller);
    await sampleP2PPeerHealth(controller);

    expect(activeSpeakerChanges.at(-1)).toEqual([]);
    controller.disconnect();
  });
});

describe("P2P remote audio flow classification", () => {
  it("does not recover audio when no remote voice is expected", () => {
    expect(
      classifyRemoteAudioFlowActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        false,
        "connected",
      ),
    ).toBe("not-expected");
  });

  it("waits while the peer connection is still recovering", () => {
    expect(
      classifyRemoteAudioFlowActivity(undefined, undefined, true, "connecting"),
    ).toBe("unknown");
  });

  it("flags missing inbound audio only after connected voice is expected", () => {
    expect(
      classifyRemoteAudioFlowActivity(undefined, undefined, true, "connected"),
    ).toBe("missing");
  });

  it("waits for a baseline before judging inbound audio flow", () => {
    expect(
      classifyRemoteAudioFlowActivity(
        undefined,
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        true,
        "connected",
      ),
    ).toBe("unknown");
  });

  it("uses audio level and RTP deltas as healthy flow signals", () => {
    expect(
      classifyRemoteAudioFlowActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0.02 },
        true,
        "connected",
      ),
    ).toBe("flowing");
    expect(
      classifyRemoteAudioFlowActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 240, packetsReceived: 10, audioLevel: 0 },
        true,
        "connected",
      ),
    ).toBe("flowing");
  });

  it("marks expected connected audio as stalled when inbound stats stop moving", () => {
    expect(
      classifyRemoteAudioFlowActivity(
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        { bytesReceived: 100, packetsReceived: 10, audioLevel: 0 },
        true,
        "connected",
      ),
    ).toBe("stalled");
  });
});

describe("P2P codec preferences", () => {
  it("prefers audio RED when available, then Opus, while preserving fallbacks", () => {
    const preferred = selectPreferredP2PCodecCapabilities("audio", [
      { clockRate: 8_000, mimeType: "audio/PCMU" },
      { clockRate: 48_000, mimeType: "audio/opus", channels: 2 },
      { clockRate: 48_000, mimeType: "audio/red", channels: 2 },
      { clockRate: 8_000, mimeType: "audio/telephone-event" },
    ]);

    expect(
      summarizeP2PCodecPreferenceOrder(preferred).map((codec) =>
        codec.split("/").slice(0, 2).join("/"),
      ),
    ).toEqual([
      "audio/red",
      "audio/opus",
      "audio/pcmu",
      "audio/telephone-event",
    ]);
  });

  it("keeps lightweight, broadly supported video codecs before newer or repair codecs", () => {
    const preferred = selectPreferredP2PCodecCapabilities("video", [
      { clockRate: 90_000, mimeType: "video/AV1" },
      { clockRate: 90_000, mimeType: "video/rtx", sdpFmtpLine: "apt=96" },
      { clockRate: 90_000, mimeType: "video/H264" },
      { clockRate: 90_000, mimeType: "video/ulpfec" },
      { clockRate: 90_000, mimeType: "video/VP8" },
      { clockRate: 90_000, mimeType: "video/VP9" },
    ]);

    expect(
      summarizeP2PCodecPreferenceOrder(preferred).map((codec) =>
        codec.split("/").slice(0, 2).join("/"),
      ),
    ).toEqual([
      "video/vp8",
      "video/h264",
      "video/vp9",
      "video/av1",
      "video/rtx",
      "video/ulpfec",
    ]);
  });
});

describe("P2P Opus SDP hardening", () => {
  it("enables Opus in-band FEC and DTX while preserving unrelated fmtp lines", () => {
    const sdp = [
      "v=0",
      "m=audio 9 UDP/TLS/RTP/SAVPF 111 63",
      "a=rtpmap:111 opus/48000/2",
      "a=fmtp:111 minptime=10;useinbandfec=0;stereo=1;usedtx=0",
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 VP8/90000",
      "a=fmtp:96 useinbandfec=0;usedtx=0",
      "",
    ].join("\r\n");

    const patched = enableP2POpusDtxAndInbandFec(sdp);

    expect(patched).toContain(
      "a=fmtp:111 minptime=10;stereo=1;useinbandfec=1;usedtx=1",
    );
    expect(patched).toContain("a=fmtp:96 useinbandfec=0;usedtx=0");

    const summary = summarizeP2PSdp(patched);
    expect(summary.audioOpusInbandFec).toBe(true);
    expect(summary.audioOpusDtx).toBe(true);
  });

  it("adds an Opus fmtp line when the negotiated audio payload is missing one", () => {
    const sdp = [
      "v=0",
      "m=audio 9 UDP/TLS/RTP/SAVPF 109 0",
      "a=rtpmap:109 opus/48000/2",
      "a=rtpmap:0 PCMU/8000",
      "",
    ].join("\r\n");

    const patched = enableP2POpusDtxAndInbandFec(sdp);

    expect(patched).toContain(
      [
        "a=rtpmap:109 opus/48000/2",
        "a=fmtp:109 useinbandfec=1;usedtx=1",
        "a=rtpmap:0 PCMU/8000",
      ].join("\r\n"),
    );

    const summary = summarizeP2PSdp(patched);
    expect(summary.audioOpusInbandFec).toBe(true);
    expect(summary.audioOpusDtx).toBe(true);
  });
});

describe("P2P remote video activity classification", () => {
  it("does not flag missing video when remote video is not expected", () => {
    expect(
      classifyRemoteVideoActivity(undefined, undefined, false, "connected"),
    ).toBe("not-expected");
  });

  it("waits while the connection is still recovering", () => {
    expect(
      classifyRemoteVideoActivity(undefined, undefined, true, "connecting"),
    ).toBe("unknown");
  });

  it("flags missing inbound video only after the peer is connected and video is expected", () => {
    expect(
      classifyRemoteVideoActivity(undefined, undefined, true, "connected"),
    ).toBe("missing");
  });

  it("uses decoded frames as a remote-video flow signal when available", () => {
    expect(
      classifyRemoteVideoActivity(
        { framesDecoded: 10, bytesReceived: 10_000 },
        { framesDecoded: 11, bytesReceived: 10_000 },
        true,
        "connected",
      ),
    ).toBe("flowing");
  });

  it("treats byte movement as flowing when the frame counter is temporarily stale", () => {
    expect(
      classifyRemoteVideoActivity(
        { framesDecoded: 10, bytesReceived: 10_000 },
        { framesDecoded: 10, bytesReceived: 12_000 },
        true,
        "connected",
      ),
    ).toBe("flowing");
  });

  it("falls back to bytes when decoded frame counters are unavailable", () => {
    expect(
      classifyRemoteVideoActivity(
        { bytesReceived: 10_000 },
        { bytesReceived: 12_000 },
        true,
        "connected",
      ),
    ).toBe("flowing");
  });

  it("marks connected expected video as stalled when inbound stats stop moving", () => {
    expect(
      classifyRemoteVideoActivity(
        { framesDecoded: 10, bytesReceived: 10_000 },
        { framesDecoded: 10, bytesReceived: 10_000 },
        true,
        "connected",
      ),
    ).toBe("stalled");
  });

  it("aggregates multiple inbound video RTP stats instead of letting a stale stat hide flow", () => {
    const summary = summarizeStats(
      statsReportFrom([
        {
          id: "active-video",
          type: "inbound-rtp",
          kind: "video",
          bytesReceived: 5_000,
          framesDecoded: 12,
          framesPerSecond: 10,
        },
        {
          id: "stale-video",
          type: "inbound-rtp",
          kind: "video",
          bytesReceived: 200,
          framesDecoded: 0,
          framesPerSecond: 0,
        },
      ]),
    );

    expect(summary.videoInbound).toEqual({
      bytesReceived: 5_200,
      framesDecoded: 12,
      framesPerSecond: 10,
    });
  });

  it("restarts ICE after consecutive stalled remote video samples", async () => {
    const { controller } = createP2PControllerHarness();
    const stalledStats = statsReportFrom([
      {
        id: "viewer-video",
        type: "inbound-rtp",
        kind: "video",
        bytesReceived: 10_000,
        framesDecoded: 10,
        framesPerSecond: 0,
      },
    ]);
    const { pc } = installStatsPeer(controller, "viewer", [
      stalledStats,
      stalledStats,
      stalledStats,
    ]);
    const peer = (
      controller as unknown as {
        peers: Map<string, { remoteVideoExpected: boolean }>;
      }
    ).peers.get("viewer");
    if (peer) {
      peer.remoteVideoExpected = true;
    }

    await sampleP2PPeerHealth(controller);
    await sampleP2PPeerHealth(controller);
    await sampleP2PPeerHealth(controller);

    await vi.waitFor(() => expect(pc.restartIce).toHaveBeenCalledTimes(1));

    controller.disconnect();
  });
});

describe("P2P media participant selection", () => {
  it("keeps idle participants out of the WebRTC mesh when nobody publishes media", () => {
    const participants = [
      participant("host", false),
      participant("viewer-a", false),
      participant("viewer-b", false),
      participant("viewer-c", false),
    ];

    // A fully idle local participant publishes nothing and has no incoming
    // media publishers to receive, so it needs no peers.
    expect(
      selectP2PMediaParticipants(participants, "viewer-c", false).map(
        (item) => item.id,
      ),
    ).toEqual([]);
  });

  it("keeps chat-only participants out even if they try local camera or voice", () => {
    const participants = [
      participant("host", true),
      participant("viewer", false, "none"),
    ];

    expect(
      selectP2PMediaParticipants(
        participants,
        "viewer",
        true,
        new Set(["viewer"]),
      ).map((item) => item.id),
    ).toEqual([]);
  });

  it("keeps receiving remote camera publishers while the local camera is off", () => {
    const participants = [
      participant("host", true),
      participant("viewer", false),
    ];

    expect(
      selectP2PMediaParticipants(participants, "viewer", false).map(
        (item) => item.id,
      ),
    ).toEqual(["host", "viewer"]);
  });

  it("includes the local participant while they are trying to take a media seat", () => {
    const participants = [
      participant("host", true),
      participant("viewer", false),
    ];

    expect(
      selectP2PMediaParticipants(participants, "viewer", true).map(
        (item) => item.id,
      ),
    ).toEqual(["host", "viewer"]);
  });

  it("does not pair chat-only remotes solely because local camera is being published", () => {
    const participants = [
      participant("host", false),
      participant("viewer-a", false, "none"),
      participant("viewer-b", false, "none"),
    ];

    // Larger rooms can have chat-only participants. They should not enter the
    // WebRTC mesh only because another participant is publishing camera.
    expect(
      selectP2PMediaParticipants(participants, "host", true).map(
        (item) => item.id,
      ),
    ).toEqual(["host"]);
  });

  it("pairs a talking participant with every media-seat participant", () => {
    const participants = [
      participant("host", false),
      participant("viewer-a", false),
      participant("viewer-b", false),
    ];

    // Voice is media-wide: while the local user talks, every media-seat
    // participant must get a peer to hear them.
    expect(
      selectP2PMediaParticipants(
        participants,
        "host",
        false,
        new Set(["host", "viewer-a"]),
      ).map((item) => item.id),
    ).toEqual(["host", "viewer-a", "viewer-b"]);
  });

  it("pairs a silent cam-less listener with talkers and camera publishers", () => {
    const participants = [
      participant("host", false),
      participant("viewer-a", true),
      participant("viewer-b", false),
    ];

    // Voice is joined for the talker, and remote camera publishers stay joined
    // so receiving video does not depend on publishing local video.
    expect(
      selectP2PMediaParticipants(
        participants,
        "viewer-b",
        false,
        new Set(["host"]),
      ).map((item) => item.id),
    ).toEqual(["host", "viewer-a", "viewer-b"]);
  });

  it("drops incoming P2P signals from chat-only participants", () => {
    const participants = [
      participant("host", true),
      participant("viewer-a", true),
      participant("viewer-b", false, "none"),
    ];

    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer-a",
        "host",
        false,
      ),
    ).toBe(true);
    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer-a",
        "viewer-b",
        false,
      ),
    ).toBe(false);
    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer-b",
        "host",
        false,
      ),
    ).toBe(false);
  });

  it("allows camera publisher signals while the local camera is off", () => {
    const participants = [
      participant("host", true),
      participant("viewer", false),
    ];

    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer",
        "host",
        false,
      ),
    ).toBe(true);
  });

  it("does not allow a new chat-only renegotiate solely from local camera intent", () => {
    const participants = [
      participant("host", false),
      participant("viewer", false, "none"),
    ];

    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "host",
        "viewer",
        true,
      ),
    ).toBe(false);
  });

  it("allows P2P signals for a voice-only peer while cameras are off", () => {
    const participants = [
      participant("host", false),
      participant("viewer", false),
    ];
    const voiceParticipantIds = new Set(["host", "viewer"]);

    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer",
        "host",
        false,
        voiceParticipantIds,
      ),
    ).toBe(true);
  });

  it("delivers talker signals to a cam-less listener in both directions", () => {
    const participants = [
      participant("host", false),
      participant("viewer", false),
    ];
    const onlyHostTalks = new Set(["host"]);

    // The listener holds no camera, no cam seat, and is not talking — they
    // must still complete the handshake with the talker to hear them.
    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "viewer",
        "host",
        false,
        onlyHostTalks,
      ),
    ).toBe(true);
    expect(
      canReceiveP2PSignalFromParticipant(
        participants,
        "host",
        "viewer",
        false,
        onlyHostTalks,
      ),
    ).toBe(true);
  });
});

class FakeRtcTransceiver {
  currentDirection: RTCRtpTransceiverDirection | null = null;
  direction: RTCRtpTransceiverDirection;
  mid: string | null = null;
  readonly receiver: { track: { kind: string } };
  readonly sender: {
    replaceTrack: ReturnType<typeof vi.fn>;
    track: MediaStreamTrack | null;
  };

  constructor(kind: "audio" | "video", direction: RTCRtpTransceiverDirection) {
    this.direction = direction;
    this.receiver = { track: { kind } };
    this.sender = { replaceTrack: vi.fn(async () => undefined), track: null };
  }
}

class FakeRtcPeerConnection extends EventTarget {
  static instances: FakeRtcPeerConnection[] = [];

  connectionState: RTCPeerConnectionState = "new";
  iceConnectionState: RTCIceConnectionState = "new";
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  signalingState: RTCSignalingState = "stable";
  readonly close = vi.fn(() => {
    this.signalingState = "closed";
  });
  readonly restartIce = vi.fn();
  readonly setConfiguration = vi.fn();
  private readonly transceivers: FakeRtcTransceiver[] = [];

  constructor() {
    super();
    FakeRtcPeerConnection.instances.push(this);
  }

  addTransceiver(
    kind: "audio" | "video",
    init?: RTCRtpTransceiverInit,
  ): FakeRtcTransceiver {
    const transceiver = new FakeRtcTransceiver(kind, init?.direction ?? "sendrecv");
    this.transceivers.push(transceiver);
    return transceiver;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "v=0\r\n" };
  }

  async getStats(): Promise<RTCStatsReport> {
    return statsReportFrom([]);
  }

  getTransceivers(): FakeRtcTransceiver[] {
    return this.transceivers;
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  readonly setRemoteDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.remoteDescription = description as RTCSessionDescription;
      this.signalingState =
        description.type === "offer" ? "have-remote-offer" : "stable";
    },
  );
}

describe("P2P idle peer linger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRtcPeerConnection.instances = [];
    vi.stubGlobal("RTCPeerConnection", FakeRtcPeerConnection);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps an idle peer warm for the linger window before closing it", async () => {
    const harness = createP2PControllerHarness();
    harness.controller.updateParticipants([participant("viewer", true)]);
    await vi.advanceTimersByTimeAsync(0);

    const pc = FakeRtcPeerConnection.instances[0];
    expect(pc).toBeDefined();
    expect(harness.controller.hasPeer("viewer")).toBe(true);

    harness.controller.updateParticipants([]);
    await vi.advanceTimersByTimeAsync(0);
    // The peer survives the publish stop; only the video expectation drops.
    expect(pc?.close).not.toHaveBeenCalled();
    expect(harness.controller.hasPeer("viewer")).toBe(true);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(pc?.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(pc?.close).toHaveBeenCalledTimes(1);
    expect(harness.controller.hasPeer("viewer")).toBe(false);

    harness.controller.disconnect();
  });

  it("cancels the linger close when the participant publishes again", async () => {
    const harness = createP2PControllerHarness();
    harness.controller.updateParticipants([participant("viewer", true)]);
    await vi.advanceTimersByTimeAsync(0);

    const pc = FakeRtcPeerConnection.instances[0];
    harness.controller.updateParticipants([]);
    await vi.advanceTimersByTimeAsync(1_000);

    harness.controller.updateParticipants([participant("viewer", true)]);
    await vi.advanceTimersByTimeAsync(60_000);

    // The camera re-toggle reused the existing connection: no close and no
    // second RTCPeerConnection.
    expect(pc?.close).not.toHaveBeenCalled();
    expect(FakeRtcPeerConnection.instances).toHaveLength(1);

    harness.controller.disconnect();
  });

  it("still closes a lingering peer immediately on bye", async () => {
    const harness = createP2PControllerHarness();
    harness.controller.updateParticipants([participant("viewer", true)]);
    await vi.advanceTimersByTimeAsync(0);

    const pc = FakeRtcPeerConnection.instances[0];
    harness.controller.updateParticipants([]);
    await vi.advanceTimersByTimeAsync(0);

    await harness.controller.handleSignal("viewer", { kind: "bye" });
    expect(pc?.close).toHaveBeenCalledTimes(1);

    // The cleared linger timer must not fire against a recreated peer later.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pc?.close).toHaveBeenCalledTimes(1);

    harness.controller.disconnect();
  });

  it("drops stale answers that arrive after the offerer returned to stable", async () => {
    const harness = createP2PControllerHarness();

    await harness.controller.handleSignal(
      "viewer",
      {
        kind: "answer",
        sdp: { type: "answer", sdp: "v=0\r\n" },
      },
      { senderConnectionId: "viewer-connection" },
    );

    const pc = FakeRtcPeerConnection.instances[0];
    expect(pc?.setRemoteDescription).not.toHaveBeenCalled();

    harness.controller.disconnect();
  });
});
