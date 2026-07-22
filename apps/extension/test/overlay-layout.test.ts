import { describe, expect, it } from "vitest";
import {
  DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
  getOverlayChromePlacement,
  shouldShowCameraStack,
} from "../src/overlay-layout";

describe("overlay layout", () => {
  it("uses the edge margin when the player chrome is hidden", () => {
    expect(
      getOverlayChromePlacement({
        controlsVisible: false,
        launcher: { rightPx: 10, topPx: 13 },
        panel: { rightPx: 10, topPx: 51 },
        safeInsets: { bottomPx: 126, leftPx: 0, rightPx: 0, topPx: 0 },
      }),
    ).toEqual({
      miniPanelBottomReservePx: DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
      miniPanelRightPx: 10,
      miniPanelTopPx: 51,
      topBubbleRightPx: 10,
      topBubbleTopPx: 13,
    });
  });

  it("keeps the mini panel above visible provider controls", () => {
    expect(
      getOverlayChromePlacement({
        controlsVisible: true,
        launcher: { rightPx: 10, topPx: 13 },
        panel: { rightPx: 10, topPx: 51 },
        safeInsets: { bottomPx: 126, leftPx: 0, rightPx: 0, topPx: 0 },
      }),
    ).toEqual({
      miniPanelBottomReservePx: 126,
      miniPanelRightPx: 10,
      miniPanelTopPx: 51,
      topBubbleRightPx: 10,
      topBubbleTopPx: 13,
    });
  });

  it("keeps launcher and panel anchors independent", () => {
    expect(
      getOverlayChromePlacement({
        controlsVisible: true,
        launcher: { rightPx: 118, topPx: 12 },
        panel: { rightPx: 10, topPx: 50 },
        safeInsets: { bottomPx: 68, leftPx: 0, rightPx: 0, topPx: 0 },
      }),
    ).toEqual({
      miniPanelBottomReservePx: 68,
      miniPanelRightPx: 10,
      miniPanelTopPx: 50,
      topBubbleRightPx: 118,
      topBubbleTopPx: 12,
    });
  });

  it("normalizes invalid measurements instead of emitting broken CSS values", () => {
    expect(
      getOverlayChromePlacement({
        controlsVisible: true,
        launcher: { rightPx: Number.NaN, topPx: Number.POSITIVE_INFINITY },
        panel: { rightPx: Number.NaN, topPx: Number.NEGATIVE_INFINITY },
        safeInsets: { bottomPx: Number.NaN, leftPx: 0, rightPx: 0, topPx: 0 },
      }),
    ).toEqual({
      miniPanelBottomReservePx: DEFAULT_MINI_PANEL_BOTTOM_RESERVE_PX,
      miniPanelRightPx: 10,
      miniPanelTopPx: 48,
      topBubbleRightPx: 10,
      topBubbleTopPx: 10,
    });
  });

  it("keeps remote camera bubbles visible when the local camera toggle is off", () => {
    expect(
      shouldShowCameraStack({
        cameraParticipantCount: 1,
        p2pSessionActive: true,
      }),
    ).toBe(true);
  });

  it("hides camera bubbles when no participant is publishing camera", () => {
    expect(
      shouldShowCameraStack({
        cameraParticipantCount: 0,
        p2pSessionActive: true,
      }),
    ).toBe(false);
  });
});
