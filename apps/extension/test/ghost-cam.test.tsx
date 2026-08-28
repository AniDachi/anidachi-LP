import type { Participant } from "@anidachi/protocol";
import type {
  IncomingP2PSignal,
  MicrophoneStatus,
  MicrophoneTerminalFailure,
  SignalingTransportReady,
} from "../src/media-types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockP2PMedia = vi.hoisted(() => {
  const handleSignalResults: boolean[] = [];
  const options: Array<{
    onMicrophoneStatusChange: (status: MicrophoneStatus) => void;
    onMicrophoneTerminalFailure: (
      failure: MicrophoneTerminalFailure,
    ) => void;
    sendSignal: (
      toUserId: string,
      signal: IncomingP2PSignal["signal"],
      metadata: { senderMediaSessionId: string },
    ) => "sent" | "queued" | "dropped";
  }> = [];
  const controllers: Array<{
    disconnect: ReturnType<typeof vi.fn>;
    handleSignal: ReturnType<typeof vi.fn>;
    handleSignalingTransportReady: ReturnType<typeof vi.fn>;
    hasPeer: ReturnType<typeof vi.fn>;
    isRemoteVoicePublishing: ReturnType<typeof vi.fn>;
    replaceParticipantAudioOutputs: ReturnType<typeof vi.fn>;
    setCameraEnabled: ReturnType<typeof vi.fn>;
    setMicrophonePublishing: ReturnType<typeof vi.fn>;
    setParticipantAudioOutput: ReturnType<typeof vi.fn>;
    unlockAudio: ReturnType<typeof vi.fn>;
    updateParticipants: ReturnType<typeof vi.fn>;
  }> = [];

  const P2PMediaController = vi.fn(function MockP2PMediaController(
    controllerOptions: (typeof options)[number],
  ) {
    options.push(controllerOptions);
    const remoteVoicePublishingIds = new Set<string>();
    const senderMediaSessionIds = new Map<string, string>();
    const controller = {
      disconnect: vi.fn(),
      handleSignal: vi.fn(
        (
          fromUserId: string,
          signal: IncomingP2PSignal["signal"],
          metadata: { senderMediaSessionId?: string } = {},
        ) => {
          const accepted = handleSignalResults.shift() ?? true;
          if (!accepted) {
            return Promise.resolve(false);
          }
          const previousSessionId = senderMediaSessionIds.get(fromUserId);
          if (
            previousSessionId &&
            metadata.senderMediaSessionId &&
            previousSessionId !== metadata.senderMediaSessionId
          ) {
            remoteVoicePublishingIds.delete(fromUserId);
          }
          if (metadata.senderMediaSessionId) {
            senderMediaSessionIds.set(
              fromUserId,
              metadata.senderMediaSessionId,
            );
          }
          if (signal.kind === "voice-start") {
            remoteVoicePublishingIds.add(fromUserId);
          } else if (
            signal.kind === "voice-stop" ||
            signal.kind === "bye"
          ) {
            remoteVoicePublishingIds.delete(fromUserId);
          }
          return Promise.resolve(true);
        },
      ),
      handleSignalingTransportReady: vi.fn(() => Promise.resolve()),
      hasPeer: vi.fn(() => false),
      isRemoteVoicePublishing: vi.fn((participantId: string) =>
        remoteVoicePublishingIds.has(participantId),
      ),
      replaceParticipantAudioOutputs: vi.fn(),
      setCameraEnabled: vi.fn(() => Promise.resolve()),
      setMicrophonePublishing: vi.fn(() => Promise.resolve()),
      setParticipantAudioOutput: vi.fn(),
      unlockAudio: vi.fn(() => Promise.resolve()),
      updateParticipants: vi.fn(),
    };
    controllers.push(controller);
    return controller;
  });

  return {
    controllers,
    handleSignalResults,
    options,
    P2PMediaController,
  };
});

vi.mock("../src/p2p-ice", () => ({
  loadP2PIceServers: vi.fn(() => Promise.resolve([])),
  refreshP2PIceServers: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../src/p2p-media", () => ({
  canReceiveP2PSignalFromParticipant: vi.fn(() => true),
  P2PMediaController: mockP2PMedia.P2PMediaController,
  selectP2PMediaParticipants: vi.fn(
    (
      participants: Participant[],
      localParticipantId: string,
      localMediaWanted: boolean,
      voiceParticipantIds: ReadonlySet<string> = new Set(),
    ) => {
      const mediaParticipants = participants.filter(
        (participant) => participant.mediaSeat === "joined",
      );
      const local = mediaParticipants.find(
        (participant) => participant.id === localParticipantId,
      );
      if (!local) {
        return [];
      }
      const localPublishes =
        localMediaWanted ||
        Boolean(local.cameraEnabled) ||
        voiceParticipantIds.has(localParticipantId);
      const remoteIds = new Set(
        mediaParticipants
          .filter(
            (participant) =>
              participant.id !== localParticipantId &&
              (localPublishes ||
                participant.cameraEnabled ||
                voiceParticipantIds.has(participant.id)),
          )
          .map((participant) => participant.id),
      );
      const localIncluded = localPublishes || remoteIds.size > 0;
      return mediaParticipants.filter((participant) =>
        participant.id === localParticipantId
          ? localIncluded
          : remoteIds.has(participant.id),
      );
    },
  ),
}));

import { canReceiveP2PSignalFromParticipant } from "../src/p2p-media";
import { loadP2PIceServers } from "../src/p2p-ice";
import { type GhostCamSession, useGhostCam } from "../src/ghost-cam";
import type { ParticipantAudioPreference } from "../src/voice-audio-preferences";

function participant(
  id: string,
  displayName = "Host",
  role: Participant["role"] = "host",
): Participant {
  return {
    cameraEnabled: false,
    displayName,
    id,
    lastSeenAt: 1,
    mediaSeat: "joined",
    mediaSeatSource: "auto",
    role,
    syncStatus: "synced",
  };
}

function renderGhostCam(root: Root, activeParticipant: Participant) {
  root.render(
    <GhostCamHarness participant={activeParticipant} participants={[activeParticipant]} />,
  );
}

const noopCameraStatus = vi.fn();
const noopSendP2PSignal = vi.fn();

function GhostCamHarness({
  cameraEnabled = true,
  connected = true,
  incomingP2PSignals = [],
  onSession,
  participant: activeParticipant,
  participantAudioPreferenceScope = "account-1",
  participantAudioPreferences = {},
  participantAudioPreferencesReady = true,
  participants,
  roomGeneration = 1,
  roomId = "room-1",
  signalingTransportReady = null,
  sourceGeneration = 1,
}: {
  cameraEnabled?: boolean;
  connected?: boolean;
  incomingP2PSignals?: IncomingP2PSignal[];
  onSession?: (session: GhostCamSession) => void;
  participant: Participant;
  participantAudioPreferenceScope?: string;
  participantAudioPreferences?: Readonly<
    Record<string, ParticipantAudioPreference>
  >;
  participantAudioPreferencesReady?: boolean;
  participants: Participant[];
  roomGeneration?: number;
  roomId?: string;
  signalingTransportReady?: SignalingTransportReady | null;
  sourceGeneration?: number;
}) {
  const session = useGhostCam({
    cameraEnabled,
    connected,
    incomingP2PSignals,
    onCameraStatus: noopCameraStatus,
    participant: activeParticipant,
    participantAudioPreferenceScope,
    participantAudioPreferences,
    participantAudioPreferencesReady,
    participants,
    roomGeneration,
    roomId,
    roomToken: "token-1",
    sendP2PSignal: noopSendP2PSignal,
    signalingTransportReady,
    sourceGeneration,
  });
  onSession?.(session);
  return null;
}

describe("useGhostCam P2P session lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    noopCameraStatus.mockClear();
    noopSendP2PSignal.mockClear();
    vi.mocked(canReceiveP2PSignalFromParticipant).mockReset();
    vi.mocked(canReceiveP2PSignalFromParticipant).mockReturnValue(true);
    mockP2PMedia.controllers.length = 0;
    mockP2PMedia.handleSignalResults.length = 0;
    mockP2PMedia.options.length = 0;
    mockP2PMedia.P2PMediaController.mockClear();
    document.body.replaceChildren();
  });

  it("keeps the same media controller when the same participant id is refreshed as a new object", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      renderGhostCam(root, participant("user-1", "Host"));
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(1);
    const firstController = mockP2PMedia.controllers[0];

    await act(async () => {
      renderGhostCam(root, participant("user-1", "Host Updated"));
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(1);
    expect(firstController.disconnect).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    expect(firstController.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the same media controller when the room switches source generation", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("user-1", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          sourceGeneration={1}
        />,
      );
    });
    await act(async () => undefined);

    const firstController = mockP2PMedia.controllers[0];
    await act(async () => {
      await session?.setMicrophonePublishing(true, "warm", "open-mic");
    });

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          sourceGeneration={2}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(1);
    expect(firstController.disconnect).not.toHaveBeenCalled();
    expect(firstController.setCameraEnabled).toHaveBeenCalledTimes(1);
    expect(firstController.setMicrophonePublishing).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });

  it("replays buffered signals against the latest source generation while ICE loads", async () => {
    const iceServers = deferred<RTCIceServer[]>();
    vi.mocked(loadP2PIceServers).mockImplementationOnce(() => iceServers.promise);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const signal: IncomingP2PSignal = {
      clientSignalId: "signal-source-2",
      fromUserId: viewer.id,
      roomGeneration: 1,
      senderConnectionId: "connection-viewer",
      sequence: 1,
      signal: { kind: "renegotiate" },
      sourceGeneration: 2,
    };

    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[]}
          participant={host}
          participants={[host, viewer]}
          sourceGeneration={1}
        />,
      );
      await Promise.resolve();
    });
    expect(mockP2PMedia.controllers).toHaveLength(0);

    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[signal]}
          participant={host}
          participants={[host, viewer]}
          sourceGeneration={2}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      iceServers.resolve([]);
      await iceServers.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockP2PMedia.controllers).toHaveLength(1);
    expect(mockP2PMedia.controllers[0]?.handleSignal).toHaveBeenCalledWith(
      viewer.id,
      signal.signal,
      { senderConnectionId: signal.senderConnectionId },
    );

    await act(async () => root.unmount());
  });

  it("delivers a signal from an existing peer even if the latest snapshot is temporarily inactive", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const signal: IncomingP2PSignal = {
      clientSignalId: "signal-1",
      fromUserId: "viewer",
      roomGeneration: 1,
      senderConnectionId: "connection-viewer",
      sequence: 1,
      signal: { kind: "renegotiate" },
      sourceGeneration: 1,
    };

    vi.mocked(canReceiveP2PSignalFromParticipant).mockReturnValue(false);

    await act(async () => {
      root.render(<GhostCamHarness participant={host} participants={[host, viewer]} />);
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    controller.hasPeer.mockReturnValue(true);

    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[signal]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(controller.handleSignal).toHaveBeenCalledWith(
      "viewer",
      {
        kind: "renegotiate",
      },
      {
        senderConnectionId: "connection-viewer",
      },
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("rejects a late voice-start after the remote media seat becomes inactive", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");

    await act(async () => {
      root.render(<GhostCamHarness participant={host} participants={[host, viewer]} />);
    });
    await act(async () => undefined);

    vi.mocked(canReceiveP2PSignalFromParticipant).mockReturnValue(false);
    const controller = mockP2PMedia.controllers[0];
    controller.hasPeer.mockReturnValue(true);

    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[
            {
              clientSignalId: "late-voice-start",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection",
              sequence: 1,
              signal: {
                kind: "voice-start",
                voiceMode: "push-to-talk",
              },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(controller.handleSignal).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("filters an unauthorized pending voice-start before controller replay", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    vi.mocked(canReceiveP2PSignalFromParticipant).mockReturnValue(false);

    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[
            {
              clientSignalId: "pending-voice-start",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection",
              sequence: 1,
              signal: {
                kind: "voice-start",
                voiceMode: "push-to-talk",
              },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers[0].handleSignal).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("forgets stale voice intent across media-seat revoke and regrant", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const voiceStart: IncomingP2PSignal = {
      clientSignalId: "voice-start",
      fromUserId: "viewer",
      roomGeneration: 1,
      senderConnectionId: "viewer-connection",
      sequence: 1,
      signal: { kind: "voice-start", voiceMode: "push-to-talk" },
      sourceGeneration: 1,
    };

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    expect(
      controller.updateParticipants.mock.calls.at(-1)?.[0].map(
        (item: Participant) => item.id,
      ),
    ).toContain("viewer");

    const revokedViewer = {
      ...viewer,
      mediaSeat: "none" as const,
      mediaSeatSource: undefined,
    };
    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, revokedViewer]}
        />,
      );
    });
    await act(async () => undefined);

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(controller.updateParticipants.mock.calls.at(-1)?.[0]).toEqual([]);

    await act(async () => root.unmount());
  });

  it("reconciles the media mesh after buffered voice start and stop", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[
            {
              clientSignalId: "buffered-voice-start",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection",
              sequence: 1,
              signal: {
                kind: "voice-start",
                voiceMode: "push-to-talk",
              },
              sourceGeneration: 1,
            },
            {
              clientSignalId: "buffered-voice-stop",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection",
              sequence: 2,
              signal: { kind: "voice-stop" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    expect(controller.handleSignal).toHaveBeenCalledTimes(2);
    expect(controller.updateParticipants.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(
      controller.updateParticipants.mock.invocationCallOrder.at(-1),
    ).toBeGreaterThan(
      controller.handleSignal.mock.invocationCallOrder.at(-1) ?? 0,
    );

    await act(async () => root.unmount());
  });

  it("keeps current voice intent when a live stale voice-stop is rejected", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const voiceStart: IncomingP2PSignal = {
      clientSignalId: "voice-start-current",
      fromUserId: "viewer",
      roomGeneration: 1,
      senderConnectionId: "viewer-connection-b",
      senderMediaSessionId: "viewer-media-b",
      sequence: 1,
      signal: { kind: "voice-start", voiceMode: "open-mic" },
      sourceGeneration: 1,
    };

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    mockP2PMedia.handleSignalResults.push(false);
    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[
            voiceStart,
            {
              clientSignalId: "voice-stop-stale",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection-a",
              senderMediaSessionId: "viewer-media-a",
              sequence: 2,
              signal: { kind: "voice-stop" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(
      controller.updateParticipants.mock.calls.at(-1)?.[0].map(
        (item: Participant) => item.id,
      ),
    ).toContain("viewer");

    await act(async () => root.unmount());
  });

  it("keeps current voice intent when a buffered stale voice-stop is rejected", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    mockP2PMedia.handleSignalResults.push(true, false);

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[
            {
              clientSignalId: "buffered-current-start",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection-b",
              senderMediaSessionId: "viewer-media-b",
              sequence: 1,
              signal: { kind: "voice-start", voiceMode: "open-mic" },
              sourceGeneration: 1,
            },
            {
              clientSignalId: "buffered-stale-stop",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection-a",
              senderMediaSessionId: "viewer-media-a",
              sequence: 2,
              signal: { kind: "voice-stop" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    expect(
      controller.updateParticipants.mock.calls.at(-1)?.[0].map(
        (item: Participant) => item.id,
      ),
    ).toContain("viewer");

    await act(async () => root.unmount());
  });

  it("clears voice intent when an accepted signal replaces the media session", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const voiceStart: IncomingP2PSignal = {
      clientSignalId: "session-a-start",
      fromUserId: "viewer",
      roomGeneration: 1,
      senderConnectionId: "viewer-connection-a",
      senderMediaSessionId: "viewer-media-a",
      sequence: 1,
      signal: { kind: "voice-start", voiceMode: "open-mic" },
      sourceGeneration: 1,
    };

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[
            voiceStart,
            {
              clientSignalId: "session-b-renegotiate",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection-b",
              senderMediaSessionId: "viewer-media-b",
              sequence: 2,
              signal: { kind: "renegotiate" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(
      mockP2PMedia.controllers[0].updateParticipants.mock.calls.at(-1)?.[0],
    ).toEqual([]);

    await act(async () => root.unmount());
  });

  it("clears voice intent after an accepted bye", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");
    const voiceStart: IncomingP2PSignal = {
      clientSignalId: "voice-before-bye",
      fromUserId: "viewer",
      roomGeneration: 1,
      senderConnectionId: "viewer-connection",
      senderMediaSessionId: "viewer-media",
      sequence: 1,
      signal: { kind: "voice-start", voiceMode: "push-to-talk" },
      sourceGeneration: 1,
    };

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[voiceStart]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    await act(async () => {
      root.render(
        <GhostCamHarness
          cameraEnabled={false}
          incomingP2PSignals={[
            voiceStart,
            {
              clientSignalId: "voice-bye",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection",
              senderMediaSessionId: "viewer-media",
              sequence: 2,
              signal: { kind: "bye" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(
      mockP2PMedia.controllers[0].updateParticipants.mock.calls.at(-1)?.[0],
    ).toEqual([]);

    await act(async () => root.unmount());
  });

  it("preserves media-session metadata on incoming signals", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewer = participant("viewer", "Viewer", "viewer");

    await act(async () => {
      root.render(
        <GhostCamHarness participant={host} participants={[host, viewer]} />,
      );
    });
    await act(async () => undefined);

    const controller = mockP2PMedia.controllers[0];
    await act(async () => {
      root.render(
        <GhostCamHarness
          incomingP2PSignals={[
            {
              clientSignalId: "signal-media-session",
              fromUserId: "viewer",
              roomGeneration: 1,
              senderConnectionId: "viewer-connection-b",
              senderMediaSessionId: "viewer-media-a",
              sequence: 1,
              signal: { kind: "renegotiate" },
              sourceGeneration: 1,
            },
          ]}
          participant={host}
          participants={[host, viewer]}
        />,
      );
    });
    await act(async () => undefined);

    expect(controller.handleSignal).toHaveBeenCalledWith(
      "viewer",
      { kind: "renegotiate" },
      {
        senderConnectionId: "viewer-connection-b",
        senderMediaSessionId: "viewer-media-a",
      },
    );

    await act(async () => root.unmount());
  });

  it("delivers snapshot readiness after the async controller is available", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const ready = {
      reconnect: true,
      senderConnectionId: "host-connection-b",
    } satisfies SignalingTransportReady;

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participants={[host]}
          signalingTransportReady={ready}
        />,
      );
    });
    await act(async () => undefined);

    expect(
      mockP2PMedia.controllers[0].handleSignalingTransportReady,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockP2PMedia.controllers[0].handleSignalingTransportReady,
    ).toHaveBeenCalledWith(ready);

    await act(async () => root.unmount());
  });

  it("forwards the controller media-session id to the room sender", async () => {
    noopSendP2PSignal.mockReturnValue("sent");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");

    await act(async () => {
      root.render(<GhostCamHarness participant={host} participants={[host]} />);
    });
    await act(async () => undefined);

    const disposition = mockP2PMedia.options[0].sendSignal(
      "viewer",
      { kind: "bye" },
      { senderMediaSessionId: "host-media-a" },
    );

    expect(disposition).toBe("sent");
    expect(noopSendP2PSignal).toHaveBeenCalledWith(
      "viewer",
      { kind: "bye" },
      "host-media-a",
    );

    await act(async () => root.unmount());
  });

  it("exposes generic microphone publication and typed terminal failures", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);

    await act(async () => {
      await session?.setMicrophonePublishing(true, "immediate");
    });
    expect(
      mockP2PMedia.controllers[0].setMicrophonePublishing,
    ).toHaveBeenCalledWith(true, "immediate", "push-to-talk");

    const failure = {
      errorName: "NotAllowedError",
      message: "Microphone access is blocked.",
      reason: "permission-denied",
    } satisfies MicrophoneTerminalFailure;
    await act(async () => {
      mockP2PMedia.options[0].onMicrophoneTerminalFailure(failure);
      mockP2PMedia.options[0].onMicrophoneStatusChange("error");
    });

    const renderedSession = session as GhostCamSession | null;
    if (!renderedSession) {
      throw new Error("Expected a rendered ghost-cam session.");
    }
    expect(renderedSession.microphoneTerminalFailure).toEqual(failure);
    expect(renderedSession.microphoneStatus).toBe("error");

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          roomGeneration={2}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledWith(false, "immediate", "push-to-talk");

    await act(async () => root.unmount());
  });

  it("restores explicit microphone publication after a room-generation controller replacement", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          roomGeneration={1}
        />,
      );
    });
    await act(async () => undefined);
    await act(async () => {
      await session?.setMicrophonePublishing(true, "warm");
    });

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          roomGeneration={2}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledWith(true, "warm", "push-to-talk");

    await act(async () => root.unmount());
  });

  it("does not carry microphone publication into another room", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          roomId="room-1"
        />,
      );
    });
    await act(async () => undefined);
    await act(async () => {
      await session?.setMicrophonePublishing(true, "warm");
    });

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
          roomId="room-2"
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledWith(false, "immediate", "push-to-talk");

    await act(async () => root.unmount());
  });

  it("does not restore microphone publication after leaving and rejoining", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    await act(async () => {
      await session?.setMicrophonePublishing(true, "warm");
    });

    await act(async () => {
      root.render(
        <GhostCamHarness
          connected={false}
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledWith(false, "immediate", "push-to-talk");

    await act(async () => root.unmount());
  });

  it("waits for participant audio preferences before creating a controller", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const viewerPreference = {
      muted: true,
      volume: 0.3,
    } satisfies ParticipantAudioPreference;

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participantAudioPreferences={{ viewer: viewerPreference }}
          participantAudioPreferencesReady={false}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    expect(mockP2PMedia.controllers).toHaveLength(0);

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participantAudioPreferences={{ viewer: viewerPreference }}
          participantAudioPreferencesReady
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(1);
    expect(
      mockP2PMedia.controllers[0].replaceParticipantAudioOutputs,
    ).toHaveBeenCalledWith({ viewer: viewerPreference });
    expect(
      mockP2PMedia.controllers[0].replaceParticipantAudioOutputs.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mockP2PMedia.controllers[0].setCameraEnabled.mock.invocationCallOrder[0],
    );

    await act(async () => root.unmount());
  });

  it("applies participant output updates to the live controller", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    let session: GhostCamSession | null = null;

    await act(async () => {
      root.render(
        <GhostCamHarness
          onSession={(value) => {
            session = value;
          }}
          participant={host}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    await act(async () => {
      session?.setParticipantAudioOutput("viewer", {
        muted: false,
        volume: 0.55,
      });
    });

    expect(
      mockP2PMedia.controllers[0].setParticipantAudioOutput,
    ).toHaveBeenCalledWith("viewer", {
      muted: false,
      volume: 0.55,
    });

    await act(async () => root.unmount());
  });

  it("clears old-listener output preferences before loading another account", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const host = participant("host", "Host");
    const accountA = {
      viewer: { muted: true, volume: 0.2 },
    } satisfies Record<string, ParticipantAudioPreference>;
    const accountB = {
      viewer: { muted: false, volume: 0.8 },
    } satisfies Record<string, ParticipantAudioPreference>;

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participantAudioPreferenceScope="account-a"
          participantAudioPreferences={accountA}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    expect(mockP2PMedia.controllers).toHaveLength(1);

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participantAudioPreferenceScope="account-b"
          participantAudioPreferences={accountA}
          participantAudioPreferencesReady={false}
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);
    expect(mockP2PMedia.controllers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(mockP2PMedia.controllers).toHaveLength(1);

    await act(async () => {
      root.render(
        <GhostCamHarness
          participant={host}
          participantAudioPreferenceScope="account-b"
          participantAudioPreferences={accountB}
          participantAudioPreferencesReady
          participants={[host]}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].replaceParticipantAudioOutputs,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockP2PMedia.controllers[1].replaceParticipantAudioOutputs,
    ).toHaveBeenCalledWith(accountB);

    await act(async () => root.unmount());
  });
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
