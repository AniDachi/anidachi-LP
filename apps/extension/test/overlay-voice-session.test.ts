import { describe, expect, it } from "vitest";
import {
  createVoiceSessionState,
  getVoiceIndicatorParticipantIds,
  isVoiceSessionPublishing,
  reduceVoiceSession,
  shouldResetPersistedOpenMicAfterMediaSeatLoss,
} from "../src/overlay-voice-session";

function connectedState(mode: "open-mic" | "push-to-talk" = "push-to-talk") {
  return createVoiceSessionState({
    listenerScope: "account-1",
    localHasMediaSeat: true,
    mode,
    roomId: "room-1",
  });
}

describe("overlay voice session", () => {
  it("publishes Open mic immediately when that room mode is selected", () => {
    const state = connectedState("open-mic");

    expect(isVoiceSessionPublishing(state)).toBe(true);
  });

  it("uses warm release for Push to talk keyup", () => {
    const started = reduceVoiceSession(connectedState(), {
      type: "push-to-talk",
      held: true,
    });
    const stopped = reduceVoiceSession(started, {
      type: "push-to-talk",
      held: false,
    });

    expect(isVoiceSessionPublishing(started)).toBe(true);
    expect(isVoiceSessionPublishing(stopped)).toBe(false);
    expect(stopped.release).toBe("warm");
  });

  it("activates the local visual indicator immediately while Push to talk is held", () => {
    const held = reduceVoiceSession(connectedState(), {
      type: "push-to-talk",
      held: true,
    });

    expect(
      getVoiceIndicatorParticipantIds({
        localParticipantId: "local",
        measuredSpeakerIds: ["remote", "remote-ptt"],
        state: held,
      }),
    ).toEqual(["remote", "remote-ptt", "local"]);
  });

  it("keeps quiet Open mic and idle Push to talk tied to measured speech", () => {
    expect(
      getVoiceIndicatorParticipantIds({
        localParticipantId: "local",
        measuredSpeakerIds: ["remote"],
        state: connectedState("open-mic"),
      }),
    ).toEqual(["remote"]);
    expect(
      getVoiceIndicatorParticipantIds({
        localParticipantId: "local",
        measuredSpeakerIds: ["local"],
        state: connectedState(),
      }),
    ).toEqual([]);
  });

  it("selecting Open mic starts publication and selecting Push to talk stops immediately", () => {
    const open = reduceVoiceSession(connectedState(), {
      type: "mode",
      mode: "open-mic",
    });
    const pushToTalk = reduceVoiceSession(open, {
      type: "mode",
      mode: "push-to-talk",
    });

    expect(open.mode).toBe("open-mic");
    expect(open.pushToTalkHeld).toBe(false);
    expect(isVoiceSessionPublishing(open)).toBe(true);
    expect(pushToTalk.mode).toBe("push-to-talk");
    expect(pushToTalk.release).toBe("immediate");
    expect(isVoiceSessionPublishing(pushToTalk)).toBe(false);
  });

  it("does not let Push to talk actions change Open mic publication", () => {
    const open = connectedState("open-mic");

    expect(reduceVoiceSession(open, { type: "push-to-talk", held: true })).toEqual(open);
  });

  it("preserves Open mic across same-room reconnect synchronization", () => {
    const reconnected = reduceVoiceSession(connectedState("open-mic"), {
      type: "context",
      listenerScope: "account-1",
      localHasMediaSeat: true,
      roomId: "room-1",
    });

    expect(reconnected.mode).toBe("open-mic");
    expect(isVoiceSessionPublishing(reconnected)).toBe(true);
  });

  it.each(["host", "guest"])(
    "preserves the %s Open mic intent while the same-room media seat is not authoritative",
    () => {
      const transitioning = reduceVoiceSession(connectedState("open-mic"), {
        type: "context",
        listenerScope: "account-1",
        localHasMediaSeat: false,
        localMediaSeatAuthoritative: false,
        roomId: "room-1",
      });

      expect(transitioning.mode).toBe("open-mic");
      expect(transitioning.localHasMediaSeat).toBe(false);
      expect(isVoiceSessionPublishing(transitioning)).toBe(false);

      const restored = reduceVoiceSession(transitioning, {
        type: "context",
        listenerScope: "account-1",
        localHasMediaSeat: true,
        localMediaSeatAuthoritative: true,
        roomId: "room-1",
      });
      expect(restored.mode).toBe("open-mic");
      expect(isVoiceSessionPublishing(restored)).toBe(true);
    },
  );

  it("resets Open mic when an unknown same-room seat is later authoritatively revoked", () => {
    const transitioning = reduceVoiceSession(connectedState("open-mic"), {
      type: "context",
      listenerScope: "account-1",
      localHasMediaSeat: false,
      localMediaSeatAuthoritative: false,
      roomId: "room-1",
    });
    const revoked = reduceVoiceSession(transitioning, {
      type: "context",
      listenerScope: "account-1",
      localHasMediaSeat: false,
      localMediaSeatAuthoritative: true,
      roomId: "room-1",
    });

    expect(revoked.mode).toBe("push-to-talk");
    expect(revoked.pushToTalkHeld).toBe(false);
    expect(revoked.release).toBe("immediate");
    expect(isVoiceSessionPublishing(revoked)).toBe(false);
  });

  it("clears persisted Open mic after a remount confirms there is no media seat", () => {
    expect(
      shouldResetPersistedOpenMicAfterMediaSeatLoss({
        localHasMediaSeat: false,
        persistedVoiceMode: "open-mic",
        roomId: "room-1",
        roomSnapshotReady: true,
      }),
    ).toBe(true);
    expect(
      shouldResetPersistedOpenMicAfterMediaSeatLoss({
        localHasMediaSeat: false,
        persistedVoiceMode: "open-mic",
        roomId: "room-1",
        roomSnapshotReady: false,
      }),
    ).toBe(false);
    expect(
      shouldResetPersistedOpenMicAfterMediaSeatLoss({
        localHasMediaSeat: true,
        persistedVoiceMode: "open-mic",
        roomId: "room-1",
        roomSnapshotReady: true,
      }),
    ).toBe(false);
  });

  it.each([
    {
      label: "room change",
      context: {
        listenerScope: "account-1",
        localHasMediaSeat: true,
        roomId: "room-2",
      },
    },
    {
      label: "room leave",
      context: {
        listenerScope: "account-1",
        localHasMediaSeat: true,
        roomId: null,
      },
    },
    {
      label: "media-seat loss",
      context: {
        listenerScope: "account-1",
        localHasMediaSeat: false,
        roomId: "room-1",
      },
    },
    {
      label: "account switch",
      context: {
        listenerScope: "account-2",
        localHasMediaSeat: true,
        roomId: "room-1",
      },
    },
  ])("returns to Push to talk and stops immediately on $label", ({ context }) => {
    const next = reduceVoiceSession(connectedState("open-mic"), {
      type: "context",
      ...context,
    });

    expect(next.mode).toBe("push-to-talk");
    expect(next.pushToTalkHeld).toBe(false);
    expect(next.release).toBe("immediate");
    expect(isVoiceSessionPublishing(next)).toBe(false);
  });

  it("returns to Push to talk after a terminal microphone failure", () => {
    const failed = reduceVoiceSession(connectedState("open-mic"), {
      type: "terminal-failure",
    });

    expect(failed.mode).toBe("push-to-talk");
    expect(failed.pushToTalkHeld).toBe(false);
    expect(failed.release).toBe("immediate");
    expect(isVoiceSessionPublishing(failed)).toBe(false);
  });

  it("keeps camera outside the voice state contract", () => {
    expect(connectedState()).not.toHaveProperty("cameraEnabled");
  });
});
