import { describe, expect, it } from "vitest";
import {
  createOverlayLayoutRuntimeContext,
  getOverlayLayoutReservedRects,
  getOverlayLayoutRuntimeStyles,
} from "../src/overlay-layout-runtime";

describe("overlay layout runtime context", () => {
  it("builds safe insets and defensively copies reserved rectangles", () => {
    const reservedRects = [{ height: 40, width: 120, x: 16, y: 24 }];
    const context = createOverlayLayoutRuntimeContext({
      cameraCount: 2,
      controlsBottomInsetPx: 48,
      height: 720,
      reservedRects,
      width: 1280,
    });

    expect(context).toEqual({
      cameraCount: 2,
      reservedRects: [{ height: 40, width: 120, x: 16, y: 24 }],
      viewport: {
        height: 720,
        safeInsets: { bottom: 48, left: 12, right: 12, top: 12 },
        width: 1280,
      },
    });
    expect(context.reservedRects).not.toBe(reservedRects);
    expect(context.reservedRects[0]).not.toBe(reservedRects[0]);

    reservedRects[0]!.x = 999;
    expect(context.reservedRects[0]!.x).toBe(16);
  });

  it("uses supplied safe padding when controls need less bottom space", () => {
    const context = createOverlayLayoutRuntimeContext({
      cameraCount: 0,
      controlsBottomInsetPx: 8,
      height: 360,
      safePaddingPx: 20,
      width: 640,
    });

    expect(context.viewport.safeInsets).toEqual({ bottom: 20, left: 20, right: 20, top: 20 });
  });

  it.each([
    { cameraCount: -2, expected: 0, label: "clamps negative counts to zero" },
    { cameraCount: 9, expected: 4, label: "clamps counts above four" },
    { cameraCount: 2.6, expected: 3, label: "rounds fractional counts before clamping" },
  ])("$label", ({ cameraCount, expected }) => {
    const context = createOverlayLayoutRuntimeContext({
      cameraCount,
      controlsBottomInsetPx: 0,
      height: 360,
      width: 640,
    });

    expect(context.cameraCount).toBe(expected);
  });
});

describe("overlay layout reserved rectangles", () => {
  it("converts right-anchored account and rail areas to clamped local rectangles in order", () => {
    const input = {
      accountBubble: { height: 20, right: 10, top: 12, width: 30 },
      roomRail: { height: 50, right: 90, top: 75, width: 50 },
      viewport: { height: 80, width: 100 },
    };

    const reservedRects = getOverlayLayoutReservedRects(input);

    expect(reservedRects).toEqual([
      { height: 20, width: 30, x: 60, y: 12 },
      { height: 50, width: 50, x: 0, y: 30 },
    ]);

    reservedRects[0]!.x = 999;
    const nextReservedRects = getOverlayLayoutReservedRects(input);
    expect(nextReservedRects).toEqual([
      { height: 20, width: 30, x: 60, y: 12 },
      { height: 50, width: 50, x: 0, y: 30 },
    ]);
    expect(nextReservedRects).not.toBe(reservedRects);
    expect(nextReservedRects[0]).not.toBe(reservedRects[0]);
  });

  it("returns no rectangles for missing areas and makes malformed measurements finite", () => {
    expect(getOverlayLayoutReservedRects({ viewport: { height: 80, width: 100 } })).toEqual([]);

    expect(getOverlayLayoutReservedRects({
      accountBubble: {
        height: Number.NEGATIVE_INFINITY,
        right: Number.POSITIVE_INFINITY,
        top: -5,
        width: Number.NaN,
      },
      viewport: { height: Number.NaN, width: Number.POSITIVE_INFINITY },
    })).toEqual([{ height: 0, width: 0, x: 0, y: 0 }]);
  });
});

describe("overlay layout runtime styles", () => {
  it("maps a left leader, bubble gap, and chat typography to pixel custom properties", () => {
    expect(getOverlayLayoutRuntimeStyles({
      chat: {
        effectiveMaxMessages: 5,
        fontSizePx: 13,
        lineHeightPx: 16,
        rect: { height: 186, width: 300, x: 24, y: 108 },
      },
      video: {
        bounds: { height: 80, width: 176, x: 900, y: 48 },
        effectiveSizePx: 80,
        effectiveSizeStep: 1,
        leaderSide: "left",
        slots: [
          { height: 80, width: 80, x: 900, y: 48 },
          { height: 80, width: 80, x: 996, y: 48 },
        ],
      },
    })).toEqual({
      "--cam-bubble-gap": "16px",
      "--cam-bubble-size": "80px",
      "--cam-stack-direction": "row",
      "--cam-stack-left": "900px",
      "--cam-stack-top": "48px",
      "--live-chat-font-size": "13px",
      "--live-chat-height": "186px",
      "--live-chat-left": "24px",
      "--live-chat-line-height": "16px",
      "--live-chat-top": "108px",
      "--live-chat-width": "300px",
    });
  });

  it("uses row-reverse for a right leader and zero gap for one slot", () => {
    const styles = getOverlayLayoutRuntimeStyles({
      chat: {
        effectiveMaxMessages: 3,
        fontSizePx: 11,
        lineHeightPx: 14,
        rect: { height: 116, width: 200, x: 0, y: 0 },
      },
      video: {
        bounds: { height: 72, width: 72, x: 1100, y: 40 },
        effectiveSizePx: 72,
        effectiveSizeStep: 0,
        leaderSide: "right",
        slots: [{ height: 72, width: 72, x: 1100, y: 40 }],
      },
    });

    expect(styles["--cam-stack-direction"]).toBe("row-reverse");
    expect(styles["--cam-bubble-gap"]).toBe("0px");
  });

  it("falls back to finite nonnegative pixel values for malformed resolved geometry", () => {
    const styles = getOverlayLayoutRuntimeStyles({
      chat: {
        fontSizePx: Number.POSITIVE_INFINITY,
        lineHeightPx: -1,
        rect: { height: Number.NaN, width: -1, x: Number.NEGATIVE_INFINITY, y: -5 },
      },
      video: {
        bounds: { height: Number.NaN, width: -1, x: Number.POSITIVE_INFINITY, y: -1 },
        effectiveSizePx: Number.NaN,
        leaderSide: "invalid",
        slots: [
          { height: 10, width: 10, x: Number.NaN, y: 0 },
          { height: 10, width: 10, x: Number.POSITIVE_INFINITY, y: 0 },
        ],
      },
    } as never);

    expect(styles).toEqual({
      "--cam-bubble-gap": "0px",
      "--cam-bubble-size": "0px",
      "--cam-stack-direction": "row-reverse",
      "--cam-stack-left": "0px",
      "--cam-stack-top": "0px",
      "--live-chat-font-size": "0px",
      "--live-chat-height": "0px",
      "--live-chat-left": "0px",
      "--live-chat-line-height": "0px",
      "--live-chat-top": "0px",
      "--live-chat-width": "0px",
    });
  });
});
