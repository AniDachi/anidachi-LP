import { describe, expect, it } from "vitest";
import {
  createVoiceSessionState,
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
  it("never starts microphone capture merely by joining in Open mic mode", () => {
    const state = connectedState("open-mic");

    expect(state.openMicEnabled).toBe(false);
    expect(isVoiceSessionPublishing(state)).toBe(false);
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

  it("uses immediate release when explicit Open mic is turned off", () => {
    const started = reduceVoiceSession(connectedState("open-mic"), {
      type: "open-mic",
      enabled: true,
    });
    const stopped = reduceVoiceSession(started, {
      type: "open-mic",
      enabled: false,
    });

    expect(isVoiceSessionPublishing(started)).toBe(true);
    expect(isVoiceSessionPublishing(stopped)).toBe(false);
    expect(stopped.release).toBe("immediate");
  });

  it("does not let Push to talk actions change Open mic state", () => {
    const open = reduceVoiceSession(connectedState("open-mic"), {
      type: "open-mic",
      enabled: true,
    });

    expect(
      reduceVoiceSession(open, { type: "push-to-talk", held: true }),
    ).toEqual(open);
  });

  it("switches modes without automatically starting capture", () => {
    const held = reduceVoiceSession(connectedState(), {
      type: "push-to-talk",
      held: true,
    });
    const openMode = reduceVoiceSession(held, {
      type: "mode",
      mode: "open-mic",
    });

    expect(openMode.mode).toBe("open-mic");
    expect(openMode.openMicEnabled).toBe(false);
    expect(openMode.pushToTalkHeld).toBe(false);
    expect(openMode.release).toBe("immediate");
    expect(isVoiceSessionPublishing(openMode)).toBe(false);
  });

  it("preserves explicit Open mic across same-room reconnect synchronization", () => {
    const open = reduceVoiceSession(connectedState("open-mic"), {
      type: "open-mic",
      enabled: true,
    });
    const reconnected = reduceVoiceSession(open, {
      type: "context",
      listenerScope: "account-1",
      localHasMediaSeat: true,
      roomId: "room-1",
    });

    expect(reconnected.openMicEnabled).toBe(true);
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
  ])("stops immediately on $label", ({ context }) => {
    const open = reduceVoiceSession(connectedState("open-mic"), {
      type: "open-mic",
      enabled: true,
    });
    const next = reduceVoiceSession(open, {
      type: "context",
      ...context,
    });

    expect(next.openMicEnabled).toBe(false);
    expect(next.pushToTalkHeld).toBe(false);
    expect(next.release).toBe("immediate");
    expect(isVoiceSessionPublishing(next)).toBe(false);
  });

  it("clears all microphone intent after a terminal failure", () => {
    const open = reduceVoiceSession(connectedState("open-mic"), {
      type: "open-mic",
      enabled: true,
    });
    const failed = reduceVoiceSession(open, {
      type: "terminal-failure",
    });

    expect(failed.openMicEnabled).toBe(false);
    expect(failed.pushToTalkHeld).toBe(false);
    expect(failed.release).toBe("immediate");
  });

  it("keeps camera outside the voice state contract", () => {
    expect(connectedState()).not.toHaveProperty("cameraEnabled");
  });
});
