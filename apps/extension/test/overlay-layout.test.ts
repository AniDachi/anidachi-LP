import { describe, expect, it } from "vitest";
import {
  DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
  getMiniPanelBottomReservePx,
} from "../src/overlay-layout";

describe("overlay layout", () => {
  it("uses the edge margin when the player chrome is hidden and no cameras are visible", () => {
    expect(
      getMiniPanelBottomReservePx({
        cameraStackVisible: false,
        camStackBottomPx: 54,
        controlsVisible: false,
        ghostCamSizePx: 74,
      }),
    ).toBe(DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX);
  });

  it("keeps the mini panel above visible Crunchyroll controls even without cameras", () => {
    expect(
      getMiniPanelBottomReservePx({
        cameraStackVisible: false,
        camStackBottomPx: 126,
        controlsVisible: true,
        ghostCamSizePx: 74,
      }),
    ).toBe(126);
  });

  it("keeps the mini panel above the camera stack when live video bubbles are visible", () => {
    expect(
      getMiniPanelBottomReservePx({
        cameraStackVisible: true,
        camStackBottomPx: 126,
        controlsVisible: true,
        ghostCamSizePx: 116,
      }),
    ).toBe(260);
  });

  it("normalizes invalid measurements instead of emitting broken CSS values", () => {
    expect(
      getMiniPanelBottomReservePx({
        cameraStackVisible: true,
        camStackBottomPx: Number.NaN,
        controlsVisible: true,
        ghostCamSizePx: Number.POSITIVE_INFINITY,
      }),
    ).toBe(72);
  });
});
