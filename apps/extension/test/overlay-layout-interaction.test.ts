import { describe, expect, it } from "vitest";
import { getDefaultOverlayLayoutDefinition } from "../src/overlay-layout-model";
import {
  cloneOverlayLayoutDefinition,
  getOverlayLayoutDragOffsetFromOrigin,
  getOverlayLayoutGridPointer,
  getOverlayLayoutLeaderSide,
  moveOverlayLayoutObjectByDelta,
  moveOverlayLayoutObjectFromPointer,
  overlayLayoutDefinitionsEqual,
} from "../src/overlay-layout-interaction";

describe("overlay layout interaction", () => {
  it("maps client coordinates into continuous clamped grid boundaries", () => {
    const bounds = { height: 200, left: 100, top: 50, width: 300 };

    expect(getOverlayLayoutGridPointer(250, 150, bounds)).toEqual({ x: 6, y: 4 });
    expect(getOverlayLayoutGridPointer(-100, 500, bounds)).toEqual({ x: 0, y: 8 });
  });

  it("returns a finite zero pointer for invalid or zero bounds", () => {
    for (const bounds of [
      { height: 0, left: 0, top: 0, width: 100 },
      { height: 100, left: 0, top: 0, width: 0 },
      { height: Number.NaN, left: 0, top: 0, width: 100 },
      { height: 100, left: Number.POSITIVE_INFINITY, top: 0, width: 100 },
    ]) {
      const pointer = getOverlayLayoutGridPointer(10, 10, bounds);

      expect(pointer).toEqual({ x: 0, y: 0 });
      expect(Object.values(pointer).every(Number.isFinite)).toBe(true);
    }
  });

  it("uses the video leader center and chat top-left for grab offsets", () => {
    expect(getOverlayLayoutDragOffsetFromOrigin(
      { x: 9.25, y: 3.25 },
      { x: 8.5, y: 2.5 },
    )).toEqual({
      x: 0.75,
      y: 0.75,
    });
    expect(getOverlayLayoutDragOffsetFromOrigin(
      { x: 3.25, y: 6.5 },
      { x: 3, y: 5 },
    )).toEqual({
      x: 0.25,
      y: 1.5,
    });
  });

  it("preserves the video grab offset when snapping a pointer move", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const offset = getOverlayLayoutDragOffsetFromOrigin(
      { x: 11.75, y: 6.25 },
      { x: 11.5, y: 6.5 },
    );

    const moved = moveOverlayLayoutObjectFromPointer(
      definition,
      "video",
      { x: 7.75, y: 3.25 },
      offset,
    );

    expect(moved.video.anchor).toEqual({ x: 7, y: 3 });
    expect(moved.video.leaderSide).toBe("right");
  });

  it("preserves the chat grab offset when snapping a pointer move", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const offset = getOverlayLayoutDragOffsetFromOrigin(
      { x: 1.25, y: 4.5 },
      { x: 0, y: 4 },
    );

    const moved = moveOverlayLayoutObjectFromPointer(
      definition,
      "chat",
      { x: 7.25, y: 2.5 },
      offset,
    );

    expect(moved.chat.position).toEqual({ x: 6, y: 2 });
  });

  it("clamps grid moves and chat width without mutating the input", () => {
    const definition = {
      video: { anchor: { x: 1, y: 1 }, leaderSide: "left" as const, sizeStep: 3 as const },
      chat: {
        position: { x: 6, y: 4 },
        width: 6,
        textScale: "large" as const,
        maxMessages: 8 as const,
      },
    };
    const snapshot = structuredClone(definition);

    const video = moveOverlayLayoutObjectByDelta(definition, "video", -99, 99);
    const chat = moveOverlayLayoutObjectByDelta(definition, "chat", 99, -99);

    expect(video.video.anchor).toEqual({ x: 0, y: 7 });
    expect(chat.chat.position).toEqual({ x: 6, y: 0 });
    expect(definition).toEqual(snapshot);
  });

  it("switches leader side only outside the two-cell center hysteresis band", () => {
    expect(getOverlayLayoutLeaderSide(4, "right")).toBe("left");
    expect(getOverlayLayoutLeaderSide(7, "left")).toBe("right");
    expect(getOverlayLayoutLeaderSide(5, "left")).toBe("left");
    expect(getOverlayLayoutLeaderSide(6, "right")).toBe("right");
  });

  it("applies leader hysteresis to pointer and keyboard video movement", () => {
    const definition = {
      ...getDefaultOverlayLayoutDefinition(),
      video: { anchor: { x: 4, y: 3 }, leaderSide: "left" as const, sizeStep: 1 as const },
    };

    expect(moveOverlayLayoutObjectByDelta(definition, "video", 1, 0).video).toMatchObject({
      anchor: { x: 5, y: 3 },
      leaderSide: "left",
    });
    expect(moveOverlayLayoutObjectByDelta(definition, "video", 3, 0).video).toMatchObject({
      anchor: { x: 7, y: 3 },
      leaderSide: "right",
    });
  });

  it("clones definitions and compares their value without sharing nested state", () => {
    const definition = getDefaultOverlayLayoutDefinition();
    const clone = cloneOverlayLayoutDefinition(definition);

    expect(overlayLayoutDefinitionsEqual(clone, definition)).toBe(true);
    expect(clone).not.toBe(definition);
    expect(clone.video.anchor).not.toBe(definition.video.anchor);
    expect(clone.chat.position).not.toBe(definition.chat.position);

    clone.chat.position.x = 1;
    expect(overlayLayoutDefinitionsEqual(clone, definition)).toBe(false);
    expect(definition.chat.position.x).toBe(0);
  });
});
