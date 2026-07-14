import {
  getGhostCamGapPx,
  getResponsiveGhostCamSizePx,
} from "./ghost-cam-size";
import {
  OVERLAY_LAYOUT_GRID_COLUMNS,
  OVERLAY_LAYOUT_GRID_ROWS,
  type OverlayLayoutCameraSizeStep,
  type OverlayLayoutDefinition,
  type OverlayLayoutLeaderSide,
} from "./overlay-layout-model";

const MAXIMUM_CAMERA_COUNT = 4;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayLayoutSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface OverlayLayoutViewport {
  width: number;
  height: number;
  safeInsets: OverlayLayoutSafeInsets;
}

export interface ResolvedVideoLayout {
  bounds: PixelRect;
  effectiveSizePx: number;
  effectiveSizeStep: OverlayLayoutCameraSizeStep;
  leaderSide: OverlayLayoutLeaderSide;
  slots: PixelRect[];
}

export function resolveVideoLayout(
  video: OverlayLayoutDefinition["video"],
  viewport: OverlayLayoutViewport,
  cameraCount: number,
  maximumSizeStep: OverlayLayoutCameraSizeStep = video.sizeStep,
): ResolvedVideoLayout {
  const safeRect = resolveSafeRect(viewport);
  const occupiedCount = clampInteger(cameraCount, 0, MAXIMUM_CAMERA_COUNT);
  const storedSizeStep = clampInteger(video.sizeStep, 0, 3) as OverlayLayoutCameraSizeStep;
  const sizeStepCap = clampInteger(maximumSizeStep, 0, 3) as OverlayLayoutCameraSizeStep;
  const effectiveSizeStep = Math.min(
    storedSizeStep,
    sizeStepCap,
  ) as OverlayLayoutCameraSizeStep;
  const effectiveSizePx = getResponsiveGhostCamSizePx(effectiveSizeStep, {
    cameraCount: occupiedCount,
    containerHeightPx: finiteNonNegative(viewport.height),
    containerWidthPx: finiteNonNegative(viewport.width),
  });

  if (occupiedCount === 0) {
    return {
      bounds: { height: 0, width: 0, x: 0, y: 0 },
      effectiveSizePx,
      effectiveSizeStep,
      leaderSide: video.leaderSide,
      slots: [],
    };
  }

  const gapPx = getGhostCamGapPx(effectiveSizeStep);
  const leaderCenter = {
    x: safeRect.x +
      ((clampInteger(video.anchor.x, 0, OVERLAY_LAYOUT_GRID_COLUMNS - 1) + 0.5) /
        OVERLAY_LAYOUT_GRID_COLUMNS) *
        safeRect.width,
    y: safeRect.y +
      ((clampInteger(video.anchor.y, 0, OVERLAY_LAYOUT_GRID_ROWS - 1) + 0.5) /
        OVERLAY_LAYOUT_GRID_ROWS) *
        safeRect.height,
  };
  const followerDirection = video.leaderSide === "left" ? 1 : -1;
  const slots = Array.from({ length: occupiedCount }, (_, index): PixelRect => ({
    height: effectiveSizePx,
    width: effectiveSizePx,
    x:
      leaderCenter.x - effectiveSizePx / 2 +
      followerDirection * index * (effectiveSizePx + gapPx),
    y: leaderCenter.y - effectiveSizePx / 2,
  }));
  const initialBounds = getBounds(slots);
  const offsetX = resolveAxisTranslation(
    initialBounds.x,
    initialBounds.width,
    safeRect.x,
    safeRect.width,
  );
  const offsetY = resolveAxisTranslation(
    initialBounds.y,
    initialBounds.height,
    safeRect.y,
    safeRect.height,
  );
  const translatedSlots = slots.map((slot) => ({
    ...slot,
    x: slot.x + offsetX,
    y: slot.y + offsetY,
  }));

  return {
    bounds: getBounds(translatedSlots),
    effectiveSizePx,
    effectiveSizeStep,
    leaderSide: video.leaderSide,
    slots: translatedSlots,
  };
}

function resolveSafeRect(viewport: OverlayLayoutViewport): PixelRect {
  const width = finiteNonNegative(viewport.width);
  const height = finiteNonNegative(viewport.height);
  const left = Math.min(width, finiteNonNegative(viewport.safeInsets.left));
  const top = Math.min(height, finiteNonNegative(viewport.safeInsets.top));
  const right = Math.max(left, width - finiteNonNegative(viewport.safeInsets.right));
  const bottom = Math.max(top, height - finiteNonNegative(viewport.safeInsets.bottom));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function getBounds(rects: PixelRect[]): PixelRect {
  if (rects.length === 0) {
    return { height: 0, width: 0, x: 0, y: 0 };
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}

function resolveAxisTranslation(
  groupStart: number,
  groupSize: number,
  safeStart: number,
  safeSize: number,
): number {
  const minimumOffset = safeStart - groupStart;
  const maximumOffset = safeStart + safeSize - (groupStart + groupSize);

  if (minimumOffset <= maximumOffset) {
    return Math.max(minimumOffset, Math.min(maximumOffset, 0));
  }

  return (minimumOffset + maximumOffset) / 2;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finiteValue = Number.isFinite(value) ? value : minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(finiteValue)));
}
