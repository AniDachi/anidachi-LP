import { describe, expect, it } from "vitest";
import {
  getDefaultOverlayLayoutDefinition,
  getDefaultOverlayLayoutPreferencesV2,
  normalizeOverlayLayoutDefinition,
  OVERLAY_LAYOUT_STORAGE_KEY_V2,
  parseOverlayLayoutPreferencesV2,
} from "../src/overlay-layout-model";

describe("overlay layout model v2", () => {
  it("uses the V2-only local storage key", () => {
    expect(OVERLAY_LAYOUT_STORAGE_KEY_V2).toBe("local:overlayLayoutPreferencesV2");
  });

  it("defaults to the clean four-seat definition", () => {
    const preferences = getDefaultOverlayLayoutPreferencesV2();
    const definition = getDefaultOverlayLayoutDefinition();

    expect(preferences).toEqual({ layout: definition, version: 2 });
    expect(definition).toEqual({
      video: { anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 1 },
      chat: { position: { x: 0, y: 4 }, width: 5, textScale: "normal", maxMessages: 5 },
    });

    definition.video.anchor.x = 0;
    expect(getDefaultOverlayLayoutDefinition().video.anchor.x).toBe(11);
  });

  it("rejects version 1 geometry and starts from clean defaults", () => {
    const preferences = parseOverlayLayoutPreferencesV2({
      version: 1,
      presetId: "custom",
      objects: {
        video: { x: 1, y: 2, w: 4, h: 2 },
        chat: { x: 7, y: 3, w: 5, h: 2 },
      },
      chat: { maxMessages: 8 },
    });

    expect(preferences).toEqual(getDefaultOverlayLayoutPreferencesV2());
  });

  it("returns clean defaults for every input that is not version 2", () => {
    for (const value of [undefined, null, {}, { version: 3 }, { version: "2" }, []]) {
      expect(parseOverlayLayoutPreferencesV2(value)).toEqual(
        getDefaultOverlayLayoutPreferencesV2(),
      );
    }
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

  it("normalizes version 2 layout storage without legacy state", () => {
    const first = parseOverlayLayoutPreferencesV2({
      version: 2,
      layout: {
        video: { anchor: { x: 1, y: 2 }, leaderSide: "left", sizeStep: 2 },
        chat: { position: { x: 6, y: 4 }, width: 6, textScale: "large", maxMessages: 8 },
      },
    });
    const second = parseOverlayLayoutPreferencesV2(first);

    expect(first).toEqual({
      version: 2,
      layout: {
        video: { anchor: { x: 1, y: 2 }, leaderSide: "left", sizeStep: 2 },
        chat: { position: { x: 6, y: 4 }, width: 6, textScale: "large", maxMessages: 8 },
      },
    });
    expect(second).toEqual(first);
  });
});
