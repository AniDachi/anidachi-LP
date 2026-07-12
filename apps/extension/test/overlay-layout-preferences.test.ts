import { describe, expect, it } from "vitest";
import {
  applyOverlayLayoutPreset,
  getCenteredGridPosition,
  getDefaultOverlayLayoutPreferences,
  getGridRectStyle,
  getOverlayLayoutCssVariables,
  moveOverlayLayoutObject,
  normalizeOverlayLayoutPreferences,
  resizeOverlayLayoutObject,
  updateOverlayLayoutChatMaxMessages,
} from "../src/overlay-layout-preferences";

describe("overlay layout preferences", () => {
  it("normalizes broken storage data to a safe default", () => {
    expect(normalizeOverlayLayoutPreferences(null)).toEqual(getDefaultOverlayLayoutPreferences());
    expect(
      normalizeOverlayLayoutPreferences({
        chat: { maxMessages: 100 },
        objects: {
          chat: { h: 99, w: 99, x: 99, y: 99 },
          video: { h: 2, w: 4, x: -8, y: Number.NaN },
        },
        presetId: "unknown",
        version: -1,
      }),
    ).toMatchObject({
      chat: { maxMessages: 8 },
      presetId: "classic",
      version: 1,
    });
  });

  it("keeps moved objects inside the grid and away from the other object", () => {
    const moved = moveOverlayLayoutObject(
      applyOverlayLayoutPreset("classic"),
      "chat",
      8,
      1,
    );

    expect(moved.presetId).toBe("custom");
    expect(rectsOverlap(moved.objects.video, moved.objects.chat)).toBe(false);
    expect(moved.objects.chat.x).toBeGreaterThanOrEqual(0);
    expect(moved.objects.chat.y).toBeGreaterThanOrEqual(0);
  });

  it("keeps resized objects non-overlapping", () => {
    const resized = resizeOverlayLayoutObject(
      applyOverlayLayoutPreset("cinema"),
      "chat",
      { h: 4, w: 8 },
    );

    expect(resized.presetId).toBe("custom");
    expect(rectsOverlap(resized.objects.video, resized.objects.chat)).toBe(false);
  });

  it("snaps chat message options to supported values", () => {
    const preferences = applyOverlayLayoutPreset("classic");

    expect(updateOverlayLayoutChatMaxMessages(preferences, 2).chat.maxMessages).toBe(3);
    expect(updateOverlayLayoutChatMaxMessages(preferences, 5).chat.maxMessages).toBe(5);
    expect(updateOverlayLayoutChatMaxMessages(preferences, 9).chat.maxMessages).toBe(8);
  });

  it("exports preview and overlay positioning values as percentages", () => {
    const preferences = applyOverlayLayoutPreset("social");

    expect(getGridRectStyle(preferences.objects.video)).toMatchObject({
      left: "66.66666666666666%",
      top: "12.5%",
    });
    expect(getOverlayLayoutCssVariables(preferences)).toMatchObject({
      "--live-chat-width": "50%",
      "--cam-stack-top": "12.5%",
    });
  });

  it("centers an object around a clicked grid cell", () => {
    expect(getCenteredGridPosition({ h: 2, w: 4, x: 0, y: 0 }, 10, 5)).toEqual({
      x: 8,
      y: 4,
    });
  });
});

function rectsOverlap(
  a: { h: number; w: number; x: number; y: number },
  b: { h: number; w: number; x: number; y: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
