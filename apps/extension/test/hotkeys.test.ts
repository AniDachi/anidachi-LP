import { describe, expect, it } from "vitest";
import {
  getHotkeyAction,
  shouldStopVoiceTalkOnWindowBlur,
} from "../src/hotkeys";

const activeState = {
  roomActive: true,
  panelOpen: false,
  reactionsEnabled: true,
  experimentalSuperReactionsEnabled: true,
  voiceMode: "push-to-talk" as const,
};

describe("Anidachi hotkeys", () => {
  it("starts voice capture on a plain V keydown", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "KeyV", key: "v", type: "keydown" }), activeState),
    ).toEqual({
      type: "voice-start",
    });
  });

  it("stops voice capture on a plain V keyup", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "KeyV", key: "v", type: "keyup" }), activeState),
    ).toEqual({
      type: "voice-stop",
    });
  });

  it("ignores repeated V keydown events", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "KeyV", key: "v", repeat: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores V inside editable elements", () => {
    const input = document.createElement("input");

    expect(
      getHotkeyAction(
        keyEvent({ code: "KeyV", key: "v", target: input, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores system-modified key combinations", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "KeyV", key: "v", metaKey: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("maps plain 1-6 to emoji without opening the mini panel", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit2", key: "2", type: "keydown" }), activeState),
    ).toEqual({ type: "reaction", emoji: "😱" });
  });

  it("starts a charged fire reaction on 4 keydown", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit4", key: "4", type: "keydown" }), activeState),
    ).toEqual({ type: "fire-start" });
  });

  it("finishes a charged fire reaction on 4 keyup", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit4", key: "4", type: "keyup" }), activeState),
    ).toEqual({ type: "fire-stop" });
  });

  it("keeps 1-6 working while the mini panel is open", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit2", key: "2", type: "keydown" }), {
        ...activeState,
        panelOpen: true,
      }),
    ).toEqual({ type: "reaction", emoji: "😱" });
  });

  it("opens the message composer on a plain Enter keydown", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Enter", key: "Enter", type: "keydown" }), activeState),
    ).toEqual({ type: "message-composer-open" });
  });

  it("does not open the message composer outside a room", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Enter", key: "Enter", type: "keydown" }), {
        ...activeState,
        roomActive: false,
      }),
    ).toBeNull();
  });

  it("ignores repeated Enter keydown events", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "Enter", key: "Enter", repeat: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores Shift+Enter so the composer can own multiline-style behavior later", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "Enter", key: "Enter", shiftKey: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores Enter while IME composition is active", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "Enter", isComposing: true, key: "Enter", type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores Enter inside editable elements", () => {
    const input = document.createElement("input");

    expect(
      getHotkeyAction(
        keyEvent({ code: "Enter", key: "Enter", target: input, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores repeated reaction keydown events", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "Digit2", key: "2", repeat: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("ignores repeated charged fire keydown events", () => {
    expect(
      getHotkeyAction(
        keyEvent({ code: "Digit4", key: "4", repeat: true, type: "keydown" }),
        activeState,
      ),
    ).toBeNull();
  });

  it("maps 4 to a normal fire reaction when experimental super reactions are disabled", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit4", key: "4", type: "keydown" }), {
        ...activeState,
        experimentalSuperReactionsEnabled: false,
      }),
    ).toEqual({ type: "reaction", emoji: "🔥" });
  });

  it("does not emit a fire-stop action when experimental super reactions are disabled", () => {
    expect(
      getHotkeyAction(keyEvent({ code: "Digit4", key: "4", type: "keyup" }), {
        ...activeState,
        experimentalSuperReactionsEnabled: false,
      }),
    ).toBeNull();
  });

  it("stops live voice on visible-window blur while V is still held", () => {
    expect(shouldStopVoiceTalkOnWindowBlur("push-to-talk")).toBe(true);
  });

  it("ignores V voice actions in Open mic mode", () => {
    const openMicState = {
      ...activeState,
      voiceMode: "open-mic" as const,
    };

    expect(
      getHotkeyAction(
        keyEvent({ code: "KeyV", key: "v", type: "keydown" }),
        openMicState,
      ),
    ).toBeNull();
    expect(
      getHotkeyAction(
        keyEvent({ code: "KeyV", key: "v", type: "keyup" }),
        openMicState,
      ),
    ).toBeNull();
    expect(shouldStopVoiceTalkOnWindowBlur("open-mic")).toBe(false);
  });
});

function keyEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    isComposing: false,
    key: "",
    metaKey: false,
    repeat: false,
    shiftKey: false,
    target: document.body,
    type: "keydown",
    composedPath: () => [overrides.target ?? document.body],
    ...overrides,
  } as KeyboardEvent;
}
