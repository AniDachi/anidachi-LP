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
    const controller = {
      disconnect: vi.fn(),
      handleSignal: vi.fn(),
      handleSignalingTransportReady: vi.fn(() => Promise.resolve()),
      hasPeer: vi.fn(() => false),
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

  return { controllers, options, P2PMediaController };
});

vi.mock("../src/p2p-ice", () => ({
  loadP2PIceServers: vi.fn(() => Promise.resolve([])),
  refreshP2PIceServers: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../src/p2p-media", () => ({
  canReceiveP2PSignalFromParticipant: vi.fn(() => true),
  P2PMediaController: mockP2PMedia.P2PMediaController,
  selectP2PMediaParticipants: vi.fn(
    (participants: Participant[], localParticipantId: string, localMediaWanted: boolean) =>
      participants.filter((participant) =>
        participant.id === localParticipantId ? localMediaWanted : participant.cameraEnabled,
      ),
  ),
}));

import { canReceiveP2PSignalFromParticipant } from "../src/p2p-media";
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
  connected = true,
  incomingP2PSignals = [],
  onSession,
  participant: activeParticipant,
  participantAudioPreferenceScope = "account-1",
  participantAudioPreferences = {},
  participantAudioPreferencesReady = true,
  participants,
  roomId = "room-1",
  signalingTransportReady = null,
  sourceGeneration = 1,
}: {
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
  roomId?: string;
  signalingTransportReady?: SignalingTransportReady | null;
  sourceGeneration?: number;
}) {
  const session = useGhostCam({
    cameraEnabled: true,
    connected,
    incomingP2PSignals,
    onCameraStatus: noopCameraStatus,
    participant: activeParticipant,
    participantAudioPreferenceScope,
    participantAudioPreferences,
    participantAudioPreferencesReady,
    participants,
    roomGeneration: 1,
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
    ).toHaveBeenCalledWith(true, "immediate");

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
          sourceGeneration={2}
        />,
      );
    });
    await act(async () => undefined);

    expect(mockP2PMedia.controllers).toHaveLength(2);
    expect(
      mockP2PMedia.controllers[1].setMicrophonePublishing,
    ).toHaveBeenCalledWith(false, "immediate");

    await act(async () => root.unmount());
  });

  it("restores explicit microphone publication after a same-room controller replacement", async () => {
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
          sourceGeneration={1}
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
          sourceGeneration={2}
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
    ).toHaveBeenCalledWith(true, "warm");

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
    ).toHaveBeenCalledWith(false, "immediate");

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
    ).toHaveBeenCalledWith(false, "immediate");

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
