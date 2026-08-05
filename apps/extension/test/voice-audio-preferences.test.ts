import { describe, expect, it } from "vitest";
import {
  type MicrophoneIntent,
  type MicrophoneStatus,
  shouldPublishMicrophone,
  type VoiceMode,
} from "../src/media-types";
import {
  applyParticipantAudioSliderValue,
  clampParticipantAudioVolume,
  getDefaultParticipantAudioPreference,
  getDefaultVoiceAudioPreferences,
  getParticipantAudioSliderValue,
  parseVoiceAudioPreferences,
  resolveVoiceAudioPreferencesForListener,
  toggleParticipantAudioMute,
  updateParticipantAudioPreference,
  VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX,
  voiceAudioPreferencesStorageKeyForUser,
} from "../src/voice-audio-preferences";

describe("voice audio preference codec", () => {
  it("defaults to no participant overrides without storing microphone mode", () => {
    expect(getDefaultVoiceAudioPreferences()).toEqual({
      version: 2,
      participantAudio: {},
    });
  });

  it("scopes every persisted preference to one authenticated listener", () => {
    const accountAKey = voiceAudioPreferencesStorageKeyForUser("account-a");
    const accountBKey = voiceAudioPreferencesStorageKeyForUser("account-b");

    expect(VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX).toBe("local:voiceAudioPreferencesV1");
    expect(accountAKey).toBe(
      `${VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX}.${encodeURIComponent("user:account-a")}`,
    );
    expect(accountBKey).not.toBe(accountAKey);
    expect(() => voiceAudioPreferencesStorageKeyForUser("   ")).toThrow(/listener user id/i);
  });

  it("keeps account A and B stores isolated even for the same participant", () => {
    const accountAKey = voiceAudioPreferencesStorageKeyForUser("account-a");
    const accountBKey = voiceAudioPreferencesStorageKeyForUser("account-b");
    const persistedByKey = {
      [accountAKey]: {
        version: 1,
        mode: "open-mic",
        participantAudio: {
          "remote-user": { muted: true, volume: 0.35 },
        },
      },
      [accountBKey]: {
        version: 1,
        mode: "push-to-talk",
        participantAudio: {},
      },
    };
    const accountA = parseVoiceAudioPreferences(persistedByKey[accountAKey]);
    const accountB = parseVoiceAudioPreferences(persistedByKey[accountBKey]);

    expect(accountA).not.toHaveProperty("mode");
    expect(accountA.participantAudio["remote-user"]).toEqual({
      muted: true,
      volume: 0.35,
    });
    expect(accountB.participantAudio["remote-user"]).toBeUndefined();
    expect(accountB).not.toHaveProperty("mode");
  });

  it("uses safe defaults while a different listener store is loading", () => {
    const accountA = {
      listenerUserId: "account-a",
      preferences: parseVoiceAudioPreferences({
        version: 1,
        mode: "open-mic",
        participantAudio: {
          "remote-user": { muted: true, volume: 0.35 },
        },
      }),
    };

    expect(resolveVoiceAudioPreferencesForListener(accountA, "account-b")).toEqual({
      ready: false,
      preferences: getDefaultVoiceAudioPreferences(),
    });
    expect(resolveVoiceAudioPreferencesForListener(accountA, "account-a")).toEqual({
      ready: true,
      preferences: accountA.preferences,
    });
  });

  it("migrates version 1 participant audio while dropping the legacy global mode", () => {
    expect(
      parseVoiceAudioPreferences({
        version: 1,
        mode: "always-listening",
        participantAudio: {
          valid: { muted: true, volume: 0.45, displayName: "Must not persist" },
          low: { muted: "yes", volume: -10 },
          high: { muted: false, volume: 99 },
          missingFields: {},
          invalidEntry: "loud",
        },
      }),
    ).toEqual({
      version: 2,
      participantAudio: {
        valid: { muted: true, volume: 0.45 },
        low: { muted: false, volume: 0.05 },
        high: { muted: false, volume: 1 },
        missingFields: { muted: false, volume: 1 },
      },
    });
  });

  it("rejects unknown versions and non-record storage safely", () => {
    for (const value of [
      undefined,
      null,
      [],
      {},
      { version: 3, mode: "open-mic" },
      { version: "1", mode: "open-mic" },
    ]) {
      expect(parseVoiceAudioPreferences(value)).toEqual(getDefaultVoiceAudioPreferences());
    }
  });

  it("clamps audible volume to the supported range", () => {
    expect(clampParticipantAudioVolume(Number.NaN)).toBe(1);
    expect(clampParticipantAudioVolume(-1)).toBe(0.05);
    expect(clampParticipantAudioVolume(0)).toBe(0.05);
    expect(clampParticipantAudioVolume(0.42)).toBe(0.42);
    expect(clampParticipantAudioVolume(2)).toBe(1);
  });

  it("maps slider zero to mute without losing the last audible volume", () => {
    const previous = { muted: false, volume: 0.4 };
    const muted = applyParticipantAudioSliderValue(previous, 0);

    expect(muted).toEqual({ muted: true, volume: 0.4 });
    expect(getParticipantAudioSliderValue(muted)).toBe(0);

    const restored = toggleParticipantAudioMute(muted);
    expect(restored).toEqual({ muted: false, volume: 0.4 });
    expect(getParticipantAudioSliderValue(restored)).toBe(0.4);
  });

  it("unmutes and adopts a new audible value when the slider rises above zero", () => {
    const muted = { muted: true, volume: 0.65 };

    expect(applyParticipantAudioSliderValue(muted, 0.25)).toEqual({
      muted: false,
      volume: 0.25,
    });
    expect(applyParticipantAudioSliderValue(muted, 0.001)).toEqual({
      muted: false,
      volume: 0.05,
    });
  });

  it("does not mute or unmute when a slider event has no finite value", () => {
    expect(applyParticipantAudioSliderValue({ muted: false, volume: 0.4 }, Number.NaN)).toEqual({
      muted: false,
      volume: 0.4,
    });
    expect(
      applyParticipantAudioSliderValue({ muted: true, volume: 0.65 }, Number.POSITIVE_INFINITY),
    ).toEqual({ muted: true, volume: 0.65 });
  });

  it("updates one opaque participant key without mutating previous state", () => {
    const previous = {
      version: 2,
      participantAudio: {
        existing: { muted: false, volume: 0.8 },
      },
    } as const;
    const snapshot = structuredClone(previous);
    const participantId = "__proto__";

    const next = updateParticipantAudioPreference(previous, participantId, {
      muted: true,
      volume: 0.2,
    });

    expect(previous).toEqual(snapshot);
    expect(next).not.toBe(previous);
    expect(next.participantAudio).not.toBe(previous.participantAudio);
    expect(next.participantAudio.existing).toEqual({
      muted: false,
      volume: 0.8,
    });
    expect(Object.hasOwn(next.participantAudio, participantId)).toBe(true);
    expect(next.participantAudio[participantId]).toEqual({
      muted: true,
      volume: 0.2,
    });
    expect(Object.keys(next.participantAudio)).toEqual(["existing", participantId]);
  });

  it("does not expose inherited object properties as participant preferences", () => {
    const defaults = getDefaultVoiceAudioPreferences();
    const parsed = parseVoiceAudioPreferences({
      version: 1,
      mode: "push-to-talk",
      participantAudio: {},
    });

    for (const participantId of ["__proto__", "constructor", "toString"]) {
      expect(defaults.participantAudio[participantId]).toBeUndefined();
      expect(parsed.participantAudio[participantId]).toBeUndefined();
      expect(Object.hasOwn(defaults.participantAudio, participantId)).toBe(false);
      expect(Object.hasOwn(parsed.participantAudio, participantId)).toBe(false);
    }
  });

  it("stores every inherited-looking participant ID as an own opaque key", () => {
    let preferences = getDefaultVoiceAudioPreferences();

    for (const participantId of ["__proto__", "constructor", "toString"]) {
      preferences = updateParticipantAudioPreference(preferences, participantId, {
        muted: true,
        volume: 0.25,
      });
    }

    for (const participantId of ["__proto__", "constructor", "toString"]) {
      expect(Object.hasOwn(preferences.participantAudio, participantId)).toBe(true);
      expect(preferences.participantAudio[participantId]).toEqual({
        muted: true,
        volume: 0.25,
      });
    }
  });

  it("returns fresh default participant values", () => {
    const first = getDefaultParticipantAudioPreference();
    const second = getDefaultParticipantAudioPreference();

    expect(first).toEqual({ muted: false, volume: 1 });
    expect(first).not.toBe(second);
  });

});

describe("microphone publication intent", () => {
  const context = { roomActive: true, hasMediaSeat: true };

  it("keeps supported modes, status, and intent as distinct domain types", () => {
    const modes: VoiceMode[] = ["push-to-talk", "open-mic"];
    const statuses: MicrophoneStatus[] = ["off", "connecting", "on", "error"];
    const intent: MicrophoneIntent = {
      mode: modes[0],
      pushToTalkHeld: false,
    };

    expect(modes).toEqual(["push-to-talk", "open-mic"]);
    expect(statuses).toEqual(["off", "connecting", "on", "error"]);
    expect(intent.mode).toBe("push-to-talk");
  });

  it("publishes Push to talk only while held in an eligible room", () => {
    const intent: MicrophoneIntent = {
      mode: "push-to-talk",
      pushToTalkHeld: true,
    };

    expect(shouldPublishMicrophone(intent, context)).toBe(true);
    expect(shouldPublishMicrophone({ ...intent, pushToTalkHeld: false }, context)).toBe(false);
  });

  it("publishes Open mic continuously in an eligible room", () => {
    const intent: MicrophoneIntent = {
      mode: "open-mic",
      pushToTalkHeld: false,
    };

    expect(shouldPublishMicrophone(intent, context)).toBe(true);
  });

  it("never publishes without both an active room and a media seat", () => {
    const intent: MicrophoneIntent = {
      mode: "open-mic",
      pushToTalkHeld: true,
    };

    expect(
      shouldPublishMicrophone(intent, {
        roomActive: false,
        hasMediaSeat: true,
      }),
    ).toBe(false);
    expect(
      shouldPublishMicrophone(intent, {
        roomActive: true,
        hasMediaSeat: false,
      }),
    ).toBe(false);
  });
});
