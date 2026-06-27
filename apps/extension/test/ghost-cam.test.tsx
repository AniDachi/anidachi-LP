import type { Participant } from "@anidachi/protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockP2PMedia = vi.hoisted(() => {
  const controllers: Array<{
    disconnect: ReturnType<typeof vi.fn>;
    handleSignal: ReturnType<typeof vi.fn>;
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

import { useGhostCam } from "../src/ghost-cam";

function participant(id: string, displayName = "Host"): Participant {
  return {
    cameraEnabled: false,
    displayName,
    id,
    lastSeenAt: 1,
    role: "host",
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
  participant: activeParticipant,
  participants,
}: {
  participant: Participant;
  participants: Participant[];
}) {
  useGhostCam({
    cameraEnabled: true,
    connected: true,
    incomingP2PSignals: [],
    onCameraStatus: noopCameraStatus,
    participant: activeParticipant,
    participants,
    roomGeneration: 1,
    roomId: "room-1",
    roomToken: "token-1",
    sendP2PSignal: noopSendP2PSignal,
    sourceGeneration: 1,
    transport: "p2p",
    voiceTalkActive: false,
  });
  return null;
}

describe("useGhostCam P2P session lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    noopCameraStatus.mockClear();
    noopSendP2PSignal.mockClear();
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
});
