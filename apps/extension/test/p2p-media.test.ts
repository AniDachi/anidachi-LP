import { describe, expect, it } from "vitest";
import {
  getP2PAudioTransceiverDirection,
  isPoliteP2PPeer,
  p2pAudioTrackSwapNeedsNegotiation,
  shouldInitiateP2POffers,
} from "../src/p2p-media";

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
