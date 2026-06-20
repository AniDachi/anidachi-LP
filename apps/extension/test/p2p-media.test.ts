import { describe, expect, it } from "vitest";
import {
  canReceiveP2PSignalFromParticipant,
  classifyPeerHealth,
  getP2PAudioTransceiverDirection,
  isPoliteP2PPeer,
  p2pAudioTrackSwapNeedsNegotiation,
  reconcilePeerAction,
  selectP2PMediaParticipants,
  shouldInitiateP2POffers,
} from "../src/p2p-media";
import type { Participant } from "@anidachi/protocol";

function participant(id: string, cameraEnabled = false): Participant {
  return {
    id,
    displayName: id,
    role: id === "host" ? "host" : "viewer",
    cameraEnabled,
    syncStatus: "unknown",
    lastSeenAt: 1,
  };
}

describe("P2P perfect negotiation role helpers", () => {
  it("uses the lower deterministic participant id as the offer initiator", () => {
    expect(shouldInitiateP2POffers("participant-a", "participant-b")).toBe(true);
    expect(isPoliteP2PPeer("participant-a", "participant-b")).toBe(false);
  });

  it("uses the higher deterministic participant id as the polite peer", () => {
    expect(shouldInitiateP2POffers("participant-b", "participant-a")).toBe(false);
    expect(isPoliteP2PPeer("participant-b", "participant-a")).toBe(true);
  });

  it("does not initiate offers against the same participant id", () => {
    expect(shouldInitiateP2POffers("participant-a", "participant-a")).toBe(false);
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
    expect(reconcilePeerAction("disconnected", "connected")).toBe("restart-ice");
    expect(reconcilePeerAction("connected", "failed")).toBe("restart-ice");
    expect(reconcilePeerAction("connected", "disconnected")).toBe("restart-ice");
  });

  it("re-syncs media (idempotent) when the connection is healthy", () => {
    expect(reconcilePeerAction("connected", "connected")).toBe("sync");
    expect(reconcilePeerAction("connecting", "checking")).toBe("sync");
    expect(reconcilePeerAction("new", "new")).toBe("sync");
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

describe("P2P media participant selection", () => {
  it("keeps chat-only participants out of the WebRTC mesh", () => {
    const participants = [
      participant("host", true),
      participant("viewer-a", true),
      participant("viewer-b", false),
      participant("viewer-c", false),
    ];

    expect(selectP2PMediaParticipants(participants, "viewer-c", false).map((item) => item.id)).toEqual([
      "host",
      "viewer-a",
    ]);
  });

  it("includes the local participant while they are trying to take a media seat", () => {
    const participants = [participant("host", true), participant("viewer", false)];

    expect(selectP2PMediaParticipants(participants, "viewer", true).map((item) => item.id)).toEqual([
      "host",
      "viewer",
    ]);
  });

  it("drops incoming P2P signals from chat-only participants", () => {
    const participants = [
      participant("host", true),
      participant("viewer-a", true),
      participant("viewer-b", false),
    ];

    expect(canReceiveP2PSignalFromParticipant(participants, "viewer-a", "host", false)).toBe(true);
    expect(canReceiveP2PSignalFromParticipant(participants, "viewer-a", "viewer-b", false)).toBe(
      false,
    );
    expect(canReceiveP2PSignalFromParticipant(participants, "viewer-b", "host", false)).toBe(false);
  });
});
