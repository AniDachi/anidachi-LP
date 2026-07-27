export const AUDIO_SPEECH_LEVEL_THRESHOLD = 0.01;
export const AUDIO_QUIET_SAMPLES_BEFORE_CLEAR = 3;

export interface AudioActivityStats {
  audioLevel?: number;
  bytesReceived?: number;
  bytesSent?: number;
  jitter?: number;
  packetsReceived?: number;
  packetsSent?: number;
}

export type AudioSpeechActivity = "active" | "quiet" | "unknown";

export type AudioTransportFlow =
  | "flowing"
  | "missing"
  | "not-expected"
  | "stalled"
  | "unknown";

export type AudioReceiverTrackState = MediaStreamTrackState | "missing";

export interface AudioTransportSample {
  connectionState: RTCPeerConnectionState;
  current: AudioActivityStats | undefined;
  expected: boolean;
  previous: AudioActivityStats | undefined;
  receiverTrackMuted: boolean;
  receiverTrackState: AudioReceiverTrackState;
}

export interface SpeakingHysteresisState {
  quietSamples: number;
  speaking: boolean;
}

export function classifyAudioSpeechActivity(
  stats: AudioActivityStats | undefined,
): AudioSpeechActivity {
  if (!stats || typeof stats.audioLevel !== "number") {
    return "unknown";
  }

  return stats.audioLevel >= AUDIO_SPEECH_LEVEL_THRESHOLD
    ? "active"
    : "quiet";
}

export function classifyAudioTransportFlow(
  sample: AudioTransportSample,
): AudioTransportFlow {
  if (!sample.expected) {
    return "not-expected";
  }

  if (sample.connectionState !== "connected") {
    return "unknown";
  }

  if (
    sample.receiverTrackState === "missing" ||
    sample.current === undefined
  ) {
    return "missing";
  }

  if (
    sample.receiverTrackState === "ended" ||
    sample.receiverTrackMuted
  ) {
    return "stalled";
  }

  // A connected live receiver is healthy during Opus DTX silence even when
  // counters stay static. Counter movement is useful positive evidence, but
  // its absence cannot distinguish healthy silence from a stalled codec.
  return "flowing";
}

export function updateSpeakingHysteresis(
  state: SpeakingHysteresisState,
  activity: AudioSpeechActivity,
  quietSamplesBeforeClear = AUDIO_QUIET_SAMPLES_BEFORE_CLEAR,
): SpeakingHysteresisState {
  if (activity === "active") {
    return {
      quietSamples: 0,
      speaking: true,
    };
  }

  // Unknown never creates speaking activity. Repeated missing samples also
  // clear a previously active indicator so a failed stats source cannot leave
  // the UI permanently lit.
  const quietSamples = state.quietSamples + 1;
  return {
    quietSamples,
    speaking:
      state.speaking && quietSamples < Math.max(1, quietSamplesBeforeClear),
  };
}
