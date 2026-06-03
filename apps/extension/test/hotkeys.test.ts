import { describe, expect, it } from "vitest";
import { getHotkeyAction } from "../src/hotkeys";

const activeState = {
  roomActive: true,
  panelOpen: false,
  reactionsEnabled: true,
  experimentalSuperReactionsEnabled: true,
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
});

function keyEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
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
