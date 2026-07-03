import { describe, expect, it } from "vitest";
import {
  getGhostCamSizeLabel,
  getGhostCamSizePx,
  getResponsiveGhostCamSizePx,
  normalizeGhostCamSizeStep,
} from "../src/ghost-cam-size";

describe("Ghost Cam size steps", () => {
  it("keeps the default size at the enlarged normal bubble size", () => {
    expect(getGhostCamSizePx(1)).toBe(74);
    expect(getGhostCamSizeLabel(1)).toBe("Normal");
  });

  it("normalizes arbitrary slider values to supported steps", () => {
    expect(normalizeGhostCamSizeStep(-4)).toBe(0);
    expect(normalizeGhostCamSizeStep(2.7)).toBe(3);
    expect(normalizeGhostCamSizeStep(10)).toBe(3);
  });

  it("keeps fixed preset sizes when the player dimensions are unknown", () => {
    expect(getResponsiveGhostCamSizePx(3, {})).toBe(108);
  });

  it("scales XL up on large players without changing media capture constraints", () => {
    expect(
      getResponsiveGhostCamSizePx(3, {
        cameraCount: 1,
        containerHeightPx: 1080,
        containerWidthPx: 1920,
      }),
    ).toBe(180);
  });

  it("caps a four-camera stack so it does not take over the player width", () => {
    expect(
      getResponsiveGhostCamSizePx(3, {
        cameraCount: 4,
        containerHeightPx: 720,
        containerWidthPx: 1280,
      }),
    ).toBe(126);
  });

  it("keeps compact players at the fixed preset size", () => {
    expect(
      getResponsiveGhostCamSizePx(3, {
        cameraCount: 2,
        containerHeightPx: 420,
        containerWidthPx: 720,
      }),
    ).toBe(108);
  });
});
