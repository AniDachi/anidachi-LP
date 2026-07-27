import { describe, expect, it } from "vitest";
import {
  classifyAudioSpeechActivity,
  classifyAudioTransportFlow,
  updateSpeakingHysteresis,
} from "../src/voice-activity";

describe("audio speech activity", () => {
  it("keeps a numeric quiet audio level quiet even while RTP counters move", () => {
    expect(
      classifyAudioSpeechActivity({
        audioLevel: 0.004,
        bytesReceived: 480,
        packetsReceived: 12,
      }),
    ).toBe("quiet");
  });

  it("does not infer speech from packet movement when audioLevel is unavailable", () => {
    expect(
      classifyAudioSpeechActivity({
        bytesReceived: 480,
        packetsReceived: 12,
      }),
    ).toBe("unknown");
  });

  it("enters active on the first above-threshold sample", () => {
    expect(classifyAudioSpeechActivity({ audioLevel: 0.01 })).toBe("active");
  });
});

describe("audio transport flow", () => {
  const connectedLiveReceiver = {
    connectionState: "connected" as const,
    expected: true,
    receiverTrackState: "live" as const,
    receiverTrackMuted: false,
  };

  it("treats static Opus DTX silence on a live receiver as healthy flow", () => {
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        previous: {
          audioLevel: 0,
          bytesReceived: 100,
          packetsReceived: 10,
        },
        current: {
          audioLevel: 0,
          bytesReceived: 100,
          packetsReceived: 10,
        },
      }),
    ).toBe("flowing");
  });

  it("uses RTP progression as positive flow evidence without treating it as speech", () => {
    const current = {
      bytesReceived: 480,
      packetsReceived: 12,
    };

    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        previous: {
          bytesReceived: 100,
          packetsReceived: 10,
        },
        current,
      }),
    ).toBe("flowing");
    expect(classifyAudioSpeechActivity(current)).toBe("unknown");
  });

  it("classifies a missing report or receiver track separately from healthy silence", () => {
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        current: undefined,
        previous: undefined,
      }),
    ).toBe("missing");
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        current: { audioLevel: 0 },
        previous: { audioLevel: 0 },
        receiverTrackState: "missing",
      }),
    ).toBe("missing");
  });

  it("classifies technically muted and ended receivers as stalled", () => {
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        current: { audioLevel: 0 },
        previous: { audioLevel: 0 },
        receiverTrackMuted: true,
      }),
    ).toBe("stalled");
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        current: { audioLevel: 0 },
        previous: { audioLevel: 0 },
        receiverTrackState: "ended",
      }),
    ).toBe("stalled");
  });

  it("does not classify transport before publication or connection is ready", () => {
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        current: { audioLevel: 0 },
        expected: false,
        previous: { audioLevel: 0 },
      }),
    ).toBe("not-expected");
    expect(
      classifyAudioTransportFlow({
        ...connectedLiveReceiver,
        connectionState: "connecting",
        current: { audioLevel: 0 },
        previous: { audioLevel: 0 },
      }),
    ).toBe("unknown");
  });
});

describe("speaking hysteresis", () => {
  it("clears speaking only after three consecutive quiet samples", () => {
    const active = updateSpeakingHysteresis(
      { speaking: false, quietSamples: 0 },
      "active",
    );
    const quiet1 = updateSpeakingHysteresis(active, "quiet");
    const quiet2 = updateSpeakingHysteresis(quiet1, "quiet");
    const quiet3 = updateSpeakingHysteresis(quiet2, "quiet");

    expect(active).toEqual({ speaking: true, quietSamples: 0 });
    expect(quiet1).toEqual({ speaking: true, quietSamples: 1 });
    expect(quiet2).toEqual({ speaking: true, quietSamples: 2 });
    expect(quiet3).toEqual({ speaking: false, quietSamples: 3 });
  });

  it("clears stale speaking after three consecutive unknown samples", () => {
    const unknown1 = updateSpeakingHysteresis(
      { speaking: true, quietSamples: 0 },
      "unknown",
    );
    const unknown2 = updateSpeakingHysteresis(unknown1, "unknown");
    const unknown3 = updateSpeakingHysteresis(unknown2, "unknown");

    expect(unknown1).toEqual({ speaking: true, quietSamples: 1 });
    expect(unknown2).toEqual({ speaking: true, quietSamples: 2 });
    expect(unknown3).toEqual({ speaking: false, quietSamples: 3 });
  });
});
