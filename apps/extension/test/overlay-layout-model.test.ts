import { describe, expect, it } from "vitest";
import {
  getActiveOverlayLayoutDefinition,
  getDefaultOverlayLayoutPreferencesV2,
  normalizeOverlayLayoutDefinition,
  parseOverlayLayoutPreferencesV2,
} from "../src/overlay-layout-model";

describe("overlay layout model v2", () => {
  it("defaults to a four-seat classic definition", () => {
    const preferences = getDefaultOverlayLayoutPreferencesV2();
    const definition = getActiveOverlayLayoutDefinition(preferences);

    expect(preferences).toMatchObject({ activePresetId: "classic", version: 2 });
    expect(definition.video).toMatchObject({ leaderSide: "right", sizeStep: 1 });
    expect(definition.chat).toMatchObject({ maxMessages: 5, textScale: "normal" });
  });

  it("migrates a custom version 1 rectangle and legacy camera size", () => {
    const preferences = parseOverlayLayoutPreferencesV2(
      {
        version: 1,
        presetId: "custom",
        objects: {
          video: { x: 1, y: 2, w: 4, h: 2 },
          chat: { x: 7, y: 3, w: 5, h: 2 },
        },
        chat: { maxMessages: 8 },
      },
      { legacyCameraSizeStep: 3 },
    );

    expect(preferences.activePresetId).toBe("custom");
    expect(preferences.custom.video).toEqual({
      anchor: { x: 1, y: 3 },
      leaderSide: "left",
      sizeStep: 3,
    });
    expect(preferences.custom.chat).toMatchObject({
      maxMessages: 8,
      position: { x: 7, y: 3 },
      textScale: "normal",
      width: 5,
    });
  });

  it("normalizes malformed fields without mutating the input", () => {
    const input = {
      video: { anchor: { x: -99, y: 99 }, leaderSide: "invalid", sizeStep: 99 },
      chat: { position: { x: 99, y: -10 }, width: 99, textScale: "tiny", maxMessages: 7 },
    };
    const snapshot = structuredClone(input);
    const normalized = normalizeOverlayLayoutDefinition(input);

    expect(input).toEqual(snapshot);
    expect(normalized.video.anchor).toEqual({ x: 0, y: 7 });
    expect(normalized.video).toMatchObject({ leaderSide: "left", sizeStep: 3 });
    expect(normalized.chat).toMatchObject({ maxMessages: 8, textScale: "normal", width: 6 });
  });

  it("is idempotent for valid version 2 storage", () => {
    const first = parseOverlayLayoutPreferencesV2(getDefaultOverlayLayoutPreferencesV2());
    const second = parseOverlayLayoutPreferencesV2(first);
    expect(second).toEqual(first);
  });
});
