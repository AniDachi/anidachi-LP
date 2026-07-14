import { describe, expect, it } from "vitest";
import { getDefaultOverlayLayoutDefinition } from "../src/overlay-layout-model";
import {
  rectsOverlap,
  resolveOverlayLayout,
  resolveVideoLayout,
} from "../src/overlay-layout-engine";

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

  it("sizes four slots against the usable safe rectangle", () => {
    const constrainedViewport = {
      height: 720,
      safeInsets: { bottom: 0, left: 100, right: 710, top: 20 },
      width: 1280,
    };
    const result = resolveVideoLayout(
      { anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 3 },
      constrainedViewport,
      4,
    );
    const safeRect = { bottom: 720, left: 100, right: 570, top: 20 };

    expect(result.slots).toHaveLength(4);
    for (const slot of result.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(safeRect.left);
      expect(slot.y).toBeGreaterThanOrEqual(safeRect.top);
      expect(slot.x + slot.width).toBeLessThanOrEqual(safeRect.right);
      expect(slot.y + slot.height).toBeLessThanOrEqual(safeRect.bottom);
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
    expect(result.effectiveSizePx).toBe(79);
    expect(video).toEqual(originalVideo);
    expect(viewport).toEqual(originalViewport);
  });
});

describe("overlay layout resolver", () => {
  it.each([
    ["compact", 3, 11, 14, 116],
    ["compact", 5, 11, 14, 186],
    ["compact", 8, 11, 14, 291],
    ["normal", 3, 13, 16, 128],
    ["normal", 5, 13, 16, 206],
    ["normal", 8, 13, 16, 323],
    ["large", 3, 15, 19, 143],
    ["large", 5, 15, 19, 231],
    ["large", 8, 15, 19, 363],
  ] as const)(
    "derives exact chat metrics for %s text at %i messages",
    (textScale, maxMessages, fontSizePx, lineHeightPx, height) => {
      const definition = getDefaultOverlayLayoutDefinition();
      const result = resolveOverlayLayout(
        { ...definition, chat: { ...definition.chat, maxMessages, textScale } },
        { cameraCount: 0, reservedRects: [], viewport },
      );

      expect(result.chat.effectiveMaxMessages).toBe(maxMessages);
      expect(result.chat.fontSizePx).toBe(fontSizePx);
      expect(result.chat.lineHeightPx).toBe(lineHeightPx);
      expect(result.chat.rect.height).toBe(height);
    },
  );

  it("moves chat to the nearest free grid position without moving the camera anchor", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [{ x: 0, y: 650, width: 1280, height: 70 }],
      viewport,
    });

    expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
    expect(result.video.leaderSide).toBe(definition.video.leaderSide);
  });

  it("uses temporary compact fallback without mutating preferences", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const snapshot = structuredClone(definition);
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [],
      viewport: {
        height: 360,
        safeInsets: { bottom: 40, left: 8, right: 8, top: 8 },
        width: 640,
      },
    });

    expect(definition).toEqual(snapshot);
    expect(result.chat.effectiveMaxMessages).toBeLessThanOrEqual(definition.chat.maxMessages);
    expect(result.video.effectiveSizeStep).toBeLessThanOrEqual(definition.video.sizeStep);
    expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
  });

  it("compacts chat before reducing the stored camera size", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [],
      viewport: {
        height: 200,
        safeInsets: { bottom: 8, left: 8, right: 8, top: 8 },
        width: 640,
      },
    });

    expect(result.chat.effectiveMaxMessages).toBe(3);
    expect(result.video.effectiveSizeStep).toBe(definition.video.sizeStep);
  });

  it("reduces the camera size step when the selected group exceeds the safe width", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [],
      viewport: {
        height: 600,
        safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
        width: 300,
      },
    });

    expect(result.video.effectiveSizeStep).toBe(0);
    expect(result.video.slots).toHaveLength(4);
    for (const slot of result.video.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + slot.width).toBeLessThanOrEqual(300);
      expect(slot.y + slot.height).toBeLessThanOrEqual(600);
    }
  });

  it("selects the nearest unblocked chat cell by Manhattan distance", () => {
    const definition = createCompactChatDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 0,
      reservedRects: [
        { height: 1, width: 300, x: 500, y: 601 },
        blockChatGridCell(5, 2),
        blockChatGridCell(5, 4),
      ],
      viewport: selectionViewport,
    });

    expect(result.chat.rect).toMatchObject({ x: 500, y: 200 });
  });

  it("breaks equal-distance chat placement ties by y before x", () => {
    const definition = createCompactChatDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 0,
      reservedRects: [blockChatGridCell(5, 3)],
      viewport: selectionViewport,
    });

    expect(result.chat.rect).toMatchObject({ x: 500, y: 400 });
  });

  it("breaks equal-distance and y chat placement ties by x", () => {
    const definition = createCompactChatDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 0,
      reservedRects: [
        blockChatRow(0),
        blockChatRow(1),
        blockChatRow(2),
        blockChatRow(4),
        blockChatRow(5),
        { height: 1, width: 300, x: 500, y: 601 },
      ],
      viewport: selectionViewport,
    });

    expect(result.chat.rect).toMatchObject({ x: 200, y: 600 });
  });

  it("returns a finite clamped minimum fallback for impossible reserved geometry", () => {
    const defaultDefinition = getDefaultOverlayLayoutDefinition();
    const definition = {
      ...defaultDefinition,
      chat: { ...defaultDefinition.chat, position: { x: 0, y: 7 } },
    };
    const snapshot = structuredClone(definition);
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [{ x: 0, y: 0, width: 640, height: 360 }],
      viewport: {
        height: 360,
        safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
        width: 640,
      },
    });

    expect(definition).toEqual(snapshot);
    expect(result.chat.effectiveMaxMessages).toBe(3);
    expect(result.video.effectiveSizeStep).toBe(0);
    expect(result.chat.rect.x).toBeGreaterThanOrEqual(0);
    expect(result.chat.rect.y).toBeGreaterThanOrEqual(0);
    expect(result.chat.rect.x + result.chat.rect.width).toBeLessThanOrEqual(640);
    expect(result.chat.rect.y + result.chat.rect.height).toBeLessThanOrEqual(360);
    expect(Object.values(result.chat.rect).every(Number.isFinite)).toBe(true);
    expect(Object.values(result.video.bounds).every(Number.isFinite)).toBe(true);
  });

  it("returns finite geometry for an invalid viewport", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const result = resolveOverlayLayout(definition, {
      cameraCount: 4,
      reservedRects: [],
      viewport: {
        height: Number.NaN,
        safeInsets: { bottom: -1, left: Number.NaN, right: 0, top: 0 },
        width: 0,
      },
    });

    for (const value of Object.values(result.chat.rect)) expect(Number.isFinite(value)).toBe(true);
    for (const value of Object.values(result.video.bounds)) expect(Number.isFinite(value)).toBe(true);
  });
});

const selectionViewport = {
  height: 1600,
  safeInsets: { bottom: 0, left: 0, right: 0, top: 0 },
  width: 1200,
};

function createCompactChatDefinition() {
  const definition = getDefaultOverlayLayoutDefinition();
  return {
    ...definition,
    chat: {
      ...definition.chat,
      maxMessages: 3 as const,
      position: { x: 5, y: 3 },
      textScale: "compact" as const,
      width: 3,
    },
  };
}

function blockChatGridCell(x: number, y: number) {
  return { height: 1, width: 1, x: x * 100 + 1, y: y * 200 + 1 };
}

function blockChatRow(y: number) {
  return { height: 1, width: 1200, x: 0, y: y * 200 + 1 };
}
