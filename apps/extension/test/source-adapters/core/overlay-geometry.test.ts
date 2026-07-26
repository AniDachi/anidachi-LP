import { describe, expect, it, vi } from "vitest";
import { Html5VideoAdapter } from "../../../src/source-adapters/core/html5-video-adapter";
import {
  arePlayerOverlayGeometriesEqual,
  DEFAULT_PLAYER_OVERLAY_GEOMETRY,
  normalizePlayerOverlayGeometry,
  type PlayerOverlayGeometry,
} from "../../../src/source-adapters/core/overlay-geometry";

describe("player overlay geometry", () => {
  it("normalizes finite values to non-negative integer viewport geometry", () => {
    expect(
      normalizePlayerOverlayGeometry({
        ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
        viewport: { widthPx: 960.4, heightPx: 540.4 },
        safeInsets: { topPx: -2, rightPx: 4.6, bottomPx: 86.4, leftPx: Number.NaN },
      }),
    ).toEqual({
      controlsVisible: false,
      viewport: { widthPx: 960, heightPx: 540 },
      safeInsets: { topPx: 0, rightPx: 5, bottomPx: 86, leftPx: 0 },
      launcher: { topPx: 10, rightPx: 10 },
      panel: { topPx: 48, rightPx: 10 },
    });
  });

  it("clamps insets and anchors to a usable viewport", () => {
    expect(
      normalizePlayerOverlayGeometry({
        controlsVisible: true,
        viewport: { widthPx: 100, heightPx: 50 },
        safeInsets: { topPx: 60, rightPx: 120, bottomPx: 75, leftPx: 150 },
        launcher: { topPx: 80, rightPx: 200 },
        panel: { topPx: 90, rightPx: 300 },
      }),
    ).toEqual({
      controlsVisible: true,
      viewport: { widthPx: 100, heightPx: 50 },
      safeInsets: { topPx: 50, rightPx: 100, bottomPx: 50, leftPx: 100 },
      launcher: { topPx: 50, rightPx: 100 },
      panel: { topPx: 50, rightPx: 100 },
    });
  });

  it("uses safe defaults for invalid values without collapsing zero-sized defaults", () => {
    expect(
      normalizePlayerOverlayGeometry({
        controlsVisible: true,
        viewport: { widthPx: Number.POSITIVE_INFINITY, heightPx: Number.NaN },
        safeInsets: {
          topPx: Number.POSITIVE_INFINITY,
          rightPx: Number.NaN,
          bottomPx: Number.NEGATIVE_INFINITY,
          leftPx: Number.NaN,
        },
        launcher: { topPx: Number.NaN, rightPx: Number.POSITIVE_INFINITY },
        panel: { topPx: Number.NEGATIVE_INFINITY, rightPx: Number.NaN },
      }),
    ).toEqual({
      ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
      controlsVisible: true,
      viewport: { widthPx: 0, heightPx: 0 },
    });
  });

  it("returns a structural clone", () => {
    const geometry = normalizePlayerOverlayGeometry(DEFAULT_PLAYER_OVERLAY_GEOMETRY);

    expect(geometry).toEqual(DEFAULT_PLAYER_OVERLAY_GEOMETRY);
    expect(geometry).not.toBe(DEFAULT_PLAYER_OVERLAY_GEOMETRY);
    expect(geometry.viewport).not.toBe(DEFAULT_PLAYER_OVERLAY_GEOMETRY.viewport);
    expect(geometry.safeInsets).not.toBe(DEFAULT_PLAYER_OVERLAY_GEOMETRY.safeInsets);
    expect(geometry.launcher).not.toBe(DEFAULT_PLAYER_OVERLAY_GEOMETRY.launcher);
    expect(geometry.panel).not.toBe(DEFAULT_PLAYER_OVERLAY_GEOMETRY.panel);
  });

  it("compares normalized geometry values", () => {
    const normalized = normalizePlayerOverlayGeometry({
      controlsVisible: true,
      viewport: { widthPx: 100.2, heightPx: 50.2 },
      safeInsets: { topPx: 10.2, rightPx: 20.2, bottomPx: 30.2, leftPx: 40.2 },
      launcher: { topPx: 5.2, rightPx: 6.2 },
      panel: { topPx: 7.2, rightPx: 8.2 },
    });
    const equivalent: PlayerOverlayGeometry = {
      controlsVisible: true,
      viewport: { widthPx: 100, heightPx: 50 },
      safeInsets: { topPx: 10, rightPx: 20, bottomPx: 30, leftPx: 40 },
      launcher: { topPx: 5, rightPx: 6 },
      panel: { topPx: 7, rightPx: 8 },
    };

    expect(arePlayerOverlayGeometriesEqual(normalized, equivalent)).toBe(true);
    expect(
      arePlayerOverlayGeometriesEqual(normalized, {
        ...equivalent,
        launcher: { ...equivalent.launcher, topPx: 6 },
      }),
    ).toBe(false);
  });

  it("provides side-effect-free generic HTML5 geometry defaults", () => {
    const video = document.createElement("video");
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ width: 960.4, height: 540.4 }) as DOMRect;
    const adapter = new Html5VideoAdapter(video, container);
    const listener = vi.fn();

    expect(adapter.getOverlayGeometry()).toEqual({
      ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
      viewport: { widthPx: 960, heightPx: 540 },
    });

    const unsubscribe = adapter.subscribeOverlayGeometry(listener);
    unsubscribe();
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});
