import { describe, expect, it } from "vitest";
import {
  getGhostCamSizeLabel,
  getGhostCamSizePx,
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
});
