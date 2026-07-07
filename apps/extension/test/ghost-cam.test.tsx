import type { Participant } from "@anidachi/protocol";
import type { IncomingP2PSignal } from "../src/media-types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockP2PMedia = vi.hoisted(() => {
  const controllers: Array<{
    disconnect: ReturnType<typeof vi.fn>;
    handleSignal: ReturnType<typeof vi.fn>;
    hasPeer: ReturnType<typeof vi.fn>;
    setCameraEnabled: ReturnType<typeof vi.fn>;
    startVoiceTalk: ReturnType<typeof vi.fn>;
    stopVoiceTalk: ReturnType<typeof vi.fn>;
    unlockAudio: ReturnType<typeof vi.fn>;
    updateParticipants: ReturnType<typeof vi.fn>;
  }> = [];

  const P2PMediaController = vi.fn(function MockP2PMediaController() {
    const controller = {
      disconnect: vi.fn(),
      handleSignal: vi.fn(),
      hasPeer: vi.fn(() => false),
      setCameraEnabled: vi.fn(() => Promise.resolve()),
      startVoiceTalk: vi.fn(() => Promise.resolve()),
      stopVoiceTalk: vi.fn(() => Promise.resolve()),
      unlockAudio: vi.fn(() => Promise.resolve()),
      updateParticipants: vi.fn(),
    };
    controllers.push(controller);
    return controller;
  });

  return { controllers, P2PMediaController };
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
import { useGhostCam } from "../src/ghost-cam";

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
  incomingP2PSignals = [],
  participant: activeParticipant,
  participants,
}: {
  incomingP2PSignals?: IncomingP2PSignal[];
  participant: Participant;
  participants: Participant[];
}) {
  useGhostCam({
    cameraEnabled: true,
    connected: true,
    incomingP2PSignals,
    onCameraStatus: noopCameraStatus,
    participant: activeParticipant,
    participants,
    roomGeneration: 1,
    roomId: "room-1",
    roomToken: "token-1",
    sendP2PSignal: noopSendP2PSignal,
    sourceGeneration: 1,
    voiceTalkActive: false,
  });
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

    expect(controller.handleSignal).toHaveBeenCalledWith("viewer", {
      kind: "renegotiate",
    });

    await act(async () => {
      root.unmount();
    });
  });
});
