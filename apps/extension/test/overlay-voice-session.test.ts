import { describe, expect, it } from "vitest";
import {
  createVoiceSessionState,
  getVoiceIndicatorParticipantIds,
  isVoiceSessionPublishing,
  reduceVoiceSession,
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
        measuredSpeakerIds: ["remote"],
        state: held,
      }),
    ).toEqual(["remote", "local"]);
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
