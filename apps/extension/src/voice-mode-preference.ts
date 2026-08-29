import { MAX_PARTICIPANT_ID_CHARS } from "@anidachi/protocol";
import type { VoiceMode } from "./media-types";

const VOICE_MODE_PREFERENCE_VERSION = 1 as const;
const VOICE_MODE_PREFERENCE_STORAGE_KEY_PREFIX =
  "anidachi:voice-mode-preference:v1:user:";

interface StorageAreaLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface VoiceModePreferenceRecord {
  version: typeof VOICE_MODE_PREFERENCE_VERSION;
  mode: VoiceMode;
}

export function voiceModePreferenceStorageKeyForUser(userId: string): string {
  const normalizedUserId = userId.trim();
  if (
    !normalizedUserId ||
    normalizedUserId.length > MAX_PARTICIPANT_ID_CHARS
  ) {
    throw new Error("A valid user ID is required for a Voice mode preference.");
  }
  return `${VOICE_MODE_PREFERENCE_STORAGE_KEY_PREFIX}${encodeURIComponent(normalizedUserId)}`;
}

export async function loadVoiceModePreference(
  storage: StorageAreaLike,
  userId: string,
): Promise<VoiceMode> {
  try {
    const key = voiceModePreferenceStorageKeyForUser(userId);
    const stored = await storage.get(key);
    return parseVoiceModePreference(stored[key]);
  } catch {
    return "push-to-talk";
  }
}

export async function persistVoiceModePreference(
  storage: StorageAreaLike,
  userId: string,
  mode: VoiceMode,
): Promise<void> {
  const key = voiceModePreferenceStorageKeyForUser(userId);
  const record: VoiceModePreferenceRecord = {
    version: VOICE_MODE_PREFERENCE_VERSION,
    mode,
  };
  await storage.set({ [key]: record });
}

function parseVoiceModePreference(value: unknown): VoiceMode {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("version" in value) ||
    value.version !== VOICE_MODE_PREFERENCE_VERSION ||
    !("mode" in value)
  ) {
    return "push-to-talk";
  }

  return value.mode === "open-mic" ? "open-mic" : "push-to-talk";
}
