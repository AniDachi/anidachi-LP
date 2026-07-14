import { describe, expect, it } from "vitest";
import { resolveVideoLayout } from "../src/overlay-layout-engine";

const viewport = {
  height: 720,
  safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
  width: 1280,
};

describe("overlay layout camera geometry", () => {
  it("places four right-side slots from the leader inward", () => {
    const result = resolveVideoLayout(
      { anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 1 },
      viewport,
      4,
    );

    expect(result.slots).toHaveLength(4);
    expect(result.slots[0]!.x).toBeGreaterThan(result.slots[1]!.x);
    expect(result.slots[1]!.x).toBeGreaterThan(result.slots[2]!.x);
    expect(result.slots[2]!.x).toBeGreaterThan(result.slots[3]!.x);
  });

  it("places left-side followers toward the screen interior", () => {
    const result = resolveVideoLayout(
      { anchor: { x: 0, y: 3 }, leaderSide: "left", sizeStep: 1 },
      viewport,
      4,
    );

    expect(result.slots[0]!.x).toBeLessThan(result.slots[1]!.x);
    expect(result.slots[3]!.x + result.slots[3]!.width).toBeLessThanOrEqual(1268);
  });

  it("returns only occupied runtime slots and keeps all geometry in bounds", () => {
    for (const count of [0, 1, 2, 3, 4] as const) {
      const result = resolveVideoLayout(
        { anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep: 3 },
        { ...viewport, height: 360, width: 640 },
        count,
      );

      expect(result.slots).toHaveLength(count);
      for (const slot of result.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(12);
        expect(slot.y).toBeGreaterThanOrEqual(12);
        expect(slot.x + slot.width).toBeLessThanOrEqual(628);
        expect(slot.y + slot.height).toBeLessThanOrEqual(304);
      }
    }
  });

  it("returns finite zero bounds when no cameras are occupied", () => {
    const result = resolveVideoLayout(
      { anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep: 3 },
      {
        height: Number.NaN,
        safeInsets: {
          bottom: Number.POSITIVE_INFINITY,
          left: -10,
          right: Number.NaN,
          top: -20,
        },
        width: Number.NEGATIVE_INFINITY,
      },
      0,
    );

    expect(result.bounds).toEqual({ height: 0, width: 0, x: 0, y: 0 });
    expect(result.slots).toEqual([]);
    expect(Object.values(result.bounds).every(Number.isFinite)).toBe(true);
  });

  it("clamps camera count and caps the effective size step without changing intent", () => {
    const video = { anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 3 } as const;
    const originalVideo = structuredClone(video);
    const originalViewport = structuredClone(viewport);
    const result = resolveVideoLayout(video, viewport, 99.7, 1);

    expect(result.slots).toHaveLength(4);
    expect(result.effectiveSizeStep).toBe(1);
    expect(result.effectiveSizePx).toBe(83);
    expect(video).toEqual(originalVideo);
    expect(viewport).toEqual(originalViewport);
  });
});
