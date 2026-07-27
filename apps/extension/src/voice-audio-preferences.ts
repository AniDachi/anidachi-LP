import type { VoiceMode } from "./media-types";

export const VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX = "local:voiceAudioPreferencesV1";
export const VOICE_AUDIO_PREFERENCES_VERSION = 1 as const;
export const DEFAULT_PARTICIPANT_AUDIO_VOLUME = 1;
export const MIN_PARTICIPANT_AUDIO_VOLUME = 0.05;
export const MAX_PARTICIPANT_AUDIO_VOLUME = 1;

export interface ParticipantAudioPreference {
  muted: boolean;
  // Last audible local playback value; mute is represented separately.
  volume: number;
}

export interface VoiceAudioPreferencesV1 {
  version: typeof VOICE_AUDIO_PREFERENCES_VERSION;
  mode: VoiceMode;
  participantAudio: Record<string, ParticipantAudioPreference>;
}

export function getDefaultParticipantAudioPreference(): ParticipantAudioPreference {
  return {
    muted: false,
    volume: DEFAULT_PARTICIPANT_AUDIO_VOLUME,
  };
}

export function getDefaultVoiceAudioPreferences(): VoiceAudioPreferencesV1 {
  return {
    version: VOICE_AUDIO_PREFERENCES_VERSION,
    mode: "push-to-talk",
    participantAudio: createParticipantAudioPreferenceRecord(),
  };
}

export function voiceAudioPreferencesStorageKeyForUser(listenerUserId: string): `local:${string}` {
  const normalizedUserId = listenerUserId.trim();
  if (!normalizedUserId) {
    throw new Error("A listener user ID is required for voice audio preferences.");
  }

  return `${VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX}.${encodeURIComponent(
    `user:${normalizedUserId}`,
  )}`;
}

export function parseVoiceAudioPreferences(value: unknown): VoiceAudioPreferencesV1 {
  if (!isRecord(value) || value.version !== VOICE_AUDIO_PREFERENCES_VERSION) {
    return getDefaultVoiceAudioPreferences();
  }

  const participantEntries = isRecord(value.participantAudio)
    ? Object.entries(value.participantAudio).flatMap(([participantId, preference]) =>
        isRecord(preference)
          ? [[participantId, normalizeParticipantAudioPreference(preference)] as const]
          : [],
      )
    : [];

  return {
    version: VOICE_AUDIO_PREFERENCES_VERSION,
    mode: normalizeVoiceMode(value.mode),
    participantAudio: createParticipantAudioPreferenceRecord(participantEntries),
  };
}

export function clampParticipantAudioVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_PARTICIPANT_AUDIO_VOLUME;
  }

  return Math.max(MIN_PARTICIPANT_AUDIO_VOLUME, Math.min(MAX_PARTICIPANT_AUDIO_VOLUME, volume));
}

export function getParticipantAudioSliderValue(preference: ParticipantAudioPreference): number {
  const normalized = normalizeParticipantAudioPreference(preference);
  return normalized.muted ? 0 : normalized.volume;
}

export function applyParticipantAudioSliderValue(
  preference: ParticipantAudioPreference,
  sliderValue: number,
): ParticipantAudioPreference {
  const normalized = normalizeParticipantAudioPreference(preference);
  if (!Number.isFinite(sliderValue)) {
    return normalized;
  }

  if (sliderValue <= 0) {
    return {
      muted: true,
      volume: normalized.volume,
    };
  }

  return {
    muted: false,
    volume: clampParticipantAudioVolume(sliderValue),
  };
}

export function toggleParticipantAudioMute(
  preference: ParticipantAudioPreference,
): ParticipantAudioPreference {
  const normalized = normalizeParticipantAudioPreference(preference);
  return {
    muted: !normalized.muted,
    volume: normalized.volume,
  };
}

export function updateParticipantAudioPreference(
  preferences: VoiceAudioPreferencesV1,
  participantId: string,
  preference: ParticipantAudioPreference,
): VoiceAudioPreferencesV1 {
  return {
    ...preferences,
    participantAudio: createParticipantAudioPreferenceRecord([
      ...Object.entries(preferences.participantAudio),
      [participantId, normalizeParticipantAudioPreference(preference)],
    ]),
  };
}

export function updateVoiceMode(
  preferences: VoiceAudioPreferencesV1,
  mode: VoiceMode,
): VoiceAudioPreferencesV1 {
  return {
    ...preferences,
    mode,
  };
}

function createParticipantAudioPreferenceRecord(
  entries: Iterable<readonly [string, ParticipantAudioPreference]> = [],
): Record<string, ParticipantAudioPreference> {
  const participantAudio = Object.create(null) as Record<string, ParticipantAudioPreference>;
  for (const [participantId, preference] of entries) {
    participantAudio[participantId] = preference;
  }
  return participantAudio;
}

function normalizeVoiceMode(value: unknown): VoiceMode {
  return value === "open-mic" || value === "push-to-talk" ? value : "push-to-talk";
}

export function normalizeParticipantAudioPreference(
  value: Record<string, unknown> | ParticipantAudioPreference,
): ParticipantAudioPreference {
  return {
    muted: typeof value.muted === "boolean" ? value.muted : false,
    volume:
      typeof value.volume === "number"
        ? clampParticipantAudioVolume(value.volume)
        : DEFAULT_PARTICIPANT_AUDIO_VOLUME,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
